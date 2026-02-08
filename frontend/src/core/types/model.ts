/**
 * SAM 模型相关类型定义
 */

export const ModelFamily = {
  SAM1: 'sam1',
  SAM2: 'sam2',
  SAM_HQ: 'sam_hq',
  SAM3: 'sam3',
} as const

export type ModelFamily = (typeof ModelFamily)[keyof typeof ModelFamily]

export interface ModelConfig {
  /** 模型唯一标识 */
  id: string
  /** 模型族 */
  family: ModelFamily
  /** 显示名称 */
  name: string
  /** 模型大小 (MB) */
  size: number
  /** 参数量 (M) */
  params: number
  /** 支持的模式 */
  supportedModes: ModeType[]
  /** 是否有 ONNX 版本 */
  hasONNX: boolean
  /** 特性列表 */
  features: string[]
  /** ONNX 模型路径 (前端使用) */
  onnxPaths?: {
    encoder?: string
    decoder?: string
  }
}

export type ModeType = 'frontend' | 'backend' | 'hybrid'

/** 模型注册表 - 所有支持的模型 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // SAM1 系列
  sam1_vit_b: {
    id: 'sam1_vit_b',
    family: ModelFamily.SAM1,
    name: 'SAM1 ViT-B',
    size: 375,
    params: 91,
    supportedModes: ['frontend', 'backend', 'hybrid'],
    hasONNX: true,
    features: ['点击分割', '边界框'],
    onnxPaths: {
      encoder: '/models/sam1_encoder_vit_b.onnx',
      decoder: '/models/sam1_decoder.onnx',
    },
  },
  sam1_vit_l: {
    id: 'sam1_vit_l',
    family: ModelFamily.SAM1,
    name: 'SAM1 ViT-L',
    size: 1200,
    params: 308,
    supportedModes: ['backend', 'hybrid'],
    hasONNX: false,
    features: ['点击分割', '边界框'],
  },
  sam1_vit_h: {
    id: 'sam1_vit_h',
    family: ModelFamily.SAM1,
    name: 'SAM1 ViT-H',
    size: 2400,
    params: 636,
    supportedModes: ['backend', 'hybrid'],
    hasONNX: false,
    features: ['点击分割', '边界框'],
  },

  // SAM2 系列
  sam2_tiny: {
    id: 'sam2_tiny',
    family: ModelFamily.SAM2,
    name: 'SAM2 Tiny',
    size: 39,
    params: 38.9,
    supportedModes: ['frontend', 'backend', 'hybrid'],
    hasONNX: true,
    features: ['点击分割', '边界框', '视频分割'],
    onnxPaths: {
      encoder: '/models/sam2_encoder_tiny.onnx',
      decoder: '/models/sam2_decoder.onnx',
    },
  },
  sam2_small: {
    id: 'sam2_small',
    family: ModelFamily.SAM2,
    name: 'SAM2 Small',
    size: 46,
    params: 46,
    supportedModes: ['frontend', 'backend', 'hybrid'],
    hasONNX: true,
    features: ['点击分割', '边界框', '视频分割'],
    onnxPaths: {
      encoder: '/models/sam2_encoder_small.onnx',
      decoder: '/models/sam2_decoder.onnx',
    },
  },
  sam2_base_plus: {
    id: 'sam2_base_plus',
    family: ModelFamily.SAM2,
    name: 'SAM2 Base+',
    size: 81,
    params: 80.8,
    supportedModes: ['frontend', 'backend', 'hybrid'],
    hasONNX: true,
    features: ['点击分割', '边界框', '视频分割'],
    onnxPaths: {
      encoder: '/models/sam2_encoder_base_plus.onnx',
      decoder: '/models/sam2_decoder.onnx',
    },
  },
  sam2_large: {
    id: 'sam2_large',
    family: ModelFamily.SAM2,
    name: 'SAM2 Large',
    size: 224,
    params: 224.4,
    supportedModes: ['backend', 'hybrid'],
    hasONNX: false,
    features: ['点击分割', '边界框', '视频分割'],
  },

  // SAM-HQ 系列
  sam_hq_vit_b: {
    id: 'sam_hq_vit_b',
    family: ModelFamily.SAM_HQ,
    name: 'SAM-HQ ViT-B',
    size: 379,
    params: 91,
    supportedModes: ['backend', 'hybrid'],
    hasONNX: false,
    features: ['点击分割', '边界框', '高质量边缘'],
  },
  sam_hq_vit_l: {
    id: 'sam_hq_vit_l',
    family: ModelFamily.SAM_HQ,
    name: 'SAM-HQ ViT-L',
    size: 1250,
    params: 308,
    supportedModes: ['backend', 'hybrid'],
    hasONNX: false,
    features: ['点击分割', '边界框', '高质量边缘'],
  },
  sam_hq_vit_h: {
    id: 'sam_hq_vit_h',
    family: ModelFamily.SAM_HQ,
    name: 'SAM-HQ ViT-H',
    size: 2500,
    params: 636,
    supportedModes: ['backend', 'hybrid'],
    hasONNX: false,
    features: ['点击分割', '边界框', '高质量边缘'],
  },

  // SAM3
  sam3: {
    id: 'sam3',
    family: ModelFamily.SAM3,
    name: 'SAM3',
    size: 3200,
    params: 848,
    supportedModes: ['backend'],
    hasONNX: false,
    features: ['点击分割', '边界框', '文本提示', '示例提示', '视频分割'],
  },
}

/** 根据模式获取可用模型 */
export function getModelsForMode(mode: ModeType): ModelConfig[] {
  return Object.values(MODEL_REGISTRY).filter((m) =>
    m.supportedModes.includes(mode),
  )
}
