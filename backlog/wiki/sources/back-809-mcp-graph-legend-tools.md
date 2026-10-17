---
title: BACK-809 - MCP: graph_legend_get/set/remove 工具
labels: [source, docs, mcp, graph]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/tasks/back-809 - MCP-graph_legend_get-set-remove-tools.md
---

# BACK-809 - MCP: graph_legend_get/set/remove 工具

**状态**: Done | **里程碑**: m-16 | **依赖**: BACK-806

把图例配置暴露给 MCP 代理：此前代理只能用 CLI 或手改 YAML，MCP 使用指南的图例章节记录的是替代做法而非工具本身。三个工具全部复用 `src/graph/legend-store.ts`，无第二存储路径。

## 工具契约

| 工具 | 语义 |
|---|---|
| `graph_legend_get(db)` | 返回 `{database, configured, config}`；**缺失条目是 `configured: false` 而非错误**，代理无需捕获异常即可询问配置是否存在 |
| `graph_legend_set(db, config)` | `isPlainLegendRecord` 校验为 plain mapping 后才写（数组与标量被拒），非对象载荷不动存储；JSON 载荷同样接受（YAML 是其超集） |
| `graph_legend_remove(db)` | 经 `saveLegendConfig(rootDir, db, null)` 删除，返回 `{database, removed: true}`，**幂等** |

注册走 `createSimpleValidatedTool` 并带 annotations：`get` 只读，`set`/`remove` 写提示（`remove` 另标幂等）。10 个 MCP 测试 + 23 个既有 `mcp-graph` 回归全绿。

## 触发了下一个任务

实现中发现：`backlog/databases/` 是唯一没有 watcher 的内容目录（tasks / memos / milestones 与配置文件都有），且 `graph-legend-updated` 只在服务端自己的 PUT/DELETE 路由广播——**MCP set、CLI set 或编辑器手改都要刷新页面才可见**。该缺口当场记为 BACK-810。

## Related Concepts

- [[concepts/mcp-server]] — 工具注册与 annotations 模型
- [[concepts/graph-legend-persistence]] — 三写入面共享存储的 MCP 面

## Related Sources

- [[sources/back-806-legend-persistence-server]] — 前置：共享存储
- [[sources/back-810-graph-legend-watcher]] — 本任务发现的缺口及其修复
