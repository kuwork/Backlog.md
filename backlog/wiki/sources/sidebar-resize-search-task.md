---
title: BACK-483 Web UI 侧边栏调整大小与搜索类型下拉
labels: [source, web-ui, ux]
created_date: 2026-05-23 00:40
updated_date: 2026-05-23 00:40
source_path: backlog/tasks/back-483 - Sidebar-resize-and-search-type-dropdown.md
---

# BACK-483 Web UI 侧边栏调整大小与搜索类型下拉

## 概述

优化 Web UI 三个交互区域：侧边栏支持拖拽调整宽度、搜索栏增加类型下拉筛选、Wiki URL 保持可读性。

## 核心功能

### 1. 侧边栏拖拽调整大小

- 在侧边栏右边缘添加 1px 可拖拽手柄
- 拖拽时通过 DOM ref 移动蓝色 ghost bar 预览（避免 React 重渲染导致的卡顿）
- 松开鼠标后应用最终宽度到 state + `localStorage` 持久化
- 限制最小 200px / 最大 500px，防止侧边栏消失或过宽

### 2. 搜索类型下拉菜单

- 搜索输入框左侧添加可点击图标按钮（absolute 定位）
- 下拉选项：All / Tasks / Documents / Decisions / Wiki，使用与侧边栏一致的图标
- 默认 "All"；切换后立即触发对应类型的搜索过滤
- 传递 `searchType` 给 `apiClient.search`；'all' 时回退到解析查询中的类型过滤

### 3. Wiki URL 编码修复

- 引入 `encodeWikiPath()`：按 `/` 分段，每段 `encodeURIComponent`，再用 `/` 拼接
- 替换 `SideNavigation`、`WikiDetail`、`api.ts` 中原有的 `encodeURIComponent` 调用
- 保持子目录路径可读（`/` 不编码为 `%2F`），同时安全处理空格、CJK 等特殊字符

## 关键设计决策

- **Ghost bar 优于实时宽度突变**：React 在每次 mousemove 时重渲染导致明显延迟，ghost bar 方案通过直接操作 DOM 实现流畅拖拽体验
- **分段编码策略**：在 URL 可读性与编码安全性之间取得平衡

## 验收标准

全部 10 项已验收完成，包括类型检查、linting 和相关交互组件测试覆盖。

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 页面、视图与技术特性总览

## Related Sources

- [[sources/wiki-web-ui-task]] — BACK-473 Wiki 区域与文件树导航原始任务
- [[sources/wiki-search-task]] — BACK-481 Wiki 搜索集成
