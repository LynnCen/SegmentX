<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { getModelsForMode } from '@/core/types'

const store = useAppStore()

const models = computed(() => getModelsForMode(store.currentModeType))

async function selectModel(event: Event) {
  const modelId = (event.target as HTMLSelectElement).value
  await store.switchModel(modelId)
}
</script>

<template>
  <div class="model-selector">
    <label class="selector-label">模型</label>
    <select
      class="selector-input"
      :value="store.currentModelId"
      :disabled="store.isInitializing"
      @change="selectModel"
    >
      <option v-for="m in models" :key="m.id" :value="m.id">
        {{ m.name }} ({{ m.size }}MB)
      </option>
    </select>
  </div>
</template>

<style scoped lang="scss">
.model-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.selector-input {
  padding: 6px 10px;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: var(--accent);
  }

  option {
    background: var(--bg-secondary);
  }
}
</style>
