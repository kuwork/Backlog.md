---
title: BACK-840 - 语料摘要抑制冗余任务刷新
labels: [source, web-ui, core, server, performance]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-840 - Skip-redundant-task-refreshes-with-a-corpus-digest.md
---

# BACK-840 - 语料摘要抑制冗余任务刷新

CDP 把 WebSocket 广播与浏览器请求对齐后发现：一次 UI 编辑产生一个来自 `onSaved` 的 `/api/search`，外加每个 `tasks-updated` 广播一个；服务端在 1.1~6.9 秒内发出三条广播（进程内 ContentStore patch、逐文件 fs.watch、根 watcher 与周期重扫）。BACK-818 的 300ms 防抖盖不住以秒计的扇出，客户端静默窗口也不能在不延迟每次孤立刷新的前提下覆盖。

## L1 方案：服务端拥有的摘要 + 客户端游标

- `computeCorpusDigest` 对 `ContentStore.getSnapshot()`（tasks、completed、documents、decisions、wikis）做**稳定键排序 + SHA-256**，排除易变的 provenance 键（`source`、`filePath`、`mtime`），使进程内 upsert 与 watcher 重读同一文件得到同一摘要。摘要在重启与多实例间对同一批文件保持稳定。
- 刻意**不用 `Task.rawContent`**：rawContent 不含 frontmatter，只用它会让 status / priority 编辑摘要不变，客户端跳过唯一一次刷新（有专门的回归测试）。也**不用 `ContentStoreEvent.version`**：那是内存事件计数器，echo 会推进、重启会归零、实例间不一致。
- 每次 data-change 广播前发一条 JSON `corpus-state` 摘要消息，原有的纯字符串广播**一条不少**（旧客户端照常刷新）。`/api/search` 在搜索读完快照之后把摘要放进 `X-Corpus-Digest`，游标永不领先于响应数据。
- 客户端在内存里持有 `serverCorpusDigestRef`（来自广播）与 `lastSyncedDigestRef`（来自全量加载响应），相等就跳过 `refreshData`；`refreshInFlightRef` 串行化刷新，避免广播落到 1~2 秒刷新途中又发起竞争请求。游标在 `Promise.all` 解析时、supersede 判断之前写入，失败/超时绝不写，也不落 localStorage。
- **只有两个全量加载器**（`loadAllData`、`refreshTasksData`）用 `searchWithDigest`；SearchDialog、TaskList、TaskDetailsModal 自动补全、`useCompletedTasks`、`refreshDocumentsData` 这五个查询/过滤调用方一律忽略摘要，防止一次搜索就让客户端宣称同步了它没有持有的数据。

## Fail-open

首载、重连追平、未知或缺失摘要、摘要不一致，全部照常刷新。source tag 被排除：watcher 事件不带写入者身份，去重必须 fail-open。范围过滤搜索与实体 delta 留给后续任务。

## 验证与遗留

`tsc --noEmit`、`bun run check .`、25 个文件 177 个作用域测试通过。一次干净的 CDP 浏览器 pass（525 任务）显示状态变更只发一次 `/api/search`（此前 3-4 次），`corpus-state` 比 `tasks-updated` 早 1ms。pass 暴露并修复了两个真实问题：并发刷新触发 request-id supersede 导致游标从不写入、刷新途中广播引发竞争请求。长窗口 pass 因第二个服务端实例争抢 graph lock 未能完成加载，明确**不作为验证**。任务留了待用户验收的注释：重启 browser 后在 Network 面板确认一次编辑一次搜索。

## Related Concepts

- [[concepts/corpus-digest]] — 摘要计算、游标与 fail-open 规则
- [[concepts/web-server]] — 广播与 `/api/search` 摘要通路
- [[concepts/web-ui-features]] — 刷新抑制的客户端落点

## Related Sources

- [[sources/back-839-batch-inline-metadata-edits]] — 前置的写入风暴治理
- [[sources/back-841-corpus-digest-gap-fixes]] — 首载与抖动两处缺口
- [[sources/back-842-reduce-modal-side-effect-requests]] — L1 范围外的副作用请求
