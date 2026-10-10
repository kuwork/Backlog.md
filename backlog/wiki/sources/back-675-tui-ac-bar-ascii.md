---
title: BACK-675 - TUI 验收标准条合并为 ASCII 彩色紧凑条
labels: [source, tui, acceptance-criteria]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-675 - Merge-the-TUI-acceptance-criteria-bar-follow-ups-into-one-ASCII-colored-compact-bar.md
---

# BACK-675 - TUI 验收标准条合并为 ASCII 彩色紧凑条

TUI 验收标准条用 Block Element 字形（U+2588/U+2591）渲染，而 blessed 只保证 DEC Special Graphics 的回退——因此在没有那些字形的 Windows 控制台上，条不可见或乱码。本任务一次落地最终形态：紧凑 ASCII、彩色、截断，并从详情窗格移除。

- `formatAcceptanceCriteriaProgress` 重写：`#` 填充 / `-` 空格的 ASCII 单元，宽版 5 格、紧凑 3 格，注释记录 Block Elements 为何不可用（无 blessed 字形回退）
- `completionColor(checked, total)` 经 `wrapStatusColor` 应用：完成绿色、低于或等于三分之一红色、之间黄色；带截断，任何已勾选项至少显示一格，未完成的工作永不填满条
- `WIDE_PROGRESS_MIN_WIDTH` 中途从 32 移到 40：32 时 fork 在已经太窄的列上仍显示宽条——120 列三列看板（列宽 36）正好落在该区间
- 条只是行的扫描辅助：任务详情窗格的条行、其 import，以及只为给它量宽而存在的宽度管道（`availableWidth` 参数、quick-look 透传、resize 重渲染）全部移除——看板行是唯一的完成度面
- 进度实时从已勾/总标准派生，无持久状态；无标准或非 In-Progress 状态的任务不渲染条，全部勾选的 In-Progress 任务保留活跃状态图标，条不会被误读为 Done
- CLI/MCP `(ac: x/y)` 摘要后缀刻意不动
- 测试：18 用例覆盖精确输出字符串、纯 ASCII 不变式、每个边界的颜色、两端截断、阈值处两种单元数、真实列宽下的看板行，以及详情小节渲染清单无条；在 BACK-411 上以 80/36/31/20 宽度实测渲染

## 验收标准

- 条渲染 ASCII `#`/`-` 单元，无 Block Element 字形或 UTF-8 locale 也可读
- 阈值 40 下宽版 5 格 / 紧凑 3 格，终端 resize 时重渲染
- 填充段经共享状态色辅助函数着色（完成绿、≤1/3 红、之间黄），两端截断
- 无标准或非 In Progress 的任务无条；全勾选的 In-Progress 保留活跃状态图标
- 条只在看板行上——详情窗格显示标题加清单；CLI/MCP 后缀不变

## Related Concepts
- [[concepts/cli-tui]] — blessed 渲染约束与终端宽度处理
- [[concepts/tui-theme-adaptive]] — 条使用的共享状态色辅助函数
- [[concepts/task-lifecycle]] — 条可视化而不暗示 Done 的 In Progress 语义

## Related Sources
- [[sources/back-569-acceptance-criteria-progress-ui]] — 本任务收尾的原始 AC 进度 UI
- [[sources/back-625-ac-progress-json-output]] — 保持不变的 `(ac: x/y)` 摘要
- [[sources/back-676-emoji-double-width-tui]] — 同级 TUI 单元格宽度正确性修复（批次兄弟）
