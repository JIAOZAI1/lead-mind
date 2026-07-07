import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import AppLayout from '../layouts/AppLayout.vue'

// 页面组件全部懒加载：按路由分包，首屏只加载当前页面的代码
const LoginPage = () => import('../views/LoginPage.vue')
const DashboardPage = () => import('../views/DashboardPage.vue')
const UnderConstructionPage = () => import('../views/UnderConstructionPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { public: true, title: '登录' } },
    {
      // 业务页面统一挂在 AppLayout 下：共享侧边菜单 + 顶栏，子路由渲染进内容区
      path: '/',
      component: AppLayout,
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        { path: 'dashboard', name: 'dashboard', component: DashboardPage, meta: { title: '工作台' } },
        // 以下模块尚未开发，统一渲染"建设中"占位页；落地时替换 component 即可
        { path: 'leads/search', name: 'lead-search', component: UnderConstructionPage, meta: { title: '线索搜索' } },
        { path: 'leads/mine', name: 'my-leads', component: UnderConstructionPage, meta: { title: '我的线索' } },
        { path: 'ai-assistant', name: 'ai-assistant', component: UnderConstructionPage, meta: { title: 'AI 助手' } },
        { path: 'settings', name: 'settings', component: UnderConstructionPage, meta: { title: '系统设置' } },
      ],
    },
    // 未匹配的路径一律回工作台（未登录时会被守卫再转去登录页）
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
  ],
})

// 全局前置守卫：未登录只能访问公开页，跳登录页时带上原目标，登录后原路返回
router.beforeEach((to) => {
  const { currentUser } = useAuth()
  if (!to.meta.public && !currentUser.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // 已登录状态下访问登录页没有意义，送回工作台
  if (to.name === 'login' && currentUser.value) {
    return { name: 'dashboard' }
  }
})

// 浏览器标签页标题跟随路由
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Lead Mind` : 'Lead Mind'
})

export default router
