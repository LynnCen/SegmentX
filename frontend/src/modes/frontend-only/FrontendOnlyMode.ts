import { BaseMode } from '@/modes/base/BaseMode'
import type { ModeInfo, Point, MaskResult } from '@/core/types'
import { MODE_INFO, MODEL_REGISTRY } from '@/core/types'
import * as ort from 'onnxruntime-web'

/**
 * 纯前端模式
 * Encoder + Decoder 都在浏览器通过 ONNX Runtime Web (WASM) 运行
 *
 * 流程:
 *  1. 加载 Encoder ONNX (~95MB) + Decoder ONNX (~16MB)
 *  2. 用户上传图片 → Encoder 生成 Embedding (浏览器内, ~3-10s)
 *  3. 每次点击 → Decoder 解码 Mask (~200ms)
 *
 * 优点: 完全离线, 无需后端
 * 缺点: 首次加载慢, Encoder 推理慢
 */
export class FrontendOnlyMode extends BaseMode {
  info: ModeInfo = MODE_INFO.frontend

  private encoderSession: ort.InferenceSession | null = null
  private decoderSession: ort.InferenceSession | null = null
  private cachedEmbedding: ort.Tensor | null = null
  private originalSize: [number, number] = [0, 0] // [H, W]
  private _isReady = false

  get isReady(): boolean {
    return this._isReady
  }

  async initialize(modelId: string): Promise<void> {
    const model = MODEL_REGISTRY[modelId]
    if (!model?.onnxPaths?.encoder || !model?.onnxPaths?.decoder) {
      throw new Error(`模型 ${modelId} 不支持前端模式 (无 ONNX 文件)`)
    }

    console.log(`[纯前端] 加载模型 ${model.name}...`)
    console.log(`[纯前端]   Encoder: ${model.onnxPaths.encoder}`)
    console.log(`[纯前端]   Decoder: ${model.onnxPaths.decoder}`)

    // 先检查模型文件是否存在
    await this.checkModelFile(model.onnxPaths.encoder, 'Encoder')
    await this.checkModelFile(model.onnxPaths.decoder, 'Decoder')

    // 设置 WASM — 使用 CDN 避免 Vite 的 import.meta.url 解析问题
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/'
    ort.env.wasm.numThreads = 1

    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }

    const startTime = performance.now()

    // 加载 Encoder (大模型, ~95MB, 可能需要几秒)
    console.log(`[纯前端] ⏳ 加载 Encoder (~95MB, 请稍候)...`)
    this.encoderSession = await ort.InferenceSession.create(
      model.onnxPaths.encoder,
      options,
    )
    console.log(`[纯前端] ✅ Encoder 加载完成 (${(performance.now() - startTime).toFixed(0)}ms)`)

    // 加载 Decoder (小模型, ~16MB)
    const decoderStart = performance.now()
    this.decoderSession = await ort.InferenceSession.create(
      model.onnxPaths.decoder,
      options,
    )
    console.log(`[纯前端] ✅ Decoder 加载完成 (${(performance.now() - decoderStart).toFixed(0)}ms)`)

    console.log(`[纯前端] ✅ 模型就绪, 总耗时: ${(performance.now() - startTime).toFixed(0)}ms`)
    this._isReady = true
  }

  async setImage(imageSource: string | ImageData): Promise<{ timeMs: number }> {
    if (!this.encoderSession) throw new Error('模型未初始化')

    const startTime = performance.now()

    // 1. 获取 ImageData
    let imageData: ImageData
    if (typeof imageSource === 'string') {
      imageData = await this.loadImageFromUrl(imageSource)
    } else {
      imageData = imageSource
    }

    // 记录原始尺寸 [H, W]
    this.originalSize = [imageData.height, imageData.width]

    // 2. 预处理: resize → 1024x1024, 归一化, BCHW
    const inputTensor = this.preprocess(imageData)

    // 3. 运行 Encoder — 输入名 "input_image" (与导出脚本一致)
    console.log(`[纯前端] ⏳ Encoder 推理中 (${imageData.width}x${imageData.height})...`)
    const result = await this.encoderSession.run({ input_image: inputTensor })
    this.cachedEmbedding = result['image_embeddings'] as ort.Tensor

    const timeMs = performance.now() - startTime
    console.log(
      `[纯前端] ✅ Embedding 就绪: shape=${this.cachedEmbedding.dims.join('x')}, ${timeMs.toFixed(0)}ms`,
    )

    return { timeMs }
  }

  async segment(points: Point[]): Promise<MaskResult> {
    if (!this.decoderSession || !this.cachedEmbedding) {
      throw new Error('请先设置图片')
    }

    const startTime = performance.now()

    // 1. 坐标变换: 原图坐标 → SAM 1024 空间
    const [origH, origW] = this.originalSize
    const scale = 1024 / Math.max(origH, origW)

    // 2. 构建点坐标 + padding point (ONNX Decoder 要求)
    const numPoints = points.length + 1
    const coordsData = new Float32Array(numPoints * 2)
    const labelsData = new Float32Array(numPoints)

    for (let i = 0; i < points.length; i++) {
      coordsData[i * 2] = points[i]!.x * scale
      coordsData[i * 2 + 1] = points[i]!.y * scale
      labelsData[i] = points[i]!.type // 1=前景, 0=背景
    }
    // padding point (必需)
    coordsData[(numPoints - 1) * 2] = 0
    coordsData[(numPoints - 1) * 2 + 1] = 0
    labelsData[numPoints - 1] = -1

    // 3. 构建 ONNX 输入 (与 HybridMode 一致)
    const feeds: Record<string, ort.Tensor> = {
      image_embeddings: this.cachedEmbedding,
      point_coords: new ort.Tensor('float32', coordsData, [1, numPoints, 2]),
      point_labels: new ort.Tensor('float32', labelsData, [1, numPoints]),
      mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
      orig_im_size: new ort.Tensor('float32', new Float32Array([origH, origW]), [2]),
    }

    // 4. ONNX 推理
    const result = await this.decoderSession.run(feeds)

    const masks = result['masks']!.data as Float32Array
    const iouScores = result['iou_predictions']!.data as Float32Array

    // 5. 选最佳 mask
    let bestIdx = 0
    let bestScore = iouScores[0]!
    for (let i = 1; i < iouScores.length; i++) {
      if (iouScores[i]! > bestScore) {
        bestScore = iouScores[i]!
        bestIdx = i
      }
    }

    // 6. 提取最佳 mask → RGBA ImageData (原图尺寸)
    const maskPixels = origH * origW
    const offset = bestIdx * maskPixels
    const rgba = new Uint8ClampedArray(maskPixels * 4)

    for (let i = 0; i < maskPixels; i++) {
      if (masks[offset + i]! > 0) {
        rgba[i * 4] = 30      // R
        rgba[i * 4 + 1] = 144 // G
        rgba[i * 4 + 2] = 255 // B
        rgba[i * 4 + 3] = 128 // A (半透明)
      }
    }

    const timeMs = performance.now() - startTime
    console.log(
      `[纯前端] ✅ Decoder: ${timeMs.toFixed(0)}ms, score=${bestScore.toFixed(4)}, mask=${origW}x${origH}`,
    )

    return {
      mask: new ImageData(rgba, origW, origH),
      score: bestScore,
      timeMs,
    }
  }

  async cleanup(): Promise<void> {
    if (this.encoderSession) {
      await this.encoderSession.release()
    }
    if (this.decoderSession) {
      await this.decoderSession.release()
    }
    this.encoderSession = null
    this.decoderSession = null
    this.cachedEmbedding = null
    this._isReady = false
  }

  // --- 私有方法 ---

  /**
   * 检查模型文件是否存在 (HEAD 请求)
   */
  private async checkModelFile(url: string, name: string): Promise<void> {
    try {
      const resp = await fetch(url, { method: 'HEAD' })
      const contentType = resp.headers.get('content-type') || ''
      // 如果返回 HTML (SPA fallback), 说明文件不存在
      if (!resp.ok || contentType.includes('text/html')) {
        throw new Error(
          `${name} ONNX 文件不存在: ${url}\n` +
          `请运行导出脚本: cd backend && source venv/bin/activate && python ../scripts/export_onnx.py`,
        )
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('ONNX 文件不存在')) {
        throw err
      }
      // fetch 本身失败 (网络等), 继续尝试
      console.warn(`[纯前端] 无法检查文件 ${url}:`, err)
    }
  }

  /**
   * 图片预处理:
   *  1. 缩放到 1024x1024 (保持 SAM 输入要求)
   *  2. 像素归一化 (ImageNet 均值/标准差)
   *  3. 转为 BCHW 格式 Float32 Tensor
   */
  private preprocess(imageData: ImageData): ort.Tensor {
    const targetSize = 1024

    // 缩放到 1024x1024
    const canvas = new OffscreenCanvas(targetSize, targetSize)
    const ctx = canvas.getContext('2d')!
    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(srcCanvas, 0, 0, targetSize, targetSize)

    const resized = ctx.getImageData(0, 0, targetSize, targetSize)

    // ImageNet 归一化 → BCHW
    const mean = [0.485, 0.456, 0.406]
    const std = [0.229, 0.224, 0.225]
    const pixels = targetSize * targetSize
    const float32 = new Float32Array(3 * pixels)

    for (let i = 0; i < pixels; i++) {
      float32[i] = (resized.data[i * 4]! / 255 - mean[0]!) / std[0]!
      float32[pixels + i] = (resized.data[i * 4 + 1]! / 255 - mean[1]!) / std[1]!
      float32[2 * pixels + i] = (resized.data[i * 4 + 2]! / 255 - mean[2]!) / std[2]!
    }

    return new ort.Tensor('float32', float32, [1, 3, targetSize, targetSize])
  }

  private async loadImageFromUrl(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      if (url.startsWith('http')) {
        img.crossOrigin = 'anonymous'
      }
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, img.width, img.height))
      }
      img.onerror = reject
      img.src = url
    })
  }
}
