---
title: BACK-554 - CLI 指令补充 sequence 命令速查
labels: [source, documentation, cli, sequences]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-554 - Document-sequences-command-in-CLI-instructions.md
---

# BACK-554 - CLI 指令补充 sequence 命令速查

在 `src/guidelines/cli-instructions/overview.md` 中新增 Sequences Quick Reference 小节，让阅读 `backlog instructions` 的 agent 能发现 `backlog sequence list`。该小节含 `backlog sequence list --plain` 示例，说明 sequence 由依赖关系派生、同一 sequence 内的任务可并行执行；尽管上游已在 v1.48.0 / BACK-520 移除该功能，本 fork 仍让 sequence 特性保持可用。

## 验收标准

- `overview.md` 新增 Sequences Quick Reference 小节。
- 小节说明派生的分层 sequence 及同一 sequence 内的并行执行。
- `bunx biome check` 在改动文件上通过。
- `backlog sequence list --plain` 仍可运行。

## Related Concepts
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/search-sequences]] — 搜索与依赖 sequence

## Related Sources
- [[sources/back-521.14]] — CLI/MCP 指令指南更新
