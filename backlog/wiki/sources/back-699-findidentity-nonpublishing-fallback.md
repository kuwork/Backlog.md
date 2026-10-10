---
title: BACK-699 - findIdentity 回退未安装语料时不发布新鲜度
labels: [source, core, bug, cross-branch]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-699 - Stop-findIdentity-rename-fallback-from-publishing-freshness-without-installing-the-corpus.md
---

# BACK-699 - findIdentity 回退未安装语料时不发布新鲜度

任务文件被重命名或删除且分支侧无副本时，`ContentStore.findIdentity` 的重命名回退为解析一个身份加载整个语料然后丢弃——但这次加载走了发布式加载器，推进了 `Core.activeBranchFingerprint` 却没有安装任何东西。下一次读取随后跳过真正的刷新，提供移动前的过期分支内容。

## 解决方案

- `ContentStore` 新增 `TaskLoaderOptions = { publish?: boolean }`，从 `loadTasksWithLoader` 穿入 `taskLoader` 调用；重命名回退以 `{ publish: false }` 调用它，因为其加载只解析一个身份并被丢弃
- `src/core/backlog.ts`：Core 加载器闭包将该选项转发进 `loadContentStoreCorpus`，其 `publishSharedState` 默认为 `true`——因此 `loadCurrentContent` 与 `refreshTasksFromDisk` 保持发布，等语料也发布的行为被保留
- 触发条件比假设更窄：存储在绑定监视器后立即运行一次发布式配置稳定读取，安装了新鲜语料并掩盖指纹副作用——回归用例的第一个版本在未修复代码上就能通过
- 确定性来自 `settleInitialContentReload(store)` 助手，它经 `store.subscribe` 等待存储自身的 `config` 发布而非睡眠，因此 worktree tip 移动不会横跨初始重载
- 第二个回归用例（`reuses the warm store across reads`）在回滚变体 D（为安装式调用者翻转默认值）返回绿色后补加——没有任何东西固定安装式调用者仍发布；它数 `refreshTasks` 调用次数而非依赖时序
- 验证：三套件上的五变体回滚矩阵，每个变体恰好使其因果负责的用例变红；`core-task-corpus-regressions` 8 通过、`content-store` 16、`search-service` 7、`task-search-parity` 14；上游参考 `cd8f1297`（BACK-628）1:1 应用

## 验收标准

- 重命名回退要么安装它加载的语料，要么执行非发布式加载（选择了后者）
- 非发布式加载不再推进 `activeBranchFingerprint`；安装式调用者保持发布
- 回归测试复现触发条件（热语料、带外 worktree tip 移动、删除仅本地任务、读取）并在修复前失败

## Related Concepts

- [[concepts/task-identity]] — `findIdentity` 及其重命名回退
- [[concepts/core-architecture]] — ContentStore 发布与分支指纹

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — 回退所属的跨分支身份机制
- [[sources/back-601-core-browser-publication-ownership]] — 本修复遵循的发布所有权规则
- [[sources/back-602-incremental-cross-branch-task-loading]] — 回退误用的语料加载路径
- [[sources/back-540-content-store-stale-refresh-guard]] — 同一存储上的早期过期刷新防护
