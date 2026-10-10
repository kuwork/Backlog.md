---
title: BACK-690 - overview Due By 仅日期时区错位修复
labels: [source, cli, bug, date-fields]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-690 - Overview-Due-By-renders-date-only-due-dates-as-the-previous-day-in-western-timezones.md
---

# BACK-690 - overview Due By 仅日期时区错位修复

到期日是一个日历日，但 overview 健康列表渲染时追加 `T00:00:00Z`（UTC 午夜）再转换为查看者本地时区，导致 `2026-09-05` 在 UTC-7 显示为 `9/4`。修复将仅日期值按本地午夜解析；带时间戳的值保持 UTC 解析。

## 解决方案

- 单分支改动在 `formatDateForStats`（`src/ui/overview-tui.ts`）：仅日期值用 `T00:00:00`（不带 `Z`）规范化，因此按本地午夜解析并渲染为写入的那一天；带时间的值保留 `:00Z` UTC 解析，因为 created/updated 时间戳以 UTC 存储
- 该助手现在导出以便测试
- 测试（`src/test/overview-date-format.test.ts`）派生 `TZ` 固定为 America/Los_Angeles (-8) 和 Pacific/Kiritimati (+14) 的子进程，断言渲染的日期等于本地午夜渲染，另有一个进程内用例固定 UTC 日期时间路径
- 还原检查：恢复 `Z` 后缀会使恰好 -8 的探针失败，另外两个保持绿色
- 执行发现：Windows 上 Bun 忽略通过 Git Bash 命令前缀设置的 `TZ`，但经由 `Bun.spawnSync` env 会遵循；`Intl.DateTimeFormat().resolvedOptions().timeZone` 仍报告机器时区——不可用于判断固定是否生效
- 存储、录入与其他所有显示面早已将到期日视为仅日期，未改动

## 验收标准

- 仅日期值在任意时区渲染为写入的那一天（本地午夜解析）；日期时间值保持 UTC 解析
- 测试在 TZ 固定的子进程中固定两条路径，还原检查显示修复前恰好新测试失败
- 类型检查与范围测试通过

## Related Concepts

- [[concepts/date-fields]] — 本修复在 overview 中固化的仅日期 vs UTC 时间戳之分
- [[concepts/cli-tui]] — overview 命令渲染面

## Related Sources

- [[sources/timezone-handling-fix]] — 同类的早期时区日期错位修复
- [[sources/back-689-tui-task-composer-dates]] — 同一会话在 TUI 各面上的日期字段工作
