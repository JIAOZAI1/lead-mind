<script setup>
// 后台作业列表：展示本浏览器已知的作业 + 新建作业 + 按 ID 添加已有作业
// 后端暂无「作业列表」接口（只能按 ID 查询），列表由 localStorage 里记录的 ID 逐个拉详情拼出，
// 后端补列表接口后可去掉 knownJobIds 这层
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AxMessage } from '@jiaozai1/axis-ui'
import { jobApi, SCHEDULE_TYPE, SCHEDULE_TYPE_META, JOB_STATUS_META } from '../api/jobApi'
import { ApiError } from '../api/http'
import { formatDateTime } from '../utils/datetime'
import { loadKnownJobIds, addKnownJobId, removeKnownJobId } from '../utils/knownJobIds'

const router = useRouter()

const jobs = ref([])
const loading = ref(false)

const columns = [
  { key: 'id', title: 'ID', align: 'center' },
  { key: 'name', title: '作业名称' },
  { key: 'schedule', title: '调度方式' },
  { key: 'status', title: '状态', align: 'center' },
  { key: 'nextRunAt', title: '下次执行时间' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'actions', title: '操作', align: 'center' },
]

/** 按本地记录的 ID 并发拉取作业详情；已被后端删除（404）的自动从本地记录清理 */
async function loadJobs() {
  loading.value = true
  const ids = loadKnownJobIds()
  const results = await Promise.allSettled(ids.map((id) => jobApi.getJob(id)))
  const list = []
  let failed = 0
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      list.push(result.value)
    } else if (result.reason instanceof ApiError && result.reason.status === 404) {
      removeKnownJobId(ids[index])
    } else {
      failed += 1
    }
  })
  jobs.value = list.sort((a, b) => b.id - a.id)
  loading.value = false
  if (failed > 0) AxMessage.error(`${failed} 个作业加载失败，请稍后刷新重试`)
}

onMounted(loadJobs)

// ---- 按 ID 添加已有作业 ----
const importJobId = ref('')
const importing = ref(false)

async function onImportJob() {
  const id = Number(importJobId.value)
  if (!Number.isInteger(id) || id <= 0) {
    AxMessage.warning('请输入正确的作业 ID（正整数）')
    return
  }
  importing.value = true
  try {
    const job = await jobApi.getJob(id)
    addKnownJobId(job.id)
    importJobId.value = ''
    await loadJobs()
    AxMessage.success(`已添加作业「${job.name}」`)
  } catch (err) {
    AxMessage.error(err instanceof ApiError && err.status === 404 ? `作业 ${id} 不存在` : `添加失败：${err.message}`)
  } finally {
    importing.value = false
  }
}

/** 仅从本地列表移除，不影响后端作业本身 */
function onRemoveJob(job) {
  removeKnownJobId(job.id)
  jobs.value = jobs.value.filter((item) => item.id !== job.id)
  AxMessage.info(`已从列表移除「${job.name}」（后端作业不受影响）`)
}

// ---- 新建作业 ----
const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref(null)

const createForm = reactive({
  name: '',
  description: '',
  scheduleType: SCHEDULE_TYPE.CRON,
  cronExpression: '',
  runAt: '',
})

// cron / 一次性时间按当前调度类型二选一必填，切换类型后另一个字段不参与校验
const createRules = computed(() => ({
  name: [{ required: true, message: '请输入作业名称' }],
  cronExpression:
    createForm.scheduleType === SCHEDULE_TYPE.CRON
      ? [
          { required: true, message: '请输入 Cron 表达式' },
          { pattern: /^\S+(\s+\S+){4}$/, message: 'Cron 为 5 段格式，如 */5 * * * *' },
        ]
      : [],
  runAt:
    createForm.scheduleType === SCHEDULE_TYPE.ONE_TIME
      ? [
          { required: true, message: '请选择执行时间' },
          {
            validator: (value) => new Date(value) > new Date() || '执行时间必须晚于当前时间',
          },
        ]
      : [],
}))

function openCreateModal() {
  createForm.name = ''
  createForm.description = ''
  createForm.scheduleType = SCHEDULE_TYPE.CRON
  createForm.cronExpression = ''
  createForm.runAt = ''
  createVisible.value = true
}

async function onCreateJob() {
  if (!(await createFormRef.value.validate())) return
  creating.value = true
  try {
    const isCron = createForm.scheduleType === SCHEDULE_TYPE.CRON
    const job = await jobApi.createJob({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      scheduleType: createForm.scheduleType,
      // 后端校验两字段与调度类型严格互斥，未用到的必须不传
      cronExpression: isCron ? createForm.cronExpression.trim() : undefined,
      // datetime-local 取到的是本地时间，转成 UTC ISO 串提交
      runAt: isCron ? undefined : new Date(createForm.runAt).toISOString(),
    })
    addKnownJobId(job.id)
    createVisible.value = false
    await loadJobs()
    AxMessage.success(`作业「${job.name}」创建成功，可进入详情配置任务`)
  } catch (err) {
    AxMessage.error(`创建失败：${err.message}`)
  } finally {
    creating.value = false
  }
}

function goDetail(job) {
  router.push({ name: 'job-detail', params: { jobId: job.id } })
}
</script>

<template>
  <section class="jobs-page">
    <ax-alert
      class="jobs-page__notice"
      type="info"
      title="列表为本地记录"
      description="作业服务暂未提供列表查询接口，此处仅展示本浏览器创建过或按 ID 添加过的作业。"
      closable
    />

    <ax-card title="后台作业" borderless>
      <template #extra>
        <ax-space size="sm">
          <ax-button :disabled="loading" @click="loadJobs">刷新</ax-button>
          <ax-button type="primary" @click="openCreateModal">新建作业</ax-button>
        </ax-space>
      </template>
      <div class="jobs-page__toolbar">
        <ax-space size="sm" wrap>
          <ax-input
            v-model="importJobId"
            class="jobs-page__import-input"
            placeholder="输入作业 ID 添加"
            clearable
            @keyup.enter="onImportJob"
          />
          <ax-button :loading="importing" @click="onImportJob">添加</ax-button>
        </ax-space>
      </div>

      <ax-table :columns="columns" :data="jobs" :empty-text="loading ? '加载中…' : '暂无作业，点击右上角新建'" size="sm" striped>
        <template #cell-id="{ value }">
          <ax-text code>{{ value }}</ax-text>
        </template>
        <template #cell-name="{ row }">
          <ax-space direction="vertical" size="xs" align="start">
            <ax-text weight="medium">{{ row.name }}</ax-text>
            <ax-text v-if="row.description" type="tertiary" size="xs" ellipsis :text="row.description" />
          </ax-space>
        </template>
        <template #cell-schedule="{ row }">
          <ax-space size="sm">
            <ax-tag :type="SCHEDULE_TYPE_META[row.scheduleType]?.tag" round>
              {{ SCHEDULE_TYPE_META[row.scheduleType]?.label ?? row.scheduleType }}
            </ax-tag>
            <ax-text code size="sm" ellipsis :text="row.scheduleType === SCHEDULE_TYPE.CRON ? row.cronExpression : formatDateTime(row.runAt)" />
          </ax-space>
        </template>
        <template #cell-status="{ row }">
          <ax-tag :type="JOB_STATUS_META[row.status]?.tag">
            {{ JOB_STATUS_META[row.status]?.label ?? row.status }}
          </ax-tag>
        </template>
        <template #cell-nextRunAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-createdAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-actions="{ row }">
          <ax-space size="sm">
            <ax-link @click="goDetail(row)">详情</ax-link>
            <ax-link type="default" size="sm" @click="onRemoveJob(row)">移除</ax-link>
          </ax-space>
        </template>
      </ax-table>
    </ax-card>
  </section>

  <ax-modal v-model="createVisible" title="新建作业">
    <ax-form
      ref="createFormRef"
      :model="createForm"
      :rules="createRules"
      label-position="top"
      @submit="onCreateJob"
    >
      <ax-form-item label="作业名称" prop="name">
        <ax-input v-model="createForm.name" placeholder="如：每日线索同步" clearable />
      </ax-form-item>
      <ax-form-item label="描述" prop="description">
        <ax-input v-model="createForm.description" placeholder="选填，说明作业用途" clearable />
      </ax-form-item>
      <ax-form-item label="调度方式" prop="scheduleType">
        <ax-radio-group v-model="createForm.scheduleType">
          <ax-radio :value="SCHEDULE_TYPE.CRON">Cron 周期</ax-radio>
          <ax-radio :value="SCHEDULE_TYPE.ONE_TIME">一次性</ax-radio>
        </ax-radio-group>
      </ax-form-item>
      <ax-form-item v-if="createForm.scheduleType === SCHEDULE_TYPE.CRON" label="Cron 表达式" prop="cronExpression">
        <ax-input v-model="createForm.cronExpression" placeholder="*/5 * * * *（分 时 日 月 周）" />
      </ax-form-item>
      <ax-form-item v-else label="执行时间" prop="runAt">
        <ax-input v-model="createForm.runAt" type="datetime-local" />
      </ax-form-item>
    </ax-form>

    <!-- footer 用 AxModal 内置插槽承载，布局与内边距由组件提供，提交走表单 ref 校验 -->
    <template #footer>
      <ax-button @click="createVisible = false">取消</ax-button>
      <ax-button type="primary" :loading="creating" @click="onCreateJob">创建</ax-button>
    </template>
  </ax-modal>
</template>

<style scoped>
.jobs-page {
  --jobs-import-input-width: calc(var(--axis-container-sm) * 0.3);
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}

.jobs-page__toolbar {
  margin-bottom: var(--axis-space-4);
}

.jobs-page__import-input {
  min-width: var(--axis-space-16);
  width: var(--jobs-import-input-width);
}
</style>
