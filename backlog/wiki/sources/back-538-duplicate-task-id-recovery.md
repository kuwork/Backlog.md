---
title: BACK-538 重复任务 ID 恢复工作流
labels: [source, core, cli, data-consistency, bug]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-538 - Migrate-upstream-BACK-516-human-first-duplicate-task-ID-recovery-and-update-AI-guidelines.md
---

# BACK-538 人类优先的重复任务 ID 恢复流程

迁移上游 BACK-516，实现人类优先、CLI 权威的重复任务 ID 检测与修复工作流。

## 问题

尽管创建时做了跨分支 ID 校验，git 合并、零填充等价（task-1 与 task-01）、外部/手动编辑仍可能产生重复任务 ID。重复 ID 会让任务在视图、搜索和编辑中静默坍缩。

## 解决方案

`backlog doctor` 输出先供人类阅读：列出冲突组、确切文件路径、计划的重命名以及需人工审查的引用。修复不猜测。原则：fail-closed、确定性、内容保留（只改文件名和 frontmatter id）、原子性（重命名+frontmatter 同时进行）、不猜测引用、可回滚。

新增命令：`--commit`（丢弃 .bak 备份并最终化）与 `--rollback`（恢复 .bak 备份），均需人工确认后执行。

## 实现位置

- `src/core/duplicate-task-repair.ts`、`src/utils/duplicate-detection.ts`、`src/cli.ts`
- 指南 `src/guidelines/agent-guidelines.md`（新增 5.7 节含 finalize/undo）、`cli-instructions/task-execution.md`、`mcp/task-execution.md`

## 测试

覆盖 doctor 预览/修复/提交/回滚、核心回滚所有权、Web UI 恢复、巨量/填充/点号/遗留/过期计划、无覆盖并发编辑场景。

## Related Concepts
- [[concepts/core-architecture]] — 任务 ID 与文件系统
- [[concepts/task-lifecycle]] — 任务生命周期
- [[concepts/cli-entry]] — doctor 命令

## Related Sources
- [[sources/back-540-content-store-stale-refresh-guard]] — 数据一致性
- [[sources/doc-5-a-class-migration-analysis]] — A2 迁移分析
