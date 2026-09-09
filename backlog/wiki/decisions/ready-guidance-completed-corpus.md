---
title: 就绪指引加载已完成语料走 listCompletedTasks 快路径
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# 就绪指引加载已完成语料走 listCompletedTasks 快路径

## 背景

BACK-615 为依赖就绪指引加载已完成任务语料。上游做法是 `loadTasks({ includeCompleted: true })`，需要扫描全部任务目录并解析每个 frontmatter，实测 6.6 秒。

## 决定

改用 `filesystem.listCompletedTasks()`：只扫描 `completed/` 目录，实测 112ms。

同时两条配套决策：

- completed 语料中"位置即完成证据"——文件已在 completed/ 目录下，不检查 status 字符串。
- 删除上游 Core 从不处理的 `TaskListFilter.ready`：它存在即静默无操作，属于死代码。

## 理由

- 112ms 对 6.6s 是量级差异，就绪指引是交互路径，延迟直接影响体验。
- 位置即完成证据省去了对已完成任务的 status 字段猜测。
- 删掉从不生效的 filter 字段消除了调用方的误解空间。

## 被否方案

- **沿用上游 `loadTasks({ includeCompleted: true })`**：全量扫描解析，交互路径上不可接受的延迟。

## Related

- [[sources/back-615-dependency-readiness-guidance]]
- [[concepts/task-lifecycle]]
- [[concepts/upstream-migration]]
