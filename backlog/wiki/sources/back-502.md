---
title: BACK-502 同步 llm-wiki-for-backlog SKILL.md 更新到嵌入代码
labels: [source, bug, developer-experience, wiki]
created_date: 2026-05-30 15:10
updated_date: 2026-05-30 15:10
source_path: backlog/tasks/back-502 - Sync-llm-wiki-for-backlog-SKILL.md-updates-to-embedded-code.md
---

# BACK-502 同步 llm-wiki-for-backlog SKILL.md 更新到嵌入代码

## Summary

`.codex/skills/llm-wiki-for-backlog/SKILL.md` 新增了 5 个 wiki 子目录结构（`patterns/`、`decisions/`、`reasoning/`、`execution/`、`retrospectives/`），但构建时嵌入文件 `src/skills/embedded/llm-wiki-for-backlog.ts` 未同步更新，导致编译后的 CLI 二进制分发的是旧版 skill。

## Root Cause

`src/skills/embedded/llm-wiki-for-backlog.ts` 是由 `scripts/embed-wiki-skill.ts` 生成的构建时产物。直接编辑 skill 源文件而不重新运行嵌入脚本，会导致嵌入代码过期。

## Fix

1. 运行 `bun run scripts/embed-wiki-skill.ts` 重新生成嵌入模块
2. 验证生成的文件在对应行号包含 5 个新目录
3. `git diff` 显示 78 行变更（69 insertions, 9 deletions）

## Prevention

已在 `wiki/patterns/skill-file-change-sync.md` 中记录该模式，确保未来 skill 编辑后同步运行嵌入脚本。

## Related Concepts
- [[concepts/embedded-skills]] — 内嵌 Skill 架构与构建时嵌入机制

## Related Sources
- [[sources/tracking-gantt-design-doc]] — doc-6 跟踪甘特图设计方案
