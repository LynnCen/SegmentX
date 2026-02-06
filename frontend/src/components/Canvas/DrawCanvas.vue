<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const containerRef = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const maskCanvasRef = ref<HTMLCanvasElement>()

const displaySize = ref({ width: 0, height: 0 })
let loadedImage: HTMLImageElement | null = null

// ========== 图片加载 ==========

/**
 * 加载图片到内存（不依赖 canvas DOM）
 */
function preloadImage(url: string) {
  if (!url) return

  const img = new Image()
  // 只有 http(s) URL 需要 crossOrigin，blob URL 不需要
  if (url.startsWith('http')) {
    img.crossOrigin = 'anonymous'
  }
  img.onload = () => {
    loadedImage = img
    console.log(`[Canvas] 图片加载完成: ${img.width}x${img.height}`)
    // 图片加载好了，尝试绘制
    tryDraw()
  }
  img.onerror = (e) => {
    console.error('[Canvas] 图片加载失败:', url, e)
  }
  img.src = url
}

// imageUrl 变化 → 预加载图片
watch(() => store.imageUrl, (url) => {
  loadedImage = null
  displaySize.value = { width: 0, height: 0 }
  if (url) preloadImage(url)
})

// imageLoaded 变化 → 尝试绘制
watch(() => store.imageLoaded, (loaded) => {
  if (loaded) {
    tryDraw()
  } else {
    displaySize.value = { width: 0, height: 0 }
    loadedImage = null
    clearMask()
  }
})

// 组件挂载 → 如果已经有图片，加载并绘制
onMounted(() => {
  if (store.imageUrl) {
    preloadImage(store.imageUrl)
  }
})

// ========== 绘制逻辑 ==========

async function tryDraw() {
  // 两个条件：图片已加载 + imageLoaded 标记为 true
  if (!loadedImage || !store.imageLoaded) return

  // 等待 DOM 和布局更新
  await nextTick()
  await nextTick() // 双 nextTick 确保 v-show 切换后布局生效
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawToCanvas()
    })
  })
}

function drawToCanvas() {
  const container = containerRef.value
  const canvas = canvasRef.value
  const maskCanvas = maskCanvasRef.value
  const img = loadedImage

  if (!container || !canvas || !maskCanvas || !img) {
    console.warn('[Canvas] DOM 未就绪')
    return
  }

  const rect = container.getBoundingClientRect()
  console.log(`[Canvas] 容器尺寸: ${rect.width}x${rect.height}`)

  if (rect.width <= 0 || rect.height <= 0) {
    console.warn('[Canvas] 容器尺寸为 0，200ms 后重试')
    setTimeout(() => drawToCanvas(), 200)
    return
  }

  const maxW = rect.width - 40
  const maxH = rect.height - 40
  const scale = Math.min(maxW / img.width, maxH / img.height, 1)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  // 更新显示尺寸（触发 canvas-wrapper 渲染）
  displaySize.value = { width: w, height: h }

  // 必须在 DOM 更新后设置 canvas 像素尺寸
  nextTick().then(() => {
    canvas.width = w
    canvas.height = h
    maskCanvas.width = w
    maskCanvas.height = h

    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    console.log(`[Canvas] ✅ 绘制完成: ${img.width}x${img.height} → ${w}x${h}`)
  })
}

// ========== Mask 绘制 ==========

function clearMask() {
  const maskCanvas = maskCanvasRef.value
  if (maskCanvas) {
    const ctx = maskCanvas.getContext('2d')!
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
  }
}

watch(() => store.currentMask, (maskResult) => {
  const maskCanvas = maskCanvasRef.value
  if (!maskCanvas) return

  const ctx = maskCanvas.getContext('2d')!
  ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)

  if (maskResult) {
    const temp = new OffscreenCanvas(maskResult.mask.width, maskResult.mask.height)
    const tempCtx = temp.getContext('2d')!
    tempCtx.putImageData(maskResult.mask, 0, 0)
    ctx.drawImage(temp, 0, 0, maskCanvas.width, maskCanvas.height)
    console.log(`[Canvas] ✅ Mask 绘制: score=${maskResult.score.toFixed(4)}`)
  }
})

// ========== 点击交互 ==========

function handleClick(e: MouseEvent) {
  if (!store.imageLoaded || store.isProcessing) return
  const dw = displaySize.value.width
  const dh = displaySize.value.height
  if (dw <= 0 || dh <= 0) return

  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()

  const scaleX = store.imageSize.width / dw
  const scaleY = store.imageSize.height / dh
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  const type: 0 | 1 = e.button === 2 ? 0 : 1

  console.log(`[Canvas] 点击: (${x.toFixed(0)}, ${y.toFixed(0)}) ${type === 1 ? '前景' : '背景'}`)
  store.addPointAndSegment({ x, y, type })
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  handleClick(e)
}
</script>

<template>
  <div ref="containerRef" class="draw-canvas-container">
    <div
      v-show="displaySize.width > 0 && displaySize.height > 0"
      class="canvas-wrapper"
      :style="{ width: displaySize.width + 'px', height: displaySize.height + 'px' }"
    >
      <canvas ref="canvasRef" class="canvas-layer image-layer" />
      <canvas ref="maskCanvasRef" class="canvas-layer mask-layer" />
      <div class="canvas-layer interaction-layer" @click="handleClick" @contextmenu="handleContextMenu">
        <div
          v-for="(point, idx) in store.points"
          :key="idx"
          class="point-marker"
          :class="point.type === 1 ? 'foreground' : 'background'"
          :style="{
            left: (point.x / store.imageSize.width) * displaySize.width + 'px',
            top: (point.y / store.imageSize.height) * displaySize.height + 'px',
          }"
        />
      </div>
      <div v-if="store.isProcessing" class="processing-overlay">
        <div class="spinner" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.draw-canvas-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-wrapper {
  position: relative;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border-radius: 4px;
  overflow: hidden;
}

.canvas-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.image-layer { z-index: 1; }
.mask-layer { z-index: 2; pointer-events: none; }
.interaction-layer { z-index: 3; cursor: crosshair; }

.point-marker {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;

  &.foreground { background: var(--success); }
  &.background { background: var(--error); }
}

.processing-overlay {
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
