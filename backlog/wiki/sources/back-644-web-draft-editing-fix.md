---
title: BACK-644 - 修复 Web 草稿编辑
labels: [source, web-ui, drafts]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-644 - Fix-web-UI-draft-editing.md
---

# BACK-644 - 修复 Web 草稿编辑

从 Web 草稿页编辑草稿永远存不下来：浏览器的任务路由只解析任务存储，所以 `GET /api/tasks/DRAFT-2` 返回 404，PUT 返回 400。任务路由现在按显式 `DRAFT-` 前缀服务草稿，并经 `Core.editTaskOrDraft` 写入，与 MCP 语义一致。移植上游 BACK-634。

- `src/server/index.ts`：新 `isDraftId(taskId)` 依据前缀判定（`extractAnyPrefix(taskId) === DRAFT_PREFIX`），绝不靠探测草稿存储，所以裸 id 如 `/api/tasks/2` 永不会静默改指同号草稿
- `handleGetTask` 把 `DRAFT-` id 委托给现有 `handleGetDraft`（歧义仍 409，缺失 404）；`handleUpdateTask` 经 `filesystem.loadDraft` 预检草稿并经 `core.editTaskOrDraft` 写入——配置了非草稿状态会提升草稿
- `src/core/backlog.ts`：`editTaskOrDraft` 的非草稿分支现在直接委托 `updateTaskFromInput`，删除重复的 `fs.loadTask` 预载与重复的降级分支；id 解析在该方法内只发生一次
- `src/web/App.tsx`：`refreshData` 派发共享的 `drafts-updated` 事件，任何保存后草稿列表重载；`handleSubmitTask` 中的条件单路径派发已移除
- `src/web/components/TaskDetailsModal.tsx`：`StatusSelect` 把记录的实际（未配置）状态列在首位——草稿显示 Draft——且该字段对草稿禁用，因为提升属于草稿页动作，不属于弹窗
- 测试：8 个服务器用例（经 DRAFT- id 的 GET/PUT、配置状态时提升、裸数字 id 仍解析到任务、未知草稿 404、409 歧义）加 4 个 Web 用例；直接调用处理器，因为测试服务器在真实 socket 上对每个 `/api/*` 都答 404

## 验收标准

- GET `/api/tasks/<draft id>` 返回草稿而非 404；保存编辑写入草稿文件且保持草稿
- 经任务路由设置配置的非草稿状态会提升草稿，与 MCP 一致
- 无前缀 id 仍解析到任务；未知草稿 id 报缺失
- 草稿列表保存后自动刷新；弹窗状态字段显示 Draft 且禁用

## Related Concepts

- [[concepts/task-lifecycle]] — 保持单一来源的草稿提升/降级语义
- [[concepts/task-identity]] — 基于前缀的草稿寻址胜过存储探测
- [[concepts/web-server]] — 任务路由处理器扩展到草稿存储
- [[concepts/upstream-migration]] — 移植上游 BACK-634（提交 583f928d）

## Related Sources

- [[sources/back-642-draft-identity-fail-closed]] — 这些处理器复用的草稿查找器与 409 歧义映射
- [[sources/back-535-preserve-unsaved-web-drafts]] — 同一 UI 中的 Web 草稿状态处理
