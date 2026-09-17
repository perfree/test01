<template>
  <div class="page-container">
    <div class="tech-card">
      <div class="filter-bar">
        <el-input v-model="keyword" placeholder="搜索名称 / SN 编号" clearable style="width: 220px" @input="page = 1">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px" @change="page = 1">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="modelFilter" placeholder="机型" clearable style="width: 160px" @change="page = 1">
          <el-option v-for="m in models" :key="m" :label="m" :value="m" />
        </el-select>
        <div class="spacer"></div>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="table">表格</el-radio-button>
          <el-radio-button value="card">卡片</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 表格视图 -->
    <div v-if="viewMode === 'table'" class="tech-card">
      <el-table :data="pagedDrones" stripe style="width: 100%" :default-sort="{ prop: 'battery', order: 'ascending' }">
        <el-table-column prop="name" label="名称" min-width="110" fixed>
          <template #default="{ row }">
            <el-link type="primary" @click="openDetail(row.id)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="sn" label="SN 编号" min-width="110" />
        <el-table-column prop="model" label="机型" min-width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusOf(row.status).tag" size="small" effect="dark">
              {{ statusOf(row.status).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="电量" min-width="140" sortable prop="battery">
          <template #default="{ row }">
            <el-progress :percentage="Math.round(row.battery)" :color="batteryColor(row.battery)" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="速度" width="90">
          <template #default="{ row }">{{ row.speed.toFixed(1) }} m/s</template>
        </el-table-column>
        <el-table-column label="高度" width="80">
          <template #default="{ row }">{{ Math.round(row.altitude) }} m</template>
        </el-table-column>
        <el-table-column label="信号" width="80">
          <template #default="{ row }">
            <span :style="{ color: row.signal > 50 ? '#22c55e' : '#f59e0b' }">{{ Math.round(row.signal) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="累计飞行" width="100">
          <template #default="{ row }">{{ fmtDuration(row.flightTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openDetail(row.id)">详情</el-button>
            <el-dropdown trigger="click" @command="(cmd: string) => runCommand(row.id, cmd)">
              <el-button size="small" text type="warning">
                指令<el-icon><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="takeoff" :disabled="row.status !== 'idle'">起飞</el-dropdown-item>
                  <el-dropdown-item command="return" :disabled="row.status !== 'flying'">返航</el-dropdown-item>
                  <el-dropdown-item command="charge" :disabled="row.status !== 'idle'">充电</el-dropdown-item>
                  <el-dropdown-item v-if="row.status === 'maintenance'" command="resume">恢复待机</el-dropdown-item>
                  <el-dropdown-item v-else command="maintain" :disabled="row.status !== 'idle' && row.status !== 'offline'">转维护</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filteredDrones.length"
          :page-sizes="[8, 12, 24]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>

    <!-- 卡片视图 -->
    <template v-else>
      <div class="drone-cards">
        <div v-for="d in pagedDrones" :key="d.id" class="drone-card tech-card" @click="openDetail(d.id)">
          <div class="dc-header">
            <span class="dc-name">{{ d.name }}</span>
            <el-tag :type="DRONE_STATUS_MAP[d.status].tag" size="small" effect="dark">{{ DRONE_STATUS_MAP[d.status].label }}</el-tag>
          </div>
          <div class="dc-model">{{ d.model }} · {{ d.sn }}</div>
          <div class="dc-metrics">
            <div><span class="dc-label">速度</span>{{ d.speed.toFixed(1) }} m/s</div>
            <div><span class="dc-label">高度</span>{{ Math.round(d.altitude) }} m</div>
            <div><span class="dc-label">信号</span>{{ Math.round(d.signal) }}%</div>
          </div>
          <el-progress :percentage="Math.round(d.battery)" :color="batteryColor(d.battery)" :stroke-width="8" />
        </div>
      </div>
      <div class="pager-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filteredDrones.length"
          :page-sizes="[8, 12, 24]"
          layout="total, sizes, prev, pager, next"
          background
        />
      </div>
    </template>

    <DroneDetailDrawer v-model="drawerVisible" :drone-id="selectedDroneId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, Search } from '@element-plus/icons-vue'
import { useSimStore } from '@/store/simulation'
import { DRONE_STATUS_MAP, batteryColor, fmtDuration } from '@/utils/format'
import DroneDetailDrawer from '@/components/DroneDetailDrawer.vue'
import type { DroneStatus } from '@/types'

const store = useSimStore()

const keyword = ref('')
const statusFilter = ref<DroneStatus | ''>('')
const modelFilter = ref('')
const viewMode = ref<'table' | 'card'>('table')
const page = ref(1)
const pageSize = ref(12)

const drawerVisible = ref(false)
const selectedDroneId = ref('')

const models = computed(() => [...new Set(store.drones.map((d) => d.model))])

const statusOptions = (Object.keys(DRONE_STATUS_MAP) as DroneStatus[]).map((k) => ({ value: k, label: DRONE_STATUS_MAP[k].label }))

const statusOf = (s: DroneStatus) => DRONE_STATUS_MAP[s]

const filteredDrones = computed(() =>
  store.drones.filter((d) => {
    if (keyword.value && !d.name.includes(keyword.value) && !d.sn.toLowerCase().includes(keyword.value.toLowerCase())) return false
    if (statusFilter.value && d.status !== statusFilter.value) return false
    if (modelFilter.value && d.model !== modelFilter.value) return false
    return true
  })
)

const pagedDrones = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredDrones.value.slice(start, start + pageSize.value)
})

function openDetail(id: string) {
  selectedDroneId.value = id
  drawerVisible.value = true
}

function runCommand(id: string, cmd: string) {
  const res = store.droneCommand(id, cmd as 'takeoff' | 'return' | 'charge' | 'maintain' | 'resume')
  if (res.ok) ElMessage.success(res.msg)
  else ElMessage.warning(res.msg)
}
</script>

<style scoped>
.drone-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}

.drone-card {
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.drone-card:hover {
  transform: translateY(-3px);
  border-color: rgba(0, 229, 255, 0.5);
}

.dc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dc-name {
  font-weight: 600;
  color: #eaf4ff;
}

.dc-model {
  font-size: 12px;
  color: var(--text-dim);
  margin: 6px 0 10px;
}

.dc-metrics {
  display: flex;
  gap: 14px;
  font-size: 13px;
  margin-bottom: 10px;
}

.dc-label {
  color: var(--text-dim);
  font-size: 11px;
  margin-right: 4px;
  display: inline-block;
}
</style>
