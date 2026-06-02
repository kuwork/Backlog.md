---
title: BACK-419 Web UI 降级为草稿操作
labels: [source]
source_path: backlog/tasks/back-419 - Add-Web-UI-demote-to-draft-action.md
created_date: 2026-05-21 22:50
updated_date: 2026-05-21 22:50
---

# BACK-419 Web UI 降级为草稿操作

**状态**: To Do | **标签**: web-ui, drafts, enhancement | **优先级**: medium

为 Web UI 的任务详情弹窗暴露降级为草稿（demote-to-draft）动作，对应 GitHub issue #405 的一部分。

## 出现条件

降级按钮与"Mark as completed"按钮互斥，仅在以下全部条件满足时显示：
- 任务状态**不是** Done
- 当前处于 Preview 模式
- 不是创建模式
- 不是跨分支任务

## 实现

**后端**
- 新增 `POST /api/tasks/:id/demote` 端点
- 调用 `core.demoteTask(taskId)`，将任务移至 `backlog/drafts/`
- 成功后广播 `tasks-updated` + `drafts-updated` 刷新列表

**前端**
- `apiClient.demoteTask(id)` 封装
- `TaskDetailsModal.tsx` 新增 amber 样式按钮和 `handleDemote` 处理器
- 确认对话框：`t.taskDetails.demoteConfirm`
- 键盘快捷键：**D**（Preview 模式下）

## 相关概念
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/task-lifecycle]] — 任务生命周期（草稿 ↔ 任务 ↔ 已完成）
