---
title: actual 字段采用 Date-time 而非 Date-only 存储
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [decision, dates, storage]
---

# actual 字段采用 Date-time 而非 Date-only 存储

## 决策

`actualStart` / `actualEnd` 使用 `YYYY-MM-DD HH:MM` UTC 格式，而 `plannedStart` / `plannedEnd` / `dueDate` 保持 `YYYY-MM-DD` date-only 格式。

## 背景

BACK-401 为任务引入了 `dueDate`、`plannedStart`、`plannedEnd`，均采用 date-only 格式。BACK-492 需要追踪任务实际开始和完成时间。

## 权衡对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| **Date-only（统一）** | 与现有日期字段一致，简单 | 无法记录具体时刻，同一日开始/结束的任务无法区分先后顺序 |
| **Date-time（选择）** | 分钟级精度，与 `createdDate` 格式一致，支持甘特图小时级视图 | 需要时区转换处理，Web UI 使用 `datetime-local` 而非 `date` 输入 |

## 理由

1. **实际时间需要精度**：计划日期是"某天"，但实际开始/结束往往是"某时刻"（如上午 9:00 开始，下午 6:00 结束）
2. **与 createdDate 一致**：`createdDate` 已经是 `YYYY-MM-DD HH:MM` UTC，actual 字段遵循同一约定降低认知负担
3. **甘特图需求**：跟踪甘特图的日视图需要小时级精度来定位任务条

## 影响

- Web UI 中 actual 字段使用 `<input type="datetime-local">`，planned 字段使用 `<input type="date">`
- 引入 `storedUtcToDateTimeLocal` / `dateTimeLocalToStoredUtc` 进行 UTC ↔ 本地转换
- 时区一致性成为后续维护重点（BACK-497）

## Related Sources
- [[sources/actual-start-end-fields-task]] — BACK-492 实现
- [[sources/timezone-handling-fix]] — BACK-497 时区一致性修复
