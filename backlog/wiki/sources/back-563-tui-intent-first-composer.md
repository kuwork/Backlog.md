---
title: BACK-563 - TUI 意图优先任务创建器
labels: [source, tui, task-creation]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-563 - Create-tasks-with-an-intent-first-TUI-composer.md
---

# BACK-563 - TUI 意图优先任务创建器

在 TUI 看板新增可发现的 `N` 键任务创建器，用户无需离开看板即可创建任务。

## 实现要点

- 新的 `src/ui/components/task-composer.ts`（移植自上游 BACK-565 的成熟布局）提供 Title/Description/Status/Priority 创建器，支持方向键空间导航、光标感知删除和惰性的 Tab/Shift+Tab 字段遍历。
- 为 `src/ui/components/filter-popup.ts` 新增可滚动视口、适应屏幕和重排 helper，用于创建器布局。
- `src/ui/board.ts` 处理 `N` 键，通过 `runWithModalGuard` 打开创建器，将非草稿任务插入看板，聚焦新任务，并在创建器打开期间延迟看板刷新。
- `src/ui/unified-view.ts` 提供 `createTaskFromBoard` 和 `getEmptyUnifiedViewMessage`，空看板也可打开，创建经由 `Core.createTaskFromInput` 持久化。
- Fork 适配：移除 type 字段（fork Task 无此字段）；优先级选项默认为 high/medium/low；通过运行时转型使用 `textarea` widget，因为打包的类型声明未暴露它。
- 跳过上游 BACK-430 的 core 快照/回滚和 git CAS 流水线；成熟创建器通过持久化回调注入创建，与 BACK-561 的精确路径 autoCommit 兼容。

## 验收标准

- `N` 打开含 Title/Description/Status/Priority 和 Create/Cancel 操作的创建器。
- 非草稿任务出现在看板上并被聚焦；草稿报告为不显示。
- 空看板保持可打开且创建器可达。
- 聚焦测试覆盖创建器模型、看板 helper 和键盘导航。

## Related Concepts

- [[concepts/cli-tui]] — TUI 看板与任务列表
- [[concepts/task-lifecycle]] — 任务创建流程

## Related Sources

- [[sources/back-555-tui-live-refresh-atomic-writes]] — 实时刷新支撑看板更新
