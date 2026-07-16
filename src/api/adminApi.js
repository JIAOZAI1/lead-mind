// admin-service 管理接口封装（数据库实例管理 / 用户审核开户）
// 接口契约见后端仓库 services/admin-service/README.md，全部接口要求当前用户拥有 admin 角色
import { API_ORIGIN, request } from './http'

const ADMIN_BASE = `${API_ORIGIN}/admin-service/api/v1`

/** 数据库实例类型：后端当前仅支持 mysql */
export const DB_TYPE_OPTIONS = [{ value: 'mysql', label: 'MySQL' }]

/**
 * 组装分页 + 排序 query，约定同 jobApi：page/pageSize/sortBy/sortOrder 四参数，
 * sortBy 走后端白名单校验（非法字段返回 400）
 */
function buildPagedQuery({ page = 1, pageSize = 20, sortBy, sortOrder } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (sortBy) {
    query.set('sortBy', sortBy)
    query.set('sortOrder', sortOrder === 'desc' ? 'desc' : 'asc')
  }
  return query
}

// 租户（开户结果）状态：Created/Active 来自开户编排，Expired 由 License 过期监控 Job 流转，
// Cancelled 是后端预留值，当前编排逻辑不会产出
export const TENANT_STATUS_META = {
  1: { label: '已创建（待激活）', tag: 'warning' },
  2: { label: '已激活', tag: 'success' },
  3: { label: '已过期', tag: 'default' },
  4: { label: '已取消', tag: 'default' },
}

export const REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const REVIEW_STATUS_META = {
  [REVIEW_STATUS.PENDING]: { label: '待审核', tag: 'warning' },
  [REVIEW_STATUS.APPROVED]: { label: '已通过', tag: 'success' },
  [REVIEW_STATUS.REJECTED]: { label: '已拒绝', tag: 'error' },
}

export const USER_STATUS_META = {
  0: { label: '已禁用', tag: 'default' },
  1: { label: '正常', tag: 'success' },
}

export const adminApi = {
  /** 分页查询数据库实例列表；可排序字段：id/name/dbType/createdAt/updatedAt */
  listDatabaseInstances({ page = 1, pageSize = 20, sortBy = 'id', sortOrder = 'desc' } = {}) {
    const query = buildPagedQuery({ page, pageSize, sortBy, sortOrder })
    return request(`${ADMIN_BASE}/database-instances?${query}`)
  },

  /** 查询数据库实例详情（响应体不含密码字段，密码只落库不回显） */
  getDatabaseInstance(id) {
    return request(`${ADMIN_BASE}/database-instances/${id}`)
  },

  /** 注册数据库实例：body 需含 name/dbType/host/port/username/password */
  createDatabaseInstance(payload) {
    return request(`${ADMIN_BASE}/database-instances`, { method: 'POST', body: payload })
  },

  /** 编辑数据库实例：password 留空则保留原密码，不会用空值覆盖 */
  updateDatabaseInstance(id, payload) {
    return request(`${ADMIN_BASE}/database-instances/${id}`, { method: 'PUT', body: payload })
  },

  /** 删除数据库实例（后端软删除） */
  deleteDatabaseInstance(id) {
    return request(`${ADMIN_BASE}/database-instances/${id}`, { method: 'DELETE' })
  },

  /** 分页查询审核用户列表；reviewStatus 默认 pending，可排序字段：id/createdAt */
  listReviewUsers({ reviewStatus = REVIEW_STATUS.PENDING, page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
    const query = buildPagedQuery({ page, pageSize, sortBy, sortOrder })
    if (reviewStatus) query.set('reviewStatus', reviewStatus)
    return request(`${ADMIN_BASE}/reviews/users?${query}`)
  },

  /**
   * 审核通过并开户：审核与开户是同一动作，调用即触发。
   * 同步部分只做校验 + 建租户记录，真正建库建用户是异步 Job（见返回的 jobId），
   * 需要配合 jobApi.getJobStatus(jobId) 轮询开户进度。
   * 失败后可用同一个 userId 重新调用本接口重试：全链路幂等设计。
   */
  approveReview(userId, { databaseInstanceId, licenseExpiresAt }) {
    return request(`${ADMIN_BASE}/reviews/${userId}/approve`, {
      method: 'POST',
      body: { databaseInstanceId, licenseExpiresAt },
    })
  },

  /** 拒绝审核：只标记并软删除用户，不创建租户；后端约定拒绝不可撤销 */
  rejectReview(userId) {
    return request(`${ADMIN_BASE}/reviews/${userId}/reject`, { method: 'POST' })
  },

  /** 分页查询开户结果（租户）列表；可排序字段：id/tenantCode/status/createdAt */
  listTenants({ page = 1, pageSize = 20, sortBy = 'id', sortOrder = 'desc' } = {}) {
    const query = buildPagedQuery({ page, pageSize, sortBy, sortOrder })
    return request(`${ADMIN_BASE}/tenants?${query}`)
  },
}
