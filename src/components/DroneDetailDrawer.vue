<template>
  <el-drawer :model-value="modelValue" :size="drawerSize" :with-header="false" @update:model-value="emit('update:modelValue', $event)">
    <div v-if="drone" class="drawer-body">
      <div class="drawer-header">
        <div>
          <div class="drone-name">{{ drone.name }}</div>
          <div class="drone-sn">{{ drone.sn }} · {{ drone.model }}</div>
        </div>
        <el-tag :type="statusInfo.tag" effect="dark">{{ statusInfo.label }}</el-tag>
      </div>

      <div class="section-title">实时遥测</div>
      <div class="telemetry-grid">
        <div class="tele-item">
          <div class="tele-label">电量</div>
          <el-progress :percentage="Math.round(drone.battery)" :color="batteryColor(drone.battery)" :stroke-width="10" />
        </div>
        <div class="tele-item">
          <div class="tele-label">信号强度</div>
          <el-progress :percentage="Math.round(drone.signal)" :stroke-width="10" color="#38bdf8" />
        </div>
        <div class="tele-item half">
          <div class="tele-label">速度</div>
          <div class="tele-value">{{ drone.speed.toFixed(1) }} <span>m/s</span></div>
        </div>
        <div class="tele-item half">
          <div class="tele-label">高度</div>
          <div class="tele-value">{{ Math.round(drone.altitude) }} <span>m</span></div>
        </div>
        <div class="tele-item half">
          <div class="tele-label">航向</div>
          <div class="tele-value">{{ Math.round((drone.heading + 360) % 360) }}<span>°</span></div>
        </div>
        <div class="tele-item half">
          <div class="tele-label">累计飞行</div>
          <div class="tele-value">{{ fmtDuration(drone.flightTime) }}</div>
        </div>
      </div>

      <div class="section-title">位置信息</div>
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="当前坐标">E {{ (116 + drone.pos.x * 0.002).toFixed(4) }}° / N {{ (39 + drone.pos.y * 0.002).toFixed(4) }}°</el-descriptions-item>
        <el-descriptions-item label="机巢坐标">E {{ (116 + drone.home.x * 0.002).toFixed(4) }}° / N {{ (39 + drone.home.y * 0.002).toFixed(4) }}°</el-descriptions-item>
        <el-descriptions-item label="当前任务">{{ currentTaskName }}</el-descriptions-item>
        <el-descriptions-item label="最后上报">{{ fmtTime(drone.updatedAt) }}</el-descriptions-item>
      </el-descriptions>

      <div class="section-title">遥测曲线（近 2 分钟）</div>
      <div ref="chartEl" class="telemetry-chart"></div>

      <div class="section-title">关联告警</div>
      <el-empty v-if="!relatedAlerts.length" description="暂无告警" :image-size="60" />
      <div v-for="a in relatedAlerts" :key="a.id" class="alert-row">
        <span class="alert-dot" :style="{ background: ALERT_LEVEL_MAP[a.level].color }"></span>
        <div class="alert-main">
          <div class="alert-msg">{{ a.message }}</div>
          <div class="alert-time">{{ fmtDateTime(a.time) }} · {{ a.handled ? '已处理' : '未处理' }}</div>
        </div>
      </div>

      <div class="drawer-actions">
        <el-button type="primary" :disabled="drone.status !== 'idle'" @click="cmd('takeoff')">起飞</el-button>
        <el-button type="warning" :disabled="drone.status !== 'flying'" @click="cmd('return')">返航</el-button>
        <el-button type="success" :disabled="drone.status !== 'idle'" @click="cmd('charge')">充电</el-button>
        <el-button v-if="drone.status === 'maintenance'" type="info" @click="cmd('resume')">恢复待机</el-button>
        <el-button v-else type="info" :disabled="drone.status !== 'idle' && drone.status !== 'offline'" @click="cmd('maintain')">转维护</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { useSimStore } from '@/store/simulation'
import { ALERT_LEVEL_MAP, DRONE_STATUS_MAP, batteryColor, fmtDateTime, fmtDuration, fmtTime } from '@/utils/format'

const props = defineProps<{ modelValue: boolean; droneId: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const store = useSimStore()
const drone = computed(() => store.drones.find((d) => d.id === props.droneId))
const statusInfo = computed(() => (drone.value ? DRONE_STATUS_MAP[drone.value.status] : DRONE_STATUS_MAP.idle))
const currentTaskName = computed(() => {
  const t = store.tasks.find((x) => x.id === drone.value?.taskId)
  return t ? `${t.name}（${t.progress}%）` : '无'
})
const relatedAlerts = computed(() => store.alerts.filter((a) => a.droneId === props.droneId).slice(0, 5))

const drawerSize = computed(() => (window.innerWidth < 640 ? '100%' : '420px'))

// 遥测曲线
const chartEl = ref<HTMLElement>()
let chart: echarts.ECharts | null = null
let chartTimer: ReturnType<typeof setInterval> | null = null

function renderChart() {
  if (!chart || !props.droneId) return
  const data = store.telemetry[props.droneId] ?? []
  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 40, right: 40, top: 30, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['速度', '高度'], textStyle: { color: '#8fa3cc' }, top: 0 },
    xAxis: {
      type: 'category',
      data: data.map((p) => fmtTime(p.t)),
      axisLabel: { color: '#7c8db5', fontSize: 10 },
      axisLine: { lineStyle: { color: 'rgba(0,229,255,0.2)' } }
    },
    yAxis: [
      { type: 'value', name: 'm/s', axisLabel: { color: '#7c8db5' }, splitLine: { lineStyle: { color: 'rgba(0,229,255,0.08)' } } },
      { type: 'value', name: 'm', axisLabel: { color: '#7c8db5' }, splitLine: { show: false } }
    ],
    series: [
      { name: '速度', type: 'line', smooth: true, showSymbol: false, data: data.map((p) => p.speed), lineStyle: { color: '#00e5ff' }, itemStyle: { color: '#00e5ff' } },
      { name: '高度', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: false, data: data.map((p) => p.altitude), lineStyle: { color: '#a78bfa' }, itemStyle: { color: '#a78bfa' } }
    ]
  })
}

watch(
  () => [props.modelValue, props.droneId],
  ([visible]) => {
    if (visible) {
      setTimeout(() => {
        if (!chart && chartEl.value) chart = echarts.init(chartEl.value)
        chart?.resize()
        renderChart()
        if (chartTimer) clearInterval(chartTimer)
        chartTimer = setInterval(renderChart, 1000)
      }, 50)
    } else {
      if (chartTimer) clearInterval(chartTimer)
      chartTimer = null
    }
  }
)

onMounted(() => window.addEventListener('resize', () => chart?.resize()))
onBeforeUnmount(() => {
  if (chartTimer) clearInterval(chartTimer)
  chart?.dispose()
})

function cmd(action: 'takeoff' | 'return' | 'charge' | 'maintain' | 'resume') {
  const res = store.droneCommand(props.droneId, action)
  if (res.ok) ElMessage.success(res.msg)
  else ElMessage.warning(res.msg)
}
</script>

<style scoped>
.drawer-body {
  padding: 4px;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-glow);
}

.drone-name {
  font-size: 18px;
  font-weight: 700;
  color: #eaf4ff;
}

.drone-sn {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.section-title {
  margin: 18px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 1px;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.tele-item {
  grid-column: span 2;
}

.tele-item.half {
  grid-column: span 1;
}

.tele-label {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.tele-value {
  font-size: 20px;
  font-weight: 700;
  color: #eaf4ff;
}

.tele-value span {
  font-size: 12px;
  color: var(--text-dim);
  font-weight: 400;
}

.telemetry-chart {
  height: 180px;
  width: 100%;
}

.alert-row {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed rgba(0, 229, 255, 0.1);
}

.alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.alert-msg {
  font-size: 13px;
}

.alert-time {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.drawer-actions {
  margin-top: 20px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
