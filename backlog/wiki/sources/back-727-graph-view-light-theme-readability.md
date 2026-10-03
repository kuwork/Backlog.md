---
title: BACK-727 - Improve graph view readability in light theme
labels:
  - source
  - web-ui
  - graph
created_date: '2026-10-03 01:07'
updated_date: '2026-10-03 01:07'
source_path: backlog/tasks/back-727 - Improve-graph-view-readability-in-light-theme.md
---

# BACK-727 - Improve graph view readability in light theme

浅色主题下图视图的视觉可读性问题：/graph 页面和任务详情弹窗中的关系图原本为暗色画布调优，边使用 slate-400 (#94a3b8)、节点轮廓使用 300 阶的浅淡色阶，在浅色背景上 washed out——关系线看起来像空隙，节点看起来像没有轮廓的圆点。深色主题保持不动。

方案（用户从候选方案中选定）：保留节点填充色不变，浅色主题下为每种节点类型切换为同色相的 700 阶深色边框，边颜色在浅色主题下加深为 slate-500。备选方案（色盲安全调色板整体替换、去边框填充）被否决。

关键实现点：在 GraphLegend.tsx 新增 `edgeStroke(theme)`（浅色 #64748b、深色保持 #94a3b8）和 `nodeStroke(style, theme)`（浅色为同色相 700 阶、深色保持原 300 阶；tag 灰保持浅一号以维持退居效果）；GraphView.tsx 与 TaskDependencyGraph.tsx 中所有边、边标签（含深度缩放时的关系标签）和节点轮廓统一走这两个主题感知 helper；图例 LegendLine 采样线也使用 `edgeStroke(theme)`，保证图例与画布永不不一致。浅色主题调色板：task #1d4ed8、completed #047857、draft #b45309、milestone #7e22ce、wiki #0e7490、decision #be185d、document #4338ca、tag #6b7280（遵循 doc-15 §7 的退居约定）。

结果：4 条验收标准全部达成，bunx tsc --noEmit、bun run check .、bun run build 及 graph canvas 测试全部通过；深色主题零改动。

## Related Concepts

- [[concepts/web-ui-features]] — /graph 页面与任务弹窗关系图所属的 Web UI 功能面
- [[concepts/kuzu-graph]] — 图视图背后的 Kuzu 任务图数据基础

## Related Sources

- [[sources/back-704-graph-view-web-ui]] — /graph 页面的首次实现，本任务在其上做浅色主题修正
- [[sources/back-705-graph-control-cluster-styling]] — 图控制与聚类样式，同属图视图样式体系
- [[sources/back-710-task-modal-relationship-graph]] — 任务弹窗关系图，两个修正面之一
