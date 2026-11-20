---
title: BACK-856 - 决策标题驱动文件更名
labels: [source, cli, mcp, decisions, rename]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-856 - Rename-decision-files-when-decision-titles-change.md
---

# BACK-856 - 决策标题驱动文件更名

决策标题变化导致目标文件名变化时，复用 `FileRenamePlan` 保留 ID/目录并同步引用；创建、状态更新和同路径标题更新继续走旧保存流程。

## 目标

决策更名需要与文档、任务同构，但只触发 `/decisions/:id/:title` slug 规范化。目标冲突、无变化更新与自动提交范围都必须保持确定性。

## 实现要点

- 共享 `getDecisionFilename` 统一创建和更名的 sanitize 规则。
- `Core.updateDecision` 先加载持久化决策，仅在标题与 sanitize 路径都变化时构建计划。
- 同步本地链接、任务结构化字段、Wiki `source_path` 与决策 slug；CLI、MCP、Web 通过 Core 继承。
- 自动提交保留既有 Update decision 信息并纳入全部关联变更；同 ID 冲突 fail-closed。
- 公共指南采用自动更名，`mv` 仅作失败后的手工兜底。

## 验证

决策更名/自动提交 23 项、FileSystem 与 ContentStore 回归 92 项通过；TypeScript 与 Biome 通过。

## Related Concepts

- [[concepts/file-rename-plan]] — 决策复用的原子计划
- [[concepts/task-identity]] — 决策 ID 等价与冲突语义

## Related Sources

- [[sources/back-854-document-rename-reference-repair]] — 共享计划来源
- [[sources/back-855-task-title-file-rename]] — 任务侧同构接入
- [[sources/back-858-entity-id-update-source-selection]] — 后续 ID 更新与精确源选择
