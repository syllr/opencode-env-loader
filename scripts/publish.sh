#!/usr/bin/env bash
# publish.sh — 一键发布 opencode-env-loader 到 npm 官方 registry
#
# token 在哪里拿 (重要,不要把 token 写进脚本):
#   1. 浏览器打开下面这个链接,这是用户的 npmjs.com token 管理页:
#      https://www.npmjs.com/settings/shenyuanlaolarou/tokens/granular-access-tokens/3df7ef36-9e19-4b7a-8d29-5a0b221dbcd4
#   2. 点 "Generate New Token" → 选 "Granular Access Token"
#   3. Security settings 里勾上 "Bypass two-factor authentication (2FA)"
#   4. Packages and scopes 选 "Read and write" + scope = "opencode-env-loader"
#      (或者 "All packages" 也行,但最小权限更安全)
#   5. Generate → 复制 token 字符串 (形如 npm_xxxxxxxxxxxxxxxxxx)
#
# 用法 (token 通过环境变量传,不会留在 shell 历史 / .npmrc):
#   NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxx ./scripts/publish.sh
#
# 为什么不需要改 ~/.npmrc:
#   npm 命令的优先级是 --registry 参数 > .npmrc > 默认
#   token 通过 NPM_TOKEN 环境变量传就行,根本不需要写入 .npmrc
#   用户自己的 ~/.npmrc (npmmirror 镜像 + 旧 token) 不会被这个脚本碰

set -euo pipefail

# ---- 前置检查 ----
if [ -z "${NPM_TOKEN:-}" ]; then
  echo "错误: NPM_TOKEN 环境变量未设置" >&2
  echo "" >&2
  echo "请按下列步骤获取 token:" >&2
  echo "  1. 打开 https://www.npmjs.com/settings/shenyuanlaolarou/tokens/granular-access-tokens/3df7ef36-9e19-4b7a-8d29-5a0b221dbcd4" >&2
  echo "  2. Generate New Token → Granular Access Token" >&2
  echo "  3. 勾上 'Bypass two-factor authentication (2FA)'" >&2
  echo "  4. Packages: Read and write, 范围 opencode-env-loader" >&2
  echo "  5. 复制 token,执行:" >&2
  echo "" >&2
  echo "     NPM_TOKEN=npm_xxxxxxxxxxxxxxxxxx ./scripts/publish.sh" >&2
  exit 1
fi

# 切换到项目根目录 (脚本可能在子目录被调用)
cd "$(dirname "$0")/.."

# ---- 跑测试,作为最后一道质量门 ----
echo "[1/3] 跑测试..."
npm test

# ---- 干跑一次 pack,确认要发出去的文件清单 ----
echo ""
echo "[2/3] npm pack --dry-run (确认文件清单)..."
npm pack --dry-run

# ---- 真正 publish ----
#  --registry 强制走 npm 官方,绕开用户 .npmrc 里默认的 npmmirror
#  NPM_TOKEN 环境变量提供 token,不会写入 .npmrc
echo ""
echo "[3/3] npm publish ..."
env NPM_TOKEN="$NPM_TOKEN" npm publish --registry https://registry.npmjs.org

echo ""
echo "✅ publish 完成"