---
title: BACK-659 - MCP 与 plain 列表展示验收标准进度
labels: [source, cli, mcp, acceptance-criteria, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-659 - Show-acceptance-criteria-progress-in-MCP-and-plain-task-lists.md
---

# BACK-659 - MCP 与 plain 列表展示验收标准进度

`task list --json` 早已发布逐任务的验收标准进度，TUI 与 Web UI 也已渲染它，但两个列表面仍藏着：MCP `task_list` 摘要行与 `task list --plain`。两者都内联构建行而非经共享 formatter，因此同样的进度必须在每个调用点各加一次。

- `src/ui/acceptance-criteria-progress.ts` 新增共享 helper `formatAcceptanceCriteriaSummarySuffix(task)`：任务有验收标准时返回 ` (ac: checked/total)`，否则返回空串；计数取自 `task.acceptanceCriteriaItems`，与 JSON formatter 读取的来源相同
- 刻意不加状态门：列表对任何有验收标准的任务都报进度，不像 TUI 进度条只在任务 In Progress 时渲染
- MCP：后缀追加在 `formatTaskSummaryLine`（`src/mcp/tools/tasks/handlers.ts`）的状态文本之后；CLI plain 列表：`runTaskList` 中两个内联行构建器都接上（`--sort priority` 分支与按状态分组分支），有状态指示符时后缀紧随其后
- 范围之外未动：JSON 路径（已发布计数）、`formatTaskPlainText`、任务详情输出、plain search 结果（自有 `[PRIORITY]` + score 形态）
- 没有任何已发布指南文档化 plain 列表的行布局，因此行形态不属于任何文档化契约，指南无需改动
- 测试：新的 `src/test/cli-task-list.test.ts`（本 fork 原先没有）外加一个 MCP 用例——已勾选、未勾选、无验收标准；三个用例都先对未改动代码变红；真实仓库冒烟显示 339 行带后缀，无 `(ac: 0/0)`

## 验收标准

- MCP `task_list` 摘要行为每个有验收标准的任务携带已勾选/总数进度
- `task list --plain` 在两个行构建器中都携带同样的进度；无验收标准的任务渲染与之前完全一致
- 后缀与状态无关（与 TUI 进度条不同）
- `task list --json` 输出不变
- 自动化测试用已勾选、未勾选、无验收标准覆盖两个面

## Related Concepts

- [[concepts/mcp-server]] — 新增后缀的 MCP `task_list` 摘要行
- [[concepts/cli-tui]] — plain 列表面补上与 JSON/TUI/Web 的最后一处差距
- [[concepts/upstream-migration]] — 移植自上游 BACK-642（5d727d61b）

## Related Sources

- [[sources/back-625-ac-progress-json-output]] — 本任务对齐其余面所依据的 JSON 发布
- [[sources/back-569-acceptance-criteria-progress-ui]] — 刻意不复制其状态门的 TUI 进度条
