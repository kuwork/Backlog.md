---
title: BACK-509 稳定任务模态框 URL 与钻取支持
labels: [source, feature, web-ui, routing, modal]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
source_path: backlog/tasks/back-509 - Add-stable-task-modal-URLs-with-drill-down-support.md
---

# BACK-509 稳定任务模态框 URL 与钻取支持

为 Web UI 任务详情模态框引入稳定的 `/task/:id` URL 路由，支持从任意视图打开、背景页面保持、钻取导航与分享。

## 核心功能

- **稳定 URL**：`/task/:id`（如 `/task/506`）自动重定向到 `/task/:id/:title`
- **前缀无关匹配**：`/task/506` 解析为 `BACK-506`
- **背景页面保持**：使用 React Router `backgroundLocation` state，底层页面始终可见
- **钻取导航**：依赖任务标签可点击，历史堆栈管理，标题栏返回按钮
- **Markdown 链接拦截**：任务描述、文档、决策、Wiki 中的 `/task/:id` 链接在模态框内打开
- **草稿支持**：`/draft/:id` 拥有与任务相同的路由行为

## 架构

- `App.tsx` 提取 `AppContent`，新增 `/task/:id` 和 `/draft/:id` 路由
- URL sync effect 监听 `useMatch('/task/:id')`，自动打开/钻取/返回
- 关闭模态框使用 `replace` 导航到背景页面，避免历史残留和竞态

## Related Concepts
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/task-lifecycle]] — 任务生命周期

## Related Sources
- [[sources/back-505]] — BACK-505 依赖项钻取导航
