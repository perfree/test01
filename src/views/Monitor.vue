<template>
  <div class="page-container monitor-page">
    <div class="monitor-layout">
      <!-- 地图 -->
      <div class="tech-card map-panel">
        <h3 class="tech-card-title">
          实时飞行监控
          <el-checkbox v-model="showTrails" size="small" style="margin-left: auto">显示轨迹</el-checkbox>
        </h3>
        <div class="monitor-map">
          <MapCanvas :drones="store.drones" :zones="store.zones" :tasks="store.tasks" :selected-id="selectedId" :show-trails="showTrails" @select="selectedId = $event" />
        </div>
      </div>

      <!-- 右侧面板 -->
      <div class="side-panel">
        <div class="tech-card drone-list-card">
          <h3 class="tech-card-title">在线机队（{{ store.onlineCount }}）</h3>
          <el-input v-model="keyword" placeholder="搜索无人机" size="small" clearable style="margin-bottom: 8px">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div class="drone-list">
            <div
              v-for="d in filteredDrones"
              :key="d.id"
              class="drone-item"
              :class="{ active: d.id === selectedId }"
              @click="selectedId = d.id"
            >
              <span class="status-dot" :style="{ background: DRONE_STATUS_MAP[d.status].color, boxShadow: `0 0 6px ${DRONE_STATUS_MAP[d.status].color}` }"></span>
              <div class="di-main">
                <div class="di-name">{{ d.name }}</div>
                <div class="di-sub">{{ DRONE_STATUS_MAP[d.status].label }} · 电量 {{ Math.round(d.battery) }}%</div>
              </div>
              <span class="di-speed">{{ d.speed.toFixed(0) }} m/s</span>
            </div>
            <el-empty v-if="!filteredDrones.length" description="无匹配无人机" :image-size="50" />
          </div>
        </div>

        <div v-if="selected" class="tech-card telemetry-card">
          <h3 class="tech-card-title">{{ selected.name }} · 遥测</h3>
          <div class="tele-grid">
            <div class="tg-item">
              <div class="tg-value" :style="{ color: batteryColor(selected.battery) }">{{ Math.round(selected.battery) }}%</div>
              <div class="tg-label">电量</div>
            </div>
            <div class="tg-item">
              <div class="tg-value">{{ selected.speed.toFixed(1) }}</div>
              <div class="tg-label">速度 m/s</div>
            </div>
            <div class="tg-item">
              <div class="tg-value">{{ Math.round(selected.altitude) }}</div>
              <div class="tg-label">高度 m</div>
            </div>
            <div class="tg-item">
              <div class="tg-value">{{ Math.round(selected.signal) }}%</div>
              <div class="tg-label">信号</div>
            </div>
          </div>
          <div ref="teleChartEl" class="tele-chart"></div>
          <div class="tele-actions">
            <el-button size="small" type="warning" :disabled="selected.status !== 'flying'" @click="cmd('return')">一键返航</el-button>
            <el-button size="small" type="primary" @click="drawerVisible = true">查看详情</el-button>
          </div>
        </div>
      </div>
    </div>

    <DroneDetailDrawer v-model="drawerVisible" :drone-id="selectedId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useSimStore } from '@/store/simulation'
import { useECharts } from '@/composables/useECharts'
import { DRONE_STATUS_MAP, batteryColor, fmtTime } from '@/utils/format'
import MapCanvas from '@/components/MapCanvas.vue'
import DroneDetailDrawer from '@/components/DroneDetailDrawer.vue'

const store = useSimStore()
const selectedId = ref('')
const keyword = ref('')
const showTrails = ref(true)
const drawerVisible = ref(false)

const selected = computed(() => store.drones.find((d) => d.id === selectedId.value))

const filteredDrones = computed(() =>
  store.drones.filter((d) => !keyword.value || d.name.includes(keyword.value) || d.sn.includes(keyword.value))
)

// 默认选中第一架飞行中的无人机
watch(
  () => store.drones.length,
  () => {
    if (!selectedId.value) {
      const flying = store.drones.find((d) => d.status === 'flying')
      selectedId.value = flying?.id ?? store.drones[0]?.id ?? ''
    }
  },
  { immediate: true }
)

// 遥测曲线：随 tick 实时刷新
const { el: teleChartEl, setOption: setTele } = useECharts()
watch(
  [selectedId, () => store.tickCount],
  () => {
    if (!selectedId.value) return
    const data = store.telemetry[selectedId.value] ?? []
    setTele({
      backgroundColor: 'transparent',
      grid: { left: 34, right: 34, top: 26, bottom: 22 },
      tooltip: { trigger: 'axis' },
      legend: { data: ['速度', '高度'], textStyle: { color: '#8fa3cc', fontSize: 10 }, top: 0, itemWidth: 12, itemHeight: 8 },
      xAxis: {
        type: 'category',
        data: data.map((p) => fmtTime(p.t)),
        axisLabel: { color: '#7c8db5', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.2)' } }
      },
      yAxis: [
        { type: 'value', axisLabel: { color: '#7c8db5', fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(0,229,255,0.08)' } } },
        { type: 'value', axisLabel: { color: '#7c8db5', fontSize: 9 }, splitLine: { show: false } }
      ],
      series: [
        { name: '速度', type: 'line', smooth: true, showSymbol: false, data: data.map((p) => p.speed), lineStyle: { color: '#00e5ff' }, itemStyle: { color: '#00e5ff' } },
        { name: '高度', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: false, data: data.map((p) => p.altitude), lineStyle: { color: '#a78bfa' }, itemStyle: { color: '#a78bfa' } }
      ]
    })
  },
  { immediate: true }
)

function cmd(action: 'return') {
  if (!selectedId.value) return
  const res = store.droneCommand(selectedId.value, action)
  if (res.ok) ElMessage.success(res.msg)
  else ElMessage.warning(res.msg)
}
</script>

<style scoped>
.monitor-page {
  height: 100%;
}

.monitor-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.map-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.monitor-map {
  flex: 1;
  min-height: 400px;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
}

.drone-list-card {
  display: flex;
  flex-direction: column;
  max-height: 46%;
}

.drone-list {
  overflow-y: auto;
  min-height: 120px;
}

.drone-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}

.drone-item:hover {
  background: rgba(0, 229, 255, 0.06);
}

.drone-item.active {
  background: rgba(0, 229, 255, 0.1);
  border-color: rgba(0, 229, 255, 0.35);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.di-main {
  flex: 1;
  min-width: 0;
}

.di-name {
  font-size: 13px;
  color: #eaf4ff;
}

.di-sub {
  font-size: 11px;
  color: var(--text-dim);
}

.di-speed {
  font-size: 12px;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.tele-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.tg-item {
  text-align: center;
  background: rgba(0, 229, 255, 0.05);
  border-radius: 6px;
  padding: 8px 2px;
}

.tg-value {
  font-size: 17px;
  font-weight: 700;
  color: #eaf4ff;
}

.tg-label {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.tele-chart {
  height: 160px;
}

.tele-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .monitor-layout {
    grid-template-columns: 1fr;
  }

  .monitor-map {
    min-height: 340px;
  }

  .drone-list-card {
    max-height: 300px;
  }
}
</style>
