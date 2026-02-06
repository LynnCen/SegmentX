import { BaseMode } from '@/modes/base/BaseMode'
import type { ModeInfo, Point, MaskResult } from '@/core/types'
import { MODE_INFO, MODEL_REGISTRY } from '@/core/types'
import * as ort from 'onnxruntime-web'

/**
 * 纯前端模式
 * Encoder + Decoder 都在浏览器通过 ONNX.js 运行
 */
export class FrontendOnlyMode extends BaseMode {
  info: ModeInfo = MODE_INFO.frontend

  private encoderSession: ort.InferenceSession | null = null
  private decoderSession: ort.InferenceSession | null = null
  private cachedEmbedding: ort.Tensor | null = null
  private _isReady = false

  get isReady(): boolean {
    return this._isReady
  }

  async initialize(modelId: string): Promise<void> {
    const model = MODEL_REGISTRY[modelId]
    if (!model?.onnxPaths?.encoder || !model?.onnxPaths?.decoder) {
      throw new Error(`模型 ${modelId} 不支持前端模式 (无 ONNX)`)
    }

    console.log(`[纯前端] 加载模型 ${model.name}...`)

    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    }

    const startTime = performance.now()

    this.encoderSession = await ort.InferenceSession.create(
      model.onnxPaths.encoder,
      options,
    )
    console.log(`[纯前端] Encoder 加载完成`)

    this.decoderSession = await ort.InferenceSession.create(
      model.onnxPaths.decoder,
      options,
    )
    console.log(
      `[纯前端] Decoder 加载完成, 总耗时: ${(performance.now() - startTime).toFixed(0)}ms`,
    )

    this._isReady = true
  }

  async setImage(imageSource: string | ImageData): Promise<{ timeMs: number }> {
    if (!this.encoderSession) throw new Error('模型未初始化')

    const startTime = performance.now()

    // 获取 ImageData
    let imageData: ImageData
    if (typeof imageSource === 'string') {
      imageData = await this.loadImageFromUrl(imageSource)
    } else {
      imageData = imageSource
    }

    // 预处理 + 编码
    const inputTensor = this.preprocess(imageData)
    const result = await this.encoderSession.run({ image: inputTensor })
    this.cachedEmbedding = result['image_embeddings'] as ort.Tensor

    const timeMs = performance.now() - startTime
    console.log(`[纯前端] Encoder 耗时: ${timeMs.toFixed(0)}ms`)

    return { timeMs }
  }

  async segment(points: Point[]): Promise<MaskResult> {
    if (!this.decoderSession || !this.cachedEmbedding) {
      throw new Error('请先设置图片')
    }

    const startTime = performance.now()

    const coords = new Float32Array(points.flatMap((p) => [p.x, p.y]))
    const labels = new Float32Array(points.map((p) => p.type))

    const inputs: Record<string, ort.Tensor> = {
      image_embeddings: this.cachedEmbedding,
      point_coords: new ort.Tensor('float32', coords, [1, points.length, 2]),
      point_labels: new ort.Tensor('float32', labels, [1, points.length]),
    }

    const result = await this.decoderSession.run(inputs)
    const masksOutput = result['masks']
    const maskData = masksOutput ? (masksOutput.data as Float32Array) : new Float32Array(256 * 256)

    const timeMs = performance.now() - startTime
    console.log(`[纯前端] Decoder 耗时: ${timeMs.toFixed(0)}ms`)

    const iouOutput = result['iou_predictions']
    const score = iouOutput ? (iouOutput.data as Float32Array)[0] ?? 0 : 0

    return {
      mask: this.postprocess(maskData),
      score,
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

  private preprocess(imageData: ImageData): ort.Tensor {
    const targetSize = 1024

    // 创建 canvas 缩放
    const canvas = new OffscreenCanvas(targetSize, targetSize)
    const ctx = canvas.getContext('2d')!
    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(srcCanvas, 0, 0, targetSize, targetSize)

    const resized = ctx.getImageData(0, 0, targetSize, targetSize)

    // 归一化 (BCHW 格式)
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

  private postprocess(maskData: Float32Array): ImageData {
    const size = 256
    const pixels = size * size
    const rgba = new Uint8ClampedArray(pixels * 4)

    for (let i = 0; i < pixels; i++) {
      const val = (maskData[i] ?? 0) > 0 ? 255 : 0
      rgba[i * 4] = 30      // R
      rgba[i * 4 + 1] = 144 // G
      rgba[i * 4 + 2] = 255 // B
      rgba[i * 4 + 3] = val > 0 ? 128 : 0 // A
    }

    return new ImageData(rgba, size, size)
  }

  private async loadImageFromUrl(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
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
