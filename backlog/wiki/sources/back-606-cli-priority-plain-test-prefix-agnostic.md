---
title: BACK-606 - 优先级 plain 输出测试改为前缀无关
labels: [source, cli, tests]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-606 - Make-CLI-priority-plain-output-test-prefix-agnostic.md
---

# BACK-606 - 优先级 plain 输出测试改为前缀无关

`src/test/cli-priority-filtering.test.ts` 中的 'plain output includes priority indicators' 测试在输出守卫与行格式正则里硬编码了 `task-` ID 前缀。项目可配置自己的任务前缀（本仓库用 `BACK-`），导致守卫因无关原因匹配、正则永远匹配不到真实 ID——测试随运行不同而失败或空洞通过。本任务用前缀无关模式替换硬编码前缀。

- `cli config get` 不暴露 `taskPrefix`，因此修复不从配置派生前缀；而是引入共享的前缀无关 `TASK_LINE_PATTERN`（任意前缀、可选 `[HIGH]`/`[MEDIUM]`/`[LOW]` 指示符、可选 `.NN` 子任务后缀、`/m` 标志），供全部守卫与行格式断言使用。
- 替换 `src/test/cli-priority-filtering.test.ts` 中所有硬编码 `task-` 守卫与格式正则；移除空洞守卫。
- Scoped 测试 13/13 通过，重复两次；全量运行确认 plain 输出失败消失且无新增失败。

## 验收标准

- 行格式断言匹配任意项目前缀下带可选优先级指示符的真实任务 ID。
- 测试使用前缀无关任务行模式而非硬编码 `task-`。

## Related Concepts

- [[concepts/task-identity]] — 可配置任务 ID 前缀及其在 plain 输出中的呈现。
- [[concepts/cli-entry]] — 被测的 CLI plain 输出行格式。
