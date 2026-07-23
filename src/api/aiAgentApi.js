// ai-agent 服务接口封装：单轮对话（非流式）与 SSE 流式对话
// 接口契约见后端仓库 lead-mind-ai-agent（internal/gateway/handler）
// 鉴权：X-Tenant-Code 由后端网关按登录态自动注入，前端无需关心；access token 沿用统一会话体系
import { API_ORIGIN, ApiError, request } from './http'
import { loadSession } from '../utils/authSession'

const AI_AGENT_BASE = `${API_ORIGIN}/ai-agent/v1`

/**
 * 单轮对话（非流式）→ { tenantCode, sessionId, reply }
 * sessionId 首轮传空/不传，后端会新建会话并在响应中返回 sessionId；
 * 续聊必须把上一轮返回的 sessionId 原样带上，否则后端每次都当新会话处理（历史清零）。
 */
export const aiAgentApi = {
  chat({ message, sessionId = '' }) {
    return request(`${AI_AGENT_BASE}/chat`, {
      method: 'POST',
      body: { message, session_id: sessionId },
    }).then((data) => ({ tenantCode: data.tenant_code, sessionId: data.session_id, reply: data.reply }))
  },
}

/**
 * 流式对话：SSE 协议，事件为具名 event（session/message/done/error），不是默认 message 事件，
 * 因此不能用浏览器原生 EventSource（且 EventSource 不支持自定义 Authorization 头），
 * 改用 fetch + ReadableStream 手动解析 `event:`/`data:` 帧。
 *
 * 第一个事件恒为 `event: session`，携带本轮"真正生效"的 session_id（新会话时是后端新生成的，
 * 续聊时是原样回显）——必须以这个为准存起来，不能自己在前端生成一个 UUID 充当 session_id。
 *
 * @param {string} message 用户输入
 * @param {{
 *   sessionId?: string,
 *   onSession?: (sessionId: string) => void,
 *   onDelta?: (text: string) => void,
 *   onDone?: () => void,
 *   onError?: (err: Error) => void,
 *   signal?: AbortSignal,
 * }} handlers sessionId 为空/不传表示开启新会话
 * @returns {Promise<void>}
 */
export async function chatStream(message, { sessionId = '', onSession, onDelta, onDone, onError, signal } = {}) {
  const session = loadSession()
  const headers = { Accept: 'text/event-stream' }
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`

  const query = new URLSearchParams({ message })
  if (sessionId) query.set('session_id', sessionId)

  try {
    const res = await fetch(`${AI_AGENT_BASE}/chat/stream?${query}`, {
      method: 'GET',
      headers,
      signal,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 帧以空行分隔，逐帧解析（一帧可能含多行 event:/data:）
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        let event = 'message'
        let data = ''
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        if (!data) continue
        const payload = JSON.parse(data)

        if (event === 'error') throw new Error(payload.error ?? '生成失败')
        if (event === 'session') {
          onSession?.(payload.session_id)
          continue
        }
        if (event === 'done') {
          onDone?.()
          return
        }
        if (payload.delta) onDelta?.(payload.delta)
      }
    }
    onDone?.()
  } catch (err) {
    if (err.name === 'AbortError') return
    onError?.(err)
  }
}
