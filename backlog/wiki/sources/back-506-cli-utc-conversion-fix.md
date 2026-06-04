---
title: BACK-506 CLI actualStart/actualEnd local-to-UTC 转换修复
labels: [source, bug, cli, dates, timezone]
created_date: '2026-06-04 16:34'
updated_date: '2026-06-04 16:34'
source_path: backlog/tasks/back-506 - Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion.md
---

# BACK-506 CLI actualStart/actualEnd local-to-UTC 转换修复

修复 CLI（及 MCP）输入 `actualStart`/`actualEnd` 时未将本地时间转换为 UTC 的问题，消除与 Web UI 的存储偏差。

## 问题

- Web UI 通过 `dateTimeLocalToStoredUtc` 将 `datetime-local` 输入正确转换为 UTC 存储
- CLI 直接将本地时间字符串（如 `2026-06-04 09:00`）原样写入，导致同一输入在不同入口产生不同存储值
- date-only 格式（`YYYY-MM-DD`）同样未被处理

## 修复内容

1. **新增 `localDateTimeToStoredUtc`**（`src/utils/date-utc.ts`）
   - 支持三种格式：`YYYY-MM-DD`（视为 00:00 local）、`YYYY-MM-DD HH:MM`、`YYYY-MM-DDTHH:MM`
   - 统一按本地时间解析后转换为 UTC，存储为 `YYYY-MM-DD HH:MM`

2. **Web 兼容**（`src/web/utils/date-display.ts`）
   - 移除本地实现，改为从共享模块重新导出 `localDateTimeToStoredUtc` 为 `dateTimeLocalToStoredUtc`
   - Web UI 行为不变

3. **核心层应用**（`src/core/backlog.ts`）
   - `createTask` 和 `updateTask` 中对 `input.actualStart` / `input.actualEnd` 应用转换
   - 仅影响这两个字段；`dueDate`、`plannedStart`、`plannedEnd`、`createdDate` 完全不受影响

4. **测试**
   - 新增 `src/utils/date-utc.test.ts`（6 个用例）
   - 更新 `src/web/utils/date-display.test.ts`

## Related Concepts
- [[concepts/date-fields]] — 日期字段语义与存储格式
- [[concepts/cli-entry]] — CLI 命令体系与日期选项

## Related Sources
- [[sources/timezone-handling-fix]] — BACK-497 时区一致性修复（Web 侧）
- [[sources/actual-start-end-fields-task]] — BACK-492 actual 字段实现
