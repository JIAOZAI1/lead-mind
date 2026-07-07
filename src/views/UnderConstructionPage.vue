<script setup>
// 通用占位页：尚未开发的模块共用，标题取自当前路由 meta
// 模块落地时在 router 中把对应路由的 component 替换为真实页面即可
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <ax-alert
    type="info"
    :title="`「${route.meta.title}」功能建设中`"
    description="该模块正在开发中，敬请期待。"
    show-icon
  />
</template>
