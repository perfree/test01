<template>
  <div class="stat-card tech-card">
    <div class="stat-icon" :style="{ background: color + '22', color: color }">
      <el-icon :size="22"><component :is="icon" /></el-icon>
    </div>
    <div class="stat-body">
      <div class="stat-title">{{ title }}</div>
      <div class="stat-value">
        <span class="num-glow">{{ displayValue }}</span>
        <span v-if="suffix" class="stat-suffix">{{ suffix }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    value: number
    suffix?: string
    icon: Component
    color?: string
    decimals?: number
  }>(),
  { color: '#00e5ff', decimals: 0 }
)

// 数字滚动动画
const animated = ref(0)
let raf = 0

const animateTo = (target: number) => {
  cancelAnimationFrame(raf)
  const start = animated.value
  const diff = target - start
  const duration = 600
  const t0 = performance.now()
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / duration)
    const eased = 1 - Math.pow(1 - p, 3)
    animated.value = start + diff * eased
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

const displayValue = computed(() => animated.value.toFixed(props.decimals))

watch(() => props.value, (v) => animateTo(v))
onMounted(() => animateTo(props.value))
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-title {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 4px;
  white-space: nowrap;
}

.stat-value {
  font-size: 26px;
  line-height: 1.1;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-suffix {
  font-size: 12px;
  color: var(--text-dim);
  -webkit-text-fill-color: var(--text-dim);
}
</style>
