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
├── api/          # 接口封装
│   ├── http.js           # 统一请求层：JSON 编解码、错误规整、401 自动续期（refresh token 单飞轮换）
│   └── authApi.js        # sso-service 认证接口（注册/登录/注销/用户信息）+ 错误文案中文化
├── assets/       # 全局样式（main.css：全局基础样式，消费 axis-ui Token）
├── components/   # 业务公共组件
│   └── AuthPageShell.vue # 认证页共享外壳：居中卡片 + Logo + 主题切换
├── composables/  # 组合式函数
│   ├── useAuth.js        # 登录态（对接 sso-service JWT 会话）
│   ├── useTheme.js       # 亮/暗主题切换（全局单例）
│   └── useNavigation.js  # 主导航菜单配置 + 选中态与路由双向绑定
├── layouts/      # 布局组件
│   └── AppLayout.vue     # 统一布局：侧边菜单 + 顶栏用户信息，内容区渲染子路由
├── router/       # 路由配置（vue-router 4，history 模式 + 登录守卫）
│   └── index.js
├── utils/        # 纯工具函数
│   └── authSession.js    # 会话持久化（记住我 → localStorage / 否则 sessionStorage）
├── views/        # 页面级组件（与路由一一对应）
│   ├── LoginPage.vue             # /login 登录页
│   ├── RegisterPage.vue          # /register 注册页
│   ├── DashboardPage.vue         # /dashboard 工作台
│   └── UnderConstructionPage.vue # 未开发模块共用占位页
├── App.vue       # 根组件：仅渲染路由出口
└── main.js       # 入口：注册 axis-ui + router 并引入样式
```

随业务扩展将增加 `stores/` 等目录，详见 `CLAUDE.md` 中的目录结构规范。

## 功能列表

| 功能 | 页面 | 说明 |
|------|------|------|
| 登录 | `src/views/LoginPage.vue` | 对接 sso-service 真实登录：账号/密码登录换取 JWT token 对，`/me` 拉取用户信息；AxForm 声明式校验，记住我（勾选存 localStorage，否则关标签页即失效）、注册入口，接口错误中文提示 |
| 注册 | `src/views/RegisterPage.vue` | 对接 sso-service 注册：用户名/邮箱/密码/确认密码，校验规则与后端约束一致（用户名 3~64、密码 8~128、邮箱格式、两次密码一致），注册成功自动登录进工作台 |
| 会话管理 | `src/api/http.js` | access token 15 分钟过期后由 refresh token 静默续期（单飞防并发、token 轮换）；refresh token 也失效时自动清会话回登录页；退出登录同步作废后端 refresh token |
| 主框架 | `src/layouts/AppLayout.vue` | 左侧 AxMenu 菜单栏（工作台 / 客户开发二级菜单 / AI 助手 / 系统设置），顶栏展示用户信息（用户名、邮箱提示、退出）与主题切换，菜单高亮跟随路由 |
| 工作台 | `/dashboard` → `DashboardPage.vue` | 欢迎语 + 概览统计卡片（模拟数据） |
| 路由体系 | `src/router/index.js` | 页面与 URL 一一对应（`/login`、`/register`、`/dashboard`、`/leads/search`、`/leads/mine`、`/ai-assistant`、`/settings`），懒加载分包；登录守卫拦截未登录访问并支持登录后原路返回；页面标题跟随路由 |

## 后端接口

后端为微服务架构，网关按 host + 路由前缀转发（dev 网关：`http://lead-mind-backend.dev.com`），网关的 Traefik CORS 中间件按来源白名单放行跨域：

- **部署环境**：浏览器直连后端网关域名（`.env.production` 注入 `VITE_API_ORIGIN`），`lead-mind.dev.com` 在 CORS 白名单内
- **本地开发**：走 vite dev server 代理到后端网关（见 `vite.config.js` 的 `server.proxy`，服务端转发不受 CORS 限制）——vite 默认端口 `localhost:5173` 不在网关白名单内，故不直连

已接入服务：[sso-service](https://github.com/JIAOZAI1/backend-service/blob/main/services/sso-service/README.md)（注册 / 登录 / 续期 / 注销 / 用户信息，JWT 双 token：access 15 分钟 + refresh 7 天轮换）

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
  - dev 环境接入 k3s 内置 Traefik ingress（`ingressClassName: traefik`），域名 `lead-mind.dev.com` 解析至 dev 机器；dev 副本数调整为 1
- **2026-07-09**
  - 登录页对接 sso-service 真实接口：新增 `src/api/`（http.js 统一请求层 + authApi.js 认证接口）、`utils/authSession.js` 会话持久化；「记住我」决定登录态存 localStorage 还是 sessionStorage；后端错误文案中文化
  - 会话自动续期：access token 过期收到 401 时用 refresh token 静默换新并重试（单飞防并发轮换失效），refresh 也失效则清会话回登录页；退出登录调用后端 logout 作废 refresh token
  - 新增注册页 `/register`：校验规则与后端约束一致，注册成功自动登录；登录/注册页共享外壳抽取为 `components/AuthPageShell.vue`
  - 顶栏用户信息改为后端真实字段（用户名 + 邮箱提示），移除模拟的角色/租户
  - 同源代理规避跨域（后端网关未处理 CORS 预检）：本地开发走 vite `server.proxy`，部署环境前端 Ingress 加 `/sso-service` 路径直达后端 Service
  - 后端网关接入 CORS 白名单后改为直连：生产构建经 `.env.production` 的 `VITE_API_ORIGIN` 直连后端域名，前端 Ingress 移除 `/sso-service` 直达 Service 的规则；本地开发保留 vite 代理（`localhost:5173` 不在网关白名单）
