<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import type { ModeType } from '@/core/types'
import { MODE_INFO } from '@/core/types'

const store = useAppStore()

const modes: { type: ModeType; label: string; icon: string }[] = [
  { type: 'frontend', label: '纯前端', icon: '🖥️' },
  { type: 'backend', label: '纯后端', icon: '🖧' },
  { type: 'hybrid', label: '混合模式', icon: '⚡' },
]

async function selectMode(type: ModeType) {
  if (store.currentModeType === type || store.isInitializing) return
  await store.switchMode(type)
}
</script>

<template>
  <div class="mode-selector">
    <button
      v-for="m in modes"
      :key="m.type"
      class="mode-btn"
      :class="{ active: store.currentModeType === m.type }"
      :disabled="store.isInitializing"
      :title="MODE_INFO[m.type].description"
      @click="selectMode(m.type)"
    >
      <span class="mode-icon">{{ m.icon }}</span>
      <span class="mode-label">{{ m.label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.mode-selector {
  display: flex;
  gap: 4px;
  background: var(--bg-primary);
  padding: 4px;
  border-radius: var(--radius);
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;

  &:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  &.active {
    color: var(--accent);
    background: var(--bg-tertiary);
  }
}

.mode-icon {
  font-size: 14px;
}
</style>
