# Lead Mind（客脉）

[![CI](https://github.com/JIAOZAI1/lead-mind/actions/workflows/ci.yml/badge.svg)](https://github.com/JIAOZAI1/lead-mind/actions/workflows/ci.yml)

SaaS 多租户外贸获客系统 · 前端项目

帮助外贸人员通过互联网获取有价值的客户资源，并接入 AI 能力。

## 技术架构

- **Vue 3**（Composition API + `<script setup>`）+ **Vite**
- **[axis-ui](https://github.com/JIAOZAI1/axis-ui)**（`@jiaozai1/axis-ui`）— 自研企业级组件库，基于设计 Token 体系构建，支持暗色模式与品牌主题定制

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## 目录结构

```
.github/workflows/
├── ci.yml              # GitHub Actions：push main / PR 时自动构建并上传产物
└── docker.yml          # GitHub Actions：push main 时构建 Docker 镜像并推送 ghcr.io
deploy/
├── nginx.conf          # 容器内 nginx 配置（SPA 回退 + 静态资源缓存 + gzip）
└── k8s/                # Kubernetes 部署清单（Deployment / Service / Ingress）
Dockerfile              # 多阶段构建：node 构建 dist → nginx 托管
scripts/
└── update-axis-ui.sh   # axis-ui 升级脚本（查最新版 → 升级 → 报告组件/Token 变更 → 构建验证）
src/
├── assets/       # 全局样式（main.css：全局基础样式，消费 axis-ui Token）
├── composables/  # 组合式函数
│   ├── useAuth.js        # 登录态（sessionStorage 持久化，待后端接入）
│   ├── useTheme.js       # 亮/暗主题切换（全局单例）
│   └── useNavigation.js  # 主导航菜单配置 + 选中态与路由双向绑定
├── layouts/      # 布局组件
│   └── AppLayout.vue     # 统一布局：侧边菜单 + 顶栏用户信息，内容区渲染子路由
├── router/       # 路由配置（vue-router 4，history 模式 + 登录守卫）
│   └── index.js
├── views/        # 页面级组件（与路由一一对应）
│   ├── LoginPage.vue             # /login 登录页
│   ├── DashboardPage.vue         # /dashboard 工作台
│   └── UnderConstructionPage.vue # 未开发模块共用占位页
├── App.vue       # 根组件：仅渲染路由出口
└── main.js       # 入口：注册 axis-ui + router 并引入样式
```

随业务扩展将增加 `api/`（接口）、`components/`（业务公共组件）、`composables/`（组合式函数）、`router/`、`stores/`、`utils/` 等目录，详见 `CLAUDE.md` 中的目录结构规范。

## 功能列表

| 功能 | 页面 | 说明 |
|------|------|------|
| 登录 | `src/views/LoginPage.vue` | 账号/密码登录，AxForm 声明式校验（账号必填、密码至少 6 位），记住我、忘记密码、注册入口，支持亮/暗主题切换。登录接口暂为模拟，待后端接入 |
| 主框架 | `src/layouts/AppLayout.vue` | 左侧 AxMenu 菜单栏（工作台 / 客户开发二级菜单 / AI 助手 / 系统设置），顶栏展示用户信息（角色标签、租户提示、退出）与主题切换，菜单高亮跟随路由 |
| 工作台 | `/dashboard` → `DashboardPage.vue` | 欢迎语 + 概览统计卡片（模拟数据） |
| 路由体系 | `src/router/index.js` | 页面与 URL 一一对应（`/login`、`/dashboard`、`/leads/search`、`/leads/mine`、`/ai-assistant`、`/settings`），懒加载分包；登录守卫拦截未登录访问并支持登录后原路返回；页面标题跟随路由 |

## Docker 部署

镜像由 GitHub Actions 自动构建并推送到 `ghcr.io/jiaozai1/lead-mind`（`latest` + commit SHA 双标签）：

```bash
docker pull ghcr.io/jiaozai1/lead-mind:latest
docker run -d -p 8080:80 ghcr.io/jiaozai1/lead-mind:latest   # 访问 http://localhost:8080
```

本地手动构建（axis-ui 在 GitHub Packages，需要把 npm token 以 BuildKit secret 传入，token 不会进镜像层）：

```bash
export NPM_TOKEN=<你的 GitHub PAT（read:packages）>
docker build --secret id=npm_token,env=NPM_TOKEN -t lead-mind .
```

## Kubernetes 部署

清单位于 `deploy/k8s/`（Deployment 双副本滚动更新 + ClusterIP Service + Ingress）：

```bash
# 1. 创建 ghcr 镜像拉取凭证（一次性；PAT 需 read:packages 权限）
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=JIAOZAI1 \
  --docker-password=<你的 GitHub PAT>

# 2. 部署（先把 ingress.yaml 里的 host 换成实际域名）
kubectl apply -f deploy/k8s/

# 3. 发新版：CI 推送新镜像后滚动重启即可
kubectl rollout restart deployment/lead-mind
```

## 设计规范

项目严格遵循 axis-ui 前端设计规范（详见 `CLAUDE.md`）：

- 样式只消费 `--axis-*` 语义 Token，零硬编码色值与魔法数字
- 间距遵守 8px 网格（`--axis-space-*`）
- 全站支持暗色模式（`data-theme` 切换 Token 映射）
- 优先复用 axis-ui 组件，不手搓自定义组件和样式

## 更新记录

- **2026-07-07**
  - 初始化项目（create-vue + Vite）
  - 接入 `@jiaozai1/axis-ui`，从 0.1.0 逐步升级至 0.2.0
  - 新增登录页：AxCard / AxForm / AxFormItem / AxInput / AxCheckbox / AxButton / AxSwitch / AxLink / AxMessage 全组件库搭建，样式全量 Token 化
  - 全局样式接入暗色模式（html/body 背景消费 Token）
  - 建立项目章程 `CLAUDE.md`，清理脚手架演示代码
  - 新增 axis-ui 升级脚本 `scripts/update-axis-ui.sh` 及配套 `update-axis-ui` skill（`.claude/skills/`），升级流程标准化
  - axis-ui 升级至 0.3.0（新增 AxMenu / AxMenuItem / AxSubMenu）
  - 新增主页：左侧 AxMenu 菜单栏 + 顶栏用户信息 + 工作台概览；新增 `useAuth` / `useTheme` 组合式函数，登录成功后进入主页，退出返回登录页（暂未引入路由）
  - 布局封装：侧边菜单 + 顶栏抽取为 `layouts/AppLayout.vue`，菜单改为 `useNavigation.js` 配置数据驱动；新增页面只需用 AppLayout 包裹内容并在菜单配置中加一项
  - axis-ui 升级至 0.3.1（AxLink 新增 `size` / `weight` props）：顶栏"退出"、登录页"忘记密码"改用 `size="sm"`，移除自定义字号样式
  - 接入 GitHub Actions 自动化构建（`.github/workflows/ci.yml`）：push main / PR 触发，`npm ci` + 生产构建 + 上传 dist 产物（保留 7 天）
- **2026-07-08**
  - 支持 Docker 部署：新增多阶段 `Dockerfile`（node 构建 → nginx 托管，含 SPA 回退与健康检查）、`deploy/nginx.conf`、`.dockerignore`
  - 新增 `docker.yml` 工作流：push main 自动构建镜像并推送 `ghcr.io/jiaozai1/lead-mind`，npm token 走 BuildKit secret 不落镜像层，启用 GHA 层缓存
  - 引入 vue-router 4：页面与路由一一对应、懒加载分包、登录守卫（未登录跳转 `/login` 并支持原路返回）、标签页标题跟随路由；登录态持久化到 sessionStorage；`HomePage` 拆分为 `DashboardPage` + 共用占位页
  - 新增 `commit-push` skill（`.claude/skills/`）：提交推送流程标准化（构建验证、敏感信息审查、规范化提交信息）
  - 支持 Kubernetes 部署：`deploy/k8s/` 新增 Deployment（双副本零中断滚动更新、就绪/存活探针、资源限额）、Service、Ingress 清单
  - 新增 `deploy-dev` skill（`.claude/skills/`）：dev 环境部署流程标准化（本地 kubectl apply + 滚动重启拉新镜像 + 就绪验证与失败排查）
  - 页面静态标题改为 Lead Mind（原为脚手架默认的 Vite App），`html lang` 补为 `zh-CN`
