---
title: BACK-485 修复草稿提升流程并统一操作按钮样式
labels: [source]
source_path: backlog/tasks/back-485 - Fix-draft-promote-flow-and-unify-action-button-styles.md
created_date: 2026-05-23 14:20
updated_date: 2026-05-23 15:18
---

# BACK-485 修复草稿提升流程并统一操作按钮样式

**状态**: Done | **标签**: web-ui, drafts, ux | **优先级**: medium

## 问题

1. 草稿详情弹窗错误显示 **"Demote to Draft"** 按钮（应为 **"Promote to Task"**）
2. "Promote to Task" 操作在列表和弹窗之间颜色/样式不统一
3. 蓝色主操作按钮（新建任务/草稿/里程碑、保存等）在不同页面样式不一致
4. 后端 `promoteDraft` 只返回 boolean，前端无法直接获取提升后的任务对象

## 实现

### 草稿详情弹窗修复
- **`src/web/components/TaskDetailsModal.tsx`**
  - `isDraftTask = task?.id?.startsWith("DRAFT-")` 检测草稿
  - 草稿 Preview 模式显示 **"Promote to Task"**（翡翠绿 `bg-emerald-600 dark:bg-emerald-700`）
  - 普通任务显示 **"Demote to Draft"**（琥珀色 `bg-amber-500`）
  - 键盘快捷键：**P**（草稿提升）、**D**（普通任务降级）

### 提升端到端流程
- **`src/web/lib/api.ts`**: `promoteDraft()` 返回 `Promise<Task>`
- **`src/server/index.ts`**: `/api/drafts/:id/promote` 直接返回 `Task` JSON
- **`src/core/backlog.ts` & `src/file-system/operations.ts`**: `promoteDraft()` 返回 `Task | false`
- **`src/web/components/TaskDetailsModal.tsx`**: 新增 `onPromoted` 回调；提升成功后关闭弹窗、刷新列表、触发 `drafts-updated` 事件、打开新任务详情
- **`src/web/components/DraftsList.tsx`**: 列表提升增加确认对话框，成功后刷新草稿列表并打开新任务

### 按钮样式统一
- **蓝色主按钮**（`TaskList.tsx`、`DraftsList.tsx`、`MilestonesPage.tsx` 等）：统一为 `bg-blue-500 dark:bg-blue-600`，完整 focus-ring + 暗色模式
- **"Promote to Task" 按钮**：统一翡翠绿配色家族，完整暗色模式支持
- **里程碑页面**：移除 "Add Milestone" 按钮的 stray `+` 前缀

### 测试
- `src/test/filesystem.test.ts`、`cli.test.ts`、`core.test.ts` 调整断言以适应 `Task | false` 返回类型
- 全部通过（173 pass / 0 fail）

## 相关概念
- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/task-lifecycle]] — 任务生命周期（草稿 ↔ 任务 ↔ 已完成）
- [[sources/demote-to-draft-action]] — BACK-419 降级为草稿操作（互补功能）
