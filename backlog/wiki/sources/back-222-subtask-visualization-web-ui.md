---
title: BACK-222 - Improve task and subtask visualization in web UI
created_date: '2026-10-03 01:07'
updated_date: '2026-10-03 01:07'
labels:
  - source
  - web-ui
  - enhancement
  - archived
source_path: backlog/archive/tasks/back-222 - Improve-task-and-subtask-visualization-in-web-UI.md
---

# BACK-222 - Improve task and subtask visualization in web UI

一条较早（2025-08-03 提出）的 Web UI 增强需求：数据模型已通过 `parentTaskId` 与 `subtasks` 支持任务层级，但 UI 把所有任务平铺展示，父子关系缺乏视觉层次。该任务已归档，状态仍为 To Do、无 assignee，从未实现。

需求要点：父任务卡片上以徽标/图标标示有子任务；子任务以缩进或嵌套呈现层级；看板视图可展开/折叠子任务组；父卡片显示子任务完成进度（如 "3/5 complete"）；支持从父卡片直接创建子任务；拖拽换列时保持层级；看板提供显示/隐藏子任务的开关；并改进 agent 使用子任务的指令说明。

其验收标准（9 条，全部未勾选）与后续多个已实现任务高度重叠，可作历史需求背景参考：子任务分组排序已由 BACK-496 修复，共享子任务排序比较器由 BACK-649 落地，看板卡片上的 AC 进度样式由 BACK-630 重做；但"展开/折叠子任务组""从父卡片创建子任务"等交互在本仓库 backlog 中未见对应实现任务。

## Related Concepts

- [[concepts/task-identity]] — parentTaskId/subtasks 层级模型是本需求的数据基础

## Related Sources

- [[sources/subtask-grouping-fix]] — BACK-496 修复子任务在父任务下的分组，覆盖本需求的排序/分组部分
- [[sources/back-649-shared-subtask-sorting]] — BACK-649 共享任务 ID 比较器，统一含子任务的列表排序
