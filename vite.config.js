import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 本地开发把 /sso-service 前缀代理到 dev 后端网关（服务端转发不受 CORS 限制）：
      // 网关 CORS 白名单没有 vite 默认端口 localhost:5173，浏览器直连会被拦；
      // 生产构建直连后端域名（见 .env.production），不走此代理
      '/sso-service': {
        target: 'http://lead-mind-backend.dev.com',
        changeOrigin: true,
      },
      '/backend-job-service': {
        target: 'http://lead-mind-backend.dev.com',
        changeOrigin: true,
      },
      '/admin-service': {
        target: 'http://lead-mind-backend.dev.com',
        changeOrigin: true,
      },
      // SSE 流式接口需要关闭代理缓冲，否则增量内容会被攒批一次性下发
      '/ai-agent': {
        target: 'http://lead-mind-backend.dev.com',
        changeOrigin: true,
        buffer: false,
      },
    },
  },
})
