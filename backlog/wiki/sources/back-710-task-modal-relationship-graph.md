---
title: BACK-710 - 任务详情模态框新增关系图谱视图
labels: [source, graph, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-710 - Add-dependency-graph-view-to-task-detail-modal.md
---

# BACK-710 - 任务详情模态框新增关系图谱视图

Web UI 任务模态框的 Dependencies 面板新增了图谱切换按钮（侧栏四节点图标），点击后把模态框主体换成立足当前任务的力导向关系图谱，双向展示传递连接，并附按 kind 的图例。

## 实现要点

- `src/web/utils/task-subgraph.ts`：`buildRelationshipSubgraph()`——对类型化的 `/api/graph` 响应体（DependsOn、ParentOf、BelongsToMilestone）双向 BFS，带环保护、深度与节点上限；8 个单元测试
- `TaskDependencyGraph.tsx`：仿照 GraphView 的 d3-force SVG 渲染——按 kind 着色节点、带标签的有向边、缩放/拖拽、适应视图、点击节点钻取；副标题只显示本地化标题；图例栏切换节点 kind 可见性，根节点永远可见
- `TaskDetailsModal.tsx`：`showGraph` 状态，Dependencies SectionHeader 右槽的图标按钮，标题栏下方的主体切换，打开时 Escape 折叠（`disableEscapeClose`），切换任务时复位
- 执行中补充了实时刷新：`graphVersion` 贯穿 App → TaskDetailsModal → TaskDependencyGraph，任何 `graph-updated` WebSocket 事件都会触发重新拉取和重新布局；draft 任务经由同一 `/api/graph` 响应体成为一等公民
- i18n 键 `dependencyGraphTitle/Toggle/Close` 覆盖 en/ja/zh-CN/zh-TW；经 bun test、`tsc` 和 web 包构建验证

## 验收标准

- Dependencies 面板右上角有图谱切换按钮
- 展开的全宽画布以当前任务为根，展示上游、下游与传递连接
- 关闭后返回普通详情视图；测试与类型检查通过

## Related Concepts

- [[concepts/web-ui-features]] — 模态框交互约定（SectionHeader 槽位、Escape 处理）

## Related Sources

- [[sources/back-704-graph-view-web-ui]] — 本迷你视图所仿效的 /graph 页面（同一批）
- [[sources/back-709-dependency-closure-query]] — 同一模态框中与图谱并列渲染的闭包 API（同一批）
- [[sources/back-711-modal-graph-alignment]] — 对齐本视图与 /graph 页面的后续任务（同一批）
- [[sources/back-628-task-hierarchy-section]] — 更早带钻取导航的模态框增强
