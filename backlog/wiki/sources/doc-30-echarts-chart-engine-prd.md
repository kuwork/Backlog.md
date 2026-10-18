---
title: doc-30 - ECharts 图表引擎设计
labels: [source, design, web-ui, charts, markdown]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
source_path: backlog/docs/PRDS/echarts/doc-30 - ECharts-图表引擎设计（统一-ChartBlock-引擎注册表）.md
---

# doc-30 - ECharts 图表引擎设计

m-17 的设计稿。核心不是「加一个 ECharts 渲染函数」，而是把图表的渲染收敛成**一个入口 + 一张引擎注册表**，再让 ECharts 成为注册表里的第二个引擎。

## 目标（§2）

1. 保留 Mermaid 的前提下新增 ECharts；
2. 覆盖面最大化——mermaid 图类型 ∪ ECharts 全部内置 series ∪ 未来可插拔引擎；
3. 多引擎共用**一个**渲染入口，消除 mermaid 散落 3+ 处的重复；
4. 沿用既有主题与安全约定（暗色自动跟随、不引入 XSS 面）。

## 抽象（§3.1）

`ChartEngine { id, languages[], load() }` + `ChartRenderer { render(ctx), dispose? }`，`registry.ts` 用大小写不敏感的 `Map<language, engine>`。`ChartBlock` 只做四件事：查表 → 惰性 `load()` → `render()` → 卸载 `dispose()`。

源格式定为**标准 ECharts option 的 JSON**：覆盖所有 series、零学习成本、支持 `dataset`/`series` 混排。安全上与 mermaid 的 `securityLevel: "strict"` 对齐——只 `JSON.parse`，绝不把 option 当 JS 执行。

## 两个决策点

| 决策点 | 设计稿给的选项 | 落地 |
|---|---|---|
| mermaid 是否一并折进 `ChartBlock`（§3.4） | 最小改动（echarts 走组件、mermaid 维持 `renderMermaidIn` + `key={theme}`）／彻底统一 | **选了彻底统一**：删除 post-render DOM 替换与重挂载 hack，两条路径只留一份生命周期实现 |
| 数据从哪来（§8.3） | 紧耦合 `view: echarts`／松耦合 `fromQuery` | **两个都做**，见 [[concepts/query-chart-binding]] |

彻底统一的代价是必须回归 back-640 的渲染路径（围栏大小写等），这是该选择唯一被记下的风险。

## 覆盖最多类型的做法（§3.3）

`echarts/core` tree-shaking 入口 + 显式 `use()` 全部内置 series 与必要组件；`import()` 动态加载让 echarts 进独立 chunk，不进首屏；主题走 `echarts.init(dom, "dark" | undefined)`，天然支持切换，不需要重挂载。`echarts-gl` / wordcloud / liquidfill 被规划为「同一注册表上的额外引擎」，按需加。

## 使用指南（§5）

基本语法、主题自动跟随、支持类型清单、常用示例、限制与约定。这份指南后来演化成 `documents.md` 的图表章节与 doc-31 的活演示。

## 里程碑设定（§9）

设计稿末尾先给了任务拆分参考（7 个），评审时压缩为 **3 个**：核心引擎 / 方式 B / 方式 A，即 m-17 的三条任务。

## Related Concepts

- [[concepts/chart-block-engine]] — 第 3 节抽象的落地形态
- [[concepts/query-chart-binding]] — 第 8 节两种集成方式
- [[concepts/markdown-pipeline]] — 被收敛的 mermaid 渲染路径

## Related Sources

- [[sources/m-17-echarts-chart-engine]] — 交付里程碑
- [[sources/doc-31-echarts-demo]] — 基于本设计的活演示
- [[sources/back-812-core-echarts-engine]] — §3 的落地
- [[sources/back-813-query-block-view-echarts]] — §8.3.B 的落地
- [[sources/back-814-echarts-from-query]] — §8.3.A 的落地
- [[sources/doc-27-cypher-live-query-prd]] — 同类「文档内实况渲染」设计稿
