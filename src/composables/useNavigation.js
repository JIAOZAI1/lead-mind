import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * 主导航菜单配置（数据驱动）
 * key 必须与 router 中的路由 name 一致：菜单选中态直接由当前路由推导，
 * 新增页面 = router 加一条路由 + 这里加一个菜单项
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
  { key: 'settings', label: '系统设置' },
]

export function useNavigation() {
  const route = useRoute()
  const router = useRouter()

  // 菜单选中态与路由双向绑定：读 = 当前路由名，写 = 触发路由跳转
  // 这样浏览器前进/后退、直链访问时菜单高亮都能自动对上
  const activeMenu = computed({
    get: () => route.name,
    set: (name) => router.push({ name }),
  })

  /** 当前页面标题（取路由 meta，顶栏与浏览器标签页共用同一来源） */
  const activeMenuLabel = computed(() => route.meta.title ?? '')

  /** 含子菜单的分组默认全部展开 */
  const defaultOpenKeys = menuItems.filter((item) => item.children).map((item) => item.key)

  return { activeMenu, activeMenuLabel, menuItems, defaultOpenKeys }
}
