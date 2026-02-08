import { BaseMode } from '@/modes/base/BaseMode'
import type { ModeInfo, Point, MaskResult } from '@/core/types'
import { MODE_INFO } from '@/core/types'
import { apiClient } from '@/config/api'
import * as ort from 'onnxruntime-web'
import pako from 'pako'

/**
 * 混合模式
 * - 后端: Image Encoder (大模型, 高质量 Embedding)
 * - 前端: Mask Decoder (ONNX, 16MB, 50ms 响应)
 *
 * 流程:
 * 1. 用户上传图片 → 后端生成 Embedding (600ms)
 * 2. Embedding 压缩传到前端缓存
 * 3. 每次点击 → 前端 ONNX Decoder 直接解码 (50ms, 无网络请求!)
 */
export class HybridMode extends BaseMode {
  info: ModeInfo = MODE_INFO.hybrid

  private decoderSession: ort.InferenceSession | null = null
  private cachedEmbedding: Float32Array | null = null
  private originalSize: [number, number] = [0, 0] // [H, W]
  private _isReady = false
  private currentModelId: string = ''

  get isReady(): boolean {
    return this._isReady
  }

  async initialize(modelId: string): Promise<void> {
    this.currentModelId = modelId
    console.log(`[混合模式] 后端模型: ${modelId}, 加载前端 Decoder...`)

    // 显式设置 WASM 文件路径 — 使用 CDN 避免 Vite 的 import.meta.url 解析问题
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.1/dist/'
    // 禁用多线程（避免 SharedArrayBuffer 问题）
    ort.env.wasm.numThreads = 1

    this.decoderSession = await ort.InferenceSession.create(
      '/models/sam_decoder.onnx',
      { executionProviders: ['wasm'] },
    )

    this._isReady = true
    console.log(`[混合模式] ✅ Decoder 加载完成`)
  }

  async setImage(imageSource: string | ImageData): Promise<{ timeMs: number }> {
    const startTime = performance.now()

    const imageUrl =
      typeof imageSource === 'string'
        ? imageSource
        : await this.imageDataToUrl(imageSource)

    console.log(`[混合模式] 请求后端 Embedding...`)
    const response = await apiClient.post<{
      embedding: string
      shape: number[]
      original_size: number[]
      compressed_size: number
    }>('/api/embedding', {
      image_url: imageUrl,
      model: this.currentModelId,
    })

    // 解压 Embedding: base64 → gzip bytes → float32
    const b64 = response.embedding
    const compressed = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const decompressed = pako.inflate(compressed)
    this.cachedEmbedding = new Float32Array(decompressed.buffer)
    this.originalSize = [response.original_size[0]!, response.original_size[1]!]

    const timeMs = performance.now() - startTime
    console.log(
      `[混合模式] ✅ Embedding 就绪: ${response.shape.join('x')}, ` +
      `${(response.compressed_size / 1024).toFixed(0)}KB, ${timeMs.toFixed(0)}ms`,
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

    // 2. 构建点坐标 + 末尾必须加 padding point
    const numPoints = points.length + 1
    const coordsData = new Float32Array(numPoints * 2)
    const labelsData = new Float32Array(numPoints)

    for (let i = 0; i < points.length; i++) {
      coordsData[i * 2] = points[i]!.x * scale
      coordsData[i * 2 + 1] = points[i]!.y * scale
      labelsData[i] = points[i]!.type // 1=前景, 0=背景
    }
    // padding point
    coordsData[(numPoints - 1) * 2] = 0
    coordsData[(numPoints - 1) * 2 + 1] = 0
    labelsData[numPoints - 1] = -1

    // 3. 构建 ONNX 输入
    const feeds: Record<string, ort.Tensor> = {
      image_embeddings: new ort.Tensor('float32', this.cachedEmbedding, [1, 256, 64, 64]),
      point_coords: new ort.Tensor('float32', coordsData, [1, numPoints, 2]),
      point_labels: new ort.Tensor('float32', labelsData, [1, numPoints]),
      mask_input: new ort.Tensor('float32', new Float32Array(1 * 1 * 256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
      orig_im_size: new ort.Tensor('float32', new Float32Array([origH, origW]), [2]),
    }

    // 4. ONNX 推理
    const result = await this.decoderSession.run(feeds)

    const masks = result['masks']!.data as Float32Array    // [1, 4, H, W]
    const iouScores = result['iou_predictions']!.data as Float32Array // [1, 4]

    // 5. 选最佳 mask
    let bestIdx = 0
    let bestScore = iouScores[0]!
    for (let i = 1; i < 4; i++) {
      if (iouScores[i]! > bestScore) {
        bestScore = iouScores[i]!
        bestIdx = i
      }
    }

    // 6. 提取最佳 mask 并转为 RGBA ImageData
    const maskPixels = origH * origW
    const offset = bestIdx * maskPixels
    const rgba = new Uint8ClampedArray(maskPixels * 4)

    for (let i = 0; i < maskPixels; i++) {
      if (masks[offset + i]! > 0) {
        rgba[i * 4] = 30      // R
        rgba[i * 4 + 1] = 144 // G
        rgba[i * 4 + 2] = 255 // B
        rgba[i * 4 + 3] = 128 // A
      }
    }

    const timeMs = performance.now() - startTime
    console.log(
      `[混合模式] ✅ Decoder: ${timeMs.toFixed(0)}ms, score=${bestScore.toFixed(4)}, ` +
      `mask=${origW}x${origH}`,
    )

    return {
      mask: new ImageData(rgba, origW, origH),
      score: bestScore,
      timeMs,
    }
  }

  async cleanup(): Promise<void> {
    if (this.decoderSession) {
      await this.decoderSession.release()
    }
    this.decoderSession = null
    this.cachedEmbedding = null
    this._isReady = false
  }

  private async imageDataToUrl(imageData: ImageData): Promise<string> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return URL.createObjectURL(blob)
  }
}
