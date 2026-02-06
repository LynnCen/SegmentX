import type { ModeInfo, Point, MaskResult, TextSegmentResult } from '@/core/types'

/**
 * 分割模式基类 - 策略模式
 * 所有模式（纯前端、纯后端、混合）都实现此接口
 */
export abstract class BaseMode {
  abstract info: ModeInfo

  /**
   * 初始化模式（加载模型等）
   */
  abstract initialize(modelId: string): Promise<void>

  /**
   * 设置图片（生成/获取 Embedding）
   * @param imageSource 图片来源 (URL 或 ImageData)
   */
  abstract setImage(imageSource: string | ImageData): Promise<{ timeMs: number }>

  /**
   * 基于点击的分割
   */
  abstract segment(points: Point[]): Promise<MaskResult>

  /**
   * 基于文本的分割 (仅 SAM3 纯后端模式)
   */
  async segmentText(_prompt: string): Promise<TextSegmentResult> {
    throw new Error(`${this.info.name} 不支持文本提示分割`)
  }

  /**
   * 当前是否已初始化
   */
  abstract get isReady(): boolean

  /**
   * 清理资源
   */
  abstract cleanup(): Promise<void>
}
