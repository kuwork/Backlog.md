---
title: 草稿路由按 DRAFT- 前缀判断，不探测 store
description: BACK-644 服务器任务路由以显式前缀分发草稿，杜绝裸 id 静默改指
labels: [decision, web-ui, drafts, task-identity]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 草稿路由按 DRAFT- 前缀判断，不探测 store

## Context

web 任务路由只解析任务 store，`GET /api/tasks/DRAFT-2` 答 404、PUT 答 400，草稿从 web 永远无法保存。修法需要一个"这是草稿 id 吗"的判断；诱人的做法是探测草稿 store 里是否存在同号记录。

## Decision

`isDraftId(taskId)` 只看前缀（`extractAnyPrefix(taskId) === DRAFT_PREFIX`），**永远不探测 draft store**——裸 id `/api/tasks/2` 不可能被静默改指到同号草稿。GET 委托给已有的 `handleGetDraft`（歧义 409、缺失 404）；PUT 走 `core.editTaskOrDraft`，配置的非草稿状态会提升草稿，与 MCP 语义一致。

## Rejected alternatives

- 探测 store 存在性决定路由——同号的任务与草稿同时存在时路由结果取决于加载时序，产生静默改指
- 新建一套 `/api/drafts/:id` 编辑路由并让前端改址——复制已有 handler 的歧义/缺失语义，且与 MCP 的 `editTaskOrDraft` 语义分裂

## Related Sources

- [[sources/back-644-web-draft-editing-fix]] — 本决策的落地
- [[sources/back-642-draft-identity-fail-closed]] — 被复用的 fail-closed 草稿查找与 409 映射
- [[sources/back-683-cli-draft-edit]] — CLI 侧相反的取舍（状态不提升）
