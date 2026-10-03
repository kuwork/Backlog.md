---
title: 'BACK-729 - Memo HTTP API: /api/memos routes'
labels:
  - source
  - feature
  - web-ui
  - api
created_date: '2026-10-03 01:07'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-729 - Memo-HTTP-API-api-memos-routes.md
---

# BACK-729 - Memo HTTP API: /api/memos routes

BACK-728 存储层落地后，Web UI 和任何脚本都无法触达 memos，构建 Memos 页面前必须先有 HTTP 端点。本任务镜像既有 docs 路由，在 src/server/index.ts 的 Bun 路由表中加入 memo 路由，是后续所有 UI 任务的契约基础。

设计原则：server 层不做任何文件写入——handler 只校验输入、调用 src/core/memos.ts、广播。路由集：GET/POST /api/memos（列表带 limit/cursor/date 分页 + 创建）、GET /api/memos/calendar（按月返回 {"YYYY-MM-DD": count} 每日计数）、GET/PUT/DELETE /api/memos/:id。刻意排除 /api/memos/:id/promote（不在本里程碑）和 pinned（v2）；server 设计上无认证（回环绑定），不加 auth。

关键实现点：DataUpdatedScope 联合类型新增 "memos"，broadcastDataUpdated 发出 memos-updated websocket 消息——memos 不在 ContentStore 中，不会自动收到 store 事件广播，所以每次写操作后 handler 必须显式广播。tag 归一化与 parseDocumentTags 共享 parseTagList()；memo id 用白名单正则校验，路径穿越（如 ..%2F..%2Fconfig.yml）返回 400。路由冲突验证：通过真实请求和隔离的 Bun.serve 探针确认 Bun 无论注册顺序如何都让字面量段 /api/memos/calendar 优先于 :id 参数段，calendar 路由仍先注册以保证可读性。DELETE 返回 204（遵循 doc-20 附录 B 的 API 草案）。

结果：server-memos-endpoint.test.ts 13 个测试通过（分页、日期过滤、400/404 路径、calendar 计数、calendar-vs-:id 路由冲突、路径穿越、websocket 广播），六端点全量 live smoke 通过（记录在 Implementation Notes），tsc 与 biome 干净。

## Related Concepts

- [[concepts/web-server]] — Bun 路由表、广播与回环绑定的 server 架构
- [[concepts/core-architecture]] — handler 只校验并委托 core 模块的分层约定
- [[concepts/memos]] — /api/memos 路由所属的 memos 子系统与显式 memos-updated 广播约定

## Related Sources

- [[sources/back-728-memo-storage-layer]] — 本 API 委托的存储层（依赖 BACK-728）
- [[sources/back-731-memos-feed-page]] — 消费本 API 的 /memos 页面任务（依赖 BACK-729）
- [[sources/web-server-task]] — docs 路由的原始实现，memo 路由所镜像的蓝本
