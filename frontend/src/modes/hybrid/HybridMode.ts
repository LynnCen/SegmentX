import { BaseMode } from '@/modes/base/BaseMode'
import type { ModeInfo, Point, MaskResult } from '@/core/types'
import { MODE_INFO, MODEL_REGISTRY } from '@/core/types'
import { apiClient } from '@/config/api'
import * as ort from 'onnxruntime-web'
import pako from 'pako'

/**
 * 混合模式
 * Encoder 在后端 (大模型), Decoder 在前端 (快速交互)
 */
export class HybridMode extends BaseMode {
  info: ModeInfo = MODE_INFO.hybrid

  private decoderSession: ort.InferenceSession | null = null
  private cachedEmbedding: Float32Array | null = null
  private embeddingShape: number[] = []
  private _isReady = false
  private currentModelId: string = ''

  get isReady(): boolean {
    return this._isReady
  }

  async initialize(modelId: string): Promise<void> {
    this.currentModelId = modelId
    console.log(`[混合模式] 后端模型: ${modelId}`)

    // 加载前端 Decoder (轻量级, ~4MB)
    const model = MODEL_REGISTRY[modelId]
    const decoderPath = model?.onnxPaths?.decoder ?? '/models/sam_decoder.onnx'

    console.log(`[混合模式] 加载 Decoder: ${decoderPath}`)
    this.decoderSession = await ort.InferenceSession.create(decoderPath, {
      executionProviders: ['webgpu', 'wasm'],
    })

    this._isReady = true
    console.log(`[混合模式] 初始化完成`)
  }

  async setImage(imageSource: string | ImageData): Promise<{ timeMs: number }> {
    const startTime = performance.now()

    const imageUrl =
      typeof imageSource === 'string'
        ? imageSource
        : await this.imageDataToUrl(imageSource)

    // 从后端获取 Embedding
    console.log(`[混合模式] 请求后端生成 Embedding...`)
    const response = await apiClient.post<{
      embedding: string
      shape: number[]
      original_size: number[]
      compressed_size: number
    }>('/api/embedding', {
      image_url: imageUrl,
      model: this.currentModelId,
    })

    // 解码 Embedding
    const compressedBytes = Uint8Array.from(atob(response.embedding), (c) =>
      c.charCodeAt(0),
    )
    const decompressed = pako.inflate(compressedBytes)
    this.cachedEmbedding = new Float32Array(decompressed.buffer)
    this.embeddingShape = response.shape

    const timeMs = performance.now() - startTime
    console.log(
      `[混合模式] Embedding 获取完成: ${timeMs.toFixed(0)}ms, 压缩传输: ${(response.compressed_size / 1024).toFixed(0)}KB`,
    )

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
      image_embeddings: new ort.Tensor(
        'float32',
        this.cachedEmbedding,
        this.embeddingShape,
      ),
      point_coords: new ort.Tensor('float32', coords, [1, points.length, 2]),
      point_labels: new ort.Tensor('float32', labels, [1, points.length]),
    }

    const result = await this.decoderSession.run(inputs)
    const masksOutput = result['masks']
    const maskData = masksOutput ? (masksOutput.data as Float32Array) : new Float32Array(256 * 256)

    const timeMs = performance.now() - startTime
    console.log(`[混合模式] Decoder 耗时: ${timeMs.toFixed(0)}ms`)

    const iouOutput = result['iou_predictions']
    const score = iouOutput ? (iouOutput.data as Float32Array)[0] ?? 0 : 0

    return {
      mask: this.postprocessMask(maskData),
      score,
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

  // --- 私有方法 ---

  private postprocessMask(maskData: Float32Array): ImageData {
    const size = 256
    const pixels = size * size
    const rgba = new Uint8ClampedArray(pixels * 4)

    for (let i = 0; i < pixels; i++) {
      if ((maskData[i] ?? 0) > 0) {
        rgba[i * 4] = 30
        rgba[i * 4 + 1] = 144
        rgba[i * 4 + 2] = 255
        rgba[i * 4 + 3] = 128
      }
    }

    return new ImageData(rgba, size, size)
  }

  private async imageDataToUrl(imageData: ImageData): Promise<string> {
    const canvas = new OffscreenCanvas(imageData.width, imageData.height)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return URL.createObjectURL(blob)
  }
}
