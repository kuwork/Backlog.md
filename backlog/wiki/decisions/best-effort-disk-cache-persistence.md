---
title: 磁盘缓存持久化采用 best-effort
labels: [decision, cache, windows, performance]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
---

# 磁盘缓存持久化采用 best-effort

## 背景

BACK-857 中 Windows `EPERM` 让 commit-index 写盘失败，进而丢弃已经成功构建的 Git 索引并清空 fingerprint。磁盘缓存本来只是跨进程优化，却成了分支加载正确性的单点故障。

## 决定

commit-index 与 task-bundle 持久化都采用 best-effort：写盘失败不拒绝 Git 构建结果，内存索引和 fingerprint 保留；临时文件按 PID + 时间戳隔离，rename 使用 Windows 重试。

## 理由

同一进程内 unchanged refs 只需内存索引即可保证正确与去重。磁盘不可用最多损失下一次进程的 warm start，不应把当前进程拖入持续全量重建。

## 被否方案

- 写失败即整次加载失败：把可选优化升级为正确性依赖。
- 所有进程共享固定 `.tmp`：并发冲突仍然存在。
- 失败后无限重试：会让空闲搜索轮询持续阻塞，不能替代内存复用。

## Related Concepts

- [[concepts/browser-startup-cache]] — 各缓存层与正确性边界
- [[concepts/web-server]] — 分支刷新与搜索轮询宿主

## Related Sources

- [[sources/back-857-cache-write-failure-stability]] — 决策与真实仓库验证
