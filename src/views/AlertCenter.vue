<template>
  <div class="page-container">
    <!-- 统计 -->
    <div class="alert-stat-row">
      <div class="alert-stat tech-card" v-for="s in statCards" :key="s.label">
        <div class="as-value" :style="{ color: s.color }">{{ s.value }}</div>
        <div class="as-label">{{ s.label }}</div>
      </div>
    </div>

    <div class="tech-card">
      <div class="filter-bar">
        <el-input v-model="keyword" placeholder="搜索告警内容 / 无人机" clearable style="width: 220px" @input="page = 1">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="levelFilter" placeholder="级别" clearable style="width: 110px" @change="page = 1">
          <el-option v-for="o in levelOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="handledFilter" placeholder="处理状态" clearable style="width: 120px" @change="page = 1">
          <el-option label="未处理" value="unhandled" />
          <el-option label="已处理" value="handled" />
        </el-select>
        <div class="spacer"></div>
        <el-button type="success" :disabled="!store.unhandledCount" @click="handleAll">全部处理</el-button>
        <el-button type="danger" plain @click="clearHandled">清空已处理</el-button>
      </div>
    </div>

    <div class="tech-card">
      <el-table :data="pagedAlerts" stripe style="width: 100%" row-key="id">
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="levelOf(row.level).tag" size="small" effect="dark">{{ levelOf(row.level).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="110" />
        <el-table-column prop="message" label="告警内容" min-width="280" show-overflow-tooltip />
        <el-table-column label="关联无人机" width="120">
          <template #default="{ row }">
            <el-link v-if="row.droneId" type="primary" @click="openDrone(row.droneId)">{{ row.droneName }}</el-link>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ fmtDateTime(row.time) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.handled" type="success" size="small" effect="plain">已处理</el-tag>
            <el-tag v-else type="danger" size="small" effect="plain">未处理</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.handled" size="small" text type="primary" @click="openHandle(row)">处理</el-button>
            <el-tooltip v-else :content="row.handleNote" placement="left">
              <span class="handled-note">查看备注</span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filteredAlerts.length"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>

    <!-- 处理弹窗 -->
    <el-dialog v-model="handleDialogVisible" title="处理告警" :width="dialogWidth">
      <div v-if="handlingAlert" class="handle-dialog">
        <el-alert :type="handlingAlert.level === 'critical' ? 'error' : handlingAlert.level === 'warning' ? 'warning' : 'info'" :closable="false" :title="handlingAlert.message" style="margin-bottom: 14px" />
        <el-input v-model="handleNote" type="textarea" :rows="3" placeholder="请输入处理备注（可选）" maxlength="100" show-word-limit />
      </div>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmHandle">确认处理</el-button>
      </template>
    </el-dialog>

    <DroneDetailDrawer v-model="drawerVisible" :drone-id="selectedDroneId" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useSimStore } from '@/store/simulation'
import { ALERT_LEVEL_MAP, fmtDateTime } from '@/utils/format'
import DroneDetailDrawer from '@/components/DroneDetailDrawer.vue'
import type { AlertItem, AlertLevel } from '@/types'

const store = useSimStore()

const keyword = ref('')
const levelFilter = ref<AlertLevel | ''>('')
const handledFilter = ref<'' | 'handled' | 'unhandled'>('')
const page = ref(1)
const pageSize = ref(10)

const handleDialogVisible = ref(false)
const handlingAlert = ref<AlertItem | null>(null)
const handleNote = ref('')

const drawerVisible = ref(false)
const selectedDroneId = ref('')

const dialogWidth = computed(() => (window.innerWidth < 640 ? '94%' : '480px'))

const levelOptions = (Object.keys(ALERT_LEVEL_MAP) as AlertLevel[]).map((k) => ({ value: k, label: ALERT_LEVEL_MAP[k].label }))

const levelOf = (l: AlertLevel) => ALERT_LEVEL_MAP[l]

const statCards = computed(() => [
  { label: '未处理告警', value: store.unhandledCount, color: '#f43f5e' },
  { label: '严重', value: store.alerts.filter((a) => a.level === 'critical' && !a.handled).length, color: '#fb7185' },
  { label: '警告', value: store.alerts.filter((a) => a.level === 'warning' && !a.handled).length, color: '#f59e0b' },
  { label: '提示', value: store.alerts.filter((a) => a.level === 'info' && !a.handled).length, color: '#38bdf8' },
  { label: '今日累计', value: store.alerts.filter((a) => Date.now() - a.time < 24 * 3600_000).length, color: '#a78bfa' }
])

const filteredAlerts = computed(() =>
  store.alerts.filter((a) => {
    if (keyword.value && !a.message.includes(keyword.value) && !(a.droneName ?? '').includes(keyword.value)) return false
    if (levelFilter.value && a.level !== levelFilter.value) return false
    if (handledFilter.value === 'handled' && !a.handled) return false
    if (handledFilter.value === 'unhandled' && a.handled) return false
    return true
  })
)

const pagedAlerts = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredAlerts.value.slice(start, start + pageSize.value)
})

function openHandle(alert: AlertItem) {
  handlingAlert.value = alert
  handleNote.value = ''
  handleDialogVisible.value = true
}

function confirmHandle() {
  if (handlingAlert.value) {
    store.handleAlert(handlingAlert.value.id, handleNote.value || '已确认处理')
    ElMessage.success('告警已处理')
  }
  handleDialogVisible.value = false
}

async function handleAll() {
  await ElMessageBox.confirm(`确定将 ${store.unhandledCount} 条未处理告警全部标记为已处理？`, '批量处理', {
    confirmButtonText: '全部处理',
    cancelButtonText: '取消',
    type: 'warning'
  })
  store.handleAllAlerts()
  ElMessage.success('已全部处理')
}

async function clearHandled() {
  await ElMessageBox.confirm('确定清空所有已处理告警？该操作不可恢复。', '清空确认', {
    confirmButtonText: '清空',
    cancelButtonText: '取消',
    type: 'warning'
  })
  store.clearHandledAlerts()
  ElMessage.success('已清空')
}

function openDrone(id: string) {
  selectedDroneId.value = id
  drawerVisible.value = true
}
</script>

<style scoped>
.alert-stat-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.alert-stat {
  text-align: center;
  padding: 16px;
}

.as-value {
  font-size: 26px;
  font-weight: 700;
}

.as-label {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.handled-note {
  font-size: 12px;
  color: var(--text-dim);
  cursor: help;
}

@media (max-width: 900px) {
  .alert-stat-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 560px) {
  .alert-stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
