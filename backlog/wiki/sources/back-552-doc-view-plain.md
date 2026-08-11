---
title: BACK-552 doc view 增加 plain 支持
labels: [source, cli, doc]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-552 - Add-plain-support-to-doc-view.md
---

# BACK-552 doc view 增加 plain 支持

让 `backlog doc view` 支持非交互式纯文本输出，便于 agent、脚本、管道、CI 读取文档原始内容。

## 问题

`backlog doc view` 只能启动交互式查看器，agent、脚本、管道、CI 无法以非交互方式读取文档原始内容。

## 解决方案

沿用其他 read 命令的 plain 输出模式。`backlog doc view` 在回退到滚动查看器前先判断 `isPlainRequested(options) || shouldAutoPlain`；`--plain` 直接输出原始文档内容到 stdout，stdout 非 TTY 时自动输出 plain。帮助 schema 新增 plain 可选字段及 `--plain` 示例。注：非 TTY 自动 plain 原本就由 scrollableViewer 处理，新分支让 `--plain` 显式化并可在交互 TTY 上强制使用。

## 实现位置

- `src/cli.ts`
- 指南 `cli-instructions/documents.md`、`agent-guidelines.md`
- `src/test/cli-doc-view.test.ts`

## 测试

`src/test/cli-doc-view.test.ts`（2 例：显式 `--plain` 与非 TTY 自动 plain）通过。

## Related Concepts
- [[concepts/cli-entry]] — doc view 命令
- [[concepts/markdown-pipeline]] — 文档输出

## Related Sources
- [[sources/back-529-doc-update-multiline-append]] — doc 命令增强
