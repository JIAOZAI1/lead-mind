# Lead Mind（客脉）— 项目章程

每次会话开始前请通读本文件，所有开发工作必须遵守以下约定。

## 项目背景

- **项目名称**：Lead Mind，中文名「客脉」
- **产品定位**：SaaS 多租户的外贸获客系统，帮助外贸人员通过互联网获取有价值的客户资源，并接入 AI 能力
- **本仓库范围**：前端项目（Vue 3 单页应用）

## 技术架构

- **框架**：Vue 3（Composition API，统一使用 `<script setup>`）+ Vite
- **组件库**：`@jiaozai1/axis-ui` — 自研组件库与前端设计规范，**持续完善中、尚不完整**
  - 设计规范与源码：https://github.com/JIAOZAI1/axis-ui
  - **更新 axis-ui 一律走 `update-axis-ui` skill**（执行 `scripts/update-axis-ui.sh`）：自动升级到最新版、报告新增/移除的组件与 Token、构建验证；升级后按 skill 流程复用新能力并更新 README
  - 新版本经常补充新组件和新 Token，动手写代码前先确认库里是否已提供
  - 组件文档不随 npm 包发布，可通过读取 `node_modules/@jiaozai1/axis-ui/dist` 的导出和 CSS 确认组件 API 与可用 Token

## 设计规范（硬性要求）

1. **样式只消费 `--axis-*` 语义 Token**：禁止硬编码色值、px 间距、字号、阴影、动效时长等魔法数字
   - 组件级尺寸没有现成 Token 时，在组件内定义 L3 组件 Token 并从全局 Token 派生（如 `--login-card-max-width: calc(var(--axis-container-sm) * 0.75)`），保住 Token 链路
   - 传给组件 props 的尺寸值同样走 Token（如 `label-width="var(--axis-space-12)"`）
2. **间距遵守 8px 网格**：一律使用 `--axis-space-*`（space-1=4px … space-6=24px …）
3. **z-index 只用库提供的四档 Token**（dropdown / modal / message / tooltip）
4. **动效时长与缓动取 Token**（`--axis-motion-duration-*` / `--axis-motion-ease-*`）
5. **必须支持暗色模式**：暗色由 `<html data-theme="dark">` 重映射 Token 实现；`html/body` 背景也要消费 Token（见 `src/assets/main.css`），任何新页面新组件都不得破坏暗色表现
6. **视觉风格全站一致**：新页面对齐既有页面的布局密度、字号层级与卡片风格

## 组件使用原则

- **优先复用 axis-ui 组件**，包括表单校验（AxForm/AxFormItem 的 rules）、反馈（AxMessage）、链接（AxLink）等，不要手搓自定义组件和样式
- 库里没有的能力：先尝试组合现有组件；确实无法满足再手写，且样式必须完全走 Token；同时把缺口反馈给用户（axis-ui 是自研库，可以补组件）
- **非必要不引入第三方框架/库**（含 UI 库、工具库）；确有必要时**先询问用户**，说明理由再引入

## 目录结构规范

```
src/
├── api/          # 接口封装（按业务域分文件）
├── assets/       # 全局样式与静态资源（main.css 为全局基础样式）
├── components/   # 业务公共组件（可复用的业务级组件）
├── composables/  # 组合式函数（useXxx；导航菜单配置在 useNavigation.js）
├── layouts/      # 布局组件（AppLayout：侧边菜单 + 顶栏，新页面一律用它包裹内容）
├── router/       # 路由配置（vue-router 4，history 模式；页面标题走路由 meta.title，菜单 key 与路由 name 一致）
├── stores/       # 状态管理（引入 pinia 前先询问用户）
├── utils/        # 纯工具函数
├── views/        # 页面级组件（XxxPage.vue）
├── App.vue
└── main.js
```

目录按需创建，但新文件必须落在对应职责的目录里，不要堆在根目录。

## 工程与代码规范

- **命名语义化**：文件名、变量名、函数名要能直接读出业务含义（页面 `LoginPage.vue`、组合函数 `useAuth.js`、接口 `customerApi.js` 等）
- **中文注释**：关键业务逻辑必须写中文注释，解释"为什么"而不是复述代码
- **文档同步**：每次新增需求或功能，必须同步更新 `README.md`（功能列表 + 更新记录）
- **提交推送一律走 `commit-push` skill**：构建验证 → 变更与敏感信息审查 → Conventional Commits 中文提交信息 → 推送 → CI 提示
- **部署 dev 环境一律走 `deploy-dev` skill**：本地 kubectl（context `default`）apply 清单 + 滚动重启拉最新镜像 + 就绪验证

## 环境信息

- **dev 机器**：`192.168.8.184`，已配置 SSH，可直接 `ssh` 连接执行运维操作
- **dev 集群**：dev 机器上的 k3s（单节点 `lam-server`），本地 kubectl context `default` 直连；部署走 `deploy-dev` skill
- **ingress 控制器**：k3s 内置 Traefik（集群默认 IngressClass，80/443 已绑定节点 IP），**不要再装 ingress-nginx**（会抢端口）
- **dev 域名**：`lead-mind.dev.com` → 本机 `/etc/hosts` 解析到 `192.168.8.184`

## 常用命令

```bash
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建产物
```
