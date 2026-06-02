---
title: BACK-490 CLI overview 命令（项目级统计）
labels: [source, feature, cli, statistics, health]
source_path: backlog/tasks/back-490 - Add-CLI-overview-command-for-project-level-task-statistics.md
created_date: 2026-05-26 23:42
updated_date: 2026-05-26 23:42
---

# BACK-490 CLI overview 命令（项目级统计）

**状态**: Done | **标签**: feature, cli | **负责人**: @kimi | **依赖**: BACK-489

## 目标

增强现有 `backlog overview` CLI 命令，添加 `--plain` 纯文本输出模式，使用户无需启动交互式 TUI 即可快速获取项目级任务统计。

## 输出维度

- 总任务数、完成百分比、草稿数
- 按状态分布 + 百分比
- 按优先级分布 + 百分比
- 最近活动：最近 7 天创建和更新的任务列表
- 项目健康度：平均任务年龄、临期 / 逾期 / 停滞 / 阻塞任务列表

## 两种输出模式

| 模式 | 命令 | 特性 |
|---|---|---|
| 交互式 TUI | `backlog overview` | ANSI 彩色直接终端输出，单列垂直布局，终端原生滚动 |
| 纯文本 | `backlog overview --plain` | 无 ANSI 颜色，适合管道处理；分隔线长度匹配标题长度 |

## 变更摘要

| 文件 | 变更 |
|---|---|
| `src/commands/overview.ts` | 新增 `OverviewOptions` 接口（`--plain`）；非 TUI 模式跳过 loading screen 保持 stdout 干净 |
| `src/ui/overview-tui.ts` | 重写 TUI：从 blessed scrollable-box 改为 ANSI 彩色直接终端输出（修复 Windows / VS Code 终端滚动问题）；新增 `renderStatsPlainText()` 导出；健康度区展示 At Risk / Overdue / Stale / Blocked |
| `src/cli.ts` | `overview` 命令新增 `--plain` 选项；移除临时 `stats` 命令注册；移除 `--json` 选项 |
| `src/core/statistics.ts` | 修复阻塞任务检测 bug：依赖 ID 大小写敏感比较（`task-1` vs `TASK-1`）→ 改用 `taskIdsEqual()`；`recentlyUpdated` 回退到 `createdDate` |
| `src/test/stats-command.test.ts` | `overview --plain` 集成测试（含 ANSI 转义码排除验证） |

## 设计决策

- **移除 `--json`**：`TaskStatistics` 原始输出包含完整 Task 对象，对 CLI 过于冗长；plain + TUI 已覆盖用户需求。
- **TUI 直接 ANSI 输出**：避免 blessed 盒子在 Windows 和 VS Code 集成终端中的滚动/resize bug。
- **纯 read-only**：无数据模型变更，复用 `core.loadAllTasksForStatistics()` 与 `getTaskStatistics()`。

## 输出结构（plain）

```
Project Name - Project Overview
===============================

Status Overview
===============
  To Do: N tasks (N%)
  In Progress: N tasks (N%)
  Done: N tasks (N%)

  Total Tasks: N
  Completion: N%

Priority Breakdown
==================
  high     N  N%
  medium   N  N%
  low      N  N%
  none     N  N%

Recent Activity
===============
Recently Created
----------------
  TASK-N - Title

Recently Updated
----------------
  TASK-N - Title

Project Health
==============
  Average Task Age: N days
  At Risk: N   Overdue: N   Stale: N   Blocked: N

At Risk Tasks: (due soon, require immediate attention)
------------------------------------------------------
  TASK-N - Title
...
```

## Related Concepts
- [[concepts/cli-entry]] — CLI 命令体系与 TTY 检测
- [[concepts/project-health]] — 项目健康度指标计算逻辑

## Related Sources
- [[sources/back-489-health-indicators-task]] — BACK-489 健康指标分类实现
