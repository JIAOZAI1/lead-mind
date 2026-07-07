---
name: commit-push
description: 按项目规范提交代码并推送到远程（构建验证 → 变更审查 → 规范化提交 → 推送 → CI 提示）。当用户要求"提交"、"推送"、"提交到远程"或"commit/push"时使用。
---

# 提交并推送到远程

按以下步骤执行，不要跳步：

## 1. 提交前检查（章程硬性要求）

- 跑 `npm run build`，构建失败则先修复，禁止提交坏构建；
- 若本次变更包含新功能/新需求，确认 `README.md` 已同步（功能列表 + 更新记录），漏了先补上再提交。

## 2. 审查变更内容

```bash
git status --short
git diff HEAD --stat
```

- 逐项确认待提交文件都属于本次改动意图，无临时文件、构建产物、`.DS_Store` 等杂物；
- **敏感信息检查**：确认没有 token、密钥、`.npmrc`（含 authToken）、`.env` 等被暂存；发现即从暂存区剔除并告知用户；
- 工作区若混有多个不相关主题的改动，询问用户是全部提交还是拆分提交。

## 3. 写提交信息

- 遵循 Conventional Commits 前缀 + 中文描述，与仓库既有风格一致（如 `feat: 引入 vue-router 实现页面路由`、`fix: 修复暗色模式白底`、`ci: ...`、`docs: ...`、`chore: ...`）；
- 首行 ≤ 50 字概括"做了什么"，正文（可选）说明"为什么"；
- 末尾固定追加：

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

## 4. 提交并推送

```bash
git add <明确的文件列表>   # 避免无脑 git add -A
git commit -m "..."
git push
```

- 推送被拒（远端有新提交）时：`git pull --rebase` 后重推，出现冲突则停下来向用户说明；
- 禁止 force push。

## 5. 推送后报告

- 报告提交哈希、推送结果；
- 提醒本次 push 触发的 GitHub Actions（CI 构建 / Docker 镜像），给出查看地址：
  https://github.com/JIAOZAI1/lead-mind/actions
