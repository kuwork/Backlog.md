---
title: BACK-783 - Databases 页真实行数与自动刷新
labels: [source, graph, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-783 - Show-real-row-counts-in-the-databases-table-refreshed-on-graph-updates.md
---

# BACK-783 - Databases 页真实行数与自动刷新

BACK-771 的 Databases 页有两个错误：`default` 行完全没有计数（用"重建"占位符，声称计数等于重建语料），且页面察觉不到语料图谱在底下变化。图谱服务在进程内持有语料图谱，计数与变更信号本已可得——页面只是没去要。本任务补上真实行数与自动刷新，并顺手纠正查询框下的错误注释：`default` 由热备的进程内 store 服务，查询不会触发任何重建。

## 问题

1. `default` 行显示"重建"占位而非真实节点/边计数；
2. 图谱经 graph-updated / graph-ready 广播更新后，页面不刷新计数；
3. 查询框下的注释错误地暗示查询 `default` 会重建语料。

## 实现要点

- 新增 `GraphService.getCounts()`：对常驻 store 的 `countNodes()` 与逐边表的 `countEdges()` 求和，未就绪时返回 null；不走 `getPayload()`（那会为打印两个数字物化整个图谱）。
- `GET /api/graph/databases`：在 `describeDatabases()`（纯文件读取）之后，从已在运行的图谱服务填充 `default` 的节点/边数；刻意不 await 冷启动（大仓库要数秒），列表请求永不阻塞，计数在 `graph-ready` 广播后页面重新拉取时补齐。
- 前端：`GraphDatabases` 接收 `graphVersion` prop，变化时重新拉取且保留当前选中；`App` 传入 `graphVersion` 并在 `graph-ready` 时也递增（构建中途接入的客户端永远收不到那次 `graph-updated`）。计数占位符从"重建"改为中性的 "—"（语义收窄为"图谱尚未就绪"）。
- 查询框下新增可点击回填的 `show_tables` / `table_info` 提示，并附 CLI `backlog graph schema` 说明。
- 计数语义（按用户反馈修正）：**包含 Tag 节点**。初版复用 store 的 `countNodes()`，按其 API 语义只数 `FileNode`（Tag 与 Meta 除外），导致 Web UI 读数 1407 而图谱页头部显示 1588。对照 `graph describe default` 与派生图谱快照 `.kuzu.graph.json` 定位差额恰为 181 个 Tag 节点（1407 + 181 = 1588；4622 条边 = 44 + 47 + 113 + 332 + 2333 + 1753 自始至终一致）。修正为 `countNodes() + getAllTags().length`；`Meta` 是无人绘制的簿记节点，保持排除。
- 图谱页头部是**视图**计数、Databases 行是**全 store** 计数：任务图谱默认 826 · 204，知识图谱 762 · 4107，只有图例全开才显示完整的 1588 · 4622——两者只在无隐藏时一致，这是设计而非 bug。
- 刷新失败保留旧表：`loadedRef` 记录是否成功拿到过列表，仅首次加载失败才落入错误页，避免单次网络抖动连带拖垮选中数据库与查询结果。

## 验证

测试断言 `counts.nodes === payload.nodes.length`（画布在无隐藏时实际绘制的集合）与 `counts.edges === payload.edges.length`，外加一个带 label 的 wiki 页用例钉住 Tag 计数；新增 `src/test/web-graph-databases-refresh.test.tsx` 并更新 `src/test/graph-sync.test.ts`。

## Related Concepts
- [[concepts/kuzu-graph]] — FileNode/Tag 节点模型与派生语料图谱
- [[concepts/live-sync-pattern]] — graph-updated / graph-ready 广播驱动的原地刷新
- [[concepts/web-ui-features]] — Databases 页与图谱视图

## Related Sources
- [[sources/back-703-graph-incremental-sync]] — 图谱增量同步与热更新广播（本任务消费其变更信号）
- [[sources/back-704-graph-view-web-ui]] — 图谱可视化页面（头部视图计数的来源）
