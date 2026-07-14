---
title: BACK-528 修复 Web 任务详情日期清除不持久化
labels: [source, bug, web-ui, dates]
created_date: '2026-07-14 07:14'
updated_date: '2026-07-14 07:14'
source_path: backlog/tasks/back-528 - Fix-Web-task-detail-date-clear-not-persisting.md
---

# BACK-528 修复 Web 任务详情日期清除不持久化

修复 Web 任务详情模态框中点击日期选择器 "Clear" 后，日期字段未被真正保存到 Markdown 文件的问题。

## 问题

在任务详情模态框中清除 `dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd` 任一日期字段时，客户端将空值转换为 `undefined` 发送给服务端。由于 `JSON.stringify` 会丢弃 `undefined` 字段，服务端收不到清除指令，原日期值保留在文件中。

## 根因

- `handleSave` 中对日期字段使用 `dueDate.trim().length > 0 ? dueDate.trim() : undefined`，空值转为 `undefined`
- 各日期 `onChange` 回调中使用 `value || undefined`，清空时同样转为 `undefined`

## 解决方案

将客户端所有日期字段的处理从 `undefined` 改为空字符串 ` ""`：

1. **`handleSave` 创建/编辑 payload**：直接发送 `dueDate.trim()` 等，空字符串自然保留
2. **五个日期 `onChange` 回调**：
   - `dueDate`：`{ dueDate: value }`
   - `plannedStart`：`{ plannedStart: value }`
   - `plannedEnd`：`{ plannedEnd: value }`
   - `actualStart`：`{ actualStart: value }`
   - `actualEnd`：`{ actualEnd: value }`

服务端已支持空字符串清除：`handleUpdateTask` 接收空字符串后，`applyOptionalDateField` 将其转为 `undefined` 并删除任务对象上的对应字段。

## 实现位置

- `src/web/components/TaskDetailsModal.tsx`
- `src/test/server-task-dates-endpoint.test.ts`（新增测试）

## 测试

新增 `src/test/server-task-dates-endpoint.test.ts`，覆盖：

1. **批量清除**：PUT `/api/tasks/:id` 同时传入五个日期字段为空字符串，验证任务对象所有日期字段被删除
2. **单个清除**：仅清除 `actualStart`，验证其他日期字段保持不变

验证结果：
- `bunx tsc --noEmit` 通过
- `npx biome check` 通过
- `bun test src/test/server-task-dates-endpoint.test.ts src/test/task-edit-preservation.test.ts` 通过

## Related Concepts
- [[concepts/date-fields]] — 日期字段语义、存储格式与清除机制
- [[concepts/web-ui-features]] — Web UI 任务详情模态框

## Related Sources
- [[sources/timezone-handling-fix]] — BACK-497 时区一致性修复
- [[sources/back-506-cli-utc-conversion-fix]] — BACK-506 CLI UTC 转换修复
