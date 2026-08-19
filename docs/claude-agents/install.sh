#!/usr/bin/env bash
# 76-Club: Claude Code サブエージェント一式を .claude/ に配置する。
# リポジトリ直下で実行:  bash docs/claude-agents/install.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
mkdir -p "$root/.claude/agents" "$root/.claude/commands"
cp "$here/architect.md"    "$root/.claude/agents/architect.md"
cp "$here/implementer.md"  "$root/.claude/agents/implementer.md"
cp "$here/reviewer.md"     "$root/.claude/agents/reviewer.md"
cp "$here/feature.md"      "$root/.claude/commands/feature.md"
echo "配置しました:"
echo "  .claude/agents/{architect,implementer,reviewer}.md"
echo "  .claude/commands/feature.md"
echo "使い方: Claude Code で  /feature \"<やりたいこと>\"  または各エージェントを個別に呼ぶ。"
