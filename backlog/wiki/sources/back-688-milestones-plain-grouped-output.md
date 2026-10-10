---
title: BACK-688 - milestones list --plain 按里程碑分组输出任务
labels: [source, cli, milestones]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-688 - milestones-list-plain-prints-tasks-grouped-by-milestone-migrate-board-m-output.md
---

# BACK-688 - milestones list --plain 按里程碑分组输出任务

BACK-687 让 `backlog milestones list` 在 TTY 上成为交互 TUI，导致没有纯文本方式获得按里程碑分组的任务列表用于管道或分页——即 `backlog board -m` 曾提供的面。本任务在看板自己的渲染器共享下，把该分组输出恢复到 `milestones list --plain`（及非 TTY 标准输出）。

- `src/cli.ts` milestone list plain 分支：内联计数摘要替换为 `generateMilestoneGroupedBoard(tasks, statuses, milestones, projectName)`（来自 `src/board.ts`）——No Milestone 节在前，再按里程碑文件顺序，任务在 `### <Status> (n)` 标题下带 id + 标题行，与 `board -m` 的 markdown 形态完全一致
- 策略在调用点对齐 `board -m`（formatter 不动）：已完成任务默认排除，`--show-completed` 加载已完成文件夹，使已完成的里程碑有真实小节；归档里程碑任务经 `src/core/milestones.ts` 的新共享辅助 `foldArchivedMilestoneTasks` 折入 No Milestone（看板加载器去重到它）；`hideEmptyColumns` 像看板非 TTY 分支一样收窄状态
- `backlog board -m` 本身不动，调用同一共享渲染器——"保留还是重定向"的决定落地为原样保留并共享 formatter
- 文档：`CLI-INSTRUCTIONS.md` Milestone Management 表与 `src/guidelines/cli-instructions/milestones.md` 更新（分组纯文本看板、`--show-completed` 范围、非 TTY 自动 plain；`> result.md` 重定向示例后来按用户要求移除）；根入口横幅增加 `draft list --plain` 与 `milestones list --plain` 行
- 用户审阅真实输出并确认 `board -m` 一致行为（`tasks/` 中 Done 状态任务计入；`completed/` 文件夹除非 `--show-completed` 否则排除）现状即正确
- 测试：`cli-milestone-management.test.ts` 中 4 个分组输出测试替换计数摘要测试；milestone + board 套件 34/34 与 33/33；实测冒烟确认 `--plain` == `board -m` 分组形态（`--show-completed` 时 356 → 660 任务）。仓库级 Biome 保留两个已知预先存在错误，DoD #2 未勾选

## 验收标准

- `--plain` 按里程碑分组打印任务，`### <Status> (count)` 标题匹配 `board -m` markdown 形态
- 已完成里程碑默认折叠，`--show-completed` 列出；无 `--plain` 的非 TTY 标准输出行为相同
- 现有 `backlog board -m` 输出经共享渲染器仍可用；测试覆盖分组输出、开关与非 TTY 路径

## Related Concepts
- [[concepts/milestones]] — 桶排序与归档里程碑折叠规则
- [[concepts/cli-entry]] — CLI plain/非 TTY 输出契约
- [[concepts/cli-instructions]] — 更新的指南面

## Related Sources
- [[sources/back-687-milestone-board-tui]] — 本任务填补其 plain 输出缺口的 TUI 变更
- [[sources/back-562-stable-json-output]] — 同级 plain/机器可读输出面约定
