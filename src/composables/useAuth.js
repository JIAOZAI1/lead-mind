import { ref } from 'vue'

// 登录态持久化到 sessionStorage：刷新页面不丢会话，直链访问业务路由不会被误踢回登录页
// （关闭标签页即失效；接入后端后替换为真实 token 会话）
const STORAGE_KEY = 'lead-mind:current-user'

const currentUser = ref(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null'))

export function useAuth() {
  /** 登录成功后写入用户信息（角色/租户为模拟数据，待后端返回） */
  function login(username) {
    currentUser.value = {
      name: username,
      role: '管理员',
      tenant: '演示租户',
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser.value))
  }

  /** 退出登录：清空会话，路由跳转由调用方负责 */
  function logout() {
    currentUser.value = null
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return { currentUser, login, logout }
}
