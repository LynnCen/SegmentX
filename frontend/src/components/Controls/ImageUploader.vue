<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement>()

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) handleFile(file)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) handleFile(file)
}

function handleFile(file: File) {
  if (!file.type.startsWith('image/')) return

  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    // 传递 file 对象供后端/混合模式上传
    store.setImage(url, img.width, img.height, file)
  }
  img.src = url
}

function loadDemo() {
  // 下载一张示例图片作为 File 对象
  fetch('https://raw.githubusercontent.com/facebookresearch/segment-anything/main/notebooks/images/truck.jpg')
    .then(res => res.blob())
    .then(blob => {
      const file = new File([blob], 'demo.jpg', { type: 'image/jpeg' })
      handleFile(file)
    })
    .catch(() => {
      // fallback: 生成一张测试图片
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext('2d')!
      // 蓝色背景
      ctx.fillStyle = '#0064c8'
      ctx.fillRect(0, 0, 512, 512)
      // 红色圆形
      ctx.fillStyle = '#ff3232'
      ctx.beginPath()
      ctx.arc(256, 256, 100, 0, Math.PI * 2)
      ctx.fill()
      // 绿色方块
      ctx.fillStyle = '#32c832'
      ctx.fillRect(50, 50, 80, 80)

      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], 'demo.png', { type: 'image/png' })
          handleFile(file)
        }
      })
    })
}
</script>

<template>
  <div
    class="uploader"
    :class="{ dragging: isDragging }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @click="fileInput?.click()"
  >
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      hidden
      @change="onFileChange"
    />
    <div class="uploader-content">
      <div class="upload-icon">📷</div>
      <p class="upload-title">拖拽图片到此处，或点击上传</p>
      <p class="upload-hint">支持 JPG、PNG、WebP</p>
      <button class="btn btn-secondary btn-sm" @click.stop="loadDemo">
        加载示例图片
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.uploader {
  position: absolute;
  inset: 40px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover,
  &.dragging {
    border-color: var(--accent);
    background: rgba(88, 166, 255, 0.05);
  }
}

.uploader-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.upload-title {
  font-size: 16px;
  color: var(--text-primary);
}

.upload-hint {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
