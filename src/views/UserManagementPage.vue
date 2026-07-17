<script setup>
// 用户管理：admin-service 全量用户列表（服务端分页）+ 密码重置 + sso-service 角色授权
// 仅 admin 角色可见（菜单显隐 + 路由守卫拦截，见 useNavigation.js / router/index.js）
import { computed, onMounted, reactive, ref } from 'vue'
import { AxMessage } from '@jiaozai1/axis-ui'
import { userApi } from '../api/userApi'
import { ApiError } from '../api/http'
import { formatDateTime } from '../utils/datetime'

// ---- 用户列表：服务端分页 ----
const users = ref([])
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
  { key: 'index', title: '序号', type: 'index', align: 'center' },
  { key: 'username', title: '用户名', align: 'center', sortable: true },
  { key: 'email', title: '邮箱', align: 'center' },
  { key: 'roles', title: '角色', align: 'center' },
  { key: 'enabled', title: '账号状态', align: 'center' },
  { key: 'tenantCode', title: '租户编码', align: 'center' },
  { key: 'licenseExpiresAt', title: 'License 到期时间', align: 'center' },
  { key: 'createdAt', title: '创建时间', align: 'center', sortable: true },
  { key: 'actions', title: '操作', align: 'center' },
]

const ENABLED_META = {
  true: { label: '正常', tag: 'success' },
  false: { label: '已禁用', tag: 'default' },
}

async function loadUsers(page = pagination.page) {
  loading.value = true
  try {
    const result = await userApi.listUsers({
      page,
      pageSize: pagination.pageSize,
      // 第三次点击表头清空排序（key 为空）时回落默认 id 倒序
      sortBy: sort.key || 'id',
      sortOrder: sort.order || 'desc',
    })
    users.value = result.items
    pagination.page = result.page ?? page
    pagination.pageSize = result.pageSize ?? pagination.pageSize
    pagination.total = result.total
  } catch (err) {
    AxMessage.error(`用户列表加载失败：${err.message}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

function onPageChange(page, pageSize) {
  pagination.pageSize = pageSize
  loadUsers(page)
}

function onSortChange() {
  loadUsers(1)
}

// ---- 重置密码 ----
const resetTarget = ref(null)
const resetVisible = ref(false)
const resetting = ref(false)
// 重置成功后返回的临时密码：只在本次弹窗内展示一次，关闭后无法再次查看（后端不落库不记日志）
const resetResult = ref(null)

function openResetModal(row) {
  resetTarget.value = row
  resetResult.value = null
  resetVisible.value = true
}

async function onConfirmReset() {
  if (!resetTarget.value) return
  resetting.value = true
  try {
    const result = await userApi.resetPassword(resetTarget.value.id)
    resetResult.value = result
    AxMessage.success(`用户「${resetTarget.value.username}」密码已重置`)
  } catch (err) {
    AxMessage.error(`重置失败：${err.message}`)
  } finally {
    resetting.value = false
  }
}

function closeResetModal() {
  resetVisible.value = false
  resetTarget.value = null
  resetResult.value = null
}

async function copyNewPassword() {
  try {
    await navigator.clipboard.writeText(resetResult.value.newPassword)
    AxMessage.success('已复制到剪贴板')
  } catch {
    AxMessage.error('复制失败，请手动选中复制')
  }
}

// ---- 用户详情 ----
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailUser = ref(null)

async function openDetailModal(row) {
  detailVisible.value = true
  detailLoading.value = true
  detailUser.value = null
  try {
    detailUser.value = await userApi.getUser(row.id)
  } catch (err) {
    AxMessage.error(`用户详情加载失败：${err.message}`)
  } finally {
    detailLoading.value = false
  }
}

// ---- 启用 / 禁用 ----
const enableTarget = ref(null)
const enableVisible = ref(false)
const enableSubmitting = ref(false)

function openEnableModal(row) {
  enableTarget.value = row
  enableVisible.value = true
}

async function onConfirmEnableToggle() {
  if (!enableTarget.value) return
  const target = enableTarget.value
  enableSubmitting.value = true
  try {
    if (target.enabled) {
      await userApi.disableUser(target.id)
      AxMessage.success(`用户「${target.username}」已禁用`)
    } else {
      await userApi.enableUser(target.id)
      AxMessage.success(`用户「${target.username}」已启用`)
    }
    enableVisible.value = false
    enableTarget.value = null
    await loadUsers(pagination.page)
  } catch (err) {
    AxMessage.error(`${target.enabled ? '禁用' : '启用'}失败：${err.message}`)
  } finally {
    enableSubmitting.value = false
  }
}

// ---- 用户授权（角色分配）----
const roleOptions = ref([])
const authTarget = ref(null)
const authVisible = ref(false)
const authLoading = ref(false)
const authSaving = ref(false)
// 打开弹窗时的原始角色集合，用于提交时与勾选结果做差异对比
const originalRoles = ref([])
const selectedRoles = ref([])

async function loadRoles() {
  try {
    const result = await userApi.listRoles()
    roleOptions.value = result
  } catch (err) {
    AxMessage.error(`角色列表加载失败：${err.message}`)
  }
}

// AxSelect 多选需要 { value, label } 结构，角色描述拼进 label 供下拉时区分
const roleSelectOptions = computed(() =>
  roleOptions.value.map((role) => ({
    value: role.name,
    label: role.description ? `${role.name}（${role.description}）` : role.name,
  })),
)

async function openAuthModal(row) {
  authTarget.value = row
  authVisible.value = true
  authLoading.value = true
  selectedRoles.value = []
  originalRoles.value = []
  try {
    if (!roleOptions.value.length) await loadRoles()
    const roles = await userApi.listUserRoles(row.id)
    originalRoles.value = roles.map((r) => r.name)
    selectedRoles.value = [...originalRoles.value]
  } catch (err) {
    AxMessage.error(`用户角色加载失败：${err.message}`)
  } finally {
    authLoading.value = false
  }
}

function closeAuthModal() {
  authVisible.value = false
  authTarget.value = null
}

async function onSaveAuth() {
  if (!authTarget.value) return
  const toAdd = selectedRoles.value.filter((name) => !originalRoles.value.includes(name))
  const toRemove = originalRoles.value.filter((name) => !selectedRoles.value.includes(name))
  if (!toAdd.length && !toRemove.length) {
    closeAuthModal()
    return
  }
  authSaving.value = true
  try {
    await Promise.all([
      ...toAdd.map((name) => userApi.assignRole(authTarget.value.id, name)),
      ...toRemove.map((name) => userApi.removeRole(authTarget.value.id, name)),
    ])
    AxMessage.success(`用户「${authTarget.value.username}」角色已更新`)
    closeAuthModal()
    await loadUsers(pagination.page)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      AxMessage.error('用户或角色不存在，请刷新后重试')
      await loadUsers(pagination.page)
    } else {
      AxMessage.error(`授权失败：${err.message}`)
    }
  } finally {
    authSaving.value = false
  }
}

const authRolesChanged = computed(() => {
  const added = selectedRoles.value.some((name) => !originalRoles.value.includes(name))
  const removed = originalRoles.value.some((name) => !selectedRoles.value.includes(name))
  return added || removed
})
</script>

<template>
  <section class="user-management-page">
    <ax-card title="用户管理" borderless>
      <template #extra>
        <ax-button :disabled="loading" @click="loadUsers()"><ax-icon name="refresh" size="sm" />刷新</ax-button>
      </template>

      <ax-table
        v-model:sort-key="sort.key"
        v-model:sort-order="sort.order"
        :columns="columns"
        :data="users"
        :index-offset="(pagination.page - 1) * pagination.pageSize"
        :empty-text="loading ? '加载中…' : '暂无用户'"
        size="sm"
        striped
        @sort-change="onSortChange"
      >
        <template #cell-username="{ value, row }">
          <ax-link type="default" weight="medium" @click="openDetailModal(row)">{{ value }}</ax-link>
        </template>
        <template #cell-email="{ value }">
          <ax-text type="secondary">{{ value }}</ax-text>
        </template>
        <template #cell-roles="{ value }">
          <ax-space v-if="value?.length" size="xs" wrap>
            <ax-tag v-for="role in value" :key="role" type="primary" round>{{ role }}</ax-tag>
          </ax-space>
          <ax-text v-else type="tertiary">-</ax-text>
        </template>
        <template #cell-enabled="{ value }">
          <ax-tag :type="ENABLED_META[value]?.tag">{{ ENABLED_META[value]?.label ?? value }}</ax-tag>
        </template>
        <template #cell-tenantCode="{ value }">
          <ax-text v-if="value" code size="sm">{{ value }}</ax-text>
          <ax-text v-else type="tertiary">-</ax-text>
        </template>
        <template #cell-licenseExpiresAt="{ value }">{{ value ? formatDateTime(value) : '-' }}</template>
        <template #cell-createdAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-actions="{ row }">
          <ax-space size="sm">
            <ax-link type="default" @click="openAuthModal(row)"><ax-icon name="shield" size="sm" />授权</ax-link>
            <ax-link type="default" @click="openResetModal(row)"><ax-icon name="key" size="sm" />重置密码</ax-link>
            <ax-link :type="row.enabled ? 'danger' : 'default'" @click="openEnableModal(row)">
              <ax-icon :name="row.enabled ? 'lock' : 'unlock'" size="sm" />{{ row.enabled ? '禁用' : '启用' }}
            </ax-link>
          </ax-space>
        </template>
      </ax-table>

      <div class="user-management-page__pagination">
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

  <!-- 重置密码：危险操作，先二次确认，成功后展示一次性临时密码 -->
  <ax-modal v-model="resetVisible" title="重置密码" width="var(--axis-container-sm)" :mask-closable="false" :closable="false">
    <template v-if="!resetResult">
      <ax-alert
        type="error"
        title="重置后原密码立即失效"
        description="系统会生成一个新的随机密码，用户需使用新密码重新登录。请确认后再继续。"
      />
      <ax-text block class="user-management-page__confirm-text">
        确认重置用户「{{ resetTarget?.username }}」的登录密码？
      </ax-text>
    </template>
    <template v-else>
      <ax-alert type="success" title="密码已重置" description="新密码仅在此处显示一次，请立即复制并妥善转告用户，关闭弹窗后将无法再次查看。" />
      <div class="user-management-page__new-password">
        <ax-text code weight="medium" size="lg">{{ resetResult.newPassword }}</ax-text>
        <ax-button size="sm" @click="copyNewPassword"><ax-icon name="copy" size="sm" />复制</ax-button>
      </div>
    </template>
    <template #footer>
      <template v-if="!resetResult">
        <ax-button @click="closeResetModal">取消</ax-button>
        <ax-button type="danger" :loading="resetting" @click="onConfirmReset"><ax-icon name="key" size="sm" />确认重置</ax-button>
      </template>
      <ax-button v-else type="primary" @click="closeResetModal">完成</ax-button>
    </template>
  </ax-modal>

  <!-- 用户详情：按 ID 查询，不含租户信息（列表已展示租户列，详情只补充账号本身字段） -->
  <ax-modal v-model="detailVisible" title="用户详情" width="var(--axis-container-sm)" :show-footer="false">
    <ax-text v-if="detailLoading" type="tertiary" size="sm">加载中…</ax-text>
    <ax-descriptions v-else-if="detailUser" :column="2" size="sm" layout="vertical">
      <ax-descriptions-item label="用户名">{{ detailUser.username }}</ax-descriptions-item>
      <ax-descriptions-item label="邮箱" :span="2">{{ detailUser.email }}</ax-descriptions-item>
      <ax-descriptions-item label="账号状态">
        <ax-tag :type="ENABLED_META[detailUser.enabled]?.tag">{{ ENABLED_META[detailUser.enabled]?.label }}</ax-tag>
      </ax-descriptions-item>
      <ax-descriptions-item label="创建时间">{{ formatDateTime(detailUser.createdAt) }}</ax-descriptions-item>
    </ax-descriptions>
  </ax-modal>

  <!-- 启用/禁用：幂等操作，禁用属于危险操作需二次确认；启用无副作用，同一弹窗复用不同文案 -->
  <ax-modal v-model="enableVisible" :title="enableTarget?.enabled ? '禁用用户' : '启用用户'" width="var(--axis-container-sm)" :mask-closable="false">
    <ax-alert
      v-if="enableTarget?.enabled"
      type="error"
      title="禁用后用户无法登录"
      description="该用户下次登录会被拒绝，已登录的会话在下次校验时失效。可随时重新启用恢复访问。"
    />
    <ax-text block class="user-management-page__confirm-text">
      确认{{ enableTarget?.enabled ? '禁用' : '启用' }}用户「{{ enableTarget?.username }}」？
    </ax-text>
    <template #footer>
      <ax-button @click="enableVisible = false">取消</ax-button>
      <ax-button :type="enableTarget?.enabled ? 'danger' : 'primary'" :loading="enableSubmitting" @click="onConfirmEnableToggle">
        <ax-icon :name="enableTarget?.enabled ? 'lock' : 'unlock'" size="sm" />确认{{ enableTarget?.enabled ? '禁用' : '启用' }}
      </ax-button>
    </template>
  </ax-modal>

  <!-- 用户授权：下拉多选角色，提交时与打开弹窗时的原始角色集合做差异对比，只调用变化的部分 -->
  <ax-modal v-model="authVisible" title="用户授权" width="var(--axis-container-sm)">
    <ax-text type="secondary" size="sm" block class="user-management-page__auth-hint">
      为用户「{{ authTarget?.username }}」选择拥有的角色，保存后立即生效。
    </ax-text>
    <ax-text v-if="authLoading" type="tertiary" size="sm">加载中…</ax-text>
    <ax-select
      v-else
      v-model="selectedRoles"
      multiple
      :options="roleSelectOptions"
      placeholder="选择角色"
      :max-tag-count="4"
    />
    <template #footer>
      <ax-button @click="closeAuthModal">取消</ax-button>
      <ax-button type="primary" :loading="authSaving" :disabled="!authRolesChanged" @click="onSaveAuth">保存</ax-button>
    </template>
  </ax-modal>
</template>

<style scoped>
.user-management-page {
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}

.user-management-page__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--axis-space-4);
}

.user-management-page__confirm-text {
  margin-top: var(--axis-space-4);
}

.user-management-page__new-password {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--axis-space-3);
  margin-top: var(--axis-space-4);
  padding: var(--axis-space-3) var(--axis-space-4);
  background: var(--axis-color-bg-layout);
  border-radius: var(--axis-radius-md);
}

.user-management-page__auth-hint {
  margin-bottom: var(--axis-space-4);
}
</style>
