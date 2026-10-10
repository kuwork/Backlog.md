---
title: BACK-660 - 强制分配刷新不加入过期抓取
labels: [source, core, git, concurrency, upstream-migration]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-660 - Prevent-forced-allocation-refresh-from-joining-an-in-flight-stale-fetch.md
---

# BACK-660 - 强制分配刷新不加入过期抓取

任务 ID 分配会越过 60 秒租约强制刷新远端引用，但 `Core.refreshRemoteRefsForTaskRead` 只在单一 promise 槽为空时才发起新抓取——强制调用落在一个非强制抓取进行中时会加入那个过期抓取，导致其余持续时间内到达的 push 不可见，分配可能发出另一个克隆已发布的 ID。强制路径现在会等待进行中的刷新结束后再加入或发起抓取。

- 强制前等待：强制请求到达时，单一 `remoteRefRefreshPromise` 槽中的任何 promise 都早于该请求启动，因此强制路径先 await 它；槽的清理处理器在任何后续 continuation 之前清空槽，因此下方加入的抓取一定在该请求之后启动——非强制读取保持原有的 join-or-start 合并行为
- 等待后重查 git 句柄：异步等待打开了交错窗口，`reinitializeProjectRoot` 会清空槽并替换 `this.git`/`this.fs`；没有重查的话，强制 continuation 会把旧 root 的抓取停在新项目的槽里
- 移植的方法体与上游修复后版本逐字节一致；唯一的 fork 调整是把 force 判断提升为局部变量，让租约检查与前置等待读取同一标志
- 已记录未修复的残留风险：请求后的抓取期间到达的 push 仍不可见（需要服务端预留），且 `generateNextDocId`/`generateNextDecisionId` 直接调用 `core.gitOps.fetch()`，绕过 Core 槽
- 测试发现：本机沙箱运行无法在工作区内创建 `refs/remotes/origin/*`（一个预先存在的同级分配用例在这里无论如何都会失败），因此新的端到端竞态用例在检出目录外用 `mkdtemp()` 构建项目
- 四个回归用例：端到端分配竞态（门控 `git.fetch` + 并发 `generateNextId()` 恰好 2 次抓取越过已 push 的任务）、等待后抓取契约、无进行中抓取时单次抓取、等待期间 root 交换

## 验收标准

- 另一个抓取进行中到达的强制刷新会等待其结束再自行抓取
- 无进行中抓取时强制刷新只发出一次抓取；非强制请求保持 join-or-start 合并
- 等待会重查 git 句柄，项目 root 交换不会把旧 root 抓取停在新项目槽里
- `Core.refreshRemoteRefsForTaskRead` 与上游修复后方法体逐字节一致
- 回归测试覆盖 push 落在进行中抓取期间的分配竞态、等待后抓取、单次抓取与 root 交换

## Related Concepts
- [[concepts/core-architecture]] — Core 的远端引用刷新槽与分配路径
- [[concepts/task-identity]] — 跨克隆数字 ID 分配正确性
- [[concepts/upstream-migration]] — 移植上游 BACK-627（bc79cba50）

## Related Sources
- [[sources/back-571-fail-fast-concurrent-task-edits]] — Core 中的同级并发加固工作
- [[sources/back-538-duplicate-task-id-recovery]] — 分配竞态可能产生的故障模式
