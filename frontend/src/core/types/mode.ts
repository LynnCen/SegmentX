/**
 * 模式相关类型定义
 */
import type { ModeType } from './model'

export interface Point {
  x: number
  y: number
  /** 0=背景, 1=前景 */
  type: 0 | 1
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface MaskResult {
  /** 掩码图像数据 */
  mask: ImageData
  /** 质量分数 */
  score: number
  /** 推理耗时(ms) */
  timeMs: number
}

export interface TextSegmentResult {
  /** 多个实例的掩码 */
  masks: ImageData[]
  /** 各实例的分数 */
  scores: number[]
  /** 各实例的边界框 */
  boxes: Box[]
  /** 推理耗时(ms) */
  timeMs: number
}

export interface ModeInfo {
  type: ModeType
  name: string
  description: string
  /** 是否需要后端 */
  requiresBackend: boolean
  /** 支持的功能 */
  capabilities: string[]
}

export const MODE_INFO: Record<ModeType, ModeInfo> = {
  frontend: {
    type: 'frontend',
    name: '纯前端模式',
    description: 'Encoder + Decoder 全部在浏览器运行 (ONNX.js)',
    requiresBackend: false,
    capabilities: ['点击分割', '边界框'],
  },
  backend: {
    type: 'backend',
    name: '纯后端模式',
    description: 'Encoder + Decoder 全部在服务器运行 (PyTorch)',
    requiresBackend: true,
    capabilities: ['点击分割', '边界框', '文本提示(SAM3)'],
  },
  hybrid: {
    type: 'hybrid',
    name: '混合模式',
    description: 'Encoder 在后端, Decoder 在前端',
    requiresBackend: true,
    capabilities: ['点击分割', '边界框'],
  },
}
