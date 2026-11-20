---
title: BACK-857 - 磁盘缓存失败下的分支加载稳定性
labels: [source, core, cache, windows, bugfix]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-857 - Keep-branch-task-loading-stable-when-disk-cache-writes-fail.md
---

# BACK-857 - 磁盘缓存失败下的分支加载稳定性

Windows 写 commit-index JSON 缓存出现 `EPERM` 时，不再丢弃已经成功构建的 Git 内存索引；磁盘持久化降级为优化而非正确性前提。

## 问题

共享 `.tmp` 文件会让并发服务器冲突。写失败曾拒绝整次分支加载、清除内存 promise 并留下空 fingerprint，浏览器搜索轮询因此每隔几秒重建未变化提交，形成持续 Git I/O 放大。

## 解决方案

- 原子缓存临时文件名加入 PID 与时间戳，最终内容寻址路径保持不变。
- rename 复用共享 Windows 锁冲突重试助手。
- commit-index 写入与 task-bundle 一样 best-effort：内存索引与 fingerprint 继续有效，重复 unchanged refs 直接复用。
- 回归测试用普通文件冒充缓存根目录，强制全部磁盘写入失败，验证不会重复读取 Git tree/history。

## 验证

30 项 loader 测试通过；真实仓库连续三次 `refreshTasksForTaskRead` 均 `changed=false`，fingerprint 稳定，内存保留 8 个 commit indexes。TypeScript、Biome 与 `git diff --check` 通过。

## Related Concepts

- [[concepts/browser-startup-cache]] — 缓存只加速、内存结果仍正确的原则
- [[concepts/web-server]] — 搜索轮询与分支刷新成本

## Related Sources

- [[sources/back-843-browser-startup-cache]] — 分支缓存与启动性能背景
- [[sources/back-861-graph-startup-warmup-snapshot]] — 同期将派生缓存用于 Web 图谱
