---
title: 'BACK-757 - Resolve configured backlog directory for memo storage'
labels:
  - source
  - memos
  - bug
  - cli
created_date: '2026-10-09 22:00'
updated_date: '2026-10-09 22:00'
source_path: backlog/tasks/back-757 - Resolve-configured-backlog-directory-for-memo-storage.md
---

# Resolve configured backlog directory for memo storage

自定义数据目录（`backlog init --backlog-dir .backlog` 或 `backlog_directory` 配置）项目升级后 memo 功能损坏，两个独立缺陷：

1. **memo IO 无视配置的 backlog 目录**：`src/core/memos.ts` 的 `memoDir()` / `memoArchiveDir()` 硬编码 `DEFAULT_DIRECTORIES.BACKLOG`（`"backlog"`），是全仓唯一没走 `resolveBacklogDirectory()` 的产物面。browser server 的 `startMemoWatcher()` 盯着 `backlog/memos` 抛 ENOENT，memo 读写全部落错目录。
2. **重跑 init 不补建结构**：`src/core/init.ts` 的 `initializeProject()` 在重初始化分支只调 `saveConfig()`，漏掉 `ensureBacklogStructure()`，升级后重跑 `backlog init` 不会补建缺失的 `memos/`、`docs/`（wiki 根）。

修复：`memoDir()` / `memoArchiveDir()` 经 `resolveBacklogDirectory(root)` 解析、未配置时回退 `"backlog"`；re-init 分支在 `saveConfig()` 前调 `ensureBacklogStructure()`（递归、幂等、自身也解析配置目录）。memo 是纯模块，直接调用解析函数而非 threading filesystem 实例。路径逃逸安全守卫（refuses an id that would escape the memo directory）保持不变。回归用例锁定 `.backlog` 项目下 `memoDir` 解析到 `.backlog/memos` 并覆盖读写。

## Related Concepts

- [[concepts/memos]] — memo 存储模块与目录解析
- [[concepts/core-architecture]] — FileSystem 的 `getBacklogDir()` / `resolveBacklogDirectory` 单一解析点

## Related Sources

- [[sources/back-758-graph-backlog-dir-resolution]] — 同一根因家族在图谱面的修复（本任务的依赖后继）
- [[sources/back-747-memo-archiving]] — memo 归档目录（同属 memo 目录体系）
