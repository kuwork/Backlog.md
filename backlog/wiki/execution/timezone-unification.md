---
title: 统一 UTC 存储字符串的时区解析模式
labels: [execution, pattern, timezone, web-ui, core]
created_date: 2026-05-29 22:36
updated_date: 2026-05-29 22:36
extracted_from:
  - sources/timezone-handling-fix
---

# 统一 UTC 存储字符串的时区解析模式

修复 `new Date(dateStr)` 将无 Z/T 的 UTC 字符串误解析为本地时间的问题。

## 标准步骤

1. **创建共享工具**（`src/utils/date-utc.ts`）
   - `parseStoredUtcDate(dateStr: string): Date` — 将 `YYYY-MM-DD HH:MM` 按 UTC 解析
   - `getStoredUtcTimestamp(dateStr: string): number` — 获取 UTC 时间戳

2. **审计所有解析点**
   - Web 组件：`DraftsList.tsx`、`CleanupModal.tsx`、`GanttView.tsx`
   - 核心模块：`board.ts`、`statistics.ts`、`task-loader.ts`、`backlog.ts`
   - 搜索关键词：`new Date(` + 变量名包含 date/time

3. **替换为共享工具**
   - 所有从存储读取的日期时间字符串统一使用 `parseStoredUtcDate`
   - 新增代码 Code Review 时检查是否使用正确解析方式

4. **补充单元测试**
   - 覆盖跨时区场景（UTC+8、UTC-5 等）
   - 验证 `datetime-local` 输入绑定与显示一致性

## 关键洞察

CLI 写入的 UTC 时间（如 `'2026-05-29 10:32'`）不带 Z/T 后缀，因此 `new Date()` 会按本地时间解析，导致 Web UI 显示偏差。必须在应用层显式按 UTC 解析。

## Related Sources
- [[sources/timezone-handling-fix]] — BACK-497 修复详情
