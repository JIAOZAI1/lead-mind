import { createApp } from 'vue'
import AxisUI from '@jiaozai1/axis-ui'
import '@jiaozai1/axis-ui/dist/axis-ui.css'
import './assets/main.css'
import App from './App.vue'
import router from './router'
// 入口处引入即恢复持久化的主题选择，避免懒加载页面就绪前闪烁亮色
import './composables/useTheme'

createApp(App).use(AxisUI).use(router).mount('#app')
