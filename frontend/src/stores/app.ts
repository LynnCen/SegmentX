import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { ModeType, Point, MaskResult } from '@/core/types'
import { getModelsForMode, MODEL_REGISTRY } from '@/core/types'
import { BaseMode } from '@/modes/base/BaseMode'
import { FrontendOnlyMode } from '@/modes/frontend-only/FrontendOnlyMode'
import { BackendOnlyMode } from '@/modes/backend-only/BackendOnlyMode'
import { HybridMode } from '@/modes/hybrid/HybridMode'
import { apiClient } from '@/config/api'

export const useAppStore = defineStore('app', () => {
  // --- 状态 ---
  const currentModeType = ref<ModeType>('backend')
  const currentModelId = ref<string>('sam1_vit_b')
  const mode = shallowRef<BaseMode | null>(null)

  const isInitializing = ref(false)
  const isProcessing = ref(false)
  const imageLoaded = ref(false)
  const error = ref<string | null>(null)

  // 交互数据
  const points = ref<Point[]>([])
  const currentMask = shallowRef<MaskResult | null>(null)

  // 图片数据
  const imageUrl = ref<string>('')
  const imageSize = ref<{ width: number; height: number }>({ width: 0, height: 0 })

  // 性能数据
  const metrics = ref({
    initTime: 0,
    encodeTime: 0,
    decodeTime: 0,
  })

  // --- 计算属性 ---
  const availableModels = () => getModelsForMode(currentModeType.value)

  // --- 方法 ---

  /** 切换模式 */
  async function switchMode(modeType: ModeType) {
    try {
      error.value = null
      isInitializing.value = true

      // 清理旧模式
      if (mode.value) {
        await mode.value.cleanup()
      }

      // 重置状态
      points.value = []
      currentMask.value = null
      imageLoaded.value = false

      currentModeType.value = modeType

      // 自动选择该模式下的默认模型
      const models = getModelsForMode(modeType)
      if (models.length > 0 && !models.find(m => m.id === currentModelId.value)) {
        currentModelId.value = models[0]!.id
      }

      // 创建新模式
      switch (modeType) {
        case 'frontend':
          mode.value = new FrontendOnlyMode()
          break
        case 'backend':
          mode.value = new BackendOnlyMode()
          break
        case 'hybrid':
          mode.value = new HybridMode()
          break
      }

      // 初始化
      const startTime = performance.now()
      await mode.value?.initialize(currentModelId.value)
      metrics.value.initTime = performance.now() - startTime

      console.log(`✅ 切换到 ${modeType} 模式, 模型: ${currentModelId.value}`)
    } catch (e) {
      error.value = (e as Error).message
      console.error('模式切换失败:', e)
    } finally {
      isInitializing.value = false
    }
  }

  /** 切换模型 */
  async function switchModel(modelId: string) {
    const model = MODEL_REGISTRY[modelId]
    if (!model) {
      error.value = `未知模型: ${modelId}`
      return
    }

    if (!model.supportedModes.includes(currentModeType.value)) {
      error.value = `模型 ${model.name} 不支持 ${currentModeType.value} 模式`
      return
    }

    currentModelId.value = modelId
    // 重新初始化当前模式
    await switchMode(currentModeType.value)
  }

  // 服务器上的图片 URL（用于后端模式和混合模式）
  const serverImageUrl = ref<string>('')

  /** 设置图片 (从文件或URL) */
  async function setImage(url: string, width: number, height: number, file?: File) {
    if (!mode.value?.isReady) {
      error.value = '模式未初始化'
      return
    }

    try {
      error.value = null
      isProcessing.value = true
      points.value = []
      currentMask.value = null

      imageUrl.value = url
      imageSize.value = { width, height }

      // 纯前端模式直接用本地 URL
      if (currentModeType.value === 'frontend') {
        const result = await mode.value.setImage(url)
        metrics.value.encodeTime = result.timeMs
      } else {
        // 后端/混合模式需要先上传图片到服务器
        let remoteUrl = url
        if (file) {
          remoteUrl = await apiClient.uploadImage(file)
        }
        serverImageUrl.value = remoteUrl
        const result = await mode.value.setImage(remoteUrl)
        metrics.value.encodeTime = result.timeMs
      }

      imageLoaded.value = true
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isProcessing.value = false
    }
  }

  /** 添加点击并执行分割 */
  async function addPointAndSegment(point: Point) {
    if (!mode.value?.isReady || !imageLoaded.value) return

    try {
      error.value = null
      isProcessing.value = true

      points.value.push(point)

      const result = await mode.value.segment(points.value)
      currentMask.value = result
      metrics.value.decodeTime = result.timeMs
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      isProcessing.value = false
    }
  }

  /** 清除所有点击 */
  function clearPoints() {
    points.value = []
    currentMask.value = null
  }

  /** 撤销最后一个点击 */
  async function undoPoint() {
    if (points.value.length === 0) return
    points.value.pop()

    if (points.value.length === 0) {
      currentMask.value = null
      return
    }

    // 重新分割
    if (mode.value?.isReady) {
      isProcessing.value = true
      try {
        const result = await mode.value.segment(points.value)
        currentMask.value = result
        metrics.value.decodeTime = result.timeMs
      } finally {
        isProcessing.value = false
      }
    }
  }

  return {
    // 状态
    currentModeType,
    currentModelId,
    mode,
    isInitializing,
    isProcessing,
    imageLoaded,
    error,
    points,
    currentMask,
    imageUrl,
    imageSize,
    metrics,
    // 计算
    availableModels,
    // 方法
    switchMode,
    switchModel,
    setImage,
    addPointAndSegment,
    clearPoints,
    undoPoint,
  }
})
