<script setup>
// AI 助手：对接 ai-agent 服务，SSE 流式对话 + 会话列表管理
import { nextTick, onMounted, ref } from 'vue'
import { AxMessage } from '@jiaozai1/axis-ui'
import { aiAgentApi, chatStream } from '../api/aiAgentApi'
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
// 只认后端 `event: session` 帧回显的值，不在前端自己生成，否则续聊会被后端当成"客户端指定的已存在
// session"直接走 Touch 而非 Create，若这个 ID 从未被 Create 注册过会导致历史对不上（见联调文档）
const sessionId = ref('')

// 会话列表：仅元数据（标题/置顶/归档/时间戳），后端没有拉取历史消息的接口——
// 切换到旧会话只能"接着聊"（服务端按 session_id 续接短期记忆里的上下文），
// 前端无法把之前聊过的内容回放到消息区，进面板时用提示条说明这一点
const sessions = ref([])
const sessionsLoading = ref(false)
const showArchived = ref(false)

let abortController = null

function scrollToBottom() {
  nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function loadSessions() {
  sessionsLoading.value = true
  try {
    sessions.value = await aiAgentApi.listSessions({ includeArchived: showArchived.value })
  } catch (err) {
    AxMessage.error(`会话列表加载失败：${err.message}`)
  } finally {
    sessionsLoading.value = false
  }
}

onMounted(loadSessions)

async function sendMessage() {
  const text = input.value.trim()
  if (!text || sending.value) return

  const isFirstTurnOfSession = !sessionId.value
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
      // 新会话或续聊都会更新 last_active_at/可能变了 title，刷新列表让侧边栏排序与文案跟上
      if (isFirstTurnOfSession) loadSessions()
      else {
        const item = sessions.value.find((s) => s.id === sessionId.value)
        if (item) sessions.value = [item, ...sessions.value.filter((s) => s.id !== sessionId.value)]
      }
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

/** 新建对话：放弃当前 session_id，下一条消息会让后端新建会话 */
function startNewConversation() {
  if (sending.value) return
  messages.value = []
  sessionId.value = ''
}

/** 切换到历史会话：只能接续对话，无法回放之前聊过的内容（后端未提供该接口） */
function switchToSession(session) {
  if (sending.value || session.id === sessionId.value) return
  messages.value = []
  sessionId.value = session.id
}

const renameVisible = ref(false)
const renameTarget = ref(null)
const renameTitle = ref('')
const renaming = ref(false)

function openRenameModal(session) {
  renameTarget.value = session
  renameTitle.value = session.title
  renameVisible.value = true
}

async function onRenameSession() {
  const title = renameTitle.value.trim()
  if (!title || title === renameTarget.value.title) {
    renameVisible.value = false
    return
  }
  renaming.value = true
  try {
    const updated = await aiAgentApi.patchSession(renameTarget.value.id, { title })
    Object.assign(renameTarget.value, updated)
    renameVisible.value = false
  } catch (err) {
    AxMessage.error(`重命名失败：${err.message}`)
  } finally {
    renaming.value = false
  }
}

async function togglePinned(session) {
  try {
    const updated = await aiAgentApi.patchSession(session.id, { pinned: !session.pinned })
    Object.assign(session, updated)
    // 置顶状态变化影响排序（置顶优先），重新拉取列表以保持与后端排序一致
    await loadSessions()
  } catch (err) {
    AxMessage.error(`${session.pinned ? '取消置顶' : '置顶'}失败：${err.message}`)
  }
}

async function toggleArchived(session) {
  try {
    await aiAgentApi.patchSession(session.id, { archived: !session.archived })
    // 归档/取消归档都可能让该会话从当前列表视图中消失（未勾选"显示已归档"时），直接重新加载
    if (session.id === sessionId.value) startNewConversation()
    await loadSessions()
  } catch (err) {
    AxMessage.error(`${session.archived ? '取消归档' : '归档'}失败：${err.message}`)
  }
}

const deleteVisible = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

function confirmDelete(session) {
  deleteTarget.value = session
  deleteVisible.value = true
}

async function onDeleteSession() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await aiAgentApi.deleteSession(deleteTarget.value.id)
    if (deleteTarget.value.id === sessionId.value) startNewConversation()
    sessions.value = sessions.value.filter((s) => s.id !== deleteTarget.value.id)
    deleteVisible.value = false
    deleteTarget.value = null
  } catch (err) {
    AxMessage.error(`删除失败：${err.message}`)
  } finally {
    deleting.value = false
  }
}

function onToggleShowArchived() {
  showArchived.value = !showArchived.value
  loadSessions()
}
</script>

<template>
  <div class="ai-assistant">
    <aside class="ai-assistant__sidebar">
      <ax-button block type="primary" :disabled="sending" @click="startNewConversation">
        <ax-icon name="plus" size="sm" />新建对话
      </ax-button>

      <div class="ai-assistant__sidebar-toolbar">
        <ax-link size="sm" @click="onToggleShowArchived">
          <ax-icon name="folder" size="sm" />{{ showArchived ? '隐藏已归档' : '显示已归档' }}
        </ax-link>
      </div>

      <div class="ai-assistant__session-list">
        <div v-if="sessionsLoading" class="ai-assistant__session-empty">加载中…</div>
        <div v-else-if="sessions.length === 0" class="ai-assistant__session-empty">暂无历史对话</div>

        <div
          v-for="session in sessions"
          :key="session.id"
          :class="['ai-assistant__session-item', { 'is-active': session.id === sessionId }]"
          @click="switchToSession(session)"
        >
          <ax-icon v-if="session.pinned" name="star" size="sm" class="ai-assistant__session-pin" />
          <span class="ai-assistant__session-title">{{ session.title || '未命名对话' }}</span>
          <ax-tag v-if="session.archived">已归档</ax-tag>

          <div class="ai-assistant__session-actions" @click.stop>
            <ax-tooltip content="重命名" placement="top">
              <ax-link size="sm" @click="openRenameModal(session)"><ax-icon name="edit" size="sm" /></ax-link>
            </ax-tooltip>
            <ax-tooltip :content="session.pinned ? '取消置顶' : '置顶'" placement="top">
              <ax-link size="sm" @click="togglePinned(session)"><ax-icon name="star" size="sm" /></ax-link>
            </ax-tooltip>
            <ax-tooltip :content="session.archived ? '取消归档' : '归档'" placement="top">
              <ax-link size="sm" @click="toggleArchived(session)"><ax-icon name="folder" size="sm" /></ax-link>
            </ax-tooltip>
            <ax-tooltip content="删除" placement="top">
              <ax-link size="sm" type="danger" @click="confirmDelete(session)"><ax-icon name="delete" size="sm" /></ax-link>
            </ax-tooltip>
          </div>
        </div>
      </div>
    </aside>

    <ax-card class="ai-assistant__main" borderless body-padding="0">
      <div class="ai-assistant__header">
        <div class="ai-assistant__header-title">
          <ax-icon name="star" size="sm" />
          <span>AI 助手</span>
        </div>
        <ax-button size="sm" :disabled="messages.length === 0" @click="startNewConversation">
          <ax-icon name="delete" size="sm" />清空对话
        </ax-button>
      </div>

      <ax-alert
        v-if="sessionId && messages.length === 0"
        type="info"
        description="继续对话可以接上这个会话之前的上下文，但历史消息暂不支持在此回显。"
        show-icon
        class="ai-assistant__resume-hint"
      />

      <div ref="scrollRef" class="ai-assistant__body">
        <div v-if="messages.length === 0 && !sessionId" class="ai-assistant__empty">
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
            <!-- 用户消息是纯文本输入，助手回复走 AxMarkdown 渲染模型输出的 Markdown 格式（标题/列表/代码块等） -->
            <ax-markdown v-if="msg.role === 'assistant'" :content="msg.content" />
            <span v-else>{{ msg.content }}</span>
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

    <ax-modal v-model="deleteVisible" title="删除对话">
      <ax-text type="error" block>确认删除对话「{{ deleteTarget?.title || '未命名对话' }}」？删除后无法恢复。</ax-text>
      <template #footer>
        <ax-button @click="deleteVisible = false">取消</ax-button>
        <ax-button type="danger" :loading="deleting" @click="onDeleteSession"><ax-icon name="delete" size="sm" />删除</ax-button>
      </template>
    </ax-modal>

    <ax-modal v-model="renameVisible" title="重命名对话">
      <ax-input v-model="renameTitle" placeholder="输入对话标题" maxlength="50" @keydown.enter="onRenameSession" />
      <template #footer>
        <ax-button @click="renameVisible = false">取消</ax-button>
        <ax-button type="primary" :loading="renaming" @click="onRenameSession">保存</ax-button>
      </template>
    </ax-modal>
  </div>
</template>

<style scoped>
/* L3 组件 Token：聊天区整体高度 = 视口减去顶栏 + 页签栏 + 内容区上下留白的估算值，派生自全局布局 Token */
.ai-assistant {
  --ai-assistant-height: calc(100vh - var(--axis-layout-header-height) * 2 - var(--axis-space-6) * 2);

  display: flex;
  gap: var(--axis-space-4);
  height: var(--ai-assistant-height);
}

/* ===== 侧边会话列表 ===== */
.ai-assistant__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-3);
  flex-shrink: 0;
  width: var(--axis-container-sm);
  padding: var(--axis-space-4);
  background: var(--axis-color-bg-container);
  border: 1px solid var(--axis-color-border-split);
  border-radius: var(--axis-radius-lg);
}

.ai-assistant__sidebar-toolbar {
  display: flex;
  justify-content: flex-end;
}

.ai-assistant__session-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-1);
}

.ai-assistant__session-empty {
  padding: var(--axis-space-4);
  color: var(--axis-color-text-tertiary);
  font-size: var(--axis-font-size-sm);
  text-align: center;
}

.ai-assistant__session-item {
  display: flex;
  align-items: center;
  gap: var(--axis-space-2);
  padding: var(--axis-space-2) var(--axis-space-3);
  border-radius: var(--axis-radius-md);
  cursor: pointer;
  transition: background var(--axis-motion-duration-fast) var(--axis-motion-ease-in-out);
}

.ai-assistant__session-item:hover {
  background: var(--axis-color-fill-default);
}

.ai-assistant__session-item.is-active {
  background: var(--axis-color-primary-bg);
}

.ai-assistant__session-pin {
  flex-shrink: 0;
  color: var(--axis-color-warning);
}

.ai-assistant__session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-primary);
}

.ai-assistant__session-actions {
  flex-shrink: 0;
  display: none;
  align-items: center;
  gap: var(--axis-space-1);
}

.ai-assistant__session-item:hover .ai-assistant__session-actions {
  display: flex;
}

/* ===== 主对话区 ===== */
.ai-assistant__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ai-assistant__main :deep(.ax-card__body) {
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

.ai-assistant__resume-hint {
  flex-shrink: 0;
  margin: var(--axis-space-4) var(--axis-space-6) 0;
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
  min-width: 0;
  padding: var(--axis-space-3) var(--axis-space-4);
  border-radius: var(--axis-radius-md);
  background: var(--axis-color-fill-default);
  color: var(--axis-color-text-primary);
  font-size: var(--axis-font-size-base);
  line-height: var(--axis-line-height-base);
}

.ai-assistant__row--user .ai-assistant__bubble {
  background: var(--axis-color-primary-bg);
  /* 用户消息是纯文本，没有 AxMarkdown 承担换行渲染，靠 pre-wrap 保留原始换行 */
  white-space: pre-wrap;
  word-break: break-word;
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
