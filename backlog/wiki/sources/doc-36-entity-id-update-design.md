---
title: doc-36 - 任务文档决策 ID 更新设计
labels: [source, prd, identity, rename, cli, mcp]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/docs/PRDS/rename/doc-36 - PRD：任务、文档与决策更新命令支持修改-ID-设计.md
---

# doc-36 - 任务文档决策 ID 更新设计

一份面向 CLI/MCP 的 PRD：在现有 view/update 命令中增加 ID 更新与精确源选择，复用文件更名事务，明确重复 ID、任务层级、引用边界和失败诊断。

## 目标

在不新增 rename 子命令和独立 dry-run 工作流的前提下，让任务、文档和决策支持可选新 ID；view/update 可通过项目根相对 Markdown 路径精确选定重复 ID 的一个来源。ID-only、path-only、ID+path 三种模式并存。

## 设计要点

- **组合更新**：仅 ID、ID+标题、ID+元数据都可执行；先验证身份、层级和路径，再一次性更新主文件与引用。
- **精确引用**：只更新精确结构化字段、精确旧路径、精确实体路由和 Wiki `source_path`；不把普通散文中的裸 ID 全局替换。
- **任务约束**：多任务编辑、跨 parent 重编号、带 children 的 parent ID 更新拒绝；reparent 继续是独立操作。
- **公共表面**：CLI 保留现有 positional ID alias；MCP update 增加 `newId/sourcePath`，view 增加 `sourcePath` 与 `decision_view`。
- **事务与诊断**：复用 `FileRenamePlan` 的 preflight、no-replace、rollback、缓存刷新与 auto-commit；稳定错误码包括 `AMBIGUOUS_ID`、`SOURCE_MISMATCH`、`ID_CONFLICT`、`PATH_CONFLICT`。
- **Wiki 边界**：只改内容页中的 `source_path`，缺失 Wiki 跳过且不创建；维护文件与 `wiki_output/` 不由实体更名流程直接修改。

## 关键取舍

选择扩展现有 update 命令，而非建立平行 rename 命令，是为了避免两套元数据更新和冲突检查漂移。引用同步也不采用正则全局替换，因为相对路径与裸 ID 都必须结合所在文件和实体类型判断。

## Related Concepts

- [[concepts/file-rename-plan]] — PRD 依赖的原子更名计划
- [[concepts/task-identity]] — ID 等价、重复与层级规则
- [[concepts/mcp-workflow]] — CLI/MCP 公共能力映射

## Related Sources

- [[sources/back-858-entity-id-update-source-selection]] — 实现该 PRD
- [[sources/back-854-document-rename-reference-repair]] — 文件更名与引用同步基础
- [[sources/back-855-task-title-file-rename]] — 任务标题更名前置实现
- [[sources/back-856-decision-title-file-rename]] — 决策标题更名前置实现
