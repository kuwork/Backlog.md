---
title: doc-32 - Mermaid 图表画廊
labels: [source, web-ui, charts, markdown]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/docs/doc-32 - Mermaid-Diagram-Gallery.md
---

# doc-32 - Mermaid 图表画廊

随 BACK-819 发布的 Mermaid 语法示例库：18 个图表类别、25 个可直接复制使用的复杂示例，刻意在语法上覆盖子图、判断、样式类、泳道、`alt`/`loop` 等常见用法。

## 覆盖范围

示例分两类来源：

- **项目内流程**：以 Backlog.md（地质随身行 SuiShenXing）的任务、里程碑、CLI、图数据库底座为例
- **通用程序**：以微信、支付宝等日常 App 的支付、转账、扫码流程为例

### 18 个类别

流程图、时序图、类图、状态图、实体关系图、用户旅程图、甘特图、饼图、象限图、需求图、Git 图、思维导图、时间线图，以及 6 个 Beta 类型（桑基图、XY 图、架构图、块图、树图）。

> 所有 Beta 类型需 Mermaid 10+；本项目 `mermaid@11.16.1` 已支持。围栏统一用 ` ```mermaid `，渲染由 `src/web/charts/mermaid-engine.ts`（Pele 默认引擎下为 `pele-engine.ts`）处理，并随主题切换配色。

## 与图表引擎的关系

画廊里的图都走统一的 ChartBlock + 引擎注册表（[[concepts/chart-block-engine]]）。BACK-819 把默认引擎从硬接线的 Mermaid 换成可切换的 Pele（Obsidian 团队开源，Mermaid 12.1.0 语法渲染为 SVG、零依赖），Mermaid 11.16.1 保留为可选回退；画廊中三张此前无法预览的图（XY 图中文 x 轴标签、architecture-beta 标签）在 BACK-819 中被修正。

## Related Concepts

- [[concepts/chart-block-engine]] — 画廊图表的统一渲染底座
- [[concepts/markdown-pipeline]] — 围栏分支的挂载点

## Related Sources

- [[sources/back-819-switchable-diagram-engine]] — 同波发布的图表引擎切换
- [[sources/doc-31-echarts-demo]] — ECharts 侧的活演示文档
