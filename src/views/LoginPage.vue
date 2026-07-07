<script setup>
import { reactive, ref, computed } from 'vue'
import { AxMessage } from '@jiaozai1/axis-ui'
import { useAuth } from '../composables/useAuth'
import { useTheme } from '../composables/useTheme'

const form = reactive({
  username: '',
  password: '',
  remember: true,
})

const rules = {
  username: [{ required: true, message: '请输入账号' }],
  password: [
    { required: true, message: '请输入密码' },
    { min: 6, message: '密码至少 6 位' },
  ],
}

const formRef = ref(null)
const loading = ref(false)

const canSubmit = computed(() => form.username.trim() !== '' && form.password !== '')

const { login } = useAuth()
const { isDark, toggle: onToggleTheme } = useTheme()

async function onSubmit() {
  if (!(await formRef.value.validate())) return
  loading.value = true
  try {
    // TODO: 替换为真实登录接口
    await new Promise((resolve) => setTimeout(resolve, 800))
    AxMessage.success(`欢迎回来，${form.username}`)
    // 写入登录态，App.vue 监听到后切换到主页
    login(form.username)
  } catch {
    AxMessage.error('登录失败，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-theme">
      <ax-switch :model-value="isDark" @change="onToggleTheme" />
      <span class="login-theme__label">{{ isDark ? '暗色' : '亮色' }}</span>
    </div>

    <ax-card class="login-card" borderless>
      <div class="login-card__header">
        <div class="login-card__logo">Lead Mind</div>
        <p class="login-card__subtitle">登录你的账号</p>
      </div>

      <ax-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="var(--axis-space-12)"
        @submit="onSubmit"
      >
        <ax-form-item  prop="username">
          <ax-input
            v-model="form.username"
            size="lg"
            placeholder="请输入账号 / 邮箱"
            clearable
          />
        </ax-form-item>

        <ax-form-item  prop="password">
          <ax-input
            v-model="form.password"
            type="password"
            size="lg"
            placeholder="请输入密码"
          />
        </ax-form-item>

        <div class="login-form__extra">
          <ax-checkbox v-model="form.remember">记住我</ax-checkbox>
          <ax-link size="sm" href="#">忘记密码？</ax-link>
        </div>

        <ax-button
          type="primary"
          size="lg"
          block
          native-type="submit"
          :loading="loading"
          :disabled="!canSubmit"
        >
          登 录
        </ax-button>
      </ax-form>

      <p class="login-card__footer">
        还没有账号？<ax-link href="#">立即注册</ax-link>
      </p>
    </ax-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--axis-space-6);
  background: var(--axis-color-bg-layout);
}

.login-theme {
  position: fixed;
  top: var(--axis-space-6);
  right: var(--axis-space-6);
  display: flex;
  align-items: center;
  gap: var(--axis-space-2);
}

.login-theme__label {
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-secondary);
}

.login-card {
  /* L3 组件 Token：由全局容器 Token 最窄一档派生（540px * 0.75 = 405px） */
  --login-card-max-width: calc(var(--axis-container-sm) * 0.75);

  width: 100%;
  max-width: var(--login-card-max-width);
  box-shadow: var(--axis-shadow-md);
}

.login-card__header {
  text-align: center;
  margin-bottom: var(--axis-space-6);
}

.login-card__logo {
  font-size: var(--axis-font-size-h3);
  line-height: var(--axis-line-height-h3);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-primary);
}

.login-card__subtitle {
  margin: var(--axis-space-2) 0 0;
  font-size: var(--axis-font-size-base);
  color: var(--axis-color-text-secondary);
}

.login-form__extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.login-card__footer {
  margin: var(--axis-space-4) 0 0;
  text-align: center;
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-secondary);
}
</style>
