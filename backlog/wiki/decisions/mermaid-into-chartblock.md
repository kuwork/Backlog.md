---
title: 图表渲染选择"彻底统一"而非最小改动
labels: [decision, web-ui, charts, markdown]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
description: BACK-812 把 mermaid 一并折进 ChartBlock，移除 post-render 替换与 key={theme} 重挂载，而非只给 echarts 新开一条通道
---

# 图表渲染选择"彻底统一"而非最小改动

## 背景

doc-30 §3.4 留了一个非阻塞决策点：echarts 走新的 `ChartBlock` 时，mermaid 要不要一起折进去？

- **最小改动**：echarts 走 `ChartBlock`，mermaid 维持 `renderMermaidIn` 的 post-render DOM 替换 + `key={theme}` 重挂载。零风险。
- **彻底统一**：mermaid 也注册成引擎，两条路径合一。

## 选择

选了彻底统一。

## 理由

- **生命周期只有一份实现**：post-render 扫描拿不到 per-block 的容器引用，做不了精确的 resize / dispose；`key={theme}` 是整棵 markdown 树重挂载，代价随文档长度线性增长。折进 `ChartBlock` 后主题切换只重绘图表。
- **渲染时机更可控**：DOM 替换要「先渲染成代码块、再扫出来换掉」，中间态可见；组件级路由在 `PreBlock` 一次决定，没有闪烁与二次布局。
- **编辑器预览必须同源**：两条路径下，正文与编辑器预览各自实现，`MermaidAwarePre` 与正文逻辑容易走偏。统一后同一个查表函数服务两处。
- **新引擎的接入成本降到两行**：实现 `ChartEngine` + 在注册表登记语言，不再需要新的挂载点。

## 被否决的方案

保留 mermaid 旧路径的代价不是零——它把「主题」变成重挂载语义，后续任何需要跟随主题的引擎都得复制一遍 `key` hack，或者再写一套订阅。

## 代价与缓解

必须回归 back-640 的渲染路径（围栏大小写、主题、编辑器预览）。缓解方式是把 `MermaidDiagram` 的既有测试与 `mermaid-preview` 的组件测试一并转到 `ChartAwarePre` 上跑（85 个测试全绿），确认行为等价后再删旧代码。

## 相关

- [[concepts/chart-block-engine]]
- [[sources/back-812-core-echarts-engine]]
- [[sources/doc-30-echarts-chart-engine-prd]]
- [[sources/back-640-mermaid-rendering-fixes]]
