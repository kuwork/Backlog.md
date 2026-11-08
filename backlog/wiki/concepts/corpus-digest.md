---
title: 语料摘要与刷新抑制
labels: [concept, web-ui, core, server, websocket, performance]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# 语料摘要与刷新抑制

一次 UI 编辑原先会产生 3~4 次客户端 `/api/search`：`onSaved` 一次，加上服务端在数秒内扇出的三条 `tasks-updated` 广播（进程内 ContentStore patch、逐文件 fs.watch、根 watcher / 周期重扫）各一次。BACK-818 的 300ms 防抖覆盖不了以秒计的回声。BACK-840/841 用**服务端拥有的内容摘要 + 客户端游标**把回声折叠掉。

## 摘要怎么算

`computeCorpusDigest` 哈希 `ContentStore.getSnapshot()` 的整个已解析实体集合（tasks、completed bucket、documents、decisions、wikis），键稳定排序后 SHA-256，并排除易变的 provenance 键（`source`、`filePath`、`mtime`）—— 否则进程内 upsert 与 watcher 重读同一文件会算出不同摘要。

两个刻意否掉的替代：

- **不用 `Task.rawContent`**：它不含 frontmatter，只用它会让 status / priority 编辑摘要不变，客户端跳过它唯一一次刷新。有专门的 frontmatter-only 回归测试。
- **不用 `ContentStoreEvent.version`**：内存事件计数器，echo 会推进、重启归零、跨实例不一致，不满足「同一批文件 → 同一摘要」。

## 传输与游标

- WebSocket **open** 时（services ready 后）先发一条 `corpus-state` 播种客户端，否则首载后第一次编辑必然 fail-open（BACK-841 缺口一）。
- 每个 data-change 广播窗口前发一条 JSON `corpus-state`，摘要在**窗口开始**采样一次并整窗复用，与编辑后 `/api/search` 读到的是同一快照（BACK-841 缺口二，消除 D1→D2→D1 抖动）。
- `/api/search` 在搜索读完快照后把摘要放进 `X-Corpus-Digest`，游标**永不领先于响应数据**。
- 纯字符串广播（`tasks-updated` 等）一条不少，忽略 `corpus-state` 的旧客户端行为完全不变。

客户端内存持有 `serverCorpusDigestRef`（广播）与 `lastSyncedDigestRef`（全量加载响应），相等即跳过 `refreshData`；`refreshInFlightRef` 串行化刷新。游标在 `Promise.all` 解析时、supersede 判断之前写入，失败或超时不写，也不落 localStorage。

## 谁能推进游标

**只有两个全量加载器**（`loadAllData`、`refreshTasksData`）用 `searchWithDigest`。SearchDialog、TaskList、TaskDetailsModal 自动补全、`useCompletedTasks`、`refreshDocumentsData` 这五个查询 / 过滤调用方一律用 `search` 并忽略摘要 —— 一次范围搜索不能让客户端宣称同步了它没有持有的数据。这是 L1 里最容易被后续优化破坏的一条约束。

## Fail-open 是设计前提

首载、重连追平、未知或缺失摘要、摘要不一致、合并了多次编辑的窗口，全部照常刷新。watch event 不带写入者身份，所以 source tag 去重被排除；范围过滤搜索与实体 delta 留给后续层级。整个机制的失败方向必须是「多刷一次」，不能是「漏刷」。

## 与相邻治理的分工

| 层 | 管什么 | 任务 |
|---|---|---|
| 写入侧 | 五个内联元数据字段合并成一次 PUT，消除自伤型文件锁 409 | BACK-839 |
| L1 | `/api/search` 全量刷新 | BACK-840/841 |
| 副作用 | `/api/task/:id/dependencies`、`/api/tasks`、`/api/drafts` | BACK-842 |

三者互不覆盖：摘要再完美也管不到弹窗自己发起的预载请求。

## Related Concepts

- [[concepts/web-server]] — 广播合并窗口与 `/api/search` 摘要头
- [[concepts/web-ui-features]] — 客户端刷新路径
- [[concepts/browser-startup-cache]] — services ready 时序决定连接播种时机

## Related Sources

- [[sources/back-840-corpus-digest-refresh-skip]] — L1 主体
- [[sources/back-841-corpus-digest-gap-fixes]] — 两处缺口
- [[sources/back-842-reduce-modal-side-effect-requests]] — L1 之外的请求
- [[sources/back-818-checklist-batching-broadcast-debounce]] — 300ms 广播防抖前身
