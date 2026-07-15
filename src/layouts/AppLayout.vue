<script setup>
// 应用统一布局：左侧菜单栏 + 顶栏（页面标题 / 用户信息），内容区渲染当前子路由页面
// 新增页面 = router 加一条子路由 + useNavigation.js 菜单配置加一项
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useTheme } from '../composables/useTheme'
import { useNavigation } from '../composables/useNavigation'
import { useWorkspaceTabs, HOME_TAB_KEY } from '../composables/useWorkspaceTabs'

const router = useRouter()
const { currentUser, logout } = useAuth()
const { isDark, toggle: onToggleTheme } = useTheme()
const { activeMenu, activeMenuLabel, menuItems, defaultOpenKeys } = useNavigation()
// 多页签工作区：菜单级页面进页签，keep-alive 按打开的页签缓存页面状态
const { openTabs, activeTab, closeTab, resetTabs, cachedViews } = useWorkspaceTabs()

// 退出登录后回到登录页，同时清空工作区页签
function onLogout() {
  logout()
  resetTabs()
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
          <ax-tooltip :content="isDark ? '切换到亮色主题' : '切换到暗色主题'" placement="bottom">
            <ax-link type="default" @click="onToggleTheme">
              <ax-icon :name="isDark ? 'moon' : 'sun'" />
            </ax-link>
          </ax-tooltip>
          <!-- 用户信息来自 sso-service /me（角色/租户后端暂未提供） -->
          <ax-tooltip :content="`邮箱：${currentUser.email}`" placement="bottom">
            <span class="app-layout__username">{{ currentUser.username }}</span>
          </ax-tooltip>
          <ax-link type="default" size="sm" @click="onLogout">退出</ax-link>
        </div>
      </header>

      <!-- 页签栏：只渲染 AxTabs 的导航条作为页签，页面内容由下方 router-view 承载 -->
      <div class="app-layout__tabs">
        <ax-tabs v-model="activeTab" type="card" @close="closeTab">
          <ax-tab-pane
            v-for="tab in openTabs"
            :key="tab.key"
            :name="tab.key"
            :label="tab.label"
            :closable="tab.key !== HOME_TAB_KEY"
          />
        </ax-tabs>
      </div>

      <!-- 内容区：keep-alive 缓存已打开页签的页面，切换页签不丢失页内状态；关闭页签即释放缓存 -->
      <main class="app-layout__content">
        <router-view v-slot="{ Component, route: currentRoute }">
          <keep-alive :include="cachedViews">
            <component :is="Component" :key="currentRoute.fullPath" />
          </keep-alive>
        </router-view>
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

.app-layout__username {
  font-size: var(--axis-font-size-base);
  color: var(--axis-color-text-primary);
  cursor: default;
}

/* ===== 页签栏 ===== */
.app-layout__tabs {
  padding: 0 var(--axis-space-6);
  background: var(--axis-color-bg-container);
  border-bottom: 1px solid var(--axis-color-border-split);
}

/* AxTabs 在这里只当页签导航条用：内容由 router-view 渲染，隐藏其自带的内容区与分隔线（分隔线由外层通栏边框接管） */
.app-layout__tabs :deep(.ax-tabs__nav) {
  border-bottom: none;
}

.app-layout__tabs :deep(.ax-tabs__content) {
  display: none;
}

.app-layout__content {
  flex: 1;
  padding: var(--axis-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--axis-space-4);
}
</style>
