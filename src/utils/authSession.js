// 认证会话持久化：token 与用户信息统一存取
// 「记住我」勾选时存 localStorage（refresh token 有效期内免登录），
// 未勾选存 sessionStorage（关闭标签页即失效）
const STORAGE_KEY = 'lead-mind:session'

function readFrom(storage) {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

/** 读取当前会话（优先 localStorage，其次 sessionStorage） */
export function loadSession() {
  return readFrom(localStorage) ?? readFrom(sessionStorage)
}

/**
 * 写入新会话
 * @param {{ user: object|null, accessToken: string, refreshToken: string }} session
 * @param {boolean} remember 是否跨标签页/重启浏览器保留登录态
 */
export function saveSession(session, remember) {
  clearSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(STORAGE_KEY, JSON.stringify(session))
}

/** 部分更新会话（如 token 轮换后只换 token、/me 返回后补用户信息），保持原存储位置 */
export function patchSession(patch) {
  const storage = localStorage.getItem(STORAGE_KEY) !== null ? localStorage : sessionStorage
  const current = readFrom(storage)
  if (!current) return
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }))
}

/** 清空会话（两个存储都清，避免残留） */
export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}
