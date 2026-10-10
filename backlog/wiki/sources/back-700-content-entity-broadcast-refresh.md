---
title: BACK-700 - 内容实体变更广播与原位刷新
labels: [source, web-ui, live-refresh]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-700 - Broadcast-content-entity-changes-documents-decisions-wikis-and-refresh-them-in-place-in-the-Web-UI.md
---

# BACK-700 - 内容实体变更广播与原位刷新

直接在 `backlog/docs/` 下创建文档从未到达 Web UI 的文档列表：`broadcastDataUpdated` 只有 tasks/milestones 作用域，因此 document/decision/wiki 的 store 事件会落到 `tasks-updated` 上，客户端也只为它们重新拉取 `/api/search`。现在这三种内容实体拥有自己的作用域、消息和单列表原位刷新。

## 实现要点

- 服务端（`src/server/index.ts`）：新增 `DataUpdatedScope` 联合类型（tasks | milestones | documents | decisions | wikis）；单一的 pending 作用域字段改为集合，因此在 75 ms 去抖窗口内 tasks/milestones 保持合并取最宽（milestones 优先），documents/decisions/wikis 则作为各自独立的消息下发——混合窗口内互不吞并
- content-store 的订阅把 `event.type` 直接映射为作用域，类型化事件不再借用 `tasks-updated`；所有写端点都经由 `core.filesystem`，因此 store 监视器覆盖所有写入方（CLI/TUI/MCP/外部编辑），无需逐端点改动
- 客户端（`src/web/App.tsx`）：在 tasks/milestone 机制旁新增三个刷新回调——`refreshDocumentsData`（带 `type=document` 的 search + `fetchDocsTree`，`deepEqual` 保持树引用）、`refreshDecisionsData`（`fetchDecisions` + `reconcileById`）、`refreshWikisData`（`fetchWikiTree` + `deepEqual`）——当 store 从未加载或上次加载失败时各自回退到 `loadAllData`；每条消息对应一个 `ws.onmessage` 分支，只重新拉取匹配的列表
- 决策：内容刷新刻意不进入 tasks 的 `dataRequestRef`/`pendingScopeRank` 机制——这些拉取都是幂等 GET，`reconcileById` 会把未变化的响应变成状态层面的 no-op，因此不需要跨作用域的取代逻辑（simplicity-first）
- 客户端真正的缺口在 `docsTree`/`wikiTree`（只在 `loadAllData` 中加载）；docs 和 decisions 列表本就已从搜索结果 reconcile——难以区分的 `tasks-updated` 消息是缺口在广播侧的另一半
- 测试：`server-content-broadcast.test.ts` 4/4（每个实体发布自己的消息；task+document 混合窗口两者都送达），`web-content-in-place-refresh.test.tsx` 4/4（原位刷新、对象标识保持、其他实体列表不重新拉取），`server-milestone-broadcast` 2/2 作为相邻回归；测试在 `/api/tasks` 后需要约 1.5 s 等待，因为监视器绑定被推迟到 corpus 响应之后
- 边界：内容详情页内的编辑流程不在范围内——只保证列表新鲜度；批量 server-*/web-* 回归因本地 Git Bash netapi32.dll 崩溃本会话未能运行（环境问题，非代码问题）

## 验收标准

- 每个内容实体拥有独立作用域和专用消息；内容写入与 store 事件绝不借用 `tasks-updated`；task/milestone 语义不变
- 同一实体的重复变更按去抖窗口合并；混合窗口的变更作为独立消息下发
- 客户端每条消息只重新拉取一个匹配列表，并通过 `reconcileById` 保持对象/数组标识
- 端到端：在 `backlog/docs/` 下创建的文件原位出现，且不发起其他实体列表的请求

## Related Concepts

- [[concepts/web-server]] — 作用域广播协议与去抖语义
- [[concepts/web-ui-features]] — 应用外壳中的文档/决策/wiki 列表
- [[concepts/markdown-pipeline]] — 被刷新的内容实体

## Related Sources

- [[sources/back-698-web-in-place-refresh]] — 本任务扩展到内容实体的作用域与 reconcile 模式
- [[sources/wiki-web-ui-task]] — 由 `wikis-updated` 刷新的 wiki 树页面
- [[sources/back-540-content-store-stale-refresh-guard]] — 其类型化事件驱动各作用域的 content-store 监视器
