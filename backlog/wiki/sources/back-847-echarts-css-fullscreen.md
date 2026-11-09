---
title: BACK-847 - ECharts 图表 CSS 全屏浏览入口
labels: [source, web-ui, charts, echarts, lightbox]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
source_path: backlog/tasks/back-847 - Add-CSS-fullscreen-entry-for-ECharts-charts.md
---

# BACK-847 - ECharts 图表 CSS 全屏浏览入口

BACK-846 给 Mermaid 加了全屏叠加层，但当时把入口限制在 SVG 类引擎。本任务把 ECharts（canvas）纳入同一套叠加层，并补上「查询直出 `view: echarts`」这条被漏掉的独立渲染路径。

## 目标

- 所有 ECharts 图表（fence 与 `view: echarts`）都有右上角全屏按钮。
- 打开后在暗底叠加层里重新渲染，容器有显式尺寸，canvas 不出现空白。
- ECharts 走内置 dark 主题，**不加**反相滤镜（反相只属于经典 Mermaid）。
- 缩放 / 平移 / 旋转 / 重置 / Esc 行为与 Mermaid 完全一致；关闭时销毁图表实例与 `ResizeObserver`。

## 实现要点

**前提已经变了**：BACK-846 曾因「克隆画布会得到空位图」把叠加层限制为 SVG 引擎，后来叠加层改为在干净容器里重新渲染，这个限制自然失效。因此主要工作是把 `echarts` 加进 `FULLSCREEN_LANGS`，交互代码一行未加。

**修正一个按错键的判断**：叠加层的暗色/反相原先读 `useDiagramEngine()` 的 `engineId`，那是全局「用 Pele 还是经典 Mermaid 画 mermaid 块」的设置，对 ECharts 块毫无意义——用户切到经典 Mermaid 引擎时，ECharts 会被错误地 `invert(1)`。改为按块实际引擎 `getChartEngine(lang).id`：只有经典 Mermaid 反相，Pele / ECharts 原生暗色。

**canvas 必须先有盒子再 init**：`echarts.init` 在创建时读容器尺寸，自动撑开的 flex 容器是 0×0，会渲染空白位图。叠加层渲染前按视口 90% 给容器设显式像素宽高；渲染后没有 SVG，跳过 fit / 可读下限逻辑并复位溢出标志。关闭时调 `renderer.dispose(target)`，销毁实例与观察器。

**测试 seam**：jsdom 没有 canvas context，`echarts-engine.ts` 增加 `__ECHARTS_MOCK__` 注入点（对齐 `utils/mermaid.ts` 已有的 `__MERMAID_MOCK__`），让 stub renderer 验证按钮、叠加层内重新渲染、尺寸、dark 模式、无反相、关闭时 dispose。

## 查询直出路径的遗漏

`SqlQueryBlock` 的 `view === "echarts"` 分支并不走 `ChartBlock`，而是渲染 `EchartsFromResult`——后者用私有 effect 直接调 `echartsEngine.load().render()`。因此只放宽 `FULLSCREEN_LANGS` 对查询直出无效，按钮仍然不出现。

修复是把 `EchartsFromResult` 收敛为薄适配层：`buildEchartsOption(chart, result)` 生成标准 option 并序列化，交给 `<ChartBlock lang="echarts" source={optionJson} />`；无效 `chart` 配置仍在挂载前内联显示 `.chart-block-error`。至此 **ChartBlock 是所有 ECharts 来源的唯一渲染路径**，主题切换、`fromQuery` 解析、`ResizeObserver`、`dispose` 与全屏叠加层统一生效。`source` 是字符串，结果不变时字符串相同，不会因父组件重渲染而重复绘制。sqlite / duckdb / cypher 共用 `SqlQueryBlock`，一处改动全覆盖。

## 验证

`tsc --noEmit`、`biome check` 干净；`chart-fullscreen-surface` + `sqlite-query-block` 23 项、`mermaid-preview` / `mermaid-markdown` / `echarts-query-block` / `echarts-engine-registration` / `query-result-registry` / `duckdb-query-block` / `cypher-query-block` 129 项全过。五个语言的 `viewFullscreen` 标签沿用，本任务未改字典。

## Related Concepts

- [[concepts/chart-fullscreen-overlay]] — 叠加层对 SVG 与 canvas 引擎的分流
- [[concepts/chart-block-engine]] — 注册表、生命周期与 per-block dispose
- [[concepts/query-chart-binding]] — 方式 B（`view: echarts`）与方式 A（`fromQuery`）的分工

## Related Sources

- [[sources/back-846-mermaid-css-fullscreen]] — 被复用的叠加层实现
- [[sources/back-813-query-block-view-echarts]] — 方式 B 查询直出的原始实现
- [[sources/back-814-echarts-from-query]] — 方式 A 与注册表订阅机制

## Related Decisions

- [[decisions/fresh-render-for-fullscreen-overlay]] — 重新渲染使 canvas 引擎也能进叠加层
