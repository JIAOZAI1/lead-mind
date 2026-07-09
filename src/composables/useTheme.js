import { ref } from 'vue'
import { toggleTheme, setTheme, getTheme } from '@jiaozai1/axis-ui'

// 用户手动选择的主题存 localStorage：axis-ui 的 setTheme 只改 <html data-theme>
// 属性、不做持久化，刷新后会丢，需要应用层自己恢复
const STORAGE_KEY = 'lead-mind:theme'

// 模块启动时恢复上次选择；无存储或读取失败（如隐私模式禁用存储）时保持默认亮色
function restoreTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') setTheme(saved)
  } catch {
    /* 存储不可用时静默降级为默认主题 */
  }
}
restoreTheme()

// 模块级单例：亮/暗主题状态全局共享（登录页与主页的开关联动）
const isDark = ref(getTheme() === 'dark')

export function useTheme() {
  /** 切换亮/暗主题：axis-ui 通过 <html data-theme> 重映射全部设计 Token，并持久化选择 */
  function toggle() {
    const theme = toggleTheme()
    isDark.value = theme === 'dark'
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* 存储不可用时主题仍生效，只是刷新后不保留 */
    }
  }

  return { isDark, toggle }
}
