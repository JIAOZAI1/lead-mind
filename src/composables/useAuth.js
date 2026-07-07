import { ref } from 'vue'

// 模块级单例：整个应用共享同一份登录态
// 当前为纯前端模拟，接入后端后替换为真实会话（token + 用户信息接口）
const currentUser = ref(null)

export function useAuth() {
  /** 登录成功后写入用户信息（角色/租户为模拟数据，待后端返回） */
  function login(username) {
    currentUser.value = {
      name: username,
      role: '管理员',
      tenant: '演示租户',
    }
  }

  /** 退出登录，回到登录页（App.vue 根据 currentUser 切换页面） */
  function logout() {
    currentUser.value = null
  }

  return { currentUser, login, logout }
}
