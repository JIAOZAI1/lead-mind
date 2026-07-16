// 用户管理接口封装：admin-service 全量用户列表 / 重置密码 + sso-service 角色分配
// 接口契约见后端仓库 services/admin-service、services/sso-service，全部接口要求当前用户拥有 admin 角色
import { API_ORIGIN, request } from './http'

const ADMIN_BASE = `${API_ORIGIN}/admin-service/api/v1`
const SSO_BASE = `${API_ORIGIN}/sso-service/api/v1`

/**
 * 组装分页 + 排序 query，约定同 adminApi/jobApi：page/pageSize/sortBy/sortOrder 四参数，
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

export const userApi = {
  /** 分页查询全量用户（不限审核状态）；可排序字段：id/username/createdAt */
  listUsers({ page = 1, pageSize = 20, sortBy = 'id', sortOrder = 'desc' } = {}) {
    const query = buildPagedQuery({ page, pageSize, sortBy, sortOrder })
    return request(`${ADMIN_BASE}/users?${query}`)
  },

  /** 按 ID 查询用户详情 → { id, username, email, enabled, createdAt }（不含租户信息，不限审核/租户状态） */
  getUser(userId) {
    return request(`${ADMIN_BASE}/users/${userId}`)
  },

  /**
   * 管理员重置指定用户密码：后端生成随机临时密码并写库，
   * 明文只在本次响应体返回一次（{ newPassword }），不落库不记日志，关闭弹窗后无法再次查看
   */
  resetPassword(userId) {
    return request(`${ADMIN_BASE}/users/${userId}/reset-password`, { method: 'POST' })
  },

  /** 启用用户：幂等，已启用重复调用不报错 */
  enableUser(userId) {
    return request(`${ADMIN_BASE}/users/${userId}/enable`, { method: 'POST' })
  },

  /** 禁用用户：幂等，已禁用重复调用不报错；禁用后该用户下次登录会被 sso-service 拒绝 */
  disableUser(userId) {
    return request(`${ADMIN_BASE}/users/${userId}/disable`, { method: 'POST' })
  },

  /** 查询角色列表（用于授权表单勾选项） */
  listRoles() {
    return request(`${SSO_BASE}/roles`)
  },

  /** 查询指定用户当前拥有的角色 */
  listUserRoles(userId) {
    return request(`${SSO_BASE}/users/${userId}/roles`)
  },

  /** 给用户分配角色：已拥有该角色时后端返回 409 */
  assignRole(userId, roleName) {
    return request(`${SSO_BASE}/users/${userId}/roles`, { method: 'POST', body: { roleName } })
  },

  /** 移除用户的某个角色 */
  removeRole(userId, roleName) {
    return request(`${SSO_BASE}/users/${userId}/roles/${roleName}`, { method: 'DELETE' })
  },
}
