---
title: 项目健康度指标
labels: [concept, statistics, health, web-ui, cli]
created_date: 2026-05-26 23:42
updated_date: 2026-05-26 23:42
---

# 项目健康度指标

Backlog.md 用于快速识别需要关注任务的四维健康分类系统。由 BACK-489 引入，BACK-490 扩展至 CLI。

## 四种健康分类

| 分类 | 英文名 | 判定逻辑 | 视觉标识 |
|---|---|---|---|
| **临期** | At Risk | `status !== "Done" && dueDate && diffInDays(dueDate, today) <= 1` | 🟡 琥珀色 |
| **逾期** | Overdue | `status !== "Done" && dueDate && diffInDays(dueDate, today) < 0` | 🔴 红色 |
| **停滞** | Stale | `status !== "Done" && !dueDate && lastUpdated > 30 days ago` | 🔵 蓝色 |
| **阻塞** | Blocked | 依赖列表中存在未完成的任务 | 🔴 红色 |

**核心规则**：有 `dueDate` 的任务**不再**计入 `stale`，避免双重分类。

## 计算实现

位于 `src/core/statistics.ts` 的 `getTaskStatistics()`：

```typescript
atRisk  = task.status !== "Done"
          && task.dueDate
          && diffInDays(task.dueDate, today) <= 1

overdue = task.status !== "Done"
          && task.dueDate
          && diffInDays(task.dueDate, today) < 0

stale   = task.status !== "Done"
          && !task.dueDate
          && lastUpdated > 30 days ago
```

**阻塞任务检测**：使用 `taskIdsEqual()` 进行大小写不敏感的依赖 ID 匹配（修复 `task-1` vs `TASK-1` 的误判）。

## Web UI 呈现

### 统计页面（Statistics）
- **顶部摘要**：四个彩色圆点 + 计数，水平排列在统计卡片头部。
- **详情列表**：按类别分块展示任务卡片。
  - 临期/逾期卡片显示 **截止日期**（Due by）。
  - 停滞卡片显示 **更新日期**。
  - 所有卡片保持点击编辑行为。
- **Tooltip**：悬停显示单语言描述（4 语言完整覆盖）。

### 看板卡片
看板卡片左侧的彩色边条为**优先级标识**（高优先级红色、中优先级黄色、低优先级绿色），与健康度分类无关。健康度信息仅在统计页面中集中展示。

## CLI 呈现

`backlog overview` 与 `backlog overview --plain` 均在 **Project Health** 区域展示：

```
Project Health
==============
  Average Task Age: N days
  At Risk: N   Overdue: N   Stale: N   Blocked: N

At Risk Tasks: (due soon, require immediate attention)
------------------------------------------------------
  TASK-N - Title
```

## i18n 键（4 语言）

| 键 | 用途 |
|---|---|
| `statistics.atRiskCount` | 临期计数标签 |
| `statistics.overdueCount` | 逾期计数标签 |
| `statistics.atRiskTooltip` / `overdueTooltip` / `staleTooltip` | 悬停提示 |
| `statistics.atRiskTasksTitle` / `overdueTasksTitle` | 详情区标题 |
| `common.dueBy` | 卡片截止日期前缀 |

## Related Concepts
- [[concepts/date-fields]] — dueDate 字段语义与存储
- [[concepts/cli-entry]] — `overview` 命令输出格式
- [[concepts/web-ui-features]] — 统计页面与看板卡片视觉设计

## Related Sources
- [[sources/back-489-health-indicators-task]] — BACK-489 重构实现
- [[sources/back-490-overview-command-task]] — BACK-490 CLI 扩展
