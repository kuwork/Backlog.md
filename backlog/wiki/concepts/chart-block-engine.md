---
title: 统一图表引擎（ChartBlock + 注册表）
labels: [concept, web-ui, charts, markdown]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
---

# 统一图表引擎（ChartBlock + 注册表）

Web 端 markdown 里的**所有图表**——mermaid 的流程图、ECharts 的数据图、以及未来的任何图表库——都从同一个组件进入，按 fence 语言查一张注册表决定由谁渲染。由 BACK-812 建立，取代了 mermaid 原先「post-render DOM 替换」的独立通道。

## 三层结构

| 层 | 文件 | 职责 |
|---|---|---|
| 类型 | `src/web/charts/types.ts` | `ChartEngine { id, languages[], containerClassName?, containerStyle?, load() }`、`ChartRenderer { render(ctx), dispose? }`、`ChartRenderContext { container, source, mode }` |
| 注册表 | `src/web/charts/registry.ts` | `Map<language, engine>`，语言大小写不敏感；`registerChartEngine` / `getChartEngine` |
| 引擎 | `mermaid-engine.ts` / `echarts-engine.ts` | mermaid 包装既有 `renderMermaidDiagram`；echarts 用 `echarts/core` |
| 入口 | `src/web/components/ChartBlock.tsx` | 查表 → 惰性 `load()` → `render()` → 卸载 `dispose()` |

`ChartBlock` 不知道自己渲染的是哪种图，所以加一个引擎只需两件事：实现 `ChartEngine` 并在 `registry.ts` 里注册语言。

## 生命周期

- `requestAnimationFrame` 推一帧再 `init`——块刚插入 DOM 时尺寸还是 0，立即 `init` 会得到一张压扁的图。
- `load()` 内部缓存渲染器：同一份 echarts 模块只 import 一次，`echarts.use()` 也只执行一次。
- cleanup 里取消未执行帧、标记 `cancelled`，并对已渲染的容器调 `dispose()`——React 严格模式的双挂载、切换文档、改主题都会走这条路径。
- ECharts 的 `ResizeObserver` 与实例一起挂在容器元素上，`dispose` 时一并撤销，避免容器被回收后仍在监听。

## 主题

`useOptionalTheme()` 给出 `light` / `dark`，作为 `mode` 传进 `render`：ECharts 走 `echarts.init(dom, mode === "dark" ? "dark" : undefined)`，mermaid 走自己的 `MERMAID_THEME_BY_MODE`。**主题切换 = 依赖变化 = 重跑 effect**，不再需要 `key={theme}` 重挂载整棵 markdown 树。

## 安全：只吃 JSON

`echarts` fence 的正文是一段 ECharts option 的 **JSON**，引擎只做 `JSON.parse`，函数永远不执行——与 mermaid 的 `securityLevel: "strict"` 同一口径。非法 JSON 或未知 series 时回退为普通代码块，不崩不空白。

代价是 `custom` series 的 `renderItem`、axis 的 `formatter` 函数都用不了；需要动态文本时用 ECharts 模板串（`"{b}: {c}"`）。

## 全系列注册与守卫

引擎用 `echarts/core` tree-shaking 入口，显式 `use()` 注册 **23 个 series**（含 v6 新增的 `chord`）与全部坐标/图形组件（grid、polar、singleAxis、calendar、parallel、radar、transform、graphic、timeline、brush、aria、matrix、thumbnail…）。

漏注册的后果是**静默白屏**：`setOption` 抛错，异常被 `ChartBlock` 的 `catch` 吞成一行 warn，容器留白。`themeRiver` 就是这样栽在 `SingleAxisComponent` 上的。因此加了 `src/test/echarts-engine-registration.test.ts`——对照 `echarts/charts` 的每个导出断言「已注册」，漏一个就构建失败。

## 与旧 mermaid 路径的差异

| | 旧 | 新 |
|---|---|---|
| 触发 | 渲染完成后扫描 DOM 替换 `<pre>` | `PreBlock` 在渲染时按语言返回组件 |
| 主题 | `key={theme}` 重挂载整个 markdown | effect 依赖 `mode`，只重绘图表 |
| 生命周期 | 全局 `initialize()`，无 per-block dispose | 每块独立 init / resize / dispose |
| 编辑器预览 | `MermaidAwarePre` | `ChartAwarePre`，与正文同一套查表逻辑 |

## Related Concepts

- [[concepts/query-chart-binding]] — 让图表吃查询结果的两种方式
- [[concepts/markdown-pipeline]] — 围栏分支的挂载点
- [[concepts/sql-query-blocks]] — 图表视图所属的块模型
- [[concepts/cypher-live-query-block]] — 同为「围栏 → 实况渲染」的邻居

## Related Sources

- [[sources/back-812-core-echarts-engine]] — 建立者
- [[sources/doc-30-echarts-chart-engine-prd]] — 抽象的设计稿
- [[sources/m-17-echarts-chart-engine]] — 里程碑
- [[sources/back-640-mermaid-rendering-fixes]] — 被替换的旧路径上的修复历史
