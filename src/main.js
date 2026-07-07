import { createApp } from 'vue'
import AxisUI from '@jiaozai1/axis-ui'
import '@jiaozai1/axis-ui/dist/axis-ui.css'
import './assets/main.css'
import App from './App.vue'
import router from './router'

createApp(App).use(AxisUI).use(router).mount('#app')
