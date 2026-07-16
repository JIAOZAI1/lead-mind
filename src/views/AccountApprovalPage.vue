<script setup>
// 注册审核 / 开户业务：管理员从待审核用户列表发起通过开户或拒绝审核
// 仅 admin 角色可见（菜单显隐 + 路由守卫拦截，见 useNavigation.js / router/index.js）
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { AxMessage } from '@jiaozai1/axis-ui'
import { adminApi, REVIEW_STATUS, REVIEW_STATUS_META, TENANT_STATUS_META, USER_STATUS_META } from '../api/adminApi'
import { jobApi, EXECUTION_STATUS_META } from '../api/jobApi'
import { ApiError } from '../api/http'
import { formatDateTime } from '../utils/datetime'

// ---- 待审核用户列表：服务端分页 ----
const pendingUsers = ref([])
const usersLoading = ref(false)
const usersPagination = reactive({
  page: 1,
  pageSize: 20,
  pageSizes: [10, 20, 50, 100],
  total: 0,
})
const usersSort = reactive({ key: '', order: '' })

// 待审核接口支持 createdAt 排序，但当前响应体不返回 createdAt；默认用 createdAt 倒序拿最新注册用户。
const userColumns = [
  { key: 'id', title: '用户 ID', align: 'center', sortable: true },
  { key: 'username', title: '用户名', align: 'center' },
  { key: 'email', title: '邮箱', align: 'center' },
  { key: 'status', title: '账号状态', align: 'center' },
  { key: 'reviewStatus', title: '审核状态', align: 'center' },
  { key: 'roles', title: '角色', align: 'center' },
  { key: 'actions', title: '操作', align: 'center' },
]

async function loadPendingUsers(page = usersPagination.page) {
  usersLoading.value = true
  try {
    const result = await adminApi.listReviewUsers({
      reviewStatus: REVIEW_STATUS.PENDING,
      page,
      pageSize: usersPagination.pageSize,
      sortBy: usersSort.key || 'createdAt',
      sortOrder: usersSort.order || 'desc',
    })
    pendingUsers.value = result.items
    usersPagination.page = result.page ?? page
    usersPagination.pageSize = result.pageSize ?? usersPagination.pageSize
    usersPagination.total = result.total
  } catch (err) {
    AxMessage.error(`待审核用户加载失败：${err.message}`)
  } finally {
    usersLoading.value = false
  }
}

function onUsersPageChange(page, pageSize) {
  usersPagination.pageSize = pageSize
  loadPendingUsers(page)
}

function onUsersSortChange() {
  loadPendingUsers(1)
}

// ---- 开户结果（租户）列表：服务端分页 ----
const tenants = ref([])
const loading = ref(false)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  pageSizes: [10, 20, 50, 100],
  total: 0,
})
const sort = reactive({ key: 'id', order: 'desc' })

// 表头与内容统一居中，是本项目表格的默认对齐方案
const columns = [
  { key: 'id', title: 'ID', align: 'center', sortable: true },
  { key: 'tenantCode', title: '租户编码', align: 'center', sortable: true },
  { key: 'db', title: '数据库', align: 'center' },
  { key: 'licenseExpiresAt', title: 'License 到期时间', align: 'center' },
  { key: 'reviewedBy', title: '审核人 ID', align: 'center' },
  { key: 'status', title: '状态', align: 'center', sortable: true },
  { key: 'createdAt', title: '创建时间', align: 'center', sortable: true },
]

async function loadTenants(page = pagination.page) {
  loading.value = true
  try {
    const result = await adminApi.listTenants({
      page,
      pageSize: pagination.pageSize,
      sortBy: sort.key || 'id',
      sortOrder: sort.order || 'desc',
    })
    tenants.value = result.items
    pagination.page = result.page ?? page
    pagination.pageSize = result.pageSize ?? pagination.pageSize
    pagination.total = result.total
  } catch (err) {
    AxMessage.error(`开户记录加载失败：${err.message}`)
  } finally {
    loading.value = false
  }
}

function onPageChange(page, pageSize) {
  pagination.pageSize = pageSize
  loadTenants(page)
}

function onSortChange() {
  loadTenants(1)
}

// ---- 数据库实例下拉（开户向导用于选择目标实例）----
const databaseInstances = ref([])

async function loadDatabaseInstances() {
  try {
    // 开户向导通常实例数量不多，一次拉一页大的即可，不做二次分页
    const result = await adminApi.listDatabaseInstances({ page: 1, pageSize: 100 })
    databaseInstances.value = result.items
  } catch (err) {
    AxMessage.error(`数据库实例加载失败：${err.message}`)
  }
}

const databaseInstanceOptions = computed(() =>
  databaseInstances.value.map((inst) => ({ value: inst.id, label: `${inst.name}（${inst.host}:${inst.port}）` })),
)

// ---- 审核通过并开户 ----
const reviewVisible = ref(false)
const reviewSubmitting = ref(false)
const reviewFormRef = ref(null)
const reviewingUser = ref(null)
const reviewStep = ref(0)
const reviewForm = reactive({ databaseInstanceId: '', licenseExpiresAt: '' })
const REVIEW_WIZARD_STEPS = ['确认用户', '开户设置', '执行进度']
const reviewRules = {
  databaseInstanceId: [{ required: true, message: '请选择目标数据库实例' }],
  licenseExpiresAt: [
    { required: true, message: '请选择 License 到期时间' },
    { validator: (value) => new Date(value) > new Date() || 'License 到期时间必须晚于当前时间' },
  ],
}

// 审核结果：同步部分返回后进入"开户进行中"轮询态，展示 4 步编排进度
const reviewResult = ref(null)
const jobStatus = ref(null)
const POLL_INTERVAL = 3000
let pollTimer = null

// 与 backend-job-service 挂载的固定 4 个任务一一对应（services/admin-service README 中的编排顺序）
const PROVISION_STEPS = ['创建数据库', '创建数据库用户', '标记用户已审核', '激活租户']

const provisionCurrentStep = computed(() => {
  const executions = jobStatus.value?.latestExecution?.taskExecutions
  if (!executions?.length) return 0
  const succeededCount = executions.filter((t) => t.status === 3).length
  return succeededCount
})

const provisionFailed = computed(() => jobStatus.value?.latestExecution?.status === 4)
const provisionSucceeded = computed(() => jobStatus.value?.latestExecution?.status === 3)

function openReviewModal(user) {
  reviewingUser.value = user
  reviewForm.databaseInstanceId = ''
  reviewForm.licenseExpiresAt = ''
  reviewStep.value = 0
  reviewResult.value = null
  jobStatus.value = null
  reviewVisible.value = true
  if (!databaseInstances.value.length) loadDatabaseInstances()
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollJobStatus(jobId) {
  try {
    jobStatus.value = await jobApi.getJobStatus(jobId)
    if (jobStatus.value.latestExecution?.status === 3 || jobStatus.value.latestExecution?.status === 4) {
      stopPolling()
      if (jobStatus.value.latestExecution.status === 3) {
        AxMessage.success(`用户 ${reviewResult.value.userId} 开户完成`)
        await Promise.all([loadPendingUsers(1), loadTenants(1)])
      }
    }
  } catch {
    // 轮询失败静默跳过，等下一轮，避免短暂网络抖动打断管理员当前弹窗
  }
}

async function onSubmitReview() {
  if (!reviewingUser.value || !(await reviewFormRef.value.validate())) return
  reviewSubmitting.value = true
  try {
    const result = await adminApi.approveReview(Number(reviewingUser.value.id), {
      databaseInstanceId: Number(reviewForm.databaseInstanceId),
      licenseExpiresAt: new Date(reviewForm.licenseExpiresAt).toISOString(),
    })
    reviewResult.value = result
    AxMessage.success(`审核通过，开户任务已触发（Job #${result.jobId}）`)
    stopPolling()
    await pollJobStatus(result.jobId)
    // 首次查询可能已经是终态（执行很快时常见）：只有仍未结束才需要开定时轮询
    if (!provisionSucceeded.value && !provisionFailed.value) {
      pollTimer = setInterval(() => pollJobStatus(result.jobId), POLL_INTERVAL)
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      AxMessage.error('用户或数据库实例不存在，请刷新后重试')
      await loadPendingUsers(1)
    } else if (err instanceof ApiError && err.status === 500 && err.message) {
      AxMessage.error(`开户编排失败：${err.message}`)
    } else {
      AxMessage.error(`审核失败：${err.message}`)
    }
  } finally {
    reviewSubmitting.value = false
  }
}

async function beforeReviewNext(step) {
  if (step === 0) return true
  if (step === 1) {
    await onSubmitReview()
    return !!reviewResult.value
  }
  return true
}

// 开户失败后可直接用原用户重试：全链路幂等，重新提交同一个 userId 即可
function onRetryReview() {
  onSubmitReview()
}

// ---- 拒绝审核 ----
const rejectingUser = ref(null)
const rejectVisible = ref(false)
const rejecting = ref(false)

function openRejectModal(user) {
  rejectingUser.value = user
  rejectVisible.value = true
}

async function onRejectReview() {
  if (!rejectingUser.value) return
  rejecting.value = true
  try {
    await adminApi.rejectReview(Number(rejectingUser.value.id))
    AxMessage.success(`已拒绝用户「${rejectingUser.value.username}」的注册申请`)
    rejectingUser.value = null
    rejectVisible.value = false
    await loadPendingUsers(1)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      AxMessage.error('用户不存在或已被处理，请刷新后重试')
      await loadPendingUsers(1)
    } else {
      AxMessage.error(`拒绝失败：${err.message}`)
    }
  } finally {
    rejecting.value = false
  }
}

onMounted(() => {
  loadPendingUsers()
  loadTenants()
})

onUnmounted(stopPolling)
</script>

<template>
  <section class="account-approval-page">
    <ax-card title="待审核用户" borderless>
      <template #extra>
        <ax-button :disabled="usersLoading" @click="loadPendingUsers()"><ax-icon name="refresh" size="sm" />刷新</ax-button>
      </template>

      <ax-table
        v-model:sort-key="usersSort.key"
        v-model:sort-order="usersSort.order"
        :columns="userColumns"
        :data="pendingUsers"
        :empty-text="usersLoading ? '加载中…' : '暂无待审核用户'"
        size="sm"
        striped
        @sort-change="onUsersSortChange"
      >
        <template #cell-id="{ value }">
          <ax-text code>{{ value }}</ax-text>
        </template>
        <template #cell-username="{ value }">
          <ax-text weight="medium">{{ value }}</ax-text>
        </template>
        <template #cell-email="{ value }">
          <ax-text type="secondary">{{ value }}</ax-text>
        </template>
        <template #cell-status="{ value }">
          <ax-tag :type="USER_STATUS_META[value]?.tag">{{ USER_STATUS_META[value]?.label ?? value }}</ax-tag>
        </template>
        <template #cell-reviewStatus="{ value }">
          <ax-tag :type="REVIEW_STATUS_META[value]?.tag">{{ REVIEW_STATUS_META[value]?.label ?? value }}</ax-tag>
        </template>
        <template #cell-roles="{ value }">
          <ax-space v-if="value?.length" size="xs" wrap>
            <ax-tag v-for="role in value" :key="role" type="primary" round>{{ role }}</ax-tag>
          </ax-space>
          <ax-text v-else type="tertiary">-</ax-text>
        </template>
        <template #cell-actions="{ row }">
          <ax-space size="sm">
            <ax-link @click="openReviewModal(row)"><ax-icon name="check" size="sm" />通过开户</ax-link>
            <ax-link type="danger" @click="openRejectModal(row)"><ax-icon name="close" size="sm" />拒绝</ax-link>
          </ax-space>
        </template>
      </ax-table>

      <div class="account-approval-page__pagination">
        <ax-pagination
          v-model:current="usersPagination.page"
          v-model:page-size="usersPagination.pageSize"
          :page-sizes="usersPagination.pageSizes"
          :total="usersPagination.total"
          show-total
          show-size-changer
          @change="onUsersPageChange"
        />
      </div>
    </ax-card>

    <ax-card title="开户记录" borderless>
      <template #extra>
        <ax-button :disabled="loading" @click="loadTenants()"><ax-icon name="refresh" size="sm" />刷新</ax-button>
      </template>

      <ax-table
        v-model:sort-key="sort.key"
        v-model:sort-order="sort.order"
        :columns="columns"
        :data="tenants"
        :empty-text="loading ? '加载中…' : '暂无开户记录'"
        size="sm"
        striped
        @sort-change="onSortChange"
      >
        <template #cell-id="{ value }">
          <ax-text code>{{ value }}</ax-text>
        </template>
        <template #cell-tenantCode="{ value }">
          <ax-text code weight="medium">{{ value }}</ax-text>
        </template>
        <template #cell-db="{ row }">
          <ax-text code size="sm">{{ row.dbHost }}:{{ row.dbPort }} / {{ row.dbName }}</ax-text>
        </template>
        <template #cell-licenseExpiresAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-status="{ value }">
          <ax-tag :type="TENANT_STATUS_META[value]?.tag">{{ TENANT_STATUS_META[value]?.label ?? value }}</ax-tag>
        </template>
        <template #cell-createdAt="{ value }">{{ formatDateTime(value) }}</template>
      </ax-table>

      <div class="account-approval-page__pagination">
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

  <ax-wizard-modal
    v-model="reviewVisible"
    v-model:step="reviewStep"
    title="审核通过并开户"
    width="var(--axis-container-sm)"
    :steps="REVIEW_WIZARD_STEPS"
    :before-next="beforeReviewNext"
    :next-text="reviewStep === 1 ? '提交开户' : '下一步'"
    finish-text="完成"
  >
    <template #step-0>
      <ax-descriptions class="account-approval-page__target" :column="2" size="sm" layout="vertical">
        <ax-descriptions-item label="用户 ID"><ax-text code>{{ reviewingUser?.id }}</ax-text></ax-descriptions-item>
        <ax-descriptions-item label="用户名">{{ reviewingUser?.username }}</ax-descriptions-item>
        <ax-descriptions-item label="邮箱" :span="2">{{ reviewingUser?.email }}</ax-descriptions-item>
        <ax-descriptions-item label="审核状态">
          <ax-tag :type="REVIEW_STATUS_META[reviewingUser?.reviewStatus]?.tag">
            {{ REVIEW_STATUS_META[reviewingUser?.reviewStatus]?.label ?? reviewingUser?.reviewStatus }}
          </ax-tag>
        </ax-descriptions-item>
        <ax-descriptions-item label="账号状态">
          <ax-tag :type="USER_STATUS_META[reviewingUser?.status]?.tag">
            {{ USER_STATUS_META[reviewingUser?.status]?.label ?? reviewingUser?.status }}
          </ax-tag>
        </ax-descriptions-item>
      </ax-descriptions>
      <ax-text type="secondary" size="sm" block>
        确认用户信息后继续设置开户数据库实例与 License 到期时间。
      </ax-text>
    </template>

    <template #step-1>
      <ax-form ref="reviewFormRef" :model="reviewForm" :rules="reviewRules" @submit="onSubmitReview">
        <ax-form-item label="数据库实例" prop="databaseInstanceId">
          <ax-select v-model="reviewForm.databaseInstanceId" :options="databaseInstanceOptions" placeholder="选择开户目标实例" />
        </ax-form-item>
        <ax-form-item label="License 到期" prop="licenseExpiresAt">
          <ax-input v-model="reviewForm.licenseExpiresAt" type="datetime-local" />
        </ax-form-item>
      </ax-form>
      <ax-text v-if="!databaseInstances.length" type="secondary" size="sm" block>
        暂无可用数据库实例，请先前往「数据库实例注册」添加。
      </ax-text>
      <ax-text v-else type="secondary" size="sm" block>
        到期时间会随开户请求写入租户记录，必须晚于当前时间；已有租户重试时后端不会覆盖原到期时间。
      </ax-text>
    </template>

    <template #step-2>
      <ax-descriptions :column="2" size="sm" layout="vertical">
        <ax-descriptions-item label="用户 ID">{{ reviewResult.userId }}</ax-descriptions-item>
        <ax-descriptions-item label="租户编码"><ax-text code>{{ reviewResult.tenant.tenantCode }}</ax-text></ax-descriptions-item>
        <ax-descriptions-item label="开户 Job"><ax-text code>#{{ reviewResult.jobId }}</ax-text></ax-descriptions-item>
        <ax-descriptions-item label="License 到期">{{ formatDateTime(reviewResult.tenant.licenseExpiresAt) }}</ax-descriptions-item>
        <ax-descriptions-item label="目标数据库">
          <ax-text code size="sm">{{ reviewResult.tenant.dbHost }}:{{ reviewResult.tenant.dbPort }} / {{ reviewResult.tenant.dbName }}</ax-text>
        </ax-descriptions-item>
      </ax-descriptions>

      <ax-steps class="account-approval-page__steps" :steps="PROVISION_STEPS" :current="provisionCurrentStep" />

      <ax-space size="sm" align="center">
        <ax-tag v-if="jobStatus?.latestExecution" :type="EXECUTION_STATUS_META[jobStatus.latestExecution.status]?.tag">
          {{ EXECUTION_STATUS_META[jobStatus.latestExecution.status]?.label }}
        </ax-tag>
        <ax-text v-if="!provisionSucceeded && !provisionFailed" type="secondary" size="sm">开户进行中，每 {{ POLL_INTERVAL / 1000 }} 秒自动刷新…</ax-text>
      </ax-space>
      <ax-text v-if="provisionFailed && jobStatus.latestExecution.errorMessage" type="error" size="sm" block>
        {{ jobStatus.latestExecution.errorMessage }}
      </ax-text>
      <!-- 全链路幂等设计：开户失败后可用同一个 userId 直接重试 -->
      <ax-space v-if="provisionFailed" class="account-approval-page__retry" size="sm">
        <ax-button type="primary" :loading="reviewSubmitting" @click="onRetryReview">
          <ax-icon name="refresh" size="sm" />重试开户
        </ax-button>
      </ax-space>
    </template>
  </ax-wizard-modal>

  <ax-modal v-model="rejectVisible" title="拒绝注册申请" width="var(--axis-container-sm)" :mask-closable="false">
    <ax-alert
      type="error"
      title="拒绝不可撤销"
      description="拒绝后该用户会被后端软删除，不能再对同一用户 ID 执行通过或拒绝；用户可用同一用户名或邮箱重新注册。"
    />
    <ax-descriptions class="account-approval-page__target" :column="2" size="sm" layout="vertical">
      <ax-descriptions-item label="用户 ID"><ax-text code>{{ rejectingUser?.id }}</ax-text></ax-descriptions-item>
      <ax-descriptions-item label="用户名">{{ rejectingUser?.username }}</ax-descriptions-item>
      <ax-descriptions-item label="邮箱" :span="2">{{ rejectingUser?.email }}</ax-descriptions-item>
    </ax-descriptions>
    <template #footer>
      <ax-button @click="rejectVisible = false">取消</ax-button>
      <ax-button type="danger" :loading="rejecting" @click="onRejectReview"><ax-icon name="close" size="sm" />确认拒绝</ax-button>
    </template>
  </ax-modal>
</template>

<style scoped>
.account-approval-page {
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}

.account-approval-page__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--axis-space-4);
}

.account-approval-page__target {
  margin-bottom: var(--axis-space-5);
}

.account-approval-page__steps {
  margin: var(--axis-space-5) 0;
}

.account-approval-page__retry {
  margin-top: var(--axis-space-4);
}
</style>
