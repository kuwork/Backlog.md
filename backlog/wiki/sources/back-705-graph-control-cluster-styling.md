---
title: BACK-705 - 统一图谱控制簇样式
labels: [source, graph, web-ui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-705 - Unify-the-graph-control-cluster-styling-so-the-overview-key-matches-its-neighbours.md
---

# BACK-705 - 统一图谱控制簇样式

图谱控制面板中的总览（fit）键去掉了强调色，使七个键共享同一中性样式——该键独占面板左上单元格后（BACK-704 打磨），强调色只会增加第二重视觉重量。

## 实现要点

- `GraphView.tsx`：`CtrlButton` 完全移除强调色变体——prop、其 JSDoc 与蓝色类名字符串全部删除；总览键改走普通分支渲染；3 列网格与每个键单元格位置不变
- 用一次性 corpus 对照源服务端验证：浅色与深色主题下计算出的背景/边框/文字颜色都从 2 个不同值变为 1 个，且七个键保持各自矩形不变
- 原始需求中图例的一半无需代码：点击节点 kind 芯片已经会将其变暗（透明度 1 → 0.4）并在图谱中隐藏该 kind（节点到 0.00 且 pointer-events none、边到 0.00），再次点击恢复——已实测复核；只有三条边类型图例行按设计是静态的
- 关卡：`tsc` 无告警；web 套件 42 个文件 293 通过 / 0 失败

## 验收标准

- 两种主题下总览键与平移、缩放键的边框/背景/文字颜色一致；GraphView 不再残留强调色变体
- 控制面板保持 3 列网格，每个键维持原有屏幕位置

## Related Concepts

- [[concepts/web-ui-features]] — 应用于图谱页面的控制簇样式约定

## Related Sources

- [[sources/back-704-graph-view-web-ui]] — 引入本任务所移除强调色的页面（同一批）
