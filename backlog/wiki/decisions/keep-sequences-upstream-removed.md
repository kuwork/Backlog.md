---
title: 保留 sequences 功能并补充 CLI 文档
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [decision, sequences, cli-instructions]
---

# 保留 sequences 功能并补充 CLI 文档

## 背景

上游 BACK-520 从 v1.48.0 起彻底移除了 sequences 功能（核心、CLI、MCP、TUI、Web），但 fork 仍保留 `src/core/sequences.ts` 和相关能力。

## 决策

BACK-554 决定保留 fork 的 sequences 功能，并在 `src/guidelines/cli-instructions/overview.md` 中添加 Sequences Quick Reference。

## 理由

- sequences 为从 dependencies 派生的执行分层视图，不新增数据，与 fork 的依赖模型兼容
- 上游移除sequences时保留了 `dependencies` 字段，fork 的序列视图可继续存在
- CLI instructions 此前停留在上游删除后的状态，功能与文档不一致；补充文档使 agents 可发现 `backlog sequence list`
- 与排除清单「保持当前分支已支持能力」原则一致

## Related Sources

- [[sources/back-554-document-sequences-command-in-cli-instructions]] — 文档补充
- [[sources/doc-4-upstream-migration-classification]] — C1 保留说明
