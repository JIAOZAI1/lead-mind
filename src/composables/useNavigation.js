import { ref, computed } from 'vue'

/**
 * 主导航菜单配置（数据驱动）
 * 新增页面时只需在这里加一项，AppLayout 会自动渲染菜单，无需改布局组件
 * key 为菜单唯一标识，含 children 的项渲染为二级子菜单
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

// 扁平化 key → label 映射，供标题显示使用
const labelMap = Object.fromEntries(
  menuItems.flatMap((item) => [
    [item.key, item.label],
    ...(item.children ?? []).map((child) => [child.key, child.label]),
  ]),
)

// 模块级单例：当前选中菜单全局共享（布局组件与页面内容联动）
const activeMenu = ref('dashboard')

export function useNavigation() {
  /** 当前选中菜单的标题（顶栏与页面标题共用） */
  const activeMenuLabel = computed(() => labelMap[activeMenu.value] ?? '')

  /** 含子菜单的分组默认全部展开 */
  const defaultOpenKeys = menuItems.filter((item) => item.children).map((item) => item.key)

  return { activeMenu, activeMenuLabel, menuItems, defaultOpenKeys }
}
