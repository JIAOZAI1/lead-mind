import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { menuItems } from './useNavigation'

/**
 * 多页签工作区状态（模块级单例）
 * 页签粒度 = 菜单级页面：菜单里的每个叶子项对应一个页签；
 * 详情页等子页面通过路由 meta.menuKey 归入所属菜单的页签（页签记住其最后访问的 fullPath）
 */

/** 工作台是常驻首页签：不可关闭，保证工作区始终至少有一个页签 */
export const HOME_TAB_KEY = 'dashboard'

const STORAGE_KEY = 'lead-mind:workspace-tabs'

// 菜单 key → 菜单文案 的扁平映射：页签标题跟随菜单文案，也用来过滤不属于菜单体系的路由
const menuLabelMap = new Map(
  menuItems.flatMap((item) => (item.children ?? [item]).map((leaf) => [leaf.key, leaf.label])),
)

// 刷新后从 sessionStorage 恢复已打开的页签（views 是运行期的组件缓存记录，不恢复）
function restoreTabs() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    if (!Array.isArray(saved)) return []
    return saved
      .filter((tab) => menuLabelMap.has(tab?.key) && typeof tab.fullPath === 'string')
      .map((tab) => ({ key: tab.key, label: menuLabelMap.get(tab.key), fullPath: tab.fullPath, views: [] }))
  } catch {
    return []
  }
}

const openTabs = ref(restoreTabs())

watch(
  openTabs,
  (tabs) => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(tabs.map(({ key, label, fullPath }) => ({ key, label, fullPath }))),
    )
  },
  { deep: true },
)

export function useWorkspaceTabs() {
  const route = useRoute()
  const router = useRouter()

  /** 当前路由所属的页签 key（详情页经 meta.menuKey 归入所属菜单页签） */
  const routeTabKey = computed(() => route.meta.menuKey ?? route.name)

  // 取当前路由最终渲染的页面组件名（<script setup> 组件由文件名推导出 __name），
  // 记到页签上供 keep-alive include 使用：关闭页签时对应组件缓存随之释放
  function resolveViewName() {
    const component = route.matched.at(-1)?.components?.default
    // 懒加载路由在导航完成后已被 vue-router 替换为解析后的组件对象，函数说明还没解析完，跳过
    if (!component || typeof component === 'function') return ''
    return component.name ?? component.__name ?? ''
  }

  // 路由变化时同步页签：没有就新开，有就更新其 fullPath（切回页签时能还原到最后访问的页面）
  watch(
    () => route.fullPath,
    () => {
      const key = routeTabKey.value
      if (!menuLabelMap.has(key)) return
      // 工作台作为常驻首页签始终排在第一位，即使用户从直链进入其他页面
      if (!openTabs.value.some((tab) => tab.key === HOME_TAB_KEY)) {
        openTabs.value.unshift({
          key: HOME_TAB_KEY,
          label: menuLabelMap.get(HOME_TAB_KEY),
          fullPath: router.resolve({ name: HOME_TAB_KEY }).fullPath,
          views: [],
        })
      }
      let tab = openTabs.value.find((item) => item.key === key)
      if (!tab) {
        tab = { key, label: menuLabelMap.get(key), fullPath: route.fullPath, views: [] }
        openTabs.value.push(tab)
      } else {
        tab.fullPath = route.fullPath
      }
      const viewName = resolveViewName()
      if (viewName && !tab.views.includes(viewName)) tab.views.push(viewName)
    },
    { immediate: true },
  )

  // 页签选中态与路由双向绑定：读 = 当前路由所属页签，写 = 跳到目标页签记住的页面
  const activeTab = computed({
    get: () => routeTabKey.value,
    set: (key) => {
      const tab = openTabs.value.find((item) => item.key === key)
      if (tab && key !== routeTabKey.value) router.push(tab.fullPath)
    },
  })

  /** 关闭页签：若关的是当前页签，跳到右侧相邻页签（没有则左侧），与 AxTabs 的自动切换策略一致 */
  function closeTab(key) {
    if (key === HOME_TAB_KEY) return
    const index = openTabs.value.findIndex((tab) => tab.key === key)
    if (index < 0) return
    const isActive = key === routeTabKey.value
    const neighbor = openTabs.value[index + 1] ?? openTabs.value[index - 1]
    openTabs.value.splice(index, 1)
    if (isActive && neighbor) router.push(neighbor.fullPath)
  }

  /** 退出登录时清空工作区，避免页签泄漏给下一个登录的账号 */
  function resetTabs() {
    openTabs.value = []
    sessionStorage.removeItem(STORAGE_KEY)
  }

  /** 所有打开页签涉及的页面组件名并集，作为 keep-alive 的 include 白名单 */
  const cachedViews = computed(() => [...new Set(openTabs.value.flatMap((tab) => tab.views))])

  return { openTabs, activeTab, closeTab, resetTabs, cachedViews }
}
