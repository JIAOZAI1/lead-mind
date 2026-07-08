<script setup>
import { reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AxMessage } from '@jiaozai1/axis-ui'
import { useAuth } from '../composables/useAuth'
import { translateAuthError } from '../api/authApi'
import AuthPageShell from '../components/AuthPageShell.vue'

const route = useRoute()
const router = useRouter()

const form = reactive({
  username: '',
  password: '',
  remember: true,
})

const rules = {
  username: [{ required: true, message: '请输入账号' }],
  password: [
    { required: true, message: '请输入密码' },
    { min: 8, message: '密码至少 8 位' },
  ],
}

const formRef = ref(null)
const loading = ref(false)

const canSubmit = computed(() => form.username.trim() !== '' && form.password !== '')

const { login } = useAuth()

async function onSubmit() {
  if (!(await formRef.value.validate())) return
  loading.value = true
  try {
    const user = await login({
      username: form.username.trim(),
      password: form.password,
      remember: form.remember,
    })
    AxMessage.success(`欢迎回来，${user.username}`)
    // 被守卫拦截跳来登录的，登录后原路返回；直接访问登录页的进工作台
    router.push(route.query.redirect ?? { name: 'dashboard' })
  } catch (err) {
    AxMessage.error(translateAuthError(err, '登录失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}

// 后端暂未提供找回密码接口，先给出引导提示
function onForgotPassword() {
  AxMessage.info('找回密码暂未开放，请联系管理员重置')
}
</script>

<template>
  <auth-page-shell subtitle="登录你的账号">
    <ax-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="var(--axis-space-12)"
      @submit="onSubmit"
    >
      <ax-form-item prop="username">
        <ax-input
          v-model="form.username"
          size="lg"
          placeholder="请输入账号"
          clearable
        />
      </ax-form-item>

      <ax-form-item prop="password">
        <ax-input
          v-model="form.password"
          type="password"
          size="lg"
          placeholder="请输入密码"
        />
      </ax-form-item>

      <div class="login-form__extra">
        <ax-checkbox v-model="form.remember">记住我</ax-checkbox>
        <ax-link size="sm" @click="onForgotPassword">忘记密码？</ax-link>
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

    <template #footer>
      还没有账号？<ax-link @click="router.push({ name: 'register' })">立即注册</ax-link>
    </template>
  </auth-page-shell>
</template>

<style scoped>
.login-form__extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
