<script setup>
// 应用统一布局：左侧菜单栏 + 顶栏（页面标题 / 用户信息），内容区渲染当前子路由页面
// 新增页面 = router 加一条子路由 + useNavigation.js 菜单配置加一项
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTheme } from '../composables/useTheme'
import { useNavigation } from '../composables/useNavigation'

const router = useRouter()
const { currentUser, logout } = useAuth()
const { isDark, toggle: onToggleTheme } = useTheme()
const { activeMenu, activeMenuLabel, menuItems, defaultOpenKeys } = useNavigation()

// 退出登录后回到登录页
function onLogout() {
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-layout">
    <!-- 左侧菜单栏：由 useNavigation 的配置数据驱动 -->
    <aside class="app-layout__sider">
      <div class="app-layout__logo">Lead Mind</div>
      <ax-menu v-model="activeMenu" :default-open-keys="defaultOpenKeys">
        <template v-for="item in menuItems" :key="item.key">
          <ax-sub-menu v-if="item.children" :name="item.key" :title="item.label">
            <ax-menu-item v-for="child in item.children" :key="child.key" :name="child.key">
              {{ child.label }}
            </ax-menu-item>
          </ax-sub-menu>
          <ax-menu-item v-else :name="item.key">{{ item.label }}</ax-menu-item>
        </template>
      </ax-menu>
    </aside>

    <div class="app-layout__main">
      <!-- 顶栏：当前页面标题 + 用户信息 -->
      <header class="app-layout__header">
        <div class="app-layout__title">{{ activeMenuLabel }}</div>
        <div class="app-layout__user">
          <ax-switch :model-value="isDark" size="sm" @change="onToggleTheme" />
          <span class="app-layout__theme-label">{{ isDark ? '暗色' : '亮色' }}</span>
          <ax-tag type="primary" round>{{ currentUser.role }}</ax-tag>
          <ax-tooltip :content="`租户：${currentUser.tenant}`" placement="bottom">
            <span class="app-layout__username">{{ currentUser.name }}</span>
          </ax-tooltip>
          <ax-link type="default" size="sm" @click="onLogout">退出</ax-link>
        </div>
      </header>

      <!-- 内容区：渲染当前子路由对应的页面 -->
      <main class="app-layout__content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--axis-color-bg-layout);
}

/* ===== 左侧菜单栏 ===== */
.app-layout__sider {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: var(--axis-layout-sider-width);
  background: var(--axis-color-bg-container);
  border-right: 1px solid var(--axis-color-border-split);
}

.app-layout__logo {
  display: flex;
  align-items: center;
  height: var(--axis-layout-header-height);
  padding: 0 var(--axis-space-6);
  font-size: var(--axis-font-size-h4);
  line-height: var(--axis-line-height-h4);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-primary);
  border-bottom: 1px solid var(--axis-color-border-split);
}

/* ===== 右侧主区域 ===== */
.app-layout__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.app-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--axis-layout-header-height);
  padding: 0 var(--axis-space-6);
  background: var(--axis-color-bg-container);
  border-bottom: 1px solid var(--axis-color-border-split);
}

.app-layout__title {
  font-size: var(--axis-font-size-lg);
  font-weight: var(--axis-font-weight-medium);
  color: var(--axis-color-text-primary);
}

.app-layout__user {
  display: flex;
  align-items: center;
  gap: var(--axis-space-3);
}

.app-layout__theme-label {
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-secondary);
}

.app-layout__username {
  font-size: var(--axis-font-size-base);
  color: var(--axis-color-text-primary);
  cursor: default;
}

.app-layout__content {
  flex: 1;
  padding: var(--axis-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}
</style>
