<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import ModeSelector from '@/components/Controls/ModeSelector.vue'
import ModelSelector from '@/components/Controls/ModelSelector.vue'
import ImageUploader from '@/components/Controls/ImageUploader.vue'
import ToolBar from '@/components/Controls/ToolBar.vue'
import DrawCanvas from '@/components/Canvas/DrawCanvas.vue'
import MetricsPanel from '@/components/Performance/MetricsPanel.vue'

const store = useAppStore()

onMounted(async () => {
  await store.switchMode('backend')
})
</script>

<template>
  <div class="workspace">
    <!-- 顶部栏 -->
    <header class="workspace-header">
      <div class="header-left">
        <h1 class="logo">SegmentX</h1>
        <span class="subtitle">SAM 学习实践平台</span>
      </div>
      <div class="header-center">
        <ModeSelector />
      </div>
      <div class="header-right">
        <ModelSelector />
      </div>
    </header>

    <!-- 主工作区 -->
    <main class="workspace-main">
      <!-- 左侧工具栏 -->
      <aside class="sidebar-left">
        <ToolBar />
      </aside>

      <!-- 中心画布 -->
      <section class="canvas-area">
        <!-- 错误提示 -->
        <div v-if="store.error" class="error-banner">
          {{ store.error }}
          <button class="error-dismiss" @click="store.error = null">✕</button>
        </div>

        <!-- 初始化中 -->
        <div v-if="store.isInitializing" class="status-overlay">
          <div class="spinner" />
          <p>正在初始化模式...</p>
        </div>

        <!-- 上传中 -->
        <div v-else-if="!store.imageLoaded && store.isProcessing" class="status-overlay">
          <div class="spinner" />
          <p>正在上传图片...</p>
        </div>

        <!-- 上传区域 -->
        <ImageUploader v-else-if="!store.imageLoaded" />

        <!-- 画布 - 始终挂载，通过 v-show 控制显示 -->
        <DrawCanvas v-show="store.imageLoaded" />
      </section>

      <!-- 右侧面板 -->
      <aside class="sidebar-right">
        <MetricsPanel />
      </aside>
    </main>
  </div>
</template>

<style scoped lang="scss">
.workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.workspace-header {
  height: 56px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #58a6ff, #a371f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.workspace-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar-left {
  width: 60px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
}

.canvas-area {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  overflow: hidden;
}

.sidebar-right {
  width: 280px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  flex-shrink: 0;
  overflow-y: auto;
}

.error-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(248, 81, 73, 0.15);
  color: var(--error);
  padding: 8px 20px;
  border-radius: var(--radius);
  font-size: 14px;
  z-index: 10;
  border: 1px solid rgba(248, 81, 73, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.error-dismiss {
  background: none;
  color: var(--error);
  font-size: 16px;
  padding: 0;
}

.status-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);

  p {
    font-size: 14px;
  }
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
