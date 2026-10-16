---
title: BACK-798 - 修复缺 backlog/wiki 时 wiki 树请求崩溃刷屏
labels: [source, bug, web, wiki]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-798 - Web-server-crashes-wiki-tree-request-when-backlog-wiki-is-missing.md
---

# BACK-798 - 修复缺 backlog/wiki 时 wiki 树请求崩溃刷屏

Wiki 是可选功能，但在没有 `backlog/wiki` 目录的项目里启动 web 服务器时，`FileSystem.getWikiTree()` 从 `buildWikiTreeRecursive`（`src/file-system/operations.ts:2608`）抛 ENOENT，经 `handleGetWikiTree`（`src/server/index.ts:1889`）在每次 wiki 树请求时打一整段错误栈。handler 本已回退空树，用户可见结果是对的，但控制台噪音把正常的可选功能状态弄得像故障。`listWikiPages()` 早已容忍缺失 wiki 目录，`getWikiTree()` 没有。

## 问题

`getWikiTree()` 对缺失目录抛 ENOENT，与同模块 `listWikiPages()` 的容忍行为不一致；用户可见结果正确（空树），仅日志噪音。

## 解决方案

在 `getWikiTree()`（`src/file-system/operations.ts:2575`）用 try/catch 包住 `buildWikiTreeRecursive`：ENOENT 时打一条含 wiki 根路径的 `console.warn` 并返回 `[]`；其他错误原样 rethrow，真实故障仍经 `handleGetWikiTree` 的错误处理上报。行为对齐 `listWikiPages()`。

## 验证

`src/test/filesystem.test.ts` 新增回归用例 'returns an empty tree when the wiki directory is missing'（删掉 wiki 目录断言空结果，并给 `node:fs/promises` import 补 `rm`）。`bun test src/test/filesystem.test.ts` 76 通过 / 0 失败；`bunx tsc --noEmit` 干净。

## Related Concepts

- [[concepts/web-server]] — wiki 树 HTTP handler 的错误面

## Related Sources

- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 区域文件树，本端点服务的页面
- [[sources/back-672-wiki-tree-sort-toggles]] — wiki 树排序开关，同一数据通路
