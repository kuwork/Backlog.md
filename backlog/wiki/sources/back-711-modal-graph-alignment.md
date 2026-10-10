---
title: BACK-711 - 模态框关系图谱与 /graph 页对齐
labels: [source, graph, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-711 - Align-the-task-modal-relationship-graph-with-the-graph-page.md
---

# BACK-711 - 模态框关系图谱与 /graph 页对齐

BACK-710 的模态框关系图谱与 /graph 页对齐为同一个视觉产品：共享图例与调色板、填满模态框主体的画布，以及按任务保存的阅读状态——钻取往返后精确恢复父任务离开时 的视图。

## 实现要点

- 单一共享视觉实现：新增 `GraphLegend.tsx` 导出 `NodeStyle`、`NODE_FILL`、`NODE_STROKE`、`EDGE_STROKE`、`EDGE_DASH`、`nodeStyle`、`LegendDot`、`LegendLine`；`GraphView` 改从它引入而非自定义副本，两个视图不会漂移；`TaskDependencyGraph` 在头部行渲染同一图例（带实时计数的 kind 圆点加三条边样式示例）
- 画布填满模态框主体（`min(calc(94vh - 9.5rem), 44rem)`）；`fitToView` 去掉 1.5x 上限（模态框邻域只有 handful 个节点，填满阅读区正是目的），保留 0.2 下限；不足 2 个节点的子图谱改为 1:1 居中而非缩放到 k=12——实测：5 节点邻域占画布 67%×69%（原 46%×50%）
- 阅读状态属于任务而非模态框：`TaskDetailsModal` 持有 `graphOpenByTask`、按任务的视口（`GraphViewports`）与按任务的图例过滤，仅在新开模态框时清空；它们必须放在模态框里，因为邻任务详情显示期间图谱组件会卸载——钻取落在邻任务自己的状态上，返回时逐字节恢复父任务的模式、变换与过滤
- 离开图谱是模态框标题 `leftActions` 槽中的返回箭头（与被钻取任务拿到的字形相同），取代面板里装饰性的 x；与 Escape 共享同一个"后退一步"优先级：图谱打开 → 关图谱，否则历史返回；i18n 键在四种语言中改名 `dependencyGraphClose` → `dependencyGraphBack`
- 经 CDP 验证：变换逐字节恢复、头部恰好一个 28×28 箭头、x 无残留；`tsc` 无告警；web 测试 99 通过 / 1 个既存无关失败
- 工具：`scripts/cdp-session.mjs` 新增 `waitFor` 步骤与截图可选 clip/scale，一次验证运行从 12 秒盲等降到 3 秒

## 验收标准

- 模态框图谱共享 /graph 的图例与节点调色板；画布填满模态框主体
- 图谱模式、缩放/平移与图例过滤属于被阅读的任务；钻取往返精确恢复
- 经标题返回箭头（或 Escape）离开，带"后退一步"优先级

## Related Concepts

- [[concepts/web-ui-features]] — 模态框导航与钻取状态约定

## Related Sources

- [[sources/back-710-task-modal-relationship-graph]] — 本任务对齐的模态框图谱（同一批）
- [[sources/back-704-graph-view-web-ui]] — 提供共享图例/调色板的 /graph 页面（同一批）
- [[sources/back-628-task-hierarchy-section]] — 箭头复用其返回槽位约定的钻取导航
