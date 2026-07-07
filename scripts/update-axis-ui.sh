#!/usr/bin/env bash
# 更新 @jiaozai1/axis-ui 组件库到最新版本
# 并对比升级前后的差异，报告新增/移除的组件导出与设计 Token，最后跑构建验证
set -euo pipefail

# 定位到项目根目录（脚本位于 scripts/ 下）
cd "$(dirname "$0")/.."

PKG="@jiaozai1/axis-ui"

# 列出库的全部具名导出（组件 + 工具函数）
dump_exports() {
  node --input-type=module -e "import * as m from '$PKG'; console.log(Object.keys(m).sort().join('\n'))"
}

# 列出库 CSS 中的全部设计 Token 名
dump_tokens() {
  grep -o -- '--axis-[a-z0-9-]*' "node_modules/$PKG/dist/axis-ui.css" | sort -u
}

# 打印两个文件的差异行；无差异时打印（无）
print_diff() {
  local result
  result=$(comm "$1" "$2" "$3")
  if [ -n "$result" ]; then echo "$result"; else echo "（无）"; fi
}

# 直接读文件取版本号（库的 exports 字段未暴露 package.json，不能用包名 require）
current=$(node -p "require('./node_modules/$PKG/package.json').version" 2>/dev/null || echo "none")
latest=$(npm view "$PKG" version)

echo "当前版本: $current"
echo "最新版本: $latest"

if [ "$current" = "$latest" ]; then
  echo "已是最新版本，无需更新。"
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 记录升级前的导出与 Token 快照（首次安装时快照为空）
if [ "$current" != "none" ]; then
  dump_exports > "$TMP/exports.old"
  dump_tokens  > "$TMP/tokens.old"
else
  : > "$TMP/exports.old"
  : > "$TMP/tokens.old"
fi

npm install "$PKG@$latest"

dump_exports > "$TMP/exports.new"
dump_tokens  > "$TMP/tokens.new"

echo ""
echo "== 新增导出（组件/工具） =="
print_diff -13 "$TMP/exports.old" "$TMP/exports.new"
echo ""
echo "== 移除导出（需排查项目中的使用处！） =="
print_diff -23 "$TMP/exports.old" "$TMP/exports.new"
echo ""
echo "== 新增设计 Token =="
print_diff -13 "$TMP/tokens.old" "$TMP/tokens.new"
echo ""
echo "== 移除设计 Token（需排查项目中的使用处！） =="
print_diff -23 "$TMP/tokens.old" "$TMP/tokens.new"

echo ""
echo "== 构建验证 =="
npm run build

echo ""
echo "axis-ui 已从 ${current} 更新到 ${latest}，构建通过。"
