---
title: 统计语料范围
labels: [concept, statistics]
created_date: 2026-10-03 01:13
updated_date: 2026-10-09 23:30
---

# 统计语料范围

项目统计（projectHealth）默认只统计**活跃语料**（`backlog/tasks/` 下非空状态任务），`backlog/completed/` 完成记录语料是显式 opt-in。同一指标在两个 scope 下数字不同（如平均完成耗时：活跃 411 任务/386 完成/5153 分钟 vs 扩展 715/690/5305 分钟），因此"语料范围"是所有统计读数的前置参数。

## 四个开关面（同一套 show-completed 机制）

- **REST API**：`completed=true`（[[sources/back-662-completed-corpus-query-search]]）
- **页面 URL**：`completed=1`（[[sources/back-665-completed-corpus-filter-checkbox]]）
- **CLI**：`--completed`
- **MCP**：`task_list({ completed: true })` / `task_search`

共享 UI 件 `CompletedFilterToggle` + `useCompletedTasks(enabled)`：未勾选时零成本（不发 widened 请求），勾选状态骑 URL 参数存活于刷新与分享链接。

## 完成判定与指标口径

- 完成只认 `getTerminalStatus()` 的**规范终态**（本项目为 Done；Dropped 是留档终态，不算完成）——统计模块改收原始 statuses 配置、按 category 判定，避免重命名/多终态项目统计错误（[[sources/back-725-average-completion-time-statistics]]）。
- 平均完成耗时 = Gantt 左表 Actual Start / Actual End 两列显示值的差，fallback 链 start = actualStart → createdDate → now，end = actualEnd → updatedDate → createdDate+1d → start+1d，end<start 钳到 start+1d；不加排除规则、不加 flooring。Gantt 时间解析抽成共享 helper `src/utils/task-time-span.ts`，GanttView 与 core/statistics.ts 共同消费，配 parity 测试钉死两面不漂移。
- 均值强烈右偏（中位数远小于均值），卡片在均值旁显示样本量。
- 每条统计代码路径读取的语料必须一致：server 侧收敛为一个 `computeStatistics(includeCompleted)` 同时服务热路径与冷路径，**缓存按 scope 分键、整体失效**——否则数字随缓存状态漂移（BACK-725 修复的既有缺陷）。

## 与 completed 语料机制的关系

语料 opt-in 本身由 BACK-662 引入（queryTasks / SearchService 的 includeCompleted 标志，默认行为各处不变、默认输出逐字节不变），BACK-665 补了 Web 看板与任务列表的复选框。统计指标沿用同一套机制而非另起炉灶；差异在统计侧多了"完成判定"与"按 scope 分键缓存"两层口径约束。watch 进程的 stat 签名输入也包含 completedDir（见 [[concepts/json-watch]]）。

## Related Concepts

- [[concepts/project-health]] — projectHealth 输出与平均耗时/样本量指标卡片
- [[concepts/gantt-view]] — 跨度定义完全复用 Gantt 的 Actual Start/End 解析链
- [[concepts/task-lifecycle]] — completed/ 语料作为与 Done 状态不同的目的地
- [[concepts/state-machine]] — 规范终态判定依赖状态机 category
- [[concepts/json-watch]] — watch 重读成本与 completedDir 签名输入

## Related Sources

- [[sources/back-725-average-completion-time-statistics]] — 平均完成耗时指标与 scope 参数落地
- [[sources/back-490-overview-command-task]] — overview 命令输出挂接新指标与 --completed 旗标
- [[sources/back-662-completed-corpus-query-search]] — includeCompleted 语料机制的引入
- [[sources/back-665-completed-corpus-filter-checkbox]] — Web 复选框与 CompletedFilterToggle 共享件
