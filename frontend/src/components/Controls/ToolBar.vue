<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const tools = [
  { icon: '👆', label: '前景点', action: () => {} },
  { icon: '👇', label: '背景点', action: () => {} },
  { icon: '↩️', label: '撤销', action: () => store.undoPoint() },
  { icon: '🗑️', label: '清除', action: () => store.clearPoints() },
]
</script>

<template>
  <div class="toolbar">
    <button
      v-for="tool in tools"
      :key="tool.label"
      class="tool-btn"
      :title="tool.label"
      :disabled="!store.imageLoaded"
      @click="tool.action"
    >
      <span class="tool-icon">{{ tool.icon }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 4px;
}

.tool-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-secondary);
  font-size: 18px;

  &:hover:not(:disabled) {
    background: var(--bg-tertiary);
  }
}
</style>
