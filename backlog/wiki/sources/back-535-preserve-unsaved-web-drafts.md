---
title: BACK-535 跨文件刷新保留 Web 未保存草稿
labels: [source, web-ui, drafts, bug]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-535 - Preserve-unsaved-Web-drafts-across-file-refreshes.md
---

# BACK-535 跨文件刷新保留 Web 未保存草稿

当模态框打开期间任务文件在后台变化时，未保存的创建/编辑表单状态不再被重置。

## 问题

Web UI 中，模态框打开期间任务文件后台变化会重置未保存的表单状态，可能丢失用户编辑。

## 解决方案

移植上游 BACK-429 的刷新合并逻辑到 1.48 代码库：新增 `TaskDetailsFormState`、`buildTaskDetailsFormState`、`preserveDirtyRefreshValue`、`formBaselineRef`。重置 useEffect 合并刷新字段时仅更新未触碰字段，保留用户在标题、描述、计划、备注、日期、AC、DoD、references、docs 上的脏编辑；保留既有表单校验与日期清除行为。稳定了 JSDOM 回归测试脚手架。

## 实现位置

- `src/web/components/TaskDetailsModal.tsx`
- `src/test/web-task-details-modal-final-summary.test.tsx`

## 测试

新增 2 项回归（脏编辑字段、未保存创建字段跨刷新）。Scoped web 模态测试 13/13 通过。

## Related Concepts
- [[concepts/web-ui-features]] — 任务详情模态框
- [[concepts/task-lifecycle]] — 草稿概念

## Related Sources
- [[sources/back-528-web-task-detail-date-clear-persisting]] — 模态框状态修复
