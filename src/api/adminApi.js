// admin-service 管理接口封装（数据库实例管理）
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
}
