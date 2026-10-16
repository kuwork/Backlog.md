---
title: BACK-765 - 图谱页面 Cypher 搜索
labels: [source, web-ui, graph, kuzu, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-765 - Knowledge-Graph-Cypher-Search.md
---

# BACK-765 - 图谱页面 Cypher 搜索

为知识图谱（/knowledge）与任务图谱（/graph）页面加入 Cypher 搜索：放大镜入口按钮在 3x3 控制簇右上格（第 1 行第 3 列），打开搜索弹窗。最终形态经三轮验收返工定为"过滤到结果集"而非初版的"高亮命中"。仅 kuzu 后端支持，memory 后端显式报不支持。

## 目标

弹窗展示 schema 提示（节点表 FileNode/Tag/Meta，关系表 ParentOf/BelongsToMilestone/DependsOn/SourcedFrom/LinksTo/TaggedWith）与 Cypher 输入、搜索/清除按钮；搜索成功后画布过滤为命中诱导子图（命中节点 + 两端都命中的边），重新聚类并自动适配视口；过滤期间图例变为结果集摘要；清除按钮恢复原状；重开弹窗回填上次语句；后端新增 `POST /api/graph/cypher`。

## 实现要点

- 后端链：`src/graph/store.ts` 加 `CypherQueryResult` 与 `runCypher`（只读执行，拦截 CREATE/DROP/DELETE/INSERT/MERGE/SET/UPDATE，500 行上限，从结果提取 FileNode path/id 作 nodeKeys）；`graph/service.ts` 透传；`src/server/index.ts` 加 `POST /api/graph/cypher`（200/400/503）；`src/web/lib/api.ts` 加 `CypherResult`。
- 前端：`CypherSearchDialog.tsx`（schema 提示、输入、Search/Clear、localStorage 回填上次语句、Cmd/Ctrl+Enter）；`GraphView` 以 `cypherFilter` 状态承载结果集，进过滤时存 `preFilterTransformRef`/`preFilterHiddenRef` 快照，清除时恢复；`GraphLegend.selectFilteredGraph(nodes, edges, keys, hidden?)` 是布局、头部计数、图例计数共享的唯一诱导子图计算；四语言 locale 加 `graphView.cypher*` 文案。
- 返工记录：初版"高亮+淡化"因知识图谱默认隐藏任务类节点而看似无效；返工 1（自动展开命中类别）导致数百节点全图重排太吵；返工 2 用户拍板过滤到结果集；返工 3 图例改为结果集摘要（缺失类别整体移除、计数为结果集计数、命中但被隐藏的类别自动展开、图例点击在过滤之上继续生效）。
- 环境约束：Windows 上 kuzu native binding 仅在进程名为 node.exe 时可加载（kuzudb/kuzu#5672，上游已归档；后继 LadybugDB 实测亦不可用），开发靠 `scripts/dev-kuzu.{sh,ps1,cmd}`（把 bun 复制改名 node.exe）；打包构建把 native 路径烘成构建机绝对路径，打包版 Cypher 需另行解决。

## 验证

tsc 与 biome 通过；`web-graph-cypher-reveal`（诱导子图与两端规则、图例显隐/计数/点击叠加、清除恢复、关系图例过滤）+ web-graph-canvas + graph-foundation 共 41 例通过。

## Related Concepts

- [[concepts/kuzu-graph]] — FileNode 图模型与 /graph、/knowledge 视图，Cypher 搜索建在其上

## Related Sources

- [[sources/back-702-kuzu-graph-foundation]] — 图谱基础与双后端（Memory/Kuzu），本任务的 runCypher 挂在该 store 层
- [[sources/back-766-ryugraph-wasm-backend-switch]] — 后端从 Kuzu 切到 RyuGraph WASM，本任务搜索能力的承载后端
- [[sources/back-767-graph-query-cli-command]] — 同一 runCypher 能力的 CLI 暴露
