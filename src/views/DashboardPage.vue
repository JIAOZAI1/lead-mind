<script setup>
// 工作台：登录后的默认首页，展示欢迎语与经营概览
import { useAuth } from '../composables/useAuth'

const { currentUser } = useAuth()

// 工作台概览数据（模拟数据，待后端接口接入）
const overviewStats = [
  { label: '今日新增线索', value: 128 },
  { label: '待跟进客户', value: 36 },
  { label: 'AI 推荐商机', value: 12 },
]
</script>

<template>
  <ax-card class="dashboard-welcome" borderless>
    <h2 class="dashboard-welcome__title">你好，{{ currentUser.username }} 👋</h2>
    <p class="dashboard-welcome__desc">欢迎使用客脉，今天也一起高效获客吧。</p>
  </ax-card>
  <ax-row :gutter="16">
    <ax-col v-for="stat in overviewStats" :key="stat.label" :span="8">
      <ax-card hoverable>
        <div class="dashboard-stat__label">{{ stat.label }}</div>
        <div class="dashboard-stat__value">{{ stat.value }}</div>
      </ax-card>
    </ax-col>
  </ax-row>
</template>

<style scoped>
.dashboard-welcome__title {
  margin: 0;
  font-size: var(--axis-font-size-h4);
  line-height: var(--axis-line-height-h4);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-text-primary);
}

.dashboard-welcome__desc {
  margin: var(--axis-space-1) 0 0;
  font-size: var(--axis-font-size-base);
  color: var(--axis-color-text-secondary);
}

.dashboard-stat__label {
  font-size: var(--axis-font-size-sm);
  color: var(--axis-color-text-secondary);
}

.dashboard-stat__value {
  margin-top: var(--axis-space-1);
  font-size: var(--axis-font-size-h2);
  line-height: var(--axis-line-height-h2);
  font-weight: var(--axis-font-weight-semibold);
  color: var(--axis-color-text-primary);
}
</style>
