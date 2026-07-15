import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './useAuth'

/**
 * 主导航菜单配置（数据驱动）
 * key 必须与 router 中的路由 name 一致：菜单选中态直接由当前路由推导，
 * 新增页面 = router 加一条路由 + 这里加一个菜单项
 * adminOnly: true 的菜单项仅当前用户拥有 admin 角色时才展示（对应后端接口的角色校验）
 */
export const menuItems = [
  { key: 'dashboard', label: '工作台' },
  {
    key: 'customer',
    label: '客户开发',
    children: [
      { key: 'lead-search', label: '线索搜索' },
      { key: 'my-leads', label: '我的线索' },
    ],
  },
  { key: 'ai-assistant', label: 'AI 助手' },
  { key: 'jobs', label: '后台作业' },
  { key: 'account-approval', label: '注册审核与开户', adminOnly: true },
  { key: 'database-instances', label: '数据库实例注册', adminOnly: true },
  { key: 'settings', label: '系统设置' },
]

export function useNavigation() {
  const route = useRoute()
  const router = useRouter()
  const { isAdmin } = useAuth()

  // 菜单选中态与路由双向绑定：读 = 当前路由名，写 = 触发路由跳转
  // 这样浏览器前进/后退、直链访问时菜单高亮都能自动对上
  // 详情页等子页面不在菜单里，通过路由 meta.menuKey 指回所属的一级菜单保持高亮
  const activeMenu = computed({
    get: () => route.meta.menuKey ?? route.name,
    set: (name) => router.push({ name }),
  })

  /** 当前页面标题（取路由 meta，顶栏与浏览器标签页共用同一来源） */
  const activeMenuLabel = computed(() => route.meta.title ?? '')

  /** 按角色过滤后的菜单：非 admin 用户看不到 adminOnly 菜单项 */
  const visibleMenuItems = computed(() => menuItems.filter((item) => !item.adminOnly || isAdmin.value))

  /** 含子菜单的分组默认全部展开 */
  const defaultOpenKeys = menuItems.filter((item) => item.children).map((item) => item.key)

  return { activeMenu, activeMenuLabel, menuItems: visibleMenuItems, defaultOpenKeys }
}
