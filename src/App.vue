<script setup>
import { useAuth } from './composables/useAuth'
import LoginPage from './views/LoginPage.vue'
import HomePage from './views/HomePage.vue'

// 根据登录态切换登录页 / 主页（暂不引入路由，后续需要时再评估 vue-router）
const { currentUser } = useAuth()
</script>

<template>
  <HomePage v-if="currentUser" />
  <LoginPage v-else />
</template>
