// 统一 HTTP 请求封装：JSON 编解码、错误规整、access token 过期自动续期
import { loadSession, patchSession, clearSession } from '../utils/authSession'

// 后端网关地址：生产构建直连后端域名（跨域由网关 CORS 白名单放行，见 .env.production）；
// 本地开发留空走相对路径，由 vite proxy 转发——vite 默认端口 5173 不在网关 CORS 白名单内
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? ''

export const SSO_AUTH_BASE = `${API_ORIGIN}/sso-service/api/v1/auth`

/** 接口错误：status 为 HTTP 状态码，message 为后端返回的 error 文案 */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function rawRequest(path, { method = 'GET', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  // 错误体两种格式：业务错误 { error }；ASP.NET 参数绑定失败返回 ProblemDetails { title, errors }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? data?.title ?? `HTTP ${res.status}`)
  return data
}

// 单飞续期：多个请求同时收到 401 时只发一次 refresh
// （后端 refresh token 采用轮换机制，同一个旧 token 用第二次会直接失效整个会话）
let refreshPromise = null

function refreshTokens(refreshToken) {
  refreshPromise ??= rawRequest(`${SSO_AUTH_BASE}/refresh`, {
    method: 'POST',
    body: { refreshToken },
  })
    .then((tokens) => {
      patchSession({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
      return tokens
    })
    .catch((err) => {
      // refresh token 也失效了 → 会话彻底过期，清空并回登录页
      // 用整页跳转而非 router：避免 http 层反向依赖路由造成循环引用
      clearSession()
      window.location.assign('/login')
      throw err
    })
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

/**
 * 发起请求
 * @param {string} path 接口路径（相对路径）
 * @param {{ method?: string, body?: object, auth?: boolean }} options auth=true 时自动携带 access token，
 *   收到 401 会用 refresh token 静默续期并重试一次
 */
export async function request(path, options = {}) {
  const { auth = false, ...rest } = options
  const session = loadSession()
  try {
    return await rawRequest(path, { ...rest, token: auth ? session?.accessToken : undefined })
  } catch (err) {
    if (auth && err instanceof ApiError && err.status === 401 && session?.refreshToken) {
      const tokens = await refreshTokens(session.refreshToken)
      return rawRequest(path, { ...rest, token: tokens.accessToken })
    }
    throw err
  }
}
