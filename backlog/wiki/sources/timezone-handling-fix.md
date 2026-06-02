---
title: BACK-497 修复 CLI 与 Web UI 时区处理不一致
source_path: backlog/tasks/back-497 - Fix-inconsistent-timezone-handling-between-CLI-and-web-UI.md
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
labels: [source, bug, timezone, web-ui, core]
---

# BACK-497 修复 CLI 与 Web UI 时区处理不一致

修复存储的 UTC 时间字符串在 CLI 与 Web UI 中解析不一致的问题。

## 问题

CLI 写入 UTC 时间戳（如 `'2026-05-29 10:32'`），但代码库中多处使用 `new Date(dateStr)`，浏览器/Node.js 将无 `Z` 或 `T` 的字符串解释为**本地时间**。导致：
- `TaskDetailsModal` 显示正确的本地时间（通过 `parseStoredUtcDate`）
- `DraftsList` / 看板 / 统计页面显示错误时间（通过 `new Date`）
- 甘特图显示原始 UTC 时间而非本地时间

## 解决方案

1. 提取 `parseStoredUtcDate` + `getStoredUtcTimestamp` 到 `src/utils/date-utc.ts`（CLI 与 Web 共享）
2. 修复 Web 组件：`DraftsList.tsx`、`CleanupModal.tsx`、`GanttView.tsx`
3. 修复核心模块：`board.ts`、`statistics.ts`、`task-loader.ts`、`backlog.ts`
4. 所有日期时间解析统一将存储字符串视为 UTC

## 文件变更

- `src/utils/date-utc.ts` — 新建共享工具
- `src/web/utils/date-display.ts` — 使用共享工具
- `src/web/components/DraftsList.tsx` — 修复时区解析
- `src/web/components/CleanupModal.tsx` — 修复时区解析
- `src/web/components/GanttView.tsx` — 修复时区解析
- `src/board.ts` — 修复时区解析
- `src/core/statistics.ts` — 修复时区解析
- `src/core/task-loader.ts` — 修复时区解析
- `src/core/backlog.ts` — 修复时区解析

## Related Concepts

- [[concepts/date-fields]] — 日期字段与时区处理

## Related Sources

- [[sources/actual-start-end-fields-task]] — BACK-492 引入 datetime 字段，涉及时区一致性
