<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑任务' : '新建飞行任务'"
    :width="dialogWidth"
    @update:model-value="emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入任务名称" maxlength="30" show-word-limit />
      </el-form-item>
      <el-form-item label="任务类型" prop="type">
        <el-select v-model="form.type" placeholder="请选择" style="width: 100%">
          <el-option v-for="t in TASK_TYPES" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级" prop="priority">
        <el-radio-group v-model="form.priority">
          <el-radio-button value="高">高</el-radio-button>
          <el-radio-button value="中">中</el-radio-button>
          <el-radio-button value="低">低</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="航点数量" prop="waypointCount">
        <el-slider v-model="form.waypointCount" :min="3" :max="8" show-stops :disabled="isEdit" />
        <div class="form-tip">航线将在空域内随机生成（演示模式）</div>
      </el-form-item>
      <el-form-item label="操作员" prop="operator">
        <el-select v-model="form.operator" placeholder="请选择" style="width: 100%">
          <el-option v-for="o in OPERATORS" :key="o" :label="o" :value="o" />
        </el-select>
      </el-form-item>
      <el-form-item label="任务描述">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="200" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useSimStore } from '@/store/simulation'
import type { FlightTask, TaskPriority, TaskType } from '@/types'

const props = defineProps<{ modelValue: boolean; editTask?: FlightTask | null }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean]; saved: [] }>()

const store = useSimStore()
const TASK_TYPES: TaskType[] = ['电力巡检', '物流配送', '地形测绘', '安防巡逻', '应急救援']
const OPERATORS = ['张伟', '李娜', '王强', '赵敏', '陈杰', '刘洋']

const isEdit = computed(() => !!props.editTask)
const saving = ref(false)
const formRef = ref<FormInstance>()
const dialogWidth = computed(() => (window.innerWidth < 640 ? '94%' : '520px'))

const form = reactive({
  name: '',
  type: '电力巡检' as TaskType,
  priority: '中' as TaskPriority,
  waypointCount: 5,
  operator: '张伟',
  description: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择任务类型', trigger: 'change' }],
  operator: [{ required: true, message: '请选择操作员', trigger: 'change' }]
}

function onOpen() {
  if (props.editTask) {
    form.name = props.editTask.name
    form.type = props.editTask.type
    form.priority = props.editTask.priority
    form.waypointCount = props.editTask.route.length
    form.operator = props.editTask.operator
    form.description = props.editTask.description ?? ''
  } else {
    form.name = ''
    form.type = '电力巡检'
    form.priority = '中'
    form.waypointCount = 5
    form.operator = '张伟'
    form.description = ''
  }
}

async function submit() {
  await formRef.value?.validate()
  saving.value = true
  // 模拟网络延迟
  await new Promise((r) => setTimeout(r, 400))
  if (isEdit.value && props.editTask) {
    store.updateTask(props.editTask.id, {
      name: form.name,
      type: form.type,
      priority: form.priority,
      operator: form.operator,
      description: form.description
    })
    ElMessage.success('任务已更新')
  } else {
    store.createTask({ ...form })
    ElMessage.success('任务已创建，等待调度')
  }
  saving.value = false
  emit('update:modelValue', false)
  emit('saved')
}
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.4;
}
</style>
