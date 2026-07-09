---
name: update-axis-ui
description: 更新 @jiaozai1/axis-ui 组件库到最新版本，报告新增/移除的组件与设计 Token，并根据变更复用新能力。当用户要求"更新/升级 axis-ui"或提到 axis-ui 出了新版本时使用。
---

# 更新 axis-ui 组件库

按以下步骤执行，不要跳步：

## 1. 执行更新脚本

```bash
bash scripts/update-axis-ui.sh
```

脚本会自动完成：查询最新版本 → 对比当前版本（已最新则直接结束）→ 安装 → 输出**新增/移除的组件导出**和**新增/移除的设计 Token** → 跑 `npm run build` 验证。

## 2. 处理破坏性变更（如有）

脚本输出中若有"移除导出"或"移除 Token"，立即全局搜索项目中的使用处并修复，修复后重新构建验证。

## 3. 复用新能力

对照"新增导出"和"新增 Token"，检查项目现有代码：

- 有没有手写实现可以替换为新组件（遵循 CLAUDE.md 的组件复用原则：优先复用、不手搓）；
- 有没有硬编码值或 L3 派生 Token 可以改为直接消费新增的全局 Token。

新组件的 API 不随 npm 包发文档，用以下方式确认后再使用：

```bash
node --input-type=module -e "import * as m from '@jiaozai1/axis-ui'; console.log(JSON.stringify(m.Ax组件名.props, null, 1), m.Ax组件名.emits)"
```

样式与 Token 细节查 `node_modules/@jiaozai1/axis-ui/dist/axis-ui.css`。

## 4. 更新文档

在 `README.md` 的「更新记录」中记录：升级的版本号、本次利用了哪些新组件/新 Token、涉及的页面。
