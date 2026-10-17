---
title: m-16 - 图例配置持久化里程碑
labels: [source, milestone, graph, web-ui, config]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/milestones/m-16 - graph-legend-persistence.md
---

# m-16 - 图例配置持久化里程碑

**周期**: 2026-10-17 03:18 → 2026-10-17 13:08 | **设计文档**: doc-29

把图例配置（per-type 颜色、caption、规则、关系线样式）从浏览器 localStorage 迁到**版本化的项目文件** `backlog/databases/graph-legends.yaml`，并给三个写入面（服务端 API / CLI / MCP）加同一份存储的读写能力，再加一个文件 watcher 让带外写入热更新到已打开的浏览器。

## 任务分解

| 任务 | 面 | 内容 |
|---|---|---|
| BACK-806 | 服务端 | `legend-store` + `GET/PUT /api/graph/legend` + 广播 |
| BACK-807 | 浏览器 | 启动恢复 + localStorage 迁移 + write-through 保存 |
| BACK-808 | CLI | `backlog graph legend get/set/remove` |
| BACK-809 | MCP | `graph_legend_get/set/remove` 三工具 |
| BACK-810 | 服务端 | 监听 YAML 文件并广播（补 BACK-809 发现的缺口） |

## 标志性结论

- **单一存储路径**：五个任务全部复用 `src/graph/legend-store.ts`，没有第二套读写实现，因此三个面互相可见。
- **BACK-810 是 BACK-809 的直接产物**：MCP 任务在实现时发现 `backlog/databases/` 是唯一没有 watcher 的内容目录，而 `graph-legend-updated` 只在服务端自己的 PUT 路由广播——带外写入要到刷新页面才可见，缺口立刻立为下一个任务。
- **三层「无变化不刷新」**：PUT 路由只在语义变化时广播；watcher 用深度、键序不敏感比较判基线；浏览器取回后先与屏上配置比较再采纳。

## Related Concepts

- [[concepts/graph-legend-persistence]] — 里程碑交付的能力本体
- [[concepts/live-sync-pattern]] — watcher + 广播 + 幂等刷新在本里程碑的第四个落地面

## Related Sources

- [[sources/doc-29-graph-legend-persistence-prd]] — 里程碑设计稿
- [[sources/back-806-legend-persistence-server]] — 服务端存储与端点
- [[sources/back-810-graph-legend-watcher]] — 带外写入 watcher（收尾任务）
- [[sources/back-794-cypher-graph-configurable-legend]] — 被持久化的 localStorage 版图例
