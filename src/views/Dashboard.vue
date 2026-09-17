<template>
  <div class="page-container dashboard">
    <!-- 顶部统计 -->
    <div class="stat-row">
      <StatCard title="无人机总数" :value="store.drones.length" suffix="架" :icon="Van" color="#00e5ff" />
      <StatCard title="在线 / 飞行中" :value="store.onlineCount" :suffix="`/ ${store.flyingCount} 架在飞`" :icon="Connection" color="#22c55e" />
      <StatCard title="执行中任务" :value="store.runningTasks.length" suffix="项" :icon="List" color="#a78bfa" />
      <StatCard title="今日飞行架次" :value="store.totalFlights" suffix="次" :icon="Promotion" color="#38bdf8" />
      <StatCard title="未处理告警" :value="store.unhandledCount" suffix="条" :icon="Warning" color="#f43f5e" />
    </div>

    <!-- 中部：地图 + 右列 -->
    <div class="middle-row">
      <div class="tech-card map-card">
        <h3 class="tech-card-title">空域态势</h3>
        <div class="map-box">
          <MapCanvas :drones="store.drones" :zones="store.zones" :tasks="store.tasks" :selected-id="selectedDroneId" @select="onSelectDrone" />
        </div>
      </div>
      <div class="right-col">
        <div class="tech-card chart-card">
          <h3 class="tech-card-title">机队状态分布</h3>
          <div ref="pieEl" class="chart pie-chart"></div>
        </div>
        <div class="tech-card alert-card">
          <h3 class="tech-card-title">
            实时告警
            <el-link type="primary" class="more-link" @click="$router.push('/alerts')">更多 ›</el-link>
          </h3>
          <div class="alert-feed">
            <transition-group name="list">
              <div v-for="a in latestAlerts" :key="a.id" class="feed-item">
                <span class="feed-dot" :style="{ background: ALERT_LEVEL_MAP[a.level].color, boxShadow: `0 0 6px ${ALERT_LEVEL_MAP[a.level].color}` }"></span>
                <div class="feed-body">
                  <div class="feed-msg">{{ a.message }}</div>
                  <div class="feed-time">{{ fmtTime(a.time) }}</div>
                </div>
              </div>
            </transition-group>
            <el-empty v-if="!latestAlerts.length" description="暂无告警" :image-size="60" />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部图表 -->
    <div class="bottom-row">
      <div class="tech-card chart-card">
        <h3 class="tech-card-title">24 小时飞行架次趋势</h3>
        <div ref="trendEl" class="chart"></div>
      </div>
      <div class="tech-card chart-card">
        <h3 class="tech-card-title">任务类型分布</h3>
        <div ref="barEl" class="chart"></div>
      </div>
      <div class="tech-card chart-card">
        <h3 class="tech-card-title">告警级别统计</h3>
        <div ref="roseEl" class="chart"></div>
      </div>
    </div>

    <DroneDetailDrawer v-model="drawerVisible" :drone-id="selectedDroneId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Connection, List, Promotion, Van, Warning } from '@element-plus/icons-vue'
import { useSimStore } from '@/store/simulation'
import { useECharts } from '@/composables/useECharts'
import { ALERT_LEVEL_MAP, DRONE_STATUS_MAP, fmtTime } from '@/utils/format'
import StatCard from '@/components/StatCard.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import DroneDetailDrawer from '@/components/DroneDetailDrawer.vue'

const store = useSimStore()
const selectedDroneId = ref('')
const drawerVisible = ref(false)

const latestAlerts = computed(() => store.alerts.slice(0, 8))

function onSelectDrone(id: string) {
  selectedDroneId.value = id
  drawerVisible.value = true
}

// ---------- 机队状态饼图 ----------
const { el: pieEl, setOption: setPie } = useECharts()
const statusStats = computed(() => {
  const map = new Map<string, number>()
  for (const d of store.drones) {
    const label = DRONE_STATUS_MAP[d.status].label
    map.set(label, (map.get(label) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }))
})
const statusColors = ['#00e5ff', '#38bdf8', '#94a3b8', '#22c55e', '#f59e0b', '#64748b']
watch(
  statusStats,
  (data) => {
    setPie({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#8fa3cc', fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
      series: [
        {
          type: 'pie',
          radius: ['45%', '68%'],
          center: ['50%', '44%'],
          itemStyle: { borderColor: '#0c1428', borderWidth: 2 },
          label: { show: false },
          data,
          color: statusColors
        }
      ]
    })
  },
  { immediate: true, deep: true }
)

// ---------- 24h 趋势 ----------
const { el: trendEl, setOption: setTrend } = useECharts()
watch(
  () => [store.flightTrend, store.trendLabels],
  () => {
    setTrend({
      backgroundColor: 'transparent',
      grid: { left: 36, right: 16, top: 24, bottom: 24 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: store.trendLabels,
        axisLabel: { color: '#7c8db5', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.2)' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#7c8db5' },
        splitLine: { lineStyle: { color: 'rgba(0,229,255,0.08)' } }
      },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: store.flightTrend,
          lineStyle: { color: '#00e5ff', width: 2 },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(0,229,255,0.35)' },
                { offset: 1, color: 'rgba(0,229,255,0)' }
              ]
            }
          }
        }
      ]
    })
  },
  { immediate: true, deep: true }
)

// ---------- 任务类型柱状 ----------
const { el: barEl, setOption: setBar } = useECharts()
const taskTypeStats = computed(() => {
  const types = ['电力巡检', '物流配送', '地形测绘', '安防巡逻', '应急救援']
  return types.map((t) => store.tasks.filter((x) => x.type === t).length)
})
watch(
  taskTypeStats,
  (data) => {
    setBar({
      backgroundColor: 'transparent',
      grid: { left: 36, right: 16, top: 24, bottom: 40 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: ['电力巡检', '物流配送', '地形测绘', '安防巡逻', '应急救援'],
        axisLabel: { color: '#7c8db5', fontSize: 10, interval: 0, rotate: 20 },
        axisLine: { lineStyle: { color: 'rgba(0,229,255,0.2)' } }
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: '#7c8db5' },
        splitLine: { lineStyle: { color: 'rgba(0,229,255,0.08)' } }
      },
      series: [
        {
          type: 'bar',
          data,
          barWidth: 18,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#7c3aed' },
                { offset: 1, color: 'rgba(124,58,237,0.2)' }
              ]
            }
          }
        }
      ]
    })
  },
  { immediate: true, deep: true }
)

// ---------- 告警玫瑰图 ----------
const { el: roseEl, setOption: setRose } = useECharts()
const alertLevelStats = computed(() => [
  { name: '严重', value: store.alerts.filter((a) => a.level === 'critical').length, itemStyle: { color: '#f43f5e' } },
  { name: '警告', value: store.alerts.filter((a) => a.level === 'warning').length, itemStyle: { color: '#f59e0b' } },
  { name: '提示', value: store.alerts.filter((a) => a.level === 'info').length, itemStyle: { color: '#38bdf8' } }
])
watch(
  alertLevelStats,
  (data) => {
    setRose({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#8fa3cc', fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
      series: [
        {
          type: 'pie',
          roseType: 'radius',
          radius: ['20%', '70%'],
          center: ['50%', '44%'],
          label: { show: false },
          itemStyle: { borderColor: '#0c1428', borderWidth: 2 },
          data
        }
      ]
    })
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
.dashboard {
  gap: 14px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.middle-row {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 14px;
  min-height: 420px;
}

.map-card {
  display: flex;
  flex-direction: column;
}

.map-box {
  flex: 1;
  min-height: 320px;
}

.right-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.chart-card {
  display: flex;
  flex-direction: column;
}

.chart {
  height: 200px;
  width: 100%;
}

.pie-chart {
  height: 180px;
}

.alert-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.more-link {
  margin-left: auto;
  font-size: 12px;
}

.alert-feed {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.feed-item {
  display: flex;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px dashed rgba(0, 229, 255, 0.1);
}

.feed-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}

.feed-msg {
  font-size: 12.5px;
  line-height: 1.4;
}

.feed-time {
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 2px;
}

.bottom-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
}

.list-enter-active {
  transition: all 0.4s;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 1280px) {
  .stat-row {
    grid-template-columns: repeat(3, 1fr);
  }

  .middle-row {
    grid-template-columns: 1fr;
  }

  .right-col {
    flex-direction: row;
  }

  .right-col > * {
    flex: 1;
  }
}

@media (max-width: 900px) {
  .bottom-row {
    grid-template-columns: 1fr;
  }

  .right-col {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
