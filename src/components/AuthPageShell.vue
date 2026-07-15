<script setup>
// 认证页（登录/注册）共享外壳：全屏居中卡片 + Logo 标题 + 右上角主题切换
// 保证两个页面视觉完全一致，新增找回密码等认证页也复用它
import { useTheme } from '../composables/useTheme'

defineProps({
  /** 卡片副标题，如「登录你的账号」 */
  subtitle: { type: String, required: true },
})

const { isDark, toggle: onToggleTheme } = useTheme()
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__theme">
      <ax-tooltip :content="isDark ? '切换到亮色主题' : '切换到暗色主题'" placement="bottom">
        <ax-link type="default" @click="onToggleTheme">
          <ax-icon :name="isDark ? 'moon' : 'sun'" />
        </ax-link>
      </ax-tooltip>
    </div>

    <ax-card class="auth-page__card" borderless>
      <div class="auth-page__header">
        <div class="auth-page__logo">Lead Mind</div>
        <p class="auth-page__subtitle">{{ subtitle }}</p>
      </div>

      <slot />

      <p class="auth-page__footer">
        <slot name="footer" />
      </p>
    </ax-card>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--axis-space-6);
  background: var(--axis-color-bg-layout);
}

.auth-page__theme {
  position: fixed;
  top: var(--axis-space-6);
  right: var(--axis-space-6);
}

.auth-page__card {
  /* L3 组件 Token：由全局容器 Token 最窄一档派生（540px * 0.75 = 405px） */
  --auth-card-max-width: calc(var(--axis-container-sm) * 0.75);

  width: 100%;
  max-width: var(--auth-card-max-width);
  box-shadow: var(--axis-shadow-md);
}

.auth-page__header {
  text-align: center;
  margin-bottom: var(--axis-space-6);
}

.auth-page__logo {
  font-size: var(--axis-font-size-h3);
  line-height: var(--axis-line-height-h3);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-primary);
}

.auth-page__subtitle {
  margin: var(--axis-space-2) 0 0;
  font-size: var(--axis-font-size-base);
  color: var(--axis-color-text-secondary);
}

.auth-page__footer {
  margin: var(--axis-space-4) 0 0;
  text-align: center;
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-secondary);
}
</style>
