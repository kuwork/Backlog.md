---
title: BACK-733 - Include memos in global search
labels:
  - source
  - feature
  - web-ui
  - cli
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 09:25'
source_path: backlog/tasks/back-733 - Include-memos-in-global-search.md
---

# Include memos in global search

Memos（快速笔记）最初完全游离于 SearchService 之外，用户上周记的笔记在全局搜索对话框里完全不可见，这正是 Memos 用户"找不到我的笔记"的核心抱怨。本任务要求让 memo 成为全局搜索的一种结果类型，与任务、文档、决策、wiki 并列。

实现上，在 `src/types/index.ts` 中给 SearchResultType 增加 "memo" 成员，并新增 MemoSearchResult 变体（携带 Memo 与可选 matches）加入 SearchResult 联合类型。关键在于 Memos 刻意不进入 ContentStore 快照，因此 SearchService 通过注入的 loader（`() => listMemos(filesystem.rootDir)`，来自 src/core/backlog.ts 的构造点）获取 memo 语料，并新增 MemoSearchEntity 供 Fuse 索引使用。

由于 memo 写入不发出 store 事件，索引构建时重新加载语料，并在索引超过 500ms 未刷新时后台刷新一次，保证启动后新捕获的 memo 在下一次请求即可被搜到，无需重启；`refreshMemos()` 公开给需要显式等待的调用方。无查询时 memo 也走既有的 collectWithoutQuery 路径，不遗漏。web 搜索对话框为 memo 增加了筛选 tab、分组标签、图标色、行 id 和指向 `/memos?date=<day>` 的链接（memo 没有独立详情路由）；若无这些分支，memo 结果会落到 task 形状上并在 undefined 字段上崩溃。CLI JSON 输出新增 MemoSummaryJson 形状，纯文本输出则跳过 memo（与 wiki 结果同样视为 web-only）。

服务端 /api/search 的类型白名单原先只有四类，曾对 type=memo 返回 400；修复后白名单包含 memo，且错误消息直接从列表派生，避免再次漂移。验证：新增 src/test/memo-search.test.ts 8 个测试，连同 search-service 与 server-search-endpoint 共 28 个测试全绿，并做了真实 HTTP 冒烟（带 type 过滤、不带过滤、非法 type 拒绝）。

> 注（2026-10-03 复核）：任务书中「下一次请求即可被搜到」是简化说法。`refreshMemosWhenStale()` 触发的重载是异步非阻塞的（search-service.ts），触发刷新那一次搜索仍返回旧语料，新 memo 在重载完成后的第一次搜索才命中；最坏为触发后的第二次搜索。500ms 是语料年龄 TTL，非严格定时。`refreshMemos()` 目前尚无 memo 写入路径调用（写入只走 `memos-updated` 客户端广播，不经搜索服务）。后续 BACK-745 为刷新加入 stat 签名门控（签名未变跳过重读）并修复 dispose 后状态残留，机制细节见 [[sources/back-745-memo-corpus-signature-gate]]。

## Related Concepts
- [[concepts/spotlight-search]] — 全局搜索/Fuse 索引架构，本任务在其上增加 memo 结果类型
- [[concepts/search-sequences]] — 搜索相关命令序列与 SearchService 的边界
- [[concepts/core-architecture]] — ContentStore 快照与外部语料（memos）的分离是本任务的核心设计约束
- [[concepts/memos]] — memo 结果类型与注入式 loader 所属的 memos 子系统

## Related Sources
- [[sources/back-685-single-source-task-search]] — 单一搜索来源的架构背景，memo 接入同一 SearchService
- [[sources/back-686-shared-search-consumers]] — 搜索消费者的共享约定，memo 结果映射遵循同一套 meta/link 约定
- [[sources/back-734-memos-knowledge-web-links]] — 同一里程碑内让 memo 正文接入实体自动链接的配套任务
- [[sources/back-735-memos-realtime-sync]] — 同一里程碑内让 memo 变更实时广播到 web 的配套任务
