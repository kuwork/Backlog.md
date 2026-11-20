---
title: BACK-851 - Web 文档文件夹拖拽移动
labels: [source, web-ui, documentation, drag-drop]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-851 - Support-drag-and-drop-folder-moves-in-the-web-UI.md
---

# BACK-851 - Web 文档文件夹拖拽移动

在 BACK-850 的文档拖放上扩展整个文件夹移动，包括嵌套内容与文档引用修复，不增加目录专用后端接口。

## 目标

用户应能把文档文件夹拖到另一文件夹；自身、后代和已有目标后代必须拒绝，根目标合法且保持展开，移动后选择目标文件夹。同名目标冲突按服务端 fail-fast 契约显示错误。

## 实现要点

- 文档和文件夹共用拖放状态、合法性与高亮 hook；文件夹拖动负载使用现有路径与目录信息。
- 对文件夹的每一个递归文档分别调用既有 rename mutation，完整新路径包含目标目录与原子路径。
- 自身/后代目标在前端直接拒绝；目标已经位于移动文件夹内部的后代不允许接收放置。
- 每个文档移动仍由服务端处理内容引用更新、父目录创建和冲突保护。

## 验证

`bun test web-documents` 通过，TypeScript 与 Biome 通过；覆盖文件夹递归移动、自身/后代拒绝、根放置、选择与展开状态。

## Related Concepts

- [[concepts/web-ui-features]] — 共享拖放状态与文档树行为
- [[concepts/file-rename-plan]] — 文档路径变化时的引用修复基础

## Related Sources

- [[sources/back-850-document-drag-move]] — 单文档拖放与共享 hook 来源
- [[sources/back-854-document-rename-reference-repair]] — 后续统一引用重写事务
