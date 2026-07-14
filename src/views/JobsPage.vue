<script setup>
// 后台作业列表：服务端分页查询 + 新建作业
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AxMessage } from '@jiaozai1/axis-ui'
import { jobApi, SCHEDULE_TYPE, SCHEDULE_TYPE_META, JOB_STATUS_META } from '../api/jobApi'
import { formatDateTime } from '../utils/datetime'

const router = useRouter()

const jobs = ref([])
const loading = ref(false)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  pageSizes: [10, 20, 50, 100],
  total: 0,
})

// 服务端排序状态：sortable 列与后端可排序白名单一一对应（调度方式为组合列，后端无对应字段）
const sort = reactive({ key: 'id', order: 'desc' })

// 表头与内容统一居中，是本项目表格的默认对齐方案
const columns = [
  { key: 'id', title: 'ID', align: 'center', sortable: true },
  { key: 'name', title: '作业名称', align: 'center', sortable: true },
  { key: 'schedule', title: '调度方式', align: 'center' },
  { key: 'status', title: '状态', align: 'center', sortable: true },
  { key: 'nextRunAt', title: '下次执行时间', align: 'center', sortable: true },
  { key: 'createdAt', title: '创建时间', align: 'center', sortable: true },
  { key: 'actions', title: '操作', align: 'center' },
]

async function loadJobs(page = pagination.page) {
  loading.value = true
  try {
    const result = await jobApi.listJobs({
      page,
      pageSize: pagination.pageSize,
      // 第三次点击表头会清空排序（key 为空），此时回落到默认的 id 倒序
      sortBy: sort.key || 'id',
      sortOrder: sort.order || 'desc',
    })
    jobs.value = result.items
    pagination.page = result.page ?? page
    pagination.pageSize = result.pageSize ?? pagination.pageSize
    pagination.total = result.total
  } catch (err) {
    AxMessage.error(`作业列表加载失败：${err.message}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadJobs)

function onPageChange(page, pageSize) {
  pagination.pageSize = pageSize
  loadJobs(page)
}

// 排序变化后回到第一页重新查询
function onSortChange() {
  loadJobs(1)
}

// ---- 新建作业 ----
const createVisible = ref(false)
const creating = ref(false)
const createFormRef = ref(null)
const editingJob = ref(null)
const deletingJob = ref(null)
const deleteVisible = ref(false)
const deleting = ref(false)

const createForm = reactive({
  name: '',
  description: '',
  scheduleType: SCHEDULE_TYPE.CRON,
  cronExpression: '',
  runAt: '',
  status: 1,
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
  editingJob.value = null
  createForm.name = ''
  createForm.description = ''
  createForm.scheduleType = SCHEDULE_TYPE.CRON
  createForm.cronExpression = ''
  createForm.runAt = ''
  createForm.status = 1
  createVisible.value = true
}

function openEditModal(row) {
  editingJob.value = row
  createForm.name = row.name
  createForm.description = row.description ?? ''
  createForm.scheduleType = row.scheduleType
  createForm.cronExpression = row.cronExpression ?? ''
  createForm.runAt = row.runAt ? new Date(row.runAt).toISOString().slice(0, 16) : ''
  createForm.status = row.status
  createVisible.value = true
}

function buildJobPayload() {
  const isCron = createForm.scheduleType === SCHEDULE_TYPE.CRON
  const payload = {
    name: createForm.name.trim(),
    description: createForm.description.trim(),
    scheduleType: createForm.scheduleType,
    cronExpression: isCron ? createForm.cronExpression.trim() : undefined,
    runAt: isCron ? undefined : new Date(createForm.runAt).toISOString(),
  }
  if (editingJob.value) payload.status = createForm.status
  return payload
}

async function onSaveJob() {
  if (!(await createFormRef.value.validate())) return
  creating.value = true
  try {
    const payload = buildJobPayload()
    const job = editingJob.value
      ? await jobApi.updateJob(editingJob.value.id, payload)
      : await jobApi.createJob(payload)
    createVisible.value = false
    await loadJobs(editingJob.value ? pagination.page : 1)
    AxMessage.success(`作业「${job.name}」${editingJob.value ? '更新' : '创建'}成功`)
  } catch (err) {
    AxMessage.error(`${editingJob.value ? '更新' : '创建'}失败：${err.message}`)
  } finally {
    creating.value = false
  }
}

async function onDeleteJob() {
  if (!deletingJob.value) return
  deleting.value = true
  try {
    await jobApi.deleteJob(deletingJob.value.id)
    AxMessage.success(`作业「${deletingJob.value.name}」已删除`)
    deletingJob.value = null
    deleteVisible.value = false
    await loadJobs(pagination.page)
  } catch (err) {
    AxMessage.error(`删除失败：${err.message}`)
  } finally {
    deleting.value = false
  }
}

function goDetail(job) {
  router.push({ name: 'job-detail', params: { jobId: job.id } })
}

function openDeleteModal(row) {
  deletingJob.value = row
  deleteVisible.value = true
}
</script>

<template>
  <section class="jobs-page">
    <ax-card title="后台作业" borderless>
      <template #extra>
        <ax-space size="sm">
          <ax-button :disabled="loading" @click="loadJobs()">刷新</ax-button>
          <ax-button type="primary" @click="openCreateModal">新建作业</ax-button>
        </ax-space>
      </template>

      <ax-table
        v-model:sort-key="sort.key"
        v-model:sort-order="sort.order"
        :columns="columns"
        :data="jobs"
        :empty-text="loading ? '加载中…' : '暂无作业，点击右上角新建'"
        size="sm"
        striped
        @sort-change="onSortChange"
      >
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
            <ax-link type="default" @click="openEditModal(row)">编辑</ax-link>
            <ax-link type="danger" @click="openDeleteModal(row)">删除</ax-link>
          </ax-space>
        </template>
      </ax-table>

      <div class="jobs-page__pagination">
        <ax-pagination
          v-model:current="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="pagination.pageSizes"
          :total="pagination.total"
          show-total
          show-size-changer
          @change="onPageChange"
        />
      </div>
    </ax-card>
  </section>

  <ax-modal v-model="createVisible" :title="editingJob ? '编辑作业' : '新建作业'">
    <ax-form
      ref="createFormRef"
      :model="createForm"
      :rules="createRules"
      @submit="onSaveJob"
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
      <ax-form-item v-if="editingJob" label="状态" prop="status">
        <ax-radio-group v-model="createForm.status">
          <ax-radio :value="1">启用</ax-radio>
          <ax-radio :value="2">停用</ax-radio>
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
      <ax-button type="primary" :loading="creating" @click="onSaveJob">{{ editingJob ? '保存' : '创建' }}</ax-button>
    </template>
  </ax-modal>

  <ax-modal v-model="deleteVisible" title="删除作业">
    <ax-text type="error" block>确认删除作业「{{ deletingJob?.name }}」？删除后列表和调度将不再包含该作业。</ax-text>
    <template #footer>
      <ax-button @click="deleteVisible = false">取消</ax-button>
      <ax-button type="danger" :loading="deleting" @click="onDeleteJob">删除</ax-button>
    </template>
  </ax-modal>
</template>

<style scoped>
.jobs-page {
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}

.jobs-page__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--axis-space-4);
}
</style>
