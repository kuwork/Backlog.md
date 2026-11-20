---
title: 实体 ID 变化扩展现有 update 命令
labels: [decision, cli, mcp, identity, rename]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
---

# 实体 ID 变化扩展现有 update 命令

## 背景

doc-36 与 BACK-858 要让任务、文档、决策支持 ID 更新，同时处理重复 ID 的精确源选择。若新增 rename 子命令，会复制元数据更新、冲突检查和 MCP 参数语义。

## 决定

CLI 在现有 update 上增加可选 `--id`，view/update 增加 `--source-path`；MCP 对应增加 `newId/sourcePath`。不新增 rename 子命令或独立 dry-run 工作流，底层统一复用 `FileRenamePlan`。

## 理由

ID-only、ID+标题、ID+元数据本来就是同一事务的变体。共享 update 入口让位置 ID alias、自动提交、缓存刷新和错误映射只有一份；source path 则把重复 ID 的选择变成显式输入，而非猜测。

## 被否方案

- 平行 rename 命令：与 update 的元数据和冲突处理漂移。
- 新增 dry-run 工作流：扩大公共表面，现有计划的 preflight 已承担写入前验证。
- 全局替换裸 ID：会误改普通散文，必须只更新精确结构化引用与实体路由。

## Related Concepts

- [[concepts/file-rename-plan]] — 统一事务实现
- [[concepts/task-identity]] — 源身份、目标 ID 与重复身份规则
- [[concepts/mcp-workflow]] — CLI/MCP 同步表面

## Related Sources

- [[sources/doc-36-entity-id-update-design]] — 设计来源
- [[sources/back-858-entity-id-update-source-selection]] — 实现与验证
