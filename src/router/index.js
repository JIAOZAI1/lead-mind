import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import AppLayout from '../layouts/AppLayout.vue'

// 页面组件全部懒加载：按路由分包，首屏只加载当前页面的代码
const LoginPage = () => import('../views/LoginPage.vue')
const RegisterPage = () => import('../views/RegisterPage.vue')
const DashboardPage = () => import('../views/DashboardPage.vue')
const JobsPage = () => import('../views/JobsPage.vue')
const JobDetailPage = () => import('../views/JobDetailPage.vue')
const DatabaseInstancesPage = () => import('../views/DatabaseInstancesPage.vue')
const AccountApprovalPage = () => import('../views/AccountApprovalPage.vue')
const UserManagementPage = () => import('../views/UserManagementPage.vue')
const UnderConstructionPage = () => import('../views/UnderConstructionPage.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage, meta: { public: true, title: '登录' } },
    { path: '/register', name: 'register', component: RegisterPage, meta: { public: true, title: '注册' } },
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
        { path: 'jobs', name: 'jobs', component: JobsPage, meta: { title: '后台作业' } },
        // 详情页不在菜单里，menuKey 指回「后台作业」保持菜单高亮
        { path: 'jobs/:jobId(\\d+)', name: 'job-detail', component: JobDetailPage, meta: { title: '作业详情', menuKey: 'jobs' } },
        // 仅 admin 角色可访问，对应后端 admin-service 全接口要求 admin 角色（见下方路由守卫）
        { path: 'database-instances', name: 'database-instances', component: DatabaseInstancesPage, meta: { title: '数据库实例注册', adminOnly: true } },
        { path: 'account-approval', name: 'account-approval', component: AccountApprovalPage, meta: { title: '注册审核与开户', adminOnly: true } },
        { path: 'user-management', name: 'user-management', component: UserManagementPage, meta: { title: '用户管理', adminOnly: true } },
        { path: 'settings', name: 'settings', component: UnderConstructionPage, meta: { title: '系统设置' } },
      ],
    },
    // 未匹配的路径一律回工作台（未登录时会被守卫再转去登录页）
    { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
  ],
})

// 全局前置守卫：未登录只能访问公开页，跳登录页时带上原目标，登录后原路返回
router.beforeEach((to) => {
  const { currentUser, isAdmin } = useAuth()
  if (!to.meta.public && !currentUser.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // 已登录状态下访问登录/注册页没有意义，送回工作台
  if ((to.name === 'login' || to.name === 'register') && currentUser.value) {
    return { name: 'dashboard' }
  }
  // 非 admin 用户直接改 URL 访问管理页：菜单已隐藏入口，这里兜底拦截（后端接口本身也会 403）
  if (to.meta.adminOnly && !isAdmin.value) {
    return { name: 'dashboard' }
  }
})

// 浏览器标签页标题跟随路由
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Lead Mind` : 'Lead Mind'
})

export default router
