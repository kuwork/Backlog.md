---
title: BACK-510 修复 Wiki 页面切换不退出编辑模式
labels: [source, bug, web-ui, wiki]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
source_path: backlog/tasks/back-510 - Fix-wiki-page-switch-not-exiting-edit-mode.md
---

# BACK-510 修复 Wiki 页面切换不退出编辑模式

修复用户在 Wiki 页面处于编辑模式时，点击侧边栏切换到另一 Wiki 页面后未正确退出编辑模式的问题。

## 问题

- 编辑模式下点击侧边栏其他页面，新页面内容在编辑器中显示，而非只读视图
- 编辑开关状态未同步重置

## 修复

`src/web/components/WikiDetail.tsx` 中响应 `wikiPath` 变化的 `useEffect` 内添加 `setIsEditing(false)`，确保切换页面始终退出编辑模式并丢弃未保存变更。

## Related Concepts
- [[concepts/web-ui-features]] — Web UI Wiki 功能
