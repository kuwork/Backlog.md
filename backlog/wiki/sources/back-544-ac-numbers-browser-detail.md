---
title: BACK-544 浏览器任务详情显示 AC 编号
labels: [source, web-ui]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-544 - Show-acceptance-criteria-numbers-in-browser-task-detail.md
---

# BACK-544 浏览器任务详情显示验收标准编号

在 Web UI 任务详情模态框的验收标准列表项中显示既有索引/编号，范围仅改浏览器任务详情预览。

## 解决方案

参照上游 BACK-517 提交，在 `TaskDetailsModal.tsx` 的验收标准列表项内新增 `#${c.index}` span——将复选框与编号 span 包进紧凑的 gap-1 flex 容器，使编号紧邻复选框，标准文本仍由外层 gap-2 分隔。仅详情预览显示编号，看板/列表卡片不变，存储格式、解析器输出、任务 schema 均未改动。

## 实现位置

- `src/web/components/TaskDetailsModal.tsx`

## 测试

`src/test/web-task-details-modal-acceptance-criteria.test.tsx` 新增 SSR 覆盖，验证详情模态编号渲染，并确认看板/列表卡片不暴露 AC 详情。

## Related Concepts
- [[concepts/web-ui-features]] — 任务详情模态框
- [[concepts/task-lifecycle]] — 验收标准

## Related Sources
- [[sources/back-537-deterministic-checklist-serialization]] — AC 编辑
