<script setup>
// AI 助手：对接 ai-agent 服务，SSE 流式对话
import { nextTick, ref } from 'vue'
import { AxMessage } from '@jiaozai1/axis-ui'
import { chatStream } from '../api/aiAgentApi'
import { useAuth } from '../composables/useAuth'

const { currentUser } = useAuth()

// 消息列表：{ role: 'user'|'assistant', content, streaming }
// streaming 为 true 时该条助手消息仍在接收增量内容，渲染打字光标
const messages = ref([])
const input = ref('')
const sending = ref(false)
const scrollRef = ref(null)

// 会话 ID 只存在组件内存里，不落路由 query：AppLayout 的 <keep-alive> 用
// currentRoute.fullPath 当 :key（见 src/layouts/AppLayout.vue），把 sessionId 写进 query
// 会导致每次收到 session 事件都强制重挂载本组件、正在流式接收的回答被打断。
// 代价是刷新页面会开新对话，可接受——messages 本身也是纯内存状态，刷新一样会清空。
// 只认后端 `event: session` 帧回显的值，不在前端自己生成，否则续聊会被后端当成"客户端指定的已存在
// session"直接走 Touch 而非 Create，若这个 ID 从未被 Create 注册过会导致历史对不上（见联调文档）
const sessionId = ref('')

let abortController = null

function scrollToBottom() {
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text || sending.value) return

  messages.value.push({ role: 'user', content: text })
  const assistantMsg = { role: 'assistant', content: '', streaming: true }
  messages.value.push(assistantMsg)
  input.value = ''
  sending.value = true
  scrollToBottom()

  abortController = new AbortController()

  await chatStream(text, {
    sessionId: sessionId.value,
    signal: abortController.signal,
    onSession(id) {
      sessionId.value = id
    },
    onDelta(delta) {
      assistantMsg.content += delta
      scrollToBottom()
    },
    onDone() {
      assistantMsg.streaming = false
      sending.value = false
    },
    onError(err) {
      assistantMsg.streaming = false
      sending.value = false
      // 已有增量内容时保留部分回答，只提示出错；完全没内容时给出兜底文案
      if (!assistantMsg.content) assistantMsg.content = '（回答生成失败）'
      AxMessage.error(err.message || 'AI 助手响应异常，请稍后重试')
    },
  })
}

/** 中止本次生成：只停止前端接收，已生成的内容保留 */
function stopGenerating() {
  abortController?.abort()
  sending.value = false
  const last = messages.value[messages.value.length - 1]
  if (last?.streaming) last.streaming = false
}

function onEnterKey(ev) {
  // Shift+Enter 换行，单独 Enter 发送
  if (ev.shiftKey) return
  ev.preventDefault()
  sendMessage()
}

function clearConversation() {
  messages.value = []
  // 清空是"开新对话"的语义，session_id 必须一并放弃，不能复用，
  // 否则下一条消息仍会带着旧 session_id 续到已清空的历史上
  sessionId.value = ''
}
</script>

<template>
  <ax-card class="ai-assistant" borderless body-padding="0">
    <div class="ai-assistant__header">
      <div class="ai-assistant__header-title">
        <ax-icon name="star" size="sm" />
        <span>AI 助手</span>
      </div>
      <ax-button size="sm" :disabled="messages.length === 0" @click="clearConversation">
        <ax-icon name="delete" size="sm" />清空对话
      </ax-button>
    </div>

    <div ref="scrollRef" class="ai-assistant__body">
      <div v-if="messages.length === 0" class="ai-assistant__empty">
        <ax-icon name="star" size="lg" />
        <p>你好{{ currentUser ? `，${currentUser.username}` : '' }}，我是 AI 助手，有什么可以帮你的？</p>
      </div>

      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['ai-assistant__row', `ai-assistant__row--${msg.role}`]"
      >
        <div class="ai-assistant__avatar">
          <ax-icon :name="msg.role === 'user' ? 'user' : 'star'" size="sm" />
        </div>
        <div class="ai-assistant__bubble">
          <span>{{ msg.content }}</span>
          <span v-if="msg.streaming" class="ai-assistant__cursor" />
        </div>
      </div>
    </div>

    <div class="ai-assistant__footer">
      <ax-input
        v-model="input"
        placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
        :disabled="sending"
        @keydown.enter="onEnterKey"
      />
      <ax-button v-if="!sending" type="primary" :disabled="!input.trim()" @click="sendMessage">
        <ax-icon name="send" size="sm" />发送
      </ax-button>
      <ax-button v-else type="danger" plain @click="stopGenerating">
        <ax-icon name="stop" size="sm" />停止生成
      </ax-button>
    </div>
  </ax-card>
</template>

<style scoped>
/* L3 组件 Token：聊天区整体高度 = 视口减去顶栏 + 页签栏 + 内容区上下留白的估算值，派生自全局布局 Token */
.ai-assistant {
  --ai-assistant-height: calc(100vh - var(--axis-layout-header-height) * 2 - var(--axis-space-6) * 2);

  display: flex;
  flex-direction: column;
  height: var(--ai-assistant-height);
}

.ai-assistant :deep(.ax-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ai-assistant__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: var(--axis-space-4) var(--axis-space-6);
  border-bottom: 1px solid var(--axis-color-border-split);
}

.ai-assistant__header-title {
  display: flex;
  align-items: center;
  gap: var(--axis-space-2);
  font-size: var(--axis-font-size-lg);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-text-primary);
}

.ai-assistant__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--axis-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-5);
}

.ai-assistant__empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--axis-space-3);
  color: var(--axis-color-text-tertiary);
  text-align: center;
}

.ai-assistant__row {
  display: flex;
  align-items: flex-start;
  gap: var(--axis-space-3);
  max-width: 70%;
}

.ai-assistant__row--user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.ai-assistant__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--axis-space-8);
  height: var(--axis-space-8);
  border-radius: var(--axis-radius-full);
  background: var(--axis-color-fill-default);
  color: var(--axis-color-text-secondary);
}

.ai-assistant__row--user .ai-assistant__avatar {
  background: var(--axis-color-primary-bg);
  color: var(--axis-color-primary);
}

.ai-assistant__bubble {
  padding: var(--axis-space-3) var(--axis-space-4);
  border-radius: var(--axis-radius-md);
  background: var(--axis-color-fill-default);
  color: var(--axis-color-text-primary);
  font-size: var(--axis-font-size-base);
  line-height: var(--axis-line-height-base);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-assistant__row--user .ai-assistant__bubble {
  background: var(--axis-color-primary-bg);
}

.ai-assistant__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--axis-color-text-secondary);
  animation: ai-assistant-blink var(--axis-motion-duration-slow) var(--axis-motion-ease-in-out) infinite;
}

@keyframes ai-assistant-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.ai-assistant__footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--axis-space-3);
  padding: var(--axis-space-4) var(--axis-space-6);
  border-top: 1px solid var(--axis-color-border-split);
}
</style>
