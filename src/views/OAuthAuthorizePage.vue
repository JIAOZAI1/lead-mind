<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxMessage } from '@jiaozai1/axis-ui'
import AuthPageShell from '../components/AuthPageShell.vue'
import { oauthApi } from '../api/oauthApi'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { currentUser } = useAuth()
const loading = ref(false)

const oauthParams = computed(() => ({
  response_type: String(route.query.response_type ?? ''),
  client_id: String(route.query.client_id ?? ''),
  redirect_uri: String(route.query.redirect_uri ?? ''),
  state: String(route.query.state ?? ''),
  code_challenge: String(route.query.code_challenge ?? ''),
  code_challenge_method: String(route.query.code_challenge_method ?? ''),
}))

const requestValid = computed(() => Object.values(oauthParams.value).every(Boolean))

async function authorize() {
  if (!requestValid.value) {
    AxMessage.error('授权请求缺少必要参数')
    return
  }
  loading.value = true
  try {
    const result = await oauthApi.authorize(oauthParams.value)
    // 回调地址完全由后端白名单校验并返回，避免前端信任 query 中的任意 redirect_uri。
    window.location.replace(result.redirectUri)
  } catch (error) {
    AxMessage.error(error?.message ?? '授权失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <auth-page-shell subtitle="授权 Chrome 插件访问你的账号">
    <ax-alert
      v-if="!requestValid"
      type="error"
      title="无效的授权请求"
      description="缺少 client、回调地址、state 或 PKCE 参数。"
    />

    <div v-else class="oauth-consent">
      <div class="oauth-consent__app">LM</div>
      <ax-title :level="4">LeadMind AI Browser Agent</ax-title>
      <ax-text type="secondary">
        将以 {{ currentUser?.username }} 的身份连接插件。
      </ax-text>
      <ax-alert
        type="info"
        title="插件将获得"
        description="你的用户标识、当前租户、角色，以及用于访问 LeadMind API 的会话 Token。"
      />
      <ax-text type="secondary" size="sm">
        插件不会获得你的密码。授权码为一次性凭据，并由 PKCE 保护。
      </ax-text>
      <div class="oauth-consent__actions">
        <ax-button @click="router.push({ name: 'dashboard' })">取消</ax-button>
        <ax-button type="primary" :loading="loading" @click="authorize">允许并继续</ax-button>
      </div>
    </div>
  </auth-page-shell>
</template>

<style scoped>
.oauth-consent {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--axis-space-4);
}

.oauth-consent__app {
  align-self: center;
  display: grid;
  place-items: center;
  width: var(--axis-space-12);
  height: var(--axis-space-12);
  border-radius: var(--axis-radius-lg);
  background: var(--axis-color-primary);
  color: var(--axis-color-text-inverse);
  font-weight: var(--axis-font-weight-semibold);
}

.oauth-consent :deep(.ax-title),
.oauth-consent :deep(.ax-text) {
  text-align: center;
}

.oauth-consent__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--axis-space-2);
}
</style>
