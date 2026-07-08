<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { AxMessage } from '@jiaozai1/axis-ui'
import { useAuth } from '../composables/useAuth'
import { authApi, translateAuthError } from '../api/authApi'
import AuthPageShell from '../components/AuthPageShell.vue'

const router = useRouter()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})

// 校验规则与后端约束保持一致：用户名 3~64、密码 8~128、邮箱格式
const rules = {
  username: [
    { required: true, message: '请输入用户名' },
    { min: 3, message: '用户名至少 3 个字符' },
    { max: 64, message: '用户名最多 64 个字符' },
  ],
  email: [
    { required: true, message: '请输入邮箱' },
    { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '邮箱格式不正确' },
  ],
  password: [
    { required: true, message: '请输入密码' },
    { min: 8, message: '密码至少 8 位' },
    { max: 128, message: '密码最多 128 位' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码' },
    { validator: (value) => value === form.password || '两次输入的密码不一致' },
  ],
}

const formRef = ref(null)
const loading = ref(false)

const canSubmit = computed(
  () =>
    form.username.trim() !== '' &&
    form.email.trim() !== '' &&
    form.password !== '' &&
    form.confirmPassword !== '',
)

const { login } = useAuth()

async function onSubmit() {
  if (!(await formRef.value.validate())) return
  loading.value = true

  const username = form.username.trim()
  try {
    await authApi.register({
      username,
      email: form.email.trim(),
      password: form.password,
    })
  } catch (err) {
    AxMessage.error(translateAuthError(err, '注册失败，请稍后重试'))
    loading.value = false
    return
  }

  // 注册成功后直接用刚填的凭证自动登录；万一失败也不影响注册结果，引导去登录页
  try {
    await login({ username, password: form.password, remember: true })
    AxMessage.success(`注册成功，欢迎加入，${username}`)
    router.push({ name: 'dashboard' })
  } catch {
    AxMessage.success('注册成功，请登录')
    router.push({ name: 'login' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <auth-page-shell subtitle="创建你的账号">
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
          placeholder="请输入用户名（3~64 个字符）"
          clearable
        />
      </ax-form-item>

      <ax-form-item prop="email">
        <ax-input
          v-model="form.email"
          size="lg"
          placeholder="请输入邮箱"
          clearable
        />
      </ax-form-item>

      <ax-form-item prop="password">
        <ax-input
          v-model="form.password"
          type="password"
          size="lg"
          placeholder="请输入密码（至少 8 位）"
        />
      </ax-form-item>

      <ax-form-item prop="confirmPassword">
        <ax-input
          v-model="form.confirmPassword"
          type="password"
          size="lg"
          placeholder="请再次输入密码"
        />
      </ax-form-item>

      <ax-button
        type="primary"
        size="lg"
        block
        native-type="submit"
        :loading="loading"
        :disabled="!canSubmit"
      >
        注 册
      </ax-button>
    </ax-form>

    <template #footer>
      已有账号？<ax-link @click="router.push({ name: 'login' })">直接登录</ax-link>
    </template>
  </auth-page-shell>
</template>
