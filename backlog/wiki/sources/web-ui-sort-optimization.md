---
title: BACK-484 Web UI sort optimization
labels:
  - source
  - web-ui
  - ui
  - ux
source_path: backlog/tasks/back-484 - Web-UI-sort-optimization.md
created_date: 2026-05-23 11:15
updated_date: 2026-05-23 11:15
---

# BACK-484 Web UI sort optimization

统一并优化 Web UI 中的排序指示器与交互。

## 任务列表页面排序图标

- 将纯文本排序符号（`↕` `▲` `▼`）替换为现代的双箭头设计：左侧 `↑` 表示升序，右侧 `↓` 表示降序
- 未激活时两支箭头均为灰色；激活时对应方向高亮，另一支保持灰色
- 三种状态的外框尺寸完全一致（固定 `w-4`），避免切换排序方向时表头抖动
- 实现文件：`src/web/components/TaskList.tsx`（`renderSortIcon`）

## 里程碑页面分组排序

- 在每个里程碑分组内（包括「未分配任务」和各个里程碑）添加可排序的表头
- 每组拥有独立的排序状态（`bucketSorts: Record<string, BucketSortConfig>`），互不影响
- 表头列：ID、标题、状态、优先级，使用与任务列表相同的双箭头图标设计
- 移除了之前的「Done 任务沉底」行为，用户拥有完全控制权
- 实现文件：`src/web/components/MilestonesPage.tsx`、`src/web/components/MilestoneTaskRow.tsx`

## 看板列操作菜单排序

- 列操作菜单扩展为 6 个本地排序选项（ID ↑/↓、标题 ↑/↓、优先级 ↑/↓）
- 本地排序仅影响当前列的展示顺序（`columnSort` 状态），不持久化到后端
- 激活项在菜单中高亮显示，右侧带 `×` 按钮可清除排序
- 拖拽任务或点击「Apply Priority Order」会清除本地排序，恢复按 ordinal 的原始顺序
- 原「Sort by Priority」重命名为「Apply Priority Order / 按优先级重排（保存）」以区分纯展示排序
- 菜单下拉宽度改为动态（`min-w-[12rem] w-max`），防止文字换行
- 实现文件：`src/web/components/TaskColumn.tsx`

## 相关概念

- [[concepts/web-ui-features]] — Web UI 功能总览

## 相关实体

- `TaskList.tsx` — 任务列表页面
- `MilestonesPage.tsx` — 里程碑页面
- `MilestoneTaskRow.tsx` — 里程碑任务行
- `TaskColumn.tsx` — 看板列组件
