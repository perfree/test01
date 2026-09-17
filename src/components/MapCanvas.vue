<template>
  <div ref="wrapRef" class="map-canvas-wrap">
    <canvas ref="canvasRef" @click="onClick"></canvas>
    <div class="map-legend hide-sm">
      <div v-for="(item, key) in legendItems" :key="key" class="legend-item">
        <span class="legend-dot" :style="{ background: item.color }"></span>{{ item.label }}
      </div>
    </div>
    <div class="map-scale hide-sm">空域范围 20km × 12km · 禁飞区 {{ zones.length }} 处</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AREA } from '@/store/simulation'
import { DRONE_STATUS_MAP } from '@/utils/format'
import type { Drone, FlightTask, NoFlyZone } from '@/types'

const props = withDefaults(
  defineProps<{
    drones: Drone[]
    zones: NoFlyZone[]
    tasks?: FlightTask[]
    selectedId?: string
    showTrails?: boolean
  }>(),
  { tasks: () => [], selectedId: '', showTrails: true }
)

const emit = defineEmits<{ select: [id: string] }>()

const wrapRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let raf = 0
let ro: ResizeObserver | null = null
let W = 0
let H = 0

const legendItems = computed(() => ({
  flying: { label: '飞行中', color: DRONE_STATUS_MAP.flying.color },
  idle: { label: '待机', color: DRONE_STATUS_MAP.idle.color },
  charging: { label: '充电中', color: DRONE_STATUS_MAP.charging.color },
  maintenance: { label: '维护/离线', color: DRONE_STATUS_MAP.maintenance.color }
}))

const toX = (x: number) => (x / AREA.w) * W
const toY = (y: number) => (y / AREA.h) * H

function resize() {
  const wrap = wrapRef.value
  const canvas = canvasRef.value
  if (!wrap || !canvas) return
  const dpr = window.devicePixelRatio || 1
  W = wrap.clientWidth
  H = wrap.clientHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function draw(time: number) {
  if (!ctx) return
  const c = ctx
  // 背景
  const bg = c.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#081020')
  bg.addColorStop(1, '#0a1226')
  c.fillStyle = bg
  c.fillRect(0, 0, W, H)

  // 网格
  c.strokeStyle = 'rgba(0, 229, 255, 0.06)'
  c.lineWidth = 1
  const gridStep = W / 20
  for (let x = 0; x <= W; x += gridStep) {
    c.beginPath()
    c.moveTo(x, 0)
    c.lineTo(x, H)
    c.stroke()
  }
  for (let y = 0; y <= H; y += gridStep) {
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(W, y)
    c.stroke()
  }

  // 雷达扫描
  const cx = W / 2
  const cy = H / 2
  const radius = Math.max(W, H) * 0.7
  const angle = (time / 3000) % (Math.PI * 2)
  const sweep = c.createConicGradient ? c.createConicGradient(angle, cx, cy) : null
  if (sweep) {
    sweep.addColorStop(0, 'rgba(0, 229, 255, 0.10)')
    sweep.addColorStop(0.08, 'rgba(0, 229, 255, 0.02)')
    sweep.addColorStop(0.15, 'transparent')
    sweep.addColorStop(1, 'transparent')
    c.fillStyle = sweep
    c.fillRect(0, 0, W, H)
  }
  // 雷达同心圆
  c.strokeStyle = 'rgba(0, 229, 255, 0.08)'
  for (const r of [0.2, 0.4, 0.6]) {
    c.beginPath()
    c.arc(cx, cy, radius * r, 0, Math.PI * 2)
    c.stroke()
  }

  // 禁飞区
  for (const z of props.zones) {
    const zx = toX(z.center.x)
    const zy = toY(z.center.y)
    const zr = (z.radius / AREA.w) * W
    c.beginPath()
    c.arc(zx, zy, zr, 0, Math.PI * 2)
    c.fillStyle = 'rgba(244, 63, 94, 0.08)'
    c.fill()
    c.setLineDash([6, 4])
    c.strokeStyle = 'rgba(244, 63, 94, 0.55)'
    c.lineWidth = 1.5
    c.stroke()
    c.setLineDash([])
    c.fillStyle = 'rgba(244, 63, 94, 0.85)'
    c.font = '11px sans-serif'
    c.textAlign = 'center'
    c.fillText(`⚠ ${z.name}`, zx, zy - zr - 6)
  }

  // 执行中任务航线
  for (const t of props.tasks) {
    if (t.status !== 'running' && t.status !== 'paused') continue
    c.beginPath()
    t.route.forEach((p, i) => {
      if (i === 0) c.moveTo(toX(p.x), toY(p.y))
      else c.lineTo(toX(p.x), toY(p.y))
    })
    c.setLineDash([5, 5])
    c.strokeStyle = t.status === 'running' ? 'rgba(0, 229, 255, 0.35)' : 'rgba(245, 158, 11, 0.35)'
    c.lineWidth = 1.5
    c.stroke()
    c.setLineDash([])
    // 航点
    c.fillStyle = 'rgba(0, 229, 255, 0.6)'
    for (const p of t.route) {
      c.beginPath()
      c.arc(toX(p.x), toY(p.y), 2.5, 0, Math.PI * 2)
      c.fill()
    }
  }

  // 无人机
  for (const d of props.drones) {
    const x = toX(d.pos.x)
    const y = toY(d.pos.y)
    const color = DRONE_STATUS_MAP[d.status].color
    const isFlying = d.status === 'flying' || d.status === 'returning'

    // 轨迹
    if (props.showTrails && d.trail.length > 1 && isFlying) {
      c.beginPath()
      d.trail.forEach((p, i) => {
        if (i === 0) c.moveTo(toX(p.x), toY(p.y))
        else c.lineTo(toX(p.x), toY(p.y))
      })
      c.strokeStyle = color + '55'
      c.lineWidth = 1.5
      c.stroke()
    }

    const selected = d.id === props.selectedId
    if (selected) {
      const pulse = 10 + Math.sin(time / 200) * 3
      c.beginPath()
      c.arc(x, y, pulse + 6, 0, Math.PI * 2)
      c.strokeStyle = color
      c.lineWidth = 1.5
      c.stroke()
    }

    // 光晕
    if (isFlying) {
      const glow = c.createRadialGradient(x, y, 0, x, y, 14)
      glow.addColorStop(0, color + '66')
      glow.addColorStop(1, 'transparent')
      c.fillStyle = glow
      c.beginPath()
      c.arc(x, y, 14, 0, Math.PI * 2)
      c.fill()
    }

    // 机身（按航向旋转的三角形）
    c.save()
    c.translate(x, y)
    c.rotate((d.heading * Math.PI) / 180)
    c.beginPath()
    c.moveTo(8, 0)
    c.lineTo(-6, 5)
    c.lineTo(-3, 0)
    c.lineTo(-6, -5)
    c.closePath()
    c.fillStyle = color
    c.shadowColor = color
    c.shadowBlur = isFlying ? 10 : 0
    c.fill()
    c.restore()

    // 标签
    if (selected || isFlying) {
      c.font = '10px sans-serif'
      c.textAlign = 'center'
      c.fillStyle = selected ? '#fff' : 'rgba(219, 231, 255, 0.75)'
      c.fillText(d.name, x, y - 12)
    }
  }

  raf = requestAnimationFrame(draw)
}

function onClick(e: MouseEvent) {
  const rect = canvasRef.value!.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  let best: Drone | null = null
  let bestDist = 18
  for (const d of props.drones) {
    const dd = Math.hypot(toX(d.pos.x) - mx, toY(d.pos.y) - my)
    if (dd < bestDist) {
      bestDist = dd
      best = d
    }
  }
  if (best) emit('select', best.id)
}

onMounted(() => {
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(wrapRef.value!)
  raf = requestAnimationFrame(draw)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})
</script>

<style scoped>
.map-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
  overflow: hidden;
  border-radius: 6px;
}

canvas {
  display: block;
  cursor: crosshair;
}

.map-legend {
  position: absolute;
  top: 10px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: rgba(6, 11, 24, 0.7);
  border: 1px solid var(--border-glow);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: var(--text-dim);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.map-scale {
  position: absolute;
  bottom: 8px;
  left: 12px;
  font-size: 11px;
  color: var(--text-dim);
}
</style>
