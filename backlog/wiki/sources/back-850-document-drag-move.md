---
title: BACK-850 - Web 文档拖拽移动
labels: [source, web-ui, documentation, drag-drop]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-850 - Support-drag-and-drop-document-moves-in-the-web-UI.md
---

# BACK-850 - Web 文档拖拽移动

文档树支持把 `.md` / `.docx` / `.xlsx` 文档拖到目标文件夹，并复用既有 rename API 完成更新后的完整路径移动。

## 目标

文档重命名服务已经具备跨目录移动与父目录创建能力，但网页端只暴露了手工改名。本任务要求不改变 API，就让单文档拖放进入受守卫的现有移动流程；空文件夹不能充当放置目标。

## 实现要点

- 可移动文档注册 draggable payload，候选目标按现有 `acceptsDrop` 校验；目标高亮、拖拽结束和拖动状态集中在共享 hook。
- 拖放结束后构造文档当前目录、文件名和目标目录拼成的完整新路径，调用既有 rename mutation；刷新并选中移动后的文档，保留失败通知。
- 文件放置区扩展为树节点级可组合放置目标，沿用全屏文件拖动处理；取消与文件自身父目录相同的 no-op 移动。
- 服务端 rename 与 ContentStore 无需修改。

## 验证

`bun test web-documents` 与 `bun test web-document-folder-drop` 通过，TypeScript 和 Biome 通过；测试覆盖移动、no-op、非法目标与取消状态。

## Related Concepts

- [[concepts/web-ui-features]] — 文档树与共享拖放交互
- [[concepts/core-architecture]] — 复用 Core rename 而非新增移动 API

## Related Sources

- [[sources/back-851-folder-drag-move]] — 同一拖放原语扩展到文件夹
- [[sources/back-849-mermaid-theme-render-race]] — 同期 Web 修复
