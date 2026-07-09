<script setup>
// 作业详情：作业信息 + 最新执行状态（自动轮询）+ 任务编排 + 执行记录
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxMessage } from '@jiaozai1/axis-ui'
import {
  jobApi,
  SCHEDULE_TYPE,
  SCHEDULE_TYPE_META,
  JOB_STATUS_META,
  EXECUTION_STATUS_META,
  TASK_EXECUTION_STATUS_META,
} from '../api/jobApi'
import { ApiError } from '../api/http'
import { formatDateTime } from '../utils/datetime'

const route = useRoute()
const router = useRouter()
const jobId = Number(route.params.jobId)

const job = ref(null)
const notFound = ref(false)

// ---- 最新执行状态：后端 /status 专供前端轮询，进行中每 5 秒刷一次 ----
const latestExecution = ref(null)
// 轮询间隔挂在 L3 语义常量上便于统一调整（毫秒）
const STATUS_POLL_INTERVAL = 5000
let statusTimer = null

async function refreshStatus() {
  try {
    const status = await jobApi.getJobStatus(jobId)
    latestExecution.value = status.latestExecution
    if (job.value) {
      // 状态接口同时带回最新的作业状态与下次执行时间，同步进头部信息
      job.value.status = status.jobStatus
      job.value.nextRunAt = status.nextRunAt
    }
  } catch {
    // 轮询失败静默跳过，等下一轮；持续失败时头部信息保持最后一次成功的数据
  }
}

// ---- 任务编排 ----
const tasks = ref([])
const taskColumns = [
  { key: 'order', title: '顺序', align: 'center' },
  { key: 'name', title: '任务名称' },
  { key: 'handlerType', title: 'Handler 类型' },
  { key: 'pluginAssembly', title: '插件程序集' },
  { key: 'timeoutSeconds', title: '超时(秒)', align: 'center' },
  { key: 'maxRetryCount', title: '最大重试', align: 'center' },
]

async function loadTasks() {
  tasks.value = await jobApi.listJobTasks(jobId)
}

/** 任务执行记录里只有 jobTaskId，用任务列表映射出名称 */
const taskNameById = computed(() =>
  Object.fromEntries(tasks.value.map((task) => [task.id, task.name])),
)

// ---- 执行记录 ----
const executions = ref([])
const executionsLoading = ref(false)
const executionLimit = ref(20)
const limitOptions = [
  { label: '最近 20 条', value: 20 },
  { label: '最近 50 条', value: 50 },
  { label: '最近 200 条', value: 200 },
]
const executionColumns = [
  { key: 'id', title: '执行 ID', align: 'center' },
  { key: 'status', title: '状态', align: 'center' },
  { key: 'triggeredAt', title: '触发时间' },
  { key: 'startedAt', title: '开始时间' },
  { key: 'finishedAt', title: '结束时间' },
  { key: 'actions', title: '操作', align: 'center' },
]

async function loadExecutions() {
  executionsLoading.value = true
  try {
    executions.value = await jobApi.listExecutions(jobId, executionLimit.value)
  } catch (err) {
    AxMessage.error(`执行记录加载失败：${err.message}`)
  } finally {
    executionsLoading.value = false
  }
}

// ---- 执行详情弹窗（列表数据已含任务明细，无需再请求） ----
const executionDetail = ref(null)
const detailVisible = ref(false)
const taskExecutionColumns = [
  { key: 'task', title: '任务' },
  { key: 'status', title: '状态', align: 'center' },
  { key: 'attemptCount', title: '尝试次数', align: 'center' },
  { key: 'startedAt', title: '开始时间' },
  { key: 'finishedAt', title: '结束时间' },
  { key: 'result', title: '输出 / 错误' },
]

function openExecutionDetail(execution) {
  executionDetail.value = execution
  detailVisible.value = true
}

// ---- 新建任务 ----
const createTaskVisible = ref(false)
const creatingTask = ref(false)
const taskFormRef = ref(null)

const taskForm = reactive({
  name: '',
  order: '1',
  handlerType: '',
  pluginAssembly: '',
  parametersJson: '{}',
  timeoutSeconds: '300',
  maxRetryCount: '0',
})

// AxInput 取值是字符串，数字字段统一走整数校验器
const positiveInt = (message) => ({
  validator: (value) => (Number.isInteger(Number(value)) && Number(value) > 0) || message,
})
const nonNegativeInt = (message) => ({
  validator: (value) => (Number.isInteger(Number(value)) && Number(value) >= 0) || message,
})

const taskRules = {
  name: [{ required: true, message: '请输入任务名称' }],
  order: [{ required: true, message: '请输入执行顺序' }, positiveInt('顺序必须是正整数')],
  handlerType: [{ required: true, message: '请输入 Handler 完整类型名（含命名空间）' }],
  pluginAssembly: [
    { required: true, message: '请输入插件 DLL 文件名' },
    { pattern: /\.dll$/i, message: '插件程序集应为 .dll 文件名' },
  ],
  parametersJson: [
    {
      validator: (value) => {
        if (!value) return true
        try {
          JSON.parse(value)
          return true
        } catch {
          return '参数必须是合法 JSON'
        }
      },
    },
  ],
  timeoutSeconds: [positiveInt('超时秒数必须是正整数')],
  maxRetryCount: [nonNegativeInt('重试次数不能为负数')],
}

function openCreateTask() {
  taskForm.name = ''
  // 顺序默认接在现有任务后面
  taskForm.order = String(tasks.value.length + 1)
  taskForm.handlerType = ''
  taskForm.pluginAssembly = ''
  taskForm.parametersJson = '{}'
  taskForm.timeoutSeconds = '300'
  taskForm.maxRetryCount = '0'
  createTaskVisible.value = true
}

async function onCreateTask() {
  if (!(await taskFormRef.value.validate())) return
  creatingTask.value = true
  try {
    const task = await jobApi.createJobTask(jobId, {
      name: taskForm.name.trim(),
      order: Number(taskForm.order),
      handlerType: taskForm.handlerType.trim(),
      pluginAssembly: taskForm.pluginAssembly.trim(),
      parametersJson: taskForm.parametersJson.trim() || '{}',
      timeoutSeconds: Number(taskForm.timeoutSeconds),
      maxRetryCount: Number(taskForm.maxRetryCount),
    })
    createTaskVisible.value = false
    await loadTasks()
    AxMessage.success(`任务「${task.name}」创建成功`)
  } catch (err) {
    AxMessage.error(`创建失败：${err.message}`)
  } finally {
    creatingTask.value = false
  }
}

// ---- 初始加载 ----
const activeTab = ref('tasks')

onMounted(async () => {
  try {
    job.value = await jobApi.getJob(jobId)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound.value = true
      return
    }
    AxMessage.error(`作业加载失败：${err.message}`)
    return
  }
  await Promise.all([loadTasks(), loadExecutions(), refreshStatus()])
  statusTimer = setInterval(refreshStatus, STATUS_POLL_INTERVAL)
})

onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer)
})
</script>

<template>
  <ax-alert
    v-if="notFound"
    class="job-detail__not-found"
    type="warning"
    title="作业不存在"
    :description="`作业 ${jobId} 不存在或已被删除。`"
  />

  <section v-else-if="job" class="job-detail">
    <!-- 作业基本信息 -->
    <ax-card class="job-detail__card" borderless>
      <template #title>
        <div class="job-detail__title-block">
          <ax-space size="sm" wrap>
            <span>{{ job.name }}</span>
            <ax-tag :type="SCHEDULE_TYPE_META[job.scheduleType]?.tag" round>
              {{ SCHEDULE_TYPE_META[job.scheduleType]?.label }}
            </ax-tag>
            <ax-tag :type="JOB_STATUS_META[job.status]?.tag">
              {{ JOB_STATUS_META[job.status]?.label }}
            </ax-tag>
          </ax-space>
          <ax-text v-if="job.description" type="secondary" size="sm" block>{{ job.description }}</ax-text>
        </div>
      </template>
      <template #extra>
        <ax-link @click="router.push({ name: 'jobs' })">返回列表</ax-link>
      </template>
      <ax-descriptions :column="4" size="sm" layout="vertical">
        <ax-descriptions-item label="作业 ID">{{ job.id }}</ax-descriptions-item>
        <ax-descriptions-item :label="job.scheduleType === SCHEDULE_TYPE.CRON ? 'Cron 表达式' : '执行时间'">
          <ax-text code ellipsis :text="job.scheduleType === SCHEDULE_TYPE.CRON ? job.cronExpression : formatDateTime(job.runAt)" />
        </ax-descriptions-item>
        <ax-descriptions-item label="下次执行">{{ formatDateTime(job.nextRunAt) }}</ax-descriptions-item>
        <ax-descriptions-item label="创建时间">{{ formatDateTime(job.createdAt) }}</ax-descriptions-item>
      </ax-descriptions>
    </ax-card>

    <!-- 最新执行状态（每 5 秒自动轮询） -->
    <ax-card class="job-detail__card" title="最新执行" borderless>
      <template #extra>
        <ax-text type="secondary" size="xs">状态每 {{ STATUS_POLL_INTERVAL / 1000 }} 秒自动刷新</ax-text>
      </template>
      <template v-if="latestExecution">
        <ax-space size="md" wrap>
          <ax-tag :type="EXECUTION_STATUS_META[latestExecution.status]?.tag">
            {{ EXECUTION_STATUS_META[latestExecution.status]?.label }}
          </ax-tag>
          <ax-text code>#{{ latestExecution.id }}</ax-text>
          <ax-text>触发于 {{ formatDateTime(latestExecution.triggeredAt) }}</ax-text>
          <ax-link size="sm" @click="openExecutionDetail(latestExecution)">查看明细</ax-link>
        </ax-space>
        <ax-text v-if="latestExecution.errorMessage" type="error" size="sm" block>
          {{ latestExecution.errorMessage }}
        </ax-text>
      </template>
      <ax-text v-else type="secondary">尚未触发过执行，到达调度时间后会自动生成执行记录。</ax-text>
    </ax-card>

    <ax-card borderless>
      <ax-tabs v-model="activeTab">
        <ax-tab-pane name="tasks" label="任务编排">
          <ax-space class="job-detail__toolbar" block justify="space-between" wrap>
            <ax-text type="secondary" size="sm">任务按顺序号依次执行，前一步失败则中断后续任务。</ax-text>
            <ax-button type="primary" @click="openCreateTask">新建任务</ax-button>
          </ax-space>
          <ax-table :columns="taskColumns" :data="tasks" empty-text="还没有任务，新建任务并绑定插件后作业才会真正执行" size="sm" striped>
            <template #cell-name="{ value }">
              <ax-text weight="medium">{{ value }}</ax-text>
            </template>
            <template #cell-handlerType="{ value }"><ax-text code ellipsis :text="value" /></template>
            <template #cell-pluginAssembly="{ value }"><ax-text code ellipsis :text="value" /></template>
          </ax-table>
        </ax-tab-pane>

        <ax-tab-pane name="executions" label="执行记录">
          <ax-space class="job-detail__toolbar" block justify="space-between" wrap>
            <ax-text type="secondary" size="sm">按触发时间倒序查看历史执行。</ax-text>
            <ax-space size="sm">
              <ax-select v-model="executionLimit" :options="limitOptions" size="sm" @change="loadExecutions" />
              <ax-button :disabled="executionsLoading" @click="loadExecutions">刷新</ax-button>
            </ax-space>
          </ax-space>
          <ax-table
            :columns="executionColumns"
            :data="executions"
            :empty-text="executionsLoading ? '加载中…' : '暂无执行记录'"
            size="sm"
            striped
          >
            <template #cell-status="{ row }">
              <ax-tag :type="EXECUTION_STATUS_META[row.status]?.tag">
                {{ EXECUTION_STATUS_META[row.status]?.label }}
              </ax-tag>
            </template>
            <template #cell-triggeredAt="{ value }">{{ formatDateTime(value) }}</template>
            <template #cell-startedAt="{ value }">{{ formatDateTime(value) }}</template>
            <template #cell-finishedAt="{ value }">{{ formatDateTime(value) }}</template>
            <template #cell-actions="{ row }">
              <ax-link @click="openExecutionDetail(row)">明细</ax-link>
            </template>
          </ax-table>
        </ax-tab-pane>
      </ax-tabs>
    </ax-card>
  </section>

  <!-- 执行明细弹窗：每个任务的执行状态、重试次数与输出/错误 -->
  <ax-modal v-model="detailVisible" :title="`执行 #${executionDetail?.id} 明细`" width="var(--axis-container-md)" :show-footer="false">
    <template v-if="executionDetail">
      <ax-text v-if="executionDetail.errorMessage" type="error" size="sm" block>{{ executionDetail.errorMessage }}</ax-text>
      <ax-table :columns="taskExecutionColumns" :data="executionDetail.taskExecutions" empty-text="本次执行没有任务记录" size="sm">
        <template #cell-task="{ row }">{{ taskNameById[row.jobTaskId] ?? `任务 ${row.jobTaskId}` }}</template>
        <template #cell-status="{ row }">
          <ax-tag :type="TASK_EXECUTION_STATUS_META[row.status]?.tag">
            {{ TASK_EXECUTION_STATUS_META[row.status]?.label }}
          </ax-tag>
        </template>
        <template #cell-startedAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-finishedAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-result="{ row }">
          <ax-text v-if="row.errorMessage" type="error" size="sm">{{ row.errorMessage }}</ax-text>
          <ax-text v-else-if="row.outputJson" code ellipsis :text="row.outputJson" />
          <span v-else>—</span>
        </template>
      </ax-table>
    </template>
  </ax-modal>

  <!-- 新建任务弹窗 -->
  <ax-modal v-model="createTaskVisible" title="新建任务" width="var(--axis-container-sm)">
    <ax-form
      ref="taskFormRef"
      :model="taskForm"
      :rules="taskRules"
      label-position="top"
      @submit="onCreateTask"
    >
      <ax-form-item label="任务名称" prop="name">
        <ax-input v-model="taskForm.name" placeholder="如：同步线索数据" clearable />
      </ax-form-item>
      <ax-form-item label="执行顺序" prop="order">
        <ax-input v-model="taskForm.order" placeholder="数字越小越先执行" />
      </ax-form-item>
      <ax-form-item label="Handler 类型" prop="handlerType">
        <ax-input v-model="taskForm.handlerType" placeholder="如 SamplePlugin.EchoTaskHandler" />
      </ax-form-item>
      <ax-form-item label="插件程序集" prop="pluginAssembly">
        <ax-input v-model="taskForm.pluginAssembly" placeholder="如 SamplePlugin.dll" />
      </ax-form-item>
      <ax-form-item label="参数 JSON" prop="parametersJson">
        <ax-input v-model="taskForm.parametersJson" placeholder='{"key":"value"}' />
      </ax-form-item>
      <ax-form-item label="超时（秒）" prop="timeoutSeconds">
        <ax-input v-model="taskForm.timeoutSeconds" />
      </ax-form-item>
      <ax-form-item label="最大重试" prop="maxRetryCount">
        <ax-input v-model="taskForm.maxRetryCount" />
      </ax-form-item>
    </ax-form>

    <!-- footer 用 AxModal 内置插槽承载，提交走表单 ref 校验 -->
    <template #footer>
      <ax-button @click="createTaskVisible = false">取消</ax-button>
      <ax-button type="primary" :loading="creatingTask" @click="onCreateTask">创建</ax-button>
    </template>
  </ax-modal>
</template>

<style scoped>
.job-detail {
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}

.job-detail__card {
  flex-shrink: 0;
}

.job-detail__title-block {
  min-width: 0;
}

.job-detail__toolbar {
  margin-bottom: var(--axis-space-3);
}
</style>
