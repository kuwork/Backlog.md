---
title: BACK-791 - 里程碑详情页任务关系图谱入口
labels: [source, web-ui, graph, milestones]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-791 - Add-task-relationship-graph-entry-to-milestone-detail.md
---

# BACK-791 - 里程碑详情页任务关系图谱入口

任务详情模态框已有按任务的关系图谱开关，里程碑详情模态框却没有入口；源自 memo backlog/memos/20261013-1.md 报告的导航缺失。本任务在里程碑详情右侧进度区顶部加入口，点击展开按该里程碑任务集合取并集的多根关系子图，并顺带修复了里程碑↔任务图谱往返的三处状态丢失缺陷。

## 目标

- 里程碑详情模态框进度区右上角显示图谱开关按钮（无任务时隐藏），点击打开以该里程碑全部任务为根的依赖关系图；
- 行为对齐任务详情图谱开关：开关、按里程碑持久的视口与图例过滤；
- 测试覆盖入口存在性与点击后渲染子图。

## 实现要点

- `src/web/utils/task-subgraph.ts`：`buildRelationshipSubgraph(payload, focusId)` 改为接受 `string | string[]`，每个 focus id 都以深度 0 / isRoot 入 BFS，返回各任务关系邻域的并集；缺失 id 忽略，全缺失返回空；单字符串调用方不受影响。
- `src/web/components/TaskDependencyGraph.tsx`：新增可选 props `focusIds`、`viewportKey`、`drillOnRoot`；`viewportKey ?? focusId` 作为视口 map 的键，实现按里程碑持久视口；`drillOnRoot` 下双击任意节点可钻取（里程碑范围内每个节点都是 root，旧的 isRoot 守卫会挡住所有钻取）。
- `src/web/components/MilestoneDetailsModal.tsx`：从 TaskDetailsModal 导出复用 `HeaderBackButton`；新增 `graphVersion` prop（由 `src/web/App.tsx` 传入）、`graphOpenByMilestone` / `graphHiddenStylesByMilestone` map 与 `milestoneGraphViewportsRef`；进度区 SectionHeader 改为 flex 行加右上角图谱按钮；Escape 与返回按钮关闭图谱。i18n 四语言新增 `milestones.dependencyGraphToggle` / `dependencyGraphBack`，图谱标题复用 `taskDetails.dependencyGraphTitle`。
- 跟进修复 A（图谱内双击里程碑节点）：任务图谱双击处理器原来只在任务语料里查 id，里程碑节点（id 为 m-N）无反应。新增共享纯函数 `relationshipNodeRoute(id, kind)` 将里程碑节点映射到 `/milestone/:id` 路由（其余返回 null）；TaskDetailsModal 以 `state.backgroundLocation` 导航，关闭里程碑后 `navigate(-1)` 回到任务。
- 跟进修复 B/C（往返状态丢失与误重置）：TaskDetailsModal 原先在 `!isOpen` 时清空按任务的图谱状态，里程碑钻取使 `useMatch("/task/:id")` 短暂为 null，导致返回时图谱塌回详情视图；直接删掉清空又导致真正关闭后重开仍停留在图谱。新增 `src/web/utils/modal-route.ts` 的 `isModalRoutePath(pathname)`（详情路由 `/task/:id`、`/draft/:id`、`/milestone/:id` 为 true，列表/看板路由为 false），两个模态框只在"真关闭"（`!isOpen && previousIsOpen` 且落地路由非模态路由）时清空状态——被遮挡（occlusion）保留、真离开重置。曾考虑 Android 式模态返回栈，被明确否决：路由派生规则已够区分两种情形。

## 验证

`bunx tsc --noEmit` 干净；`bun run check .` 0 错误（14 条预存 noExplicitAny 警告）；5 个测试文件共 21 个用例通过：`task-subgraph.test.ts`（多根并集）、`src/test/milestone-graph-entry.test.tsx`（jsdom + createRoot 挂载模态框断言入口与图谱切换）、`relationship-node-route.test.ts`、`task-graph-stack-return.test.tsx`（遮挡后图谱仍在）、`milestone-graph-reset.test.tsx`（真关闭重置、遮挡保留）。两条回归守卫均经"故意回退修复"验证会变红。

已知边界：任务与里程碑模态框按 URL 路由互斥（同时只匹配一个），里程碑打开时任务详情是视觉隐藏而非叠加第二层；两者都不卸载，故状态跨往返保留。

## Related Concepts

- [[concepts/milestones]] — 里程碑管理，本任务扩展其 Web 详情模态框
- [[concepts/kuzu-graph]] — 图谱视图体系，任务关系子图是其前端交互的近亲

## Related Sources

- [[sources/back-710-task-modal-relationship-graph]] — 任务弹窗关系图谱视图，本任务把同一入口带到里程碑详情
- [[sources/back-711-modal-graph-alignment]] — 模态框图谱与 /graph 对齐，同一图谱组件线
- [[sources/back-792-milestone-live-add-title-fix]] — 同批里程碑 Web 修复，共用 milestoneEntities 数据通路
