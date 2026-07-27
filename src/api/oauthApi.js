import { API_ORIGIN, request } from './http'

const OAUTH_BASE = `${API_ORIGIN}/sso-service/oauth`

export const oauthApi = {
  /**
   * 使用当前 Web 登录态为 Chrome 插件创建一次性授权码。
   * 后端负责校验 client_id、redirect_uri 与 PKCE，前端不拼接回调地址。
   */
  authorize(params) {
    const query = new URLSearchParams(params)
    return request(`${OAUTH_BASE}/authorize?${query}`)
  },
}
