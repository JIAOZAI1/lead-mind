<script setup>
// 数据库实例注册：admin-service 管理接口，服务端分页查询 + 注册/编辑/删除
// 仅 admin 角色可见（菜单显隐 + 路由守卫拦截，见 useNavigation.js / router/index.js）
import { computed, onMounted, reactive, ref } from 'vue'
import { AxMessage } from '@jiaozai1/axis-ui'
import { adminApi, DB_TYPE_OPTIONS } from '../api/adminApi'
import { formatDateTime } from '../utils/datetime'

const instances = ref([])
const loading = ref(false)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  pageSizes: [10, 20, 50, 100],
  total: 0,
})

// 服务端排序状态，与后端白名单一一对应
const sort = reactive({ key: 'id', order: 'desc' })

const columns = [
  { key: 'id', title: 'ID', align: 'center', sortable: true },
  { key: 'name', title: '实例名称', sortable: true },
  { key: 'dbType', title: '类型', align: 'center', sortable: true },
  { key: 'address', title: '地址' },
  { key: 'username', title: '用户名' },
  { key: 'createdAt', title: '创建时间', sortable: true },
  { key: 'actions', title: '操作', align: 'center' },
]

async function loadInstances(page = pagination.page) {
  loading.value = true
  try {
    const result = await adminApi.listDatabaseInstances({
      page,
      pageSize: pagination.pageSize,
      // 第三次点击表头清空排序（key 为空）时回落默认 id 倒序
      sortBy: sort.key || 'id',
      sortOrder: sort.order || 'desc',
    })
    instances.value = result.items
    pagination.page = result.page ?? page
    pagination.pageSize = result.pageSize ?? pagination.pageSize
    pagination.total = result.total
  } catch (err) {
    AxMessage.error(`数据库实例列表加载失败：${err.message}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadInstances)

function onPageChange(page, pageSize) {
  pagination.pageSize = pageSize
  loadInstances(page)
}

function onSortChange() {
  loadInstances(1)
}

// ---- 新建 / 编辑 ----
const formVisible = ref(false)
const saving = ref(false)
const formRef = ref(null)
const editingInstance = ref(null)

const form = reactive({
  name: '',
  dbType: 'mysql',
  host: '',
  port: 3306,
  username: '',
  password: '',
})

const formRules = computed(() => ({
  name: [{ required: true, message: '请输入实例名称' }],
  dbType: [{ required: true, message: '请选择数据库类型' }],
  host: [{ required: true, message: '请输入实例地址' }],
  port: [
    { required: true, message: '请输入端口' },
    { validator: (value) => (Number(value) >= 1 && Number(value) <= 65535) || '端口范围为 1-65535' },
  ],
  username: [{ required: true, message: '请输入用户名' }],
  // 新建必填密码，编辑留空表示保留原密码
  password: editingInstance.value ? [] : [{ required: true, message: '请输入密码' }],
}))

function openCreateModal() {
  editingInstance.value = null
  form.name = ''
  form.dbType = 'mysql'
  form.host = ''
  form.port = 3306
  form.username = ''
  form.password = ''
  formVisible.value = true
}

function openEditModal(row) {
  editingInstance.value = row
  form.name = row.name
  form.dbType = row.dbType
  form.host = row.host
  form.port = row.port
  form.username = row.username
  form.password = ''
  formVisible.value = true
}

async function onSaveInstance() {
  if (!(await formRef.value.validate())) return
  saving.value = true
  try {
    const payload = editingInstance.value
      ? {
          name: form.name.trim(),
          host: form.host.trim(),
          port: Number(form.port),
          username: form.username.trim(),
          // 留空则不传该字段，后端保留原密码
          ...(form.password ? { password: form.password } : {}),
        }
      : {
          name: form.name.trim(),
          dbType: form.dbType,
          host: form.host.trim(),
          port: Number(form.port),
          username: form.username.trim(),
          password: form.password,
        }
    const instance = editingInstance.value
      ? await adminApi.updateDatabaseInstance(editingInstance.value.id, payload)
      : await adminApi.createDatabaseInstance(payload)
    formVisible.value = false
    await loadInstances(editingInstance.value ? pagination.page : 1)
    AxMessage.success(`数据库实例「${instance.name}」${editingInstance.value ? '更新' : '注册'}成功`)
  } catch (err) {
    AxMessage.error(`${editingInstance.value ? '更新' : '注册'}失败：${err.message}`)
  } finally {
    saving.value = false
  }
}

// ---- 删除 ----
const deletingInstance = ref(null)
const deleteVisible = ref(false)
const deleting = ref(false)

function openDeleteModal(row) {
  deletingInstance.value = row
  deleteVisible.value = true
}

async function onDeleteInstance() {
  if (!deletingInstance.value) return
  deleting.value = true
  try {
    await adminApi.deleteDatabaseInstance(deletingInstance.value.id)
    AxMessage.success(`数据库实例「${deletingInstance.value.name}」已删除`)
    deletingInstance.value = null
    deleteVisible.value = false
    await loadInstances(pagination.page)
  } catch (err) {
    AxMessage.error(`删除失败：${err.message}`)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="database-instances-page">
    <ax-card title="数据库实例注册" borderless>
      <template #extra>
        <ax-space size="sm">
          <ax-button :disabled="loading" @click="loadInstances()">刷新</ax-button>
          <ax-button type="primary" @click="openCreateModal">注册实例</ax-button>
        </ax-space>
      </template>

      <ax-table
        v-model:sort-key="sort.key"
        v-model:sort-order="sort.order"
        :columns="columns"
        :data="instances"
        :empty-text="loading ? '加载中…' : '暂无数据库实例，点击右上角注册'"
        size="sm"
        striped
        @sort-change="onSortChange"
      >
        <template #cell-id="{ value }">
          <ax-text code>{{ value }}</ax-text>
        </template>
        <template #cell-name="{ value }">
          <ax-text weight="medium">{{ value }}</ax-text>
        </template>
        <template #cell-dbType="{ value }">
          <ax-tag type="primary" round>{{ value.toUpperCase() }}</ax-tag>
        </template>
        <template #cell-address="{ row }">
          <ax-text code size="sm">{{ row.host }}:{{ row.port }}</ax-text>
        </template>
        <template #cell-createdAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #cell-actions="{ row }">
          <ax-space size="sm">
            <ax-link type="default" @click="openEditModal(row)">编辑</ax-link>
            <ax-link type="danger" @click="openDeleteModal(row)">删除</ax-link>
          </ax-space>
        </template>
      </ax-table>

      <div class="database-instances-page__pagination">
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

  <ax-modal v-model="formVisible" :title="editingInstance ? '编辑数据库实例' : '注册数据库实例'">
    <ax-form ref="formRef" :model="form" :rules="formRules" @submit="onSaveInstance">
      <ax-form-item label="实例名称" prop="name">
        <ax-input v-model="form.name" placeholder="如：订单库主实例" clearable />
      </ax-form-item>
      <ax-form-item label="数据库类型" prop="dbType">
        <!-- 编辑时类型不可改：后端接口未提供修改 dbType 的能力 -->
        <ax-radio-group v-model="form.dbType" :disabled="!!editingInstance">
          <ax-radio v-for="opt in DB_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</ax-radio>
        </ax-radio-group>
      </ax-form-item>
      <ax-form-item label="实例地址" prop="host">
        <ax-input v-model="form.host" placeholder="IP 或域名" clearable />
      </ax-form-item>
      <ax-form-item label="端口" prop="port">
        <ax-input v-model="form.port" type="number" placeholder="1-65535" />
      </ax-form-item>
      <ax-form-item label="用户名" prop="username">
        <ax-input v-model="form.username" clearable />
      </ax-form-item>
      <ax-form-item label="密码" prop="password">
        <ax-input
          v-model="form.password"
          type="password"
          :placeholder="editingInstance ? '留空则保留原密码' : '请输入密码'"
          clearable
        />
      </ax-form-item>
    </ax-form>

    <template #footer>
      <ax-button @click="formVisible = false">取消</ax-button>
      <ax-button type="primary" :loading="saving" @click="onSaveInstance">{{ editingInstance ? '保存' : '注册' }}</ax-button>
    </template>
  </ax-modal>

  <ax-modal v-model="deleteVisible" title="删除数据库实例">
    <ax-text type="error" block>确认删除数据库实例「{{ deletingInstance?.name }}」？删除后作业将无法选择该实例。</ax-text>
    <template #footer>
      <ax-button @click="deleteVisible = false">取消</ax-button>
      <ax-button type="danger" :loading="deleting" @click="onDeleteInstance">删除</ax-button>
    </template>
  </ax-modal>
</template>

<style scoped>
.database-instances-page {
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}

.database-instances-page__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--axis-space-4);
}
</style>
