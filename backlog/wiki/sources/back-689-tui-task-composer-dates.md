---
title: BACK-689 - TUI 任务编辑器与详情弹窗日期字段
labels: [source, tui, cli, date-fields]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-689 - TUI-task-composer-and-task-detail-popup-planned-actual-due-dates.md
---

# BACK-689 - TUI 任务编辑器与详情弹窗日期字段

TUI 任务编辑器和任务详情弹窗过去完全没有日期字段，而里程碑表单早已携带。本任务为编辑器新增 Due / Planned from-to / Actual from-to 字段，并为任务详情弹窗新增 Due 及 Planned/Actual 区间行，与里程碑各面保持一致。

## 实现要点

- 编辑器（`task-composer.ts`）：五个日期字段（Due、Planned from/to、Actual from/to）放在 Details 框架与操作区之间，按里程碑表单风格排成标签+输入行行；弹窗高度上限从 20 提高到 24，保留短屏边距守卫
- 校验复用 `isValidMilestoneDate`；非法提交被拒绝并给出命名字段的错误，焦点回到出错字段
- 详情：`task-viewer-with-search.ts` 的 `generateDetailContent` 新增 Due/Planned/Actual 元数据行，同时供任务列表 quick-look 和看板弹窗使用；任务无日期时不渲染日期行
- 通过实时创建流探针端到端验证：非法日期被拒绝并重新聚焦，修正后的值以 `dueDate`/`plannedStart`/`plannedEnd` 持久化到创建的任务文件
- 检查：95 个相关测试通过，`bunx tsc --noEmit` 与 Biome 干净

## 验收标准

- 编辑器提供 Due / Planned / Actual 日期字段，并将合法日期持久化到创建的任务文件
- 畸形日期被拒绝并给出命名字段错误，表单重新聚焦出错字段
- 任务详情弹窗在任务列表 quick-look 和看板弹窗中均显示 Due 与 Planned/Actual 区间
- 无日期的任务不渲染日期行

## Related Concepts

- [[concepts/date-fields]] — 这些 TUI 字段暴露的 due/planned/actual 日期模型
- [[concepts/cli-tui]] — 终端 UI 的编辑器与弹窗约定

## Related Sources

- [[sources/back-587-repair-tui-task-composer-ux]] — 本表单扩展自早前的编辑器 UX 修复
- [[sources/actual-dates-auto-create-task]] — 任务创建时的 actual 日期字段，CLI 侧对应
