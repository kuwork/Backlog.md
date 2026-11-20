---
title: BACK-852 - Web 文档与决策删除
labels: [source, web-ui, documentation, decisions, delete]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-852 - Add-delete-support-for-web-documents-and-decisions.md
---

# BACK-852 - Web 文档与决策删除

文档树和决策树增加统一的显式删除入口，确认后删除唯一源文件，成功时清除被删选中项，失败时保留选择与错误提示。

## 目标

网页端需要覆盖文档与决策删除，但正文无变化不应触发编辑自动保存或冲突。文件夹不能复用单文档删除动作，成功与失败的状态收敛必须可预测。

## 实现要点

- 非空树上菜单复用 `MORE_VERT`；树为空时隐藏更多菜单，只保留新建入口。
- 删除前弹出明确确认；成功后清掉被删文档/决策的选中状态，并清除来自被删文档子树的 dirty draft，避免 watcher 向已删源路径 PUT。
- 删除失败保留选中和错误信息；四语言文案统一。
- 共用服务端删除动作，不引入 Web 专用删除语义。

## 验证

`bun test web-documents`、`bun test web-decisions`、TypeScript 与 Biome 全部通过。

## Related Concepts

- [[concepts/web-ui-features]] — 文档/决策树与选择状态
- [[concepts/live-sync-pattern]] — watcher 刷新与本地 dirty 状态协调

## Related Sources

- [[sources/back-853-cli-mcp-document-decision-delete]] — CLI/MCP 删除能力与共享 Core 基础
- [[sources/back-850-document-drag-move]] — 文档树同期交互扩展
