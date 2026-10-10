---
title: BACK-745 - memo 搜索语料刷新的 stat 签名门控
labels: [source, core, memos, search, performance]
created_date: 2026-10-03 09:25
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-745 - Memo-搜索语料刷新加-stat-签名门控.md
---

# BACK-745 - memo 搜索语料刷新的 stat 签名门控

## 问题

Memos（快速笔记）预期成为数量最多的文件实体，而 SearchService 每次刷新 memo 语料都全量 glob 扫描并逐个重读 `backlog/memos/` 下所有文件（listMemos 无缓存层），且 `handleStoreEvent` 对任何 store 变更都无条件触发全量重载——与「memo 刻意不进 ContentStore 快照」的设计矛盾（memo 变更本不发 store 事件，这条路径纯属空转）。此外每次 memo 重载都 `rebuildIndex()` → 全量重建 Fuse 索引（任务+文档+决策+wiki+memo），放大所有实体的索引成本。

## 解决方案

方案借鉴 BACK-744 的 stat 签名（name+size+mtime+ctime，一层深目录扫描，远便宜于全量读）：

- `filesSignature` 从 `src/commands/watch-json.ts` 抽到新共享模块 `src/utils/files-signature.ts`（watch-json 重导出，既有引用不变）
- `src/core/memos.ts` 新增 `memosSignature(root)`：对 memo 目录的一层 stat 扫描
- `SearchService` 构造函数接受可选第三个注入 `memosSignature`；`refreshMemos()` 先比对签名，未变化则跳过重读、仅重置 500ms 新鲜度时钟；签名变化（含增删改）走全量重载
- `handleStoreEvent` 改走统一门控 `refreshMemosWhenStale()`（签名 + TTL），不再无条件全量重载
- 评审后补关键修复：`dispose()` 必须重置 `memosSignatureSeen`/`memosLoadedAt`——否则销毁重建的服务会因「时钟陈旧 + 签名未变」跳过重载，memo 从索引中静默消失

## Related Concepts
- [[concepts/memos]] — memo 语料获取与搜索索引机制（本文档更新其「全局搜索」一节的刷新语义）
- [[concepts/json-watch]] — BACK-744 stat 签名方案的出处

## Related Sources
- [[sources/back-733-include-memos-in-global-search]] — 前置任务：memo 接入全局搜索（注入 loader + TTL 机制）
- [[sources/back-744-watch-idle-cpu-signature]] — filesSignature 方案来源
- [[sources/back-728-memo-storage-layer]] — memo 独立存储、不进 ContentStore 的设计前提
- [[execution/two-list-paging-models-wiring]] — 同期重构的另一组共享分页模块
