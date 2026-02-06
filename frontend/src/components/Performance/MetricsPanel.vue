<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { MODEL_REGISTRY, MODE_INFO } from '@/core/types'

const store = useAppStore()

const currentModel = computed(() => MODEL_REGISTRY[store.currentModelId])
const currentMode = computed(() => MODE_INFO[store.currentModeType])

const statusLabel = computed(() => {
  if (store.isInitializing) return '初始化中...'
  if (!store.mode?.isReady) return '未就绪'
  if (!store.imageLoaded) return '等待图片'
  if (store.isProcessing) return '处理中...'
  return '就绪'
})

const statusColor = computed(() => {
  if (store.isInitializing || store.isProcessing) return 'var(--warning)'
  if (!store.mode?.isReady) return 'var(--error)'
  return 'var(--success)'
})
</script>

<template>
  <div class="metrics-panel">
    <!-- 状态 -->
    <div class="panel-section">
      <h3 class="section-title">状态</h3>
      <div class="status-row">
        <span class="status-dot" :style="{ background: statusColor }" />
        <span>{{ statusLabel }}</span>
      </div>
    </div>

    <!-- 当前配置 -->
    <div class="panel-section">
      <h3 class="section-title">当前配置</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">模式</span>
          <span class="info-value">{{ currentMode?.name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">模型</span>
          <span class="info-value">{{ currentModel?.name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">大小</span>
          <span class="info-value">{{ currentModel?.size }}MB</span>
        </div>
        <div class="info-item">
          <span class="info-label">参数量</span>
          <span class="info-value">{{ currentModel?.params }}M</span>
        </div>
      </div>
    </div>

    <!-- 性能指标 -->
    <div class="panel-section">
      <h3 class="section-title">性能指标</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">初始化</span>
          <span class="info-value metric">
            {{ store.metrics.initTime > 0 ? store.metrics.initTime.toFixed(0) + 'ms' : '-' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">编码耗时</span>
          <span class="info-value metric">
            {{ store.metrics.encodeTime > 0 ? store.metrics.encodeTime.toFixed(0) + 'ms' : '-' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">解码耗时</span>
          <span class="info-value metric">
            {{ store.metrics.decodeTime > 0 ? store.metrics.decodeTime.toFixed(0) + 'ms' : '-' }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Mask 分数</span>
          <span class="info-value metric">
            {{ store.currentMask ? store.currentMask.score.toFixed(3) : '-' }}
          </span>
        </div>
      </div>
    </div>

    <!-- 交互信息 -->
    <div class="panel-section">
      <h3 class="section-title">交互</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">点击数</span>
          <span class="info-value">{{ store.points.length }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">前景点</span>
          <span class="info-value" style="color: var(--success)">
            {{ store.points.filter(p => p.type === 1).length }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">背景点</span>
          <span class="info-value" style="color: var(--error)">
            {{ store.points.filter(p => p.type === 0).length }}
          </span>
        </div>
      </div>
    </div>

    <!-- 提示 -->
    <div class="panel-section">
      <h3 class="section-title">操作提示</h3>
      <div class="tips">
        <p>左键点击 = 前景点（选中目标）</p>
        <p>右键点击 = 背景点（排除区域）</p>
      </div>
    </div>

    <!-- 特性标签 -->
    <div v-if="currentModel" class="panel-section">
      <h3 class="section-title">模型特性</h3>
      <div class="tags">
        <span
          v-for="feat in currentModel.features"
          :key="feat"
          class="tag tag-blue"
        >
          {{ feat }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.metrics-panel {
  padding: 16px;
}

.panel-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  color: var(--text-primary);
  font-weight: 500;

  &.metric {
    font-family: 'SF Mono', 'Consolas', monospace;
    color: var(--accent);
  }
}

.tips {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
