<template>
  <div class="page-container">
    <div class="tech-card">
      <div class="filter-bar">
        <el-input v-model="keyword" placeholder="搜索任务名称 / 操作员" clearable style="width: 220px" @input="page = 1">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px" @change="page = 1">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="typeFilter" placeholder="类型" clearable style="width: 130px" @change="page = 1">
          <el-option v-for="t in TASK_TYPES" :key="t" :label="t" :value="t" />
        </el-select>
        <div class="spacer"></div>
        <el-button type="primary" @click="openCreate">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>新建任务
        </el-button>
      </div>
    </div>

    <div class="tech-card">
      <el-table :data="pagedTasks" stripe style="width: 100%">
        <el-table-column prop="name" label="任务名称" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" @click="openRoutePreview(row)">{{ row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.priority === '高' ? 'danger' : row.priority === '中' ? 'warning' : 'info'" size="small" effect="plain">
              {{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="taskStatusOf(row.status).tag" size="small" effect="dark">{{ taskStatusOf(row.status).label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" min-width="150">
          <template #default="{ row }">
            <el-progress
              :percentage="row.progress"
              :stroke-width="8"
              :status="row.status === 'aborted' ? 'exception' : row.status === 'completed' ? 'success' : undefined"
            />
          </template>
        </el-table-column>
        <el-table-column label="执行无人机" width="110">
          <template #default="{ row }">{{ row.droneName ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="distance" label="里程" width="80">
          <template #default="{ row }">{{ row.distance }} km</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作员" width="90" />
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">{{ fmtDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending' || row.status === 'paused'" size="small" text type="success" @click="startTask(row)">
              {{ row.status === 'paused' ? '恢复' : '开始' }}
            </el-button>
            <el-button v-if="row.status === 'running'" size="small" text type="warning" @click="store.pauseTask(row.id)">暂停</el-button>
            <el-button v-if="row.status === 'running' || row.status === 'paused'" size="small" text type="danger" @click="abortTask(row)">终止</el-button>
            <el-button v-if="row.status === 'pending'" size="small" text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'completed' || row.status === 'aborted'" size="small" text type="danger" @click="removeTask(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="filteredTasks.length"
          :page-sizes="[8, 12, 20]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>

    <TaskFormDialog v-model="dialogVisible" :edit-task="editTask" />

    <!-- 航线预览 -->
    <el-dialog v-model="routeDialogVisible" :title="`航线预览 · ${previewTask?.name ?? ''}`" :width="routeDialogWidth">
      <div v-if="previewTask" class="route-preview">
        <MapCanvas :drones="previewDrones" :zones="store.zones" :tasks="[previewTask]" :show-trails="false" />
      </div>
      <el-descriptions v-if="previewTask" :column="2" border size="small" style="margin-top: 12px">
        <el-descriptions-item label="航点数">{{ previewTask.route.length }}</el-descriptions-item>
        <el-descriptions-item label="航线里程">{{ previewTask.distance }} km</el-descriptions-item>
        <el-descriptions-item label="状态">{{ TASK_STATUS_MAP[previewTask.status].label }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ previewTask.description || '—' }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { useSimStore } from '@/store/simulation'
import { TASK_STATUS_MAP, fmtDateTime } from '@/utils/format'
import TaskFormDialog from '@/components/TaskFormDialog.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import type { FlightTask, TaskStatus, TaskType } from '@/types'

const store = useSimStore()
const TASK_TYPES: TaskType[] = ['电力巡检', '物流配送', '地形测绘', '安防巡逻', '应急救援']

const statusOptions = (Object.keys(TASK_STATUS_MAP) as TaskStatus[]).map((k) => ({ value: k, label: TASK_STATUS_MAP[k].label }))

const taskStatusOf = (s: TaskStatus) => TASK_STATUS_MAP[s]

const keyword = ref('')
const statusFilter = ref<TaskStatus | ''>('')
const typeFilter = ref<TaskType | ''>('')
const page = ref(1)
const pageSize = ref(8)

const dialogVisible = ref(false)
const editTask = ref<FlightTask | null>(null)

const routeDialogVisible = ref(false)
const previewTask = ref<FlightTask | null>(null)
const routeDialogWidth = computed(() => (window.innerWidth < 700 ? '96%' : '720px'))

const previewDrones = computed(() => {
  if (!previewTask.value?.droneId) return []
  const d = store.getDrone(previewTask.value.droneId)
  return d ? [d] : []
})

const filteredTasks = computed(() =>
  store.tasks.filter((t) => {
    if (keyword.value && !t.name.includes(keyword.value) && !t.operator.includes(keyword.value)) return false
    if (statusFilter.value && t.status !== statusFilter.value) return false
    if (typeFilter.value && t.type !== typeFilter.value) return false
    return true
  })
)

const pagedTasks = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredTasks.value.slice(start, start + pageSize.value)
})

function openCreate() {
  editTask.value = null
  dialogVisible.value = true
}

function openEdit(task: FlightTask) {
  editTask.value = task
  dialogVisible.value = true
}

function openRoutePreview(task: FlightTask) {
  previewTask.value = task
  routeDialogVisible.value = true
}

function startTask(task: FlightTask) {
  const ok = store.startTask(task.id)
  if (ok) ElMessage.success(`「${task.name}」已开始执行`)
  else ElMessage.warning('暂无可用无人机（需待机且电量 > 30%）')
}

async function abortTask(task: FlightTask) {
  await ElMessageBox.confirm(`确定终止任务「${task.name}」？执行中的无人机将自动返航。`, '终止确认', {
    confirmButtonText: '终止任务',
    cancelButtonText: '取消',
    type: 'warning'
  })
  store.abortTask(task.id)
  ElMessage.info('任务已终止，无人机返航中')
}

async function removeTask(task: FlightTask) {
  await ElMessageBox.confirm(`确定删除任务「${task.name}」？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
  store.deleteTask(task.id)
  ElMessage.success('任务已删除')
}
</script>

<style scoped>
.route-preview {
  height: 380px;
}
</style>
