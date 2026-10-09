---
title: 'BACK-758 - Resolve configured backlog directory for graph scanning and watching'
labels:
  - source
  - graph
  - kuzu
  - bug
created_date: '2026-10-09 22:00'
updated_date: '2026-10-09 22:00'
source_path: backlog/tasks/back-758 - Resolve-configured-backlog-directory-for-graph-scanning.md
---

# Resolve configured backlog directory for graph scanning and watching

BACK-757 修复 memo 存储后，自定义目录（`.backlog` / 自定义 `backlog_directory`）项目的**任务图谱与知识图谱仍为空**。`src/graph/scanner.ts` 的 `scanWhitelistedDirs()` 与 `src/graph/service.ts` 的 watcher 目录拼接硬编码字面量 `"backlog"`：

```ts
const absDir = join(projectRoot, "backlog", dirs[dirName]);      // scanner.ts
const dir    = join(this.projectRoot, "backlog", dirs[dirName]); // service.ts watcher
```

`.backlog` 项目下扫描器扫不到任何语料文件返回 0 个节点，监听也只盯 `backlog/`。修复：两处都改经 `resolveBacklogDirectory(projectRoot).backlogDir ?? DEFAULT_DIRECTORIES.BACKLOG`。图数据库本体存于全局缓存目录（`AppData/Local/backlog.md/graph`，`src/graph/paths.ts` 的 `graphPaths()`），从不依赖项目内 backlog 目录，无需变更——只有"语料扫描"与"监听"两处走错路径。回归用例：`.backlog` 项目（config.yml + tasks/ + docs/）扫描到全部文件且 `absPath` 落在 `/.backlog/`。

这是 BACK-757 的同根因家族最后一个面：此后 tasks/docs/decisions/memos/graph 全部产物面都尊重配置目录。

## Related Concepts

- [[concepts/kuzu-graph]] — 图谱扫描、热更新 watcher 与全局缓存目录布局
- [[concepts/core-architecture]] — `resolveBacklogDirectory` 单一解析点

## Related Sources

- [[sources/back-757-memo-backlog-dir-resolution]] — 同根因的 memo 面修复（本任务的依赖前驱）
- [[sources/back-702-kuzu-graph-foundation]] — 图谱 foundation 与扫描器
