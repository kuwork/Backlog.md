---
title: BACK-815 - 服务端缓存自愈（指纹对账）
labels: [source, server, web-ui, bug]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/tasks/back-815 - Server-cache-self-heal-via-fingerprint-reconciliation.md
---

# BACK-815 - 服务端缓存自愈（指纹对账）

Web UI 显示陈旧或错误数据、只能靠重启服务器恢复的根因修复。

## 根因

两个独立问题：

1. 服务端内存缓存**只靠 `fs.watch` 事件、无轮询兜底**；CLI 与服务器是独立进程，Windows 上 `rm`、空闲事件合并/溢出、或 watcher 静默失败都会让缓存永久陈旧。
2. Web 主数据 WebSocket **没有重连逻辑**，空闲断开后永远收不到后续广播。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/core/content-store.ts` | 新增 `FileFingerprint` Map 与启动基线 `seedFingerprintBaseline`（记录每个 task/doc/decision/wiki 文件的 mtime+size，必要时补内容哈希）；`reconcileFromFingerprints` + `scanCollectionFingerprints` 每 `BACKLOG_RESCAN_INTERVAL_MS`（默认 10000ms，最小 1000ms）扫描并与内存指纹表 diff，增/改/删经现有 refresh + 广播管线刷新；`reconcileDirectories` 覆盖 doc/wiki 空目录的增删对账；`wikiRoot()` 加防御性判空 |
| `src/web/App.tsx` | 主数据 WebSocket 加 `onclose`/`onerror` 驱动的自动重连（2s 退避），重连成功后对所有 scope 调 `refreshData()` 追赶 |
| `src/test/content-store-rescan.test.ts` | 新增：rm 删除自愈、带外 CLI 编辑捕获、doc/wiki 空目录增删对账、后台定时器自愈 |

删除路径改为显式调用 `removeWatchedTask`/`removeWatchedDocument`/`removeWatchedDecision`——reload 的 merge 会保护进程内 upsert，否则消失的文件永不剔除。watcher 错误改为调度 rebind 而非静默吞掉。

## 关键约束

- 周期扫描受 `enableWatchers` 门控：watcher 关闭时无自愈。
- 首次扫描静默存基线，不广播（修复首个扫描误发 documents/wikis 通知）。
- 指纹扫描与 watcher 事件去重（短生命周期 skip set），不覆盖进程内 upsert。

## Related Concepts

- [[concepts/web-server]] — 实时同步与广播机制
- [[concepts/live-sync-pattern]] — watcher 驱动的原地刷新三件套

## Related Sources

- [[sources/back-818-checklist-batching-broadcast-debounce]] — 同波的服务端广播防抖加宽
- [[sources/back-595-content-store-watcher-retry-rename]] — 更早的 watcher 重试/改名对账修复
- [[sources/back-639-document-fingerprint-reload]] — 按正文指纹变化重载打开文档
