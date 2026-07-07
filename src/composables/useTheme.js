import { ref } from 'vue'
import { toggleTheme, getTheme } from '@jiaozai1/axis-ui'

// 模块级单例：亮/暗主题状态全局共享（登录页与主页的开关联动）
const isDark = ref(getTheme() === 'dark')

export function useTheme() {
  /** 切换亮/暗主题：axis-ui 通过 <html data-theme> 重映射全部设计 Token */
  function toggle() {
    toggleTheme()
    isDark.value = getTheme() === 'dark'
  }

  return { isDark, toggle }
}
