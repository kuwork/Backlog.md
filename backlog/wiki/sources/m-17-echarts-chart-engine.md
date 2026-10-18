---
title: m-17 - ECharts 图表引擎里程碑
labels: [source, milestone, web-ui, charts]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
source_path: backlog/milestones/m-17 - echarts-chart-engine-(web).md
---

# m-17 - ECharts 图表引擎里程碑

把 Web 端 markdown 渲染从「只支持 mermaid」扩到「mermaid + ECharts」，并让图表能直接吃 query-block 的查询结果。设计稿 [[sources/doc-30-echarts-chart-engine-prd]]，活演示 [[sources/doc-31-echarts-demo]]。

## 交付范围

一个统一渲染入口 + 一个数据图表引擎 + 两种查询联动方式：

| 任务 | 内容 | 产出 |
|---|---|---|
| [[sources/back-812-core-echarts-engine]] | 统一 `ChartBlock` + 引擎注册表、ECharts 引擎全系列注册、mermaid 改走同一路径 | `src/web/charts/*`、`ChartBlock.tsx` |
| [[sources/back-813-query-block-view-echarts]] | 紧耦合：查询块 `view: echarts` + `chart` 字段 | `echarts-query.ts`、`EchartsFromResult.tsx` |
| [[sources/back-814-echarts-from-query]] | 松耦合：`echarts` fence 用 `fromQuery` 引用命名查询块 | `query-result-registry.tsx`、`from-query.ts` |

BACK-813 / BACK-814 都依赖 BACK-812——引擎与 `ChartBlock` 是两者的共同底座。

## 三个判断

1. **不为 ECharts 新开渲染通道**，而是把 mermaid 也搬进同一个 `ChartBlock`。原先 mermaid 走 post-render DOM 替换（`renderMermaidIn`）并靠 `key={theme}` 重挂载跟随主题，两条路径语义不一致；统一后主题、resize、dispose 只有一份实现。
2. **数据来源分两档，不是二选一**：`view: echarts` 让块本身就是图（无可见表格），`fromQuery` 保留可见查询块再画图。两者共用同一套 ECharts option 与引擎。
3. **option 只吃 JSON**，不执行函数——与 mermaid 的 `securityLevel: strict` 同一安全口径。

## 结果

`src/guidelines/cli-instructions/documents.md` 新增图表章节（Mermaid and ECharts Chart Blocks），README 双语各补一条特性；doc-31 成为唯一活演示（22 个独立 fence + 2 个 `view: echarts` + 4 个 `fromQuery` 小节）。

## Related Concepts

- [[concepts/chart-block-engine]] — 本里程碑的架构主体
- [[concepts/query-chart-binding]] — `view: echarts` 与 `fromQuery` 的取舍
- [[concepts/markdown-pipeline]] — 围栏路由挂载点与本次统一

## Related Sources

- [[sources/doc-30-echarts-chart-engine-prd]] — 设计稿
- [[sources/doc-31-echarts-demo]] — 演示文档
- [[sources/back-812-core-echarts-engine]] — 核心引擎
- [[sources/back-813-query-block-view-echarts]] — 方式 B
- [[sources/back-814-echarts-from-query]] — 方式 A
- [[sources/m-15-cypher-live-query]] — 上一批查询块里程碑，`view` 枚举的先例
