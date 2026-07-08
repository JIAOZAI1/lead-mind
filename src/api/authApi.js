// sso-service 认证接口封装
// 接口文档：https://github.com/JIAOZAI1/backend-service/blob/main/services/sso-service/README.md
import { request, SSO_AUTH_BASE } from './http'

// 后端错误文案（英文原文）→ 用户可读的中文提示
const AUTH_ERROR_MESSAGES = {
  'service: username already taken': '用户名已被占用',
  'service: email already registered': '邮箱已被注册',
  'service: invalid username or password': '账号或密码错误',
  'service: user disabled': '账号已被禁用，请联系管理员',
  'service: invalid or expired refresh token': '登录已过期，请重新登录',
}

/** 把接口错误转成中文提示；未识别的错误（网络异常、参数校验等）用兜底文案 */
export function translateAuthError(err, fallback) {
  return AUTH_ERROR_MESSAGES[err?.message] ?? fallback
}

export const authApi = {
  /** 注册新用户 → { id, username, email } */
  register({ username, email, password }) {
    return request(`${SSO_AUTH_BASE}/register`, {
      method: 'POST',
      body: { username, email, password },
    })
  },

  /** 登录 → { accessToken, refreshToken, tokenType, expiresIn } */
  login({ username, password }) {
    return request(`${SSO_AUTH_BASE}/login`, {
      method: 'POST',
      body: { username, password },
    })
  },

  /** 注销：使 refresh token 即时失效 */
  logout(refreshToken) {
    return request(`${SSO_AUTH_BASE}/logout`, {
      method: 'POST',
      body: { refreshToken },
    })
  },

  /** 当前用户信息 → { id, username, email }（自动携带 access token） */
  fetchProfile() {
    return request(`${SSO_AUTH_BASE}/me`, { auth: true })
  },
}
