---
title: 用快照内容摘要而非事件版本号抑制冗余刷新
labels: [decision, core, server, web-ui, websocket, performance]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
---

# 用快照内容摘要而非事件版本号抑制冗余刷新

## 背景

BACK-840 要消除「一次 UI 编辑 → 3~4 次 `/api/search`」。服务端在 1.1~6.9 秒内发出三条 `tasks-updated` 广播（进程内 patch、逐文件 watcher、根 watcher / 周期重扫），BACK-818 的 300ms 防抖与客户端静默窗口都盖不住这个尺度的扇出。

## 决定

服务端计算一个**由 ContentStore 快照派生**的稳定摘要，广播与 `/api/search` 都携带它；每个客户端在内存里保存「服务端摘要」与「上次同步游标」，相等就跳过刷新。摘要对全量已解析实体集合（tasks、completed、documents、decisions、wikis）做稳定键排序 + SHA-256，排除易变 provenance 键（`source`、`filePath`、`mtime`）。

## 被否方案与代价

| 替代 | 为什么否 |
|---|---|
| 用 `ContentStoreEvent.version` 作游标 | 内存事件计数器：echo 会推进、重启归零、跨实例不一致，同一批文件算不出同一值 |
| 只哈希 `Task.rawContent` | rawContent **不含 frontmatter**，status / priority 编辑会得出相同摘要，客户端跳过它唯一一次刷新 —— 有专门的 frontmatter-only 回归测试守这条 |
| 用 `/api/search` 结果集算摘要 | 结果集受查询/范围过滤影响，客户端会宣称同步了它没有持有的数据；且服务端摘要必须独立于任何一次请求 |
| 用 watcher 事件的 source tag 区分写入者去重 | watcher 事件不带身份，无法可靠区分；去重必须 fail-open |
| 加大客户端静默窗口到数秒 | 每次孤立刷新都被延迟，用交互实时性换去重，方向错误 |
| 取消纯字符串广播、只发 JSON | 会破坏旧客户端；保留裸串是硬约束 |

## 关键约束

- **只有两个全量加载器**可以用 `searchWithDigest` 推进游标；五个查询/过滤调用方一律忽略摘要。
- 摘要必须在**广播窗口开始**采样一次并整窗复用，且 `/api/search` 在读完快照后采样，否则 watcher 重读造成的 D1→D2→D1 抖动会让跳过判定失效（BACK-841）。
- WebSocket **open** 时必须先播种摘要，否则首载后第一次编辑必然 fail-open（BACK-841）。
- 失败方向只能是「多刷一次」：首载、重连、缺失/未知/不一致摘要一律刷新；游标不持久化、失败或超时不写。

## 验证证据

25 个文件 177 个作用域测试；干净的 CDP pass（525 任务）显示状态变更只发一次 `/api/search`，`corpus-state` 比 `tasks-updated` 早 1ms。该 pass 还暴露并修复了并发刷新 request-id supersede 导致游标从不写入、刷新途中广播引发竞争请求两个真实缺陷。长窗口 pass 因第二实例争抢 graph lock 未完成加载，明确不计入验证。

## Related Concepts

- [[concepts/corpus-digest]] — 完整规则与分层
- [[concepts/web-server]] — 广播与响应头通路

## Related Sources

- [[sources/back-840-corpus-digest-refresh-skip]] — 裁决与备选否因
- [[sources/back-841-corpus-digest-gap-fixes]] — 首载与抖动缺口
- [[sources/back-818-checklist-batching-broadcast-debounce]] — 前置的 300ms 防抖
