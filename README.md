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
│   ├── authApi.js        # sso-service 认证接口（注册/登录/注销/用户信息）+ 错误文案中文化
│   └── jobApi.js         # backend-job-service 作业调度接口（作业/任务/执行记录/状态轮询）+ 枚举展示元数据
├── assets/       # 全局样式（main.css：全局基础样式，消费 axis-ui Token）
├── components/   # 业务公共组件
│   └── AuthPageShell.vue # 认证页共享外壳：居中卡片 + Logo + 主题切换
├── composables/  # 组合式函数
│   ├── useAuth.js        # 登录态（对接 sso-service JWT 会话）
│   ├── useTheme.js       # 亮/暗主题切换（全局单例）
│   ├── useNavigation.js  # 主导航菜单配置 + 选中态与路由双向绑定
│   └── useWorkspaceTabs.js # 多页签工作区状态（页签开关/切换/keep-alive 缓存/刷新恢复）
├── layouts/      # 布局组件
│   └── AppLayout.vue     # 统一布局：侧边菜单 + 顶栏用户信息 + 多页签栏，内容区渲染子路由
├── router/       # 路由配置（vue-router 4，history 模式 + 登录守卫）
│   └── index.js
├── utils/        # 纯工具函数
│   ├── authSession.js    # 会话持久化（记住我 → localStorage / 否则 sessionStorage）
│   └── datetime.js       # 后端 UTC 时间解析（兼容缺失 Z 后缀）与本地化格式化
├── views/        # 页面级组件（与路由一一对应）
│   ├── LoginPage.vue             # /login 登录页
│   ├── RegisterPage.vue          # /register 注册页
│   ├── DashboardPage.vue         # /dashboard 工作台
│   ├── JobsPage.vue              # /jobs 后台作业列表
│   ├── JobDetailPage.vue         # /jobs/:jobId 作业详情（任务编排 + 执行记录 + 状态轮询）
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
| 会话管理 | `src/api/http.js` | 请求默认携带 access token（后端网关对所有业务服务统一挂 ForwardAuth 登录校验，仅登录/注册/续期/注销匿名可达）；access token 15 分钟过期后由 refresh token 静默续期（单飞防并发、token 轮换）；refresh token 也失效时自动清会话回登录页；退出登录同步作废后端 refresh token |
| 主框架 | `src/layouts/AppLayout.vue` | 左侧 AxMenu 菜单栏（工作台 / 客户开发二级菜单 / AI 助手 / 后台作业 / 数据库实例注册（仅 admin 角色可见）/ 系统设置），顶栏展示用户信息（用户名、邮箱提示、退出）与主题切换，菜单高亮跟随路由 |
| 多页签工作区 | `src/composables/useWorkspaceTabs.js` | 点击菜单打开对应页签（AxTabs 导航条），切换页签经 keep-alive 保留页内状态（如列表分页/排序）；页签可关闭（工作台常驻不可关，关闭时释放页面缓存并跳相邻页签）；详情页归入所属菜单页签并记住最后访问位置；刷新后从 sessionStorage 恢复已打开页签，退出登录自动清空 |
| 工作台 | `/dashboard` → `DashboardPage.vue` | 欢迎语 + 概览统计卡片（模拟数据） |
| 后台作业 | `/jobs` → `JobsPage.vue` | 对接 backend-job-service：作业分页列表（支持点击表头按 ID / 名称 / 状态 / 下次执行 / 创建时间服务端排序）、新建作业（Cron 周期 / 一次性调度，前端校验与后端约束一致） |
| 作业详情 | `/jobs/:jobId` → `JobDetailPage.vue` | 作业信息与最新执行状态（5 秒自动轮询）；任务编排（服务端分页 + 按顺序号 / 名称排序，按顺序绑定插件 Handler，配置参数 JSON / 超时 / 重试）；执行记录（服务端分页、按触发时间倒序，任务级明细弹窗展示输出与错误） |
| 数据库实例注册 | `/database-instances` → `DatabaseInstancesPage.vue` | 对接 admin-service：数据库实例分页列表（支持点击表头按 ID / 名称 / 类型 / 创建时间服务端排序）、注册 / 编辑（密码留空则保留原密码）/ 删除（软删除），密码只加密落库不回显；仅 admin 角色可见该菜单项与访问该路由（`useNavigation.js` 菜单显隐 + 路由守卫双重拦截，对应后端接口的角色校验） |
| 路由体系 | `src/router/index.js` | 页面与 URL 一一对应（`/login`、`/register`、`/dashboard`、`/leads/search`、`/leads/mine`、`/ai-assistant`、`/jobs`、`/jobs/:jobId`、`/database-instances`、`/settings`），懒加载分包；登录守卫拦截未登录访问并支持登录后原路返回，另拦截非 admin 角色直接访问 `adminOnly` 路由；页面标题跟随路由，详情页经 `meta.menuKey` 保持所属菜单高亮 |

## 后端接口

后端为微服务架构，网关按 host + 路由前缀转发（dev 网关：`http://lead-mind-backend.dev.com`），网关的 Traefik CORS 中间件按来源白名单放行跨域：

- **部署环境**：浏览器直连后端网关域名（`.env.production` 注入 `VITE_API_ORIGIN`），`lead-mind.dev.com` 在 CORS 白名单内
- **本地开发**：走 vite dev server 代理到后端网关（见 `vite.config.js` 的 `server.proxy`，服务端转发不受 CORS 限制）——vite 默认端口 `localhost:5173` 不在网关白名单内，故不直连

已接入服务：

- [sso-service](https://github.com/JIAOZAI1/backend-service/blob/main/services/sso-service/README.md)：注册 / 登录 / 续期 / 注销 / 用户信息，JWT 双 token（access 15 分钟 + refresh 7 天轮换）；`/me` 额外返回 `roles` 角色列表，前端据此判断 admin 专属菜单/路由的可见性
- [backend-job-service](https://github.com/JIAOZAI1/backend-service/blob/main/services/backend-job-service/README.md)：作业调度（Cron / 一次性）、任务编排（插件 Handler）、执行记录与状态轮询；枚举字段用数字收发（后端未注册字符串枚举转换器），部分时间字段缺 UTC 时区后缀由前端统一补齐解析
- [admin-service](https://github.com/JIAOZAI1/backend-service/blob/main/services/admin-service/README.md)：数据库实例管理（本项目当前仅接入这部分，系统设置/用户审核开户/租户查询等接口后端已提供但前端暂未对接），全部接口要求 admin 角色，非 admin 调用返回 403

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
  - 新增「后台作业」一级菜单，对接 backend-job-service：作业列表页 `/jobs`（新建 Cron/一次性作业）+ 作业详情页 `/jobs/:jobId`（任务编排、执行记录、最新执行状态 5 秒轮询）；新增 `api/jobApi.js`、`utils/datetime.js`，统一请求层错误兼容 ASP.NET ProblemDetails 格式
- **2026-07-10**
  - 优化后台作业页面视觉规范：列表页与详情页优先复用 axis-ui 的 AxCard 标题/extra、AxTable 紧凑尺寸、AxTag、AxTabs、AxModal 等组件能力，仅保留必要布局与长文本处理样式
  - axis-ui 升级至 0.4.0：新增 AxDescriptions / AxSpace / AxText / AxTitle；后台作业列表与详情页改用 AxSpace 管理操作区间距、AxText 管理辅助/代码/错误文本、AxDescriptions 展示作业详情信息，进一步减少页面级样式
  - 作业列表改为调用 backend-job-service 服务端分页查询接口，移除本地已知作业 ID 过渡方案与按 ID 添加入口
  - axis-ui 升级至 0.4.1：AxPagination 支持每页条数切换与 `v-model` 同步，后台作业列表启用 `show-size-changer` 和 `pageSizes`
  - 后台作业支持更新与删除：列表页可编辑/删除作业；详情页只保留返回列表和子资源管理，任务编排支持编辑/删除任务
  - axis-ui 升级至 0.4.2：AxTable 支持受控表头排序（`sortKey`/`sortOrder` + `sort-change`，点击循环 升序→降序→取消）
  - 后台作业列表接入服务端字段排序（ID / 名称 / 状态 / 下次执行 / 创建时间，`sortBy`/`sortOrder` 白名单契约）；详情页任务列表随后端改造接入服务端分页 + 排序（顺序号 / 名称，默认按顺序号升序与执行顺序一致），新增分页器与每页条数切换
  - 执行记录随后端改造从 limit 条数查询改为服务端分页（固定按触发时间倒序，后端不支持排序字段），条数下拉替换为分页器
  - 修复暗色主题刷新后丢失：主题选择持久化到 localStorage（`lead-mind:theme`），应用入口处恢复，避免懒加载页面就绪前闪烁亮色
  - axis-ui 升级至 0.4.3：修复浏览器自动填充导致暗色主题下 AxInput 背景变白（UA autofill 样式用 inset 阴影 + 主题 Token 覆盖），登录/注册表单自动受益，无需业务代码改动
  - axis-ui 升级至 0.4.4；新增多页签工作区：复用 AxTabs / AxTabPane（`closable` + `close` 事件）在顶栏下方渲染页签栏，菜单级页面点击即开页签，切换页签经 keep-alive 保留页内状态，关闭页签释放缓存，详情页归入所属菜单页签，刷新经 sessionStorage 恢复（新增 `composables/useWorkspaceTabs.js`，改造 `AppLayout.vue`）
- **2026-07-13**
  - 对齐后端网关登录校验（Traefik ForwardAuth 对所有业务服务统一校验 Bearer token）：统一请求层 `request` 的 `auth` 默认值翻转为 `true`，业务接口（含 jobApi 全部请求）默认携带 access token，仅注册/登录/注销等匿名端点显式关闭，避免新增接口漏带 token 被网关 401 拦截
  - axis-ui 升级至 0.4.5：修复 0.4.4 引入的 AxTabs 回归——pane 信息存入深层 `reactive` Map 时内部 ref 被自动解包，导致所有页签文字与关闭按钮不渲染（本项目定位根因并反馈 UI 团队修复）；同时修复 AxTabPane 未设 `closable` 时无法继承 Tabs 级 `closable` 的问题。多页签工作区与作业详情页「任务编排/执行记录」页签恢复正常
- **2026-07-14**
  - axis-ui 升级至 0.4.6：内部修复，无新增/移除的组件导出与设计 Token，业务代码无需改动
  - axis-ui 0.4.6 同步新增 AxTabs `type` prop（`line`/`card`）：多页签工作区改用 `type="card"`，页签变为独立卡片外观（选中态与内容区底色衔接），无需业务侧手写样式
- **2026-07-15**
  - 新增「数据库实例注册」一级菜单，对接 admin-service：数据库实例分页列表（ID/名称/类型/创建时间服务端排序）、注册/编辑（密码留空保留原密码）/删除；新增 `api/adminApi.js`
  - 接入角色感知：`sso-service` `/me` 的 `roles` 字段透出到 `useAuth` 的 `isAdmin`，`useNavigation.js` 按角色过滤菜单项、路由 `meta.adminOnly` + 全局守卫双重拦截非 admin 用户访问管理页（后端 admin-service 全接口本身也做 admin 角色校验，前端属于体验层兜底）
  - 补齐 `vite.config.js` 本地开发代理遗漏的 `/admin-service` 路径（此前只代理了 sso-service、backend-job-service）
  - axis-ui 升级至 0.5.1：修复可排序列表头文字不跟随 `align` 居中/右对齐（列头是 flex 布局的排序按钮，`text-align` 传导不进去，此前恒靠左）——本项目定位根因、反馈并配合 UI 团队完成修复；`JobsPage`/`DatabaseInstancesPage` 的 `id`/`status`/`dbType` 等居中可排序列表头恢复居中，业务代码无需改动。同版本新增 `AxSteps`/`AxWizardModal`，暂无对应场景，未接入
  - axis-ui 升级至 0.5.2：修复可排序列居中时表头文字仍偏离列宽正中（排序图标占用 flex 布局空间，把"文字+图标"整体居中导致文字视觉左偏，窄列如 ID 尤为明显）——本项目定位根因并反馈，UI 团队采用图标 `position: absolute` 脱离文档流的方案修复，文字现在真正相对列宽居中
  - axis-ui 升级至 0.5.3：新增 `TableColumn.headerAlign`，表头对齐可独立于内容对齐配置（不传回退到 `align`，向后兼容）——本项目反馈该需求后落地
  - 表格对齐方案统一为项目默认：所有表格（`JobsPage`/`DatabaseInstancesPage`/`JobDetailPage` 的任务编排、执行记录、执行详情）全部列改为 `align: 'center'`，表头与内容均居中，不再区分短值/长文本的差异化对齐
  - axis-ui 升级至 0.7.0：新增 `AxIcon` 组件（`name`/`size`/`spin`/`label` props，内置 refresh/plus/edit/delete/eye 等图标集）；`JobsPage`/`DatabaseInstancesPage`/`JobDetailPage` 的"刷新/新建/注册/编辑/删除/详情/明细"等按钮与链接统一加上对应图标，间距由 `AxButton`/`AxLink` 自带的 flex `gap` Token 承载，无需额外样式；按钮内图标默认 20px 明显大于 14px 基础字号，统一改传 `size="sm"`（16px）与文字比例协调
  - 【待反馈 axis-ui】`refresh` 图标（环形箭头）相较 `plus`（对称十字）右侧/下方留白明显更多，与文字组合时即使 gap 值相同也显得间距偏大，属于图标集内部各图形留白不一致；本项目按钮内 gap 未做特殊处理，等待 axis-ui 侧统一做图标光学居中优化
  - axis-ui 升级至 0.7.1：修复暗色模式下 `--axis-color-text-inverse` 被错误重映射为近黑色（此前与 `--axis-color-text-primary` 暗色取值相同）导致的 bug——`ax-button` 的 primary/success/warning/danger 等实心背景变体在暗色模式下文字对比度骤降（如"新建作业"按钮暗色下文字发黑、糊在蓝色背景上）；本项目此前定位根因并反馈，现 `--axis-color-text-inverse` 已恒定为 `#ffffff`、不再随主题反转，业务代码无需改动
  - 顶栏与登录/注册页的亮暗主题切换由 `ax-switch` + 文字标签改为 `ax-link` 包 `AxIcon`（`sun`/`moon`，随当前主题切换图标）+ `ax-tooltip` 提示文案，交互更直观、不占用文字空间；`AppLayout.vue`/`AuthPageShell.vue` 移除相应的 `theme-label` 样式
