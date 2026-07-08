import { ref } from 'vue'
import { authApi } from '../api/authApi'
import { loadSession, saveSession, patchSession, clearSession } from '../utils/authSession'

// 登录态来源于 sso-service 的 JWT 会话：
// access token 15 分钟（过期由 http 层静默续期），refresh token 7 天（轮换机制）
const currentUser = ref(loadSession()?.user ?? null)

export function useAuth() {
  /**
   * 登录：换取 token 对 → 拉取用户信息 → 持久化会话
   * @param {{ username: string, password: string, remember: boolean }} payload
   */
  async function login({ username, password, remember }) {
    const tokens = await authApi.login({ username, password })
    // 先落 token 再调 /me，让用户信息请求走统一的鉴权链路
    saveSession(
      { user: null, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
      remember,
    )
    const user = await authApi.fetchProfile()
    patchSession({ user })
    currentUser.value = user
    return user
  }

  /** 退出登录：通知后端作废 refresh token（失败不阻塞前端登出），路由跳转由调用方负责 */
  function logout() {
    const session = loadSession()
    if (session?.refreshToken) {
      authApi.logout(session.refreshToken).catch(() => {})
    }
    clearSession()
    currentUser.value = null
  }

  return { currentUser, login, logout }
}
