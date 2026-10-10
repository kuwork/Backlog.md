---
title: BACK-569 - 验收标准完成度进度展示
labels: [source, tui, web-ui, acceptance-criteria]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-569 - Show-acceptance-criteria-completion-on-TUI-and-browser-task-summaries.md
---

# BACK-569 - 验收标准完成度进度展示

In-Progress 任务摘要现在显示紧凑的分段完成条和精确的已勾选/总数验收标准分数，由清单实时推导。

## 实现要点

- 新增 `src/ui/acceptance-criteria-progress.ts`，含 `formatAcceptanceCriteriaProgress`：10 格条（32 列以下 5 格），无标签、无百分比，实时已勾选/总数。
- `src/ui/board.ts`：`formatTaskListItem` 接受 `availableWidth` 并前置进度指示；`getFormattedItems` 按列计算宽度。
- `src/ui/task-viewer-with-search.ts`：验收标准小节在清单上方显示进度行。
- 新增 `src/web/components/AcceptanceCriteriaProgress.tsx`：分段条 + 精确分数，`role="progressbar"` 带 ARIA 属性，5/10 格两种布局，非 In-Progress 或无验收标准时为 null。
- `TaskCard` 在标题下显示指示（10 格）；`TaskList` 在标题单元格显示。
- 无持久化进度状态；CLI 和 MCP 输出不变。

## 验收标准

- In-Progress 任务显示 `[██████░░░░] 4/7` 式指示。
- 无 AC 标签和百分比；无验收标准的任务不显示任何内容。
- 全部勾选的 In-Progress 任务保持其实际 In-Progress 状态。
- 主题安全；不依赖颜色即可理解。
- TUI 和浏览器测试覆盖部分完成、无 AC、全部勾选和两种条宽。

## Related Concepts

- [[concepts/cli-tui]] — TUI 任务摘要
- [[concepts/web-ui-features]] — Web 任务卡片与列表
- [[concepts/task-lifecycle]] — 任务状态与验收标准

## Related Sources

- [[sources/back-537-deterministic-checklist-serialization]] — 验收标准编辑
