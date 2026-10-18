---
title: BACK-812 - 核心 ECharts 图表引擎
labels: [source, web-ui, charts, markdown]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
source_path: backlog/tasks/back-812 - Core-ECharts-chart-engine.md
---

# BACK-812 - 核心 ECharts 图表引擎

m-17 的第一个任务，也是另外两个的底座。交付的是**接口 + 注册表 + 引擎 + 统一组件**，不是某一类图。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/web/charts/types.ts` | `ChartEngine` / `ChartRenderer` / `ChartRenderContext` |
| `src/web/charts/registry.ts` | fence 语言 → 引擎，大小写不敏感 |
| `src/web/charts/mermaid-engine.ts` | 把既有 `renderMermaidDiagram` 包成引擎 |
| `src/web/charts/echarts-engine.ts` | ECharts 引擎：`echarts/core` 动态 import、全系列注册、JSON 解析、resize/dispose |
| `src/web/components/ChartBlock.tsx` | 唯一渲染入口：查表 → 惰性 load → render → dispose |
| `MermaidMarkdown.tsx` | `PreBlock` 顶部按注册表路由，**删除** `renderMermaidIn` post-render 与 `key={theme}` 重挂载 |
| `PasteAwareMDEditor.tsx` | `MermaidAwarePre` → `ChartAwarePre` |

`echarts@6.1.0` 进依赖；v6 的 `echarts/core`、`/charts`、`/components`、`/renderers` 子路径导出均已核实。

## 关键教训：漏注册是静默白屏

第一版把 22 个 series 全注册了，但组件只注册了 12 个——`themeRiver` 需要的 `SingleAxisComponent` 不在其中。`setOption` 抛 `singleAxisModel.get is not an object`，异常被 `ChartBlock` 里 promise 的 `.catch` 吞掉，**块安静留白，控制台只有一行 warn**。

修法不是补一个组件了事，而是**审计整张注册表**：对照 `echarts/charts` 与 `echarts/components` 的导出逐个核对，补上 `ChordChart`（v6 新增的第 23 个 series）以及 polar / calendar / parallel / radar / transform / markArea / graphic / timeline / brush / aria / matrix / thumbnail / gridSimple 等组件。

然后加了守卫 `src/test/echarts-engine-registration.test.ts`：断言 `echarts/charts` 的**每个导出**都被引擎注册，且关键坐标组件在位。以后漏注册会**构建失败**，而不是等某张图在浏览器里悄悄变白。

## 文档与演示

- `documents.md` 新增图表章节（后改名 Mermaid and ECharts Chart Blocks），覆盖两种 fence、series 清单、JSON-only 约定、非法输入回退。
- 示例文档先做成 `src/guidelines/cli-instructions/echarts-examples.md`，发现它在运行时不可达（未在 `index.ts` 注册，终端里的相对链接点不开），迁移为 doc-31 并在 Web UI 里活演示。

## 后续修补

- doc-31 §18（pictorialBar）从「一个 `symbol: "rect"` 例子 + 一句 `image://` 的空头承诺」扩成 symbol 三形态表 + 五个活示例，并把 `symbolRepeat` 的坑写成 WARNING。
- 本地图片示例改用 `image:///assets/images/web.jpeg`，确认 `GET /assets/images/web.jpeg` 返回 200 image/jpeg。

## Related Concepts

- [[concepts/chart-block-engine]] — 本任务建立的架构
- [[concepts/markdown-pipeline]] — 被移除的 post-render 路径
- [[concepts/sql-query-blocks]] — 后续在块模型上扩 `view: echarts`

## Related Sources

- [[sources/doc-30-echarts-chart-engine-prd]] — 设计稿
- [[sources/doc-31-echarts-demo]] — 示例文档的最终去处
- [[sources/m-17-echarts-chart-engine]] — 所属里程碑
- [[sources/back-813-query-block-view-echarts]] — 依赖本任务的下一环
- [[sources/back-814-echarts-from-query]] — 依赖本任务的下一环
- [[sources/back-640-mermaid-rendering-fixes]] — 被本次重构触及的 mermaid 渲染路径
