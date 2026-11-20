---
title: BACK-858 - 实体 ID 更新与精确源选择
labels: [source, cli, mcp, identity, rename]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-858 - Support-ID-updates-and-exact-source-selection-for-tasks-documents-and-decisions.md
---

# BACK-858 - 实体 ID 更新与精确源选择

任务、文档、决策的现有 update 命令增加可选 `--id`，view/update 增加 `--source-path`；MCP 同步支持 `newId/sourcePath`，不新增 rename 子命令或并行 dry-run 工作流。

## 目标

三种源选择模式必须同时成立：仅 ID、仅路径（从 frontmatter 读旧 ID）、ID + 路径（等价性校验）。重复旧 ID 在无路径时返回 `AMBIGUOUS_ID`，有路径时只操作选定文件；普通裸 ID 散文不能被全局替换。

## 解决方案

- 源身份与目标 ID 分离传递，保留 `doc-1`、裸 `1` 等位置参数别名；冲突在写入前返回 `SOURCE_MISMATCH`、`ID_CONFLICT` 或 `PATH_CONFLICT`。
- 扩展 `FileRenamePlan` 同步 frontmatter、精确结构化引用、相对路径、里程碑文档、Wiki `source_path` 和三类实体路由。
- 任务额外限制：多任务编辑禁止改 ID/源路径；父子跨目录重编号、带孩子的父 ID 修改拒绝；同父子任务重编号允许，reparent 保持独立。
- CLI 与 MCP 共用 Core；新增 `decision_view`，文档内容继续可选，缺省不清空正文。
- 主文件、关联文件、缓存刷新、回滚和 auto-commit 都纳入同一事务边界。

## 验证

多组聚焦测试覆盖源选择、重复 ID、层级、引用、回滚和 MCP 真实调用；TypeScript 与 Biome 通过。已知 `mcp-server` 工具列表旧期望仍漏 graph legend 工具，明确留作既有问题。

## Related Concepts

- [[concepts/file-rename-plan]] — 承载 ID/路径/引用的事务计划
- [[concepts/task-identity]] — 等价 ID、重复身份与层级规则
- [[concepts/mcp-workflow]] — CLI/MCP 同步公共能力

## Related Sources

- [[sources/doc-36-entity-id-update-design]] — 功能设计与取舍
- [[sources/back-854-document-rename-reference-repair]] — 引用修复基础
- [[sources/back-853-cli-mcp-document-decision-delete]] — 重复 ID 的删除前例
