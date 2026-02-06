import { BaseMode } from '@/modes/base/BaseMode'
import type { ModeInfo, Point, MaskResult, TextSegmentResult } from '@/core/types'
import { MODE_INFO } from '@/core/types'
import { apiClient } from '@/config/api'

/**
 * 纯后端模式
 * Encoder + Decoder 都在服务器运行
 * Mask 以 base64 PNG 格式传输
 */
export class BackendOnlyMode extends BaseMode {
  info: ModeInfo = MODE_INFO.backend

  private currentImageUrl: string = ''
  private currentModelId: string = ''
  private _isReady = false

  get isReady(): boolean {
    return this._isReady
  }

  async initialize(modelId: string): Promise<void> {
    this.currentModelId = modelId
    console.log(`[纯后端] 使用模型: ${modelId}`)
    this._isReady = true
  }

  async setImage(imageSource: string | ImageData): Promise<{ timeMs: number }> {
    const startTime = performance.now()

    if (typeof imageSource === 'string') {
      this.currentImageUrl = imageSource
    } else {
      const canvas = new OffscreenCanvas(imageSource.width, imageSource.height)
      const ctx = canvas.getContext('2d')!
      ctx.putImageData(imageSource, 0, 0)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      this.currentImageUrl = URL.createObjectURL(blob)
    }

    const timeMs = performance.now() - startTime
    return { timeMs }
  }

  async segment(points: Point[]): Promise<MaskResult> {
    if (!this.currentImageUrl) throw new Error('请先设置图片')

    const startTime = performance.now()

    const response = await apiClient.post<{
      mask: string // base64 PNG
      mask_size: number[]
      score: number
      time_ms: number
      model: string
    }>('/api/segment', {
      image_url: this.currentImageUrl,
      points: points.map((p) => ({ x: p.x, y: p.y, type: p.type })),
      model: this.currentModelId,
    })

    const timeMs = performance.now() - startTime

    // 将 base64 PNG 转为 ImageData
    const mask = await this.base64PngToImageData(response.mask)

    return {
      mask,
      score: response.score,
      timeMs,
    }
  }

  async segmentText(prompt: string): Promise<TextSegmentResult> {
    if (!this.currentImageUrl) throw new Error('请先设置图片')

    const startTime = performance.now()

    const response = await apiClient.post<{
      masks: string[]
      scores: number[]
      boxes: number[][]
      count: number
    }>('/api/segment/text', {
      image_url: this.currentImageUrl,
      prompt,
      confidence: 0.5,
    })

    const timeMs = performance.now() - startTime
    const masks = await Promise.all(response.masks.map((b64) => this.base64PngToImageData(b64)))

    return {
      masks,
      scores: response.scores,
      boxes: response.boxes.map((b) => ({
        x0: b[0] ?? 0,
        y0: b[1] ?? 0,
        x1: b[2] ?? 0,
        y1: b[3] ?? 0,
      })),
      timeMs,
    }
  }

  async cleanup(): Promise<void> {
    this.currentImageUrl = ''
    this._isReady = false
  }

  // --- 私有方法 ---

  /**
   * 将 base64 PNG 字符串转为 ImageData
   */
  private base64PngToImageData(base64: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve(ctx.getImageData(0, 0, img.width, img.height))
      }
      img.onerror = reject
      img.src = `data:image/png;base64,${base64}`
    })
  }
}
