<script setup>
// 主页：只负责内容区，菜单栏/顶栏由 AppLayout 统一提供
import AppLayout from '../layouts/AppLayout.vue'
import { useAuth } from '../composables/useAuth'
import { useNavigation } from '../composables/useNavigation'

const { currentUser } = useAuth()
const { activeMenu, activeMenuLabel } = useNavigation()

// 工作台概览数据（模拟数据，待后端接口接入）
const overviewStats = [
  { label: '今日新增线索', value: 128 },
  { label: '待跟进客户', value: 36 },
  { label: 'AI 推荐商机', value: 12 },
]
</script>

<template>
  <AppLayout>
    <template v-if="activeMenu === 'dashboard'">
      <ax-card class="home-welcome" borderless>
        <h2 class="home-welcome__title">你好，{{ currentUser.name }} 👋</h2>
        <p class="home-welcome__desc">欢迎使用客脉，今天也一起高效获客吧。</p>
      </ax-card>
      <ax-row :gutter="16">
        <ax-col v-for="stat in overviewStats" :key="stat.label" :span="8">
          <ax-card hoverable>
            <div class="home-stat__label">{{ stat.label }}</div>
            <div class="home-stat__value">{{ stat.value }}</div>
          </ax-card>
        </ax-col>
      </ax-row>
    </template>

    <!-- 其余菜单对应的功能尚未开发，先给出占位提示 -->
    <ax-alert
      v-else
      type="info"
      :title="`「${activeMenuLabel}」功能建设中`"
      description="该模块正在开发中，敬请期待。"
      show-icon
    />
  </AppLayout>
</template>

<style scoped>
.home-welcome__title {
  margin: 0;
  font-size: var(--axis-font-size-h4);
  line-height: var(--axis-line-height-h4);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-text-primary);
}

.home-welcome__desc {
  margin: var(--axis-space-1) 0 0;
  font-size: var(--axis-font-size-base);
  color: var(--axis-color-text-secondary);
}

.home-stat__label {
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-secondary);
}

.home-stat__value {
  margin-top: var(--axis-space-1);
  font-size: var(--axis-font-size-h2);
  line-height: var(--axis-line-height-h2);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-text-primary);
}
</style>
