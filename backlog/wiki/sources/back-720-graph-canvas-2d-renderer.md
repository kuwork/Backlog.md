---
title: BACK-720 - Optimize GraphView rendering performance and hover experience
labels:
  - source
  - web-ui
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:10'
source_path: backlog/tasks/back-720 - Graph-view-migrate-to-Canvas-2D-renderer-and-delay-hover.md
---

# BACK-720 - Graph view: migrate to Canvas 2D renderer and delay hover

本任务把 Web 端图视图（任务图与知识图）从 D3+SVG 渲染器迁移到 Canvas 2D 渲染器以提升性能，并给悬停触发加入刻意延迟，消除指针快速划过时 tooltip/高亮的闪烁。迁移保持现有行为不变：d3-force 布局与位置持久化（缓存键不变、已存布局保留）、缩放/拖拽/焦点淡化/相机飞入/分层标题/边名标签均保留。

实现上把 GraphCanvasView.tsx 的 Canvas 渲染器并入 GraphView.tsx（任务图与知识图两个变体），TaskDependencyGraph.tsx（任务详情弹窗内的依赖子图）同样迁移，共享绘制助手抽到 src/web/utils/graph-canvas.ts（platePath、strokeEdge、drawEdgeLabel、drawCaption、canvasThemeColors、ensureZoomInterrupt）。悬停 tooltip 与邻接高亮改为 300ms 定时器（HOVER_DELAY_MS），移动/离开/拖拽即取消，光标反馈保持即时。评估页 GraphCanvasView.tsx 连同 /knowledge-canvas 路由、导航项与 i18n key 一并删除，只留一套实现。

评审期修复了多个 Canvas 回归：d3-zoom 的 dblclick.zoom 用 stopImmediatePropagation() 吞掉了双击事件，禁用后由自有处理器接管（节点双击打开任务弹窗、空白处双击放大 2 倍）；图例隐藏全部类别时 effect 提前返回导致画布冻结残留帧，空子集路径现在显式清屏；标签节点在暗色画布上不可见，nodeFill() 把灰色由 #9ca3af 提亮为 #cbd5e1 并同步图例圆点。还把 selectVisibleGraph 的标签可见规则改为仅丢弃全 payload 无任何 TaggedWith 边的孤儿标签（隐藏其载体的标签保持可见），并通过 backlog doc update 给 doc-15 追加了修订块（§4 旧规则作废）。验证：tsc、Biome、93 个 graph/web 测试 + 5 个 Canvas 冒烟测试、bun run build，并经 WebBridge 实拍确认两图页渲染与双击打开弹窗。

## Related Concepts
- [[concepts/kuzu-graph]] — 任务图与知识图的数据层（Kuzu 图）与前端渲染的对应关系
- [[concepts/web-ui-features]] — Canvas 图视图、图例过滤与任务弹窗子图属于 Web UI 功能体系

## Related Sources
- [[sources/back-704-graph-view-web-ui]] — 图视图 Web UI 的初版实现，本任务替换其 SVG 渲染层
- [[sources/back-705-graph-control-cluster-styling]] — 图控制与聚类样式的相关实现
- [[sources/back-710-task-modal-relationship-graph]] — 任务弹窗内依赖子图（TaskDependencyGraph）的来源任务
- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — 本任务修订了其 §4 标签丢弃规则
- [[sources/back-714-knowledge-graph-ingest]] — 知识图谱摄取，所渲染的 wiki 关系数据的上游
