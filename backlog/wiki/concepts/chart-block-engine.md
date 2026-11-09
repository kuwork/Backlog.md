---
title: 统一图表引擎（ChartBlock + 注册表）
labels: [concept, web-ui, charts, markdown]
created_date: 2026-10-18 22:00
updated_date: 2026-11-10 00:27
---

# 统一图表引擎（ChartBlock + 注册表）

Web 端 markdown 里的**所有图表**——mermaid 的流程图、ECharts 的数据图、以及未来的任何图表库——都从同一个组件进入，按 fence 语言查一张注册表决定由谁渲染。由 BACK-812 建立，BACK-819 扩展为**可切换引擎**（Pele 默认、Mermaid 回退），取代了 mermaid 原先「post-render DOM 替换」的独立通道。

## 三层结构

| 层 | 文件 | 职责 |
|---|---|---|
| 类型 | `src/web/charts/types.ts` | `ChartEngine { id, languages[], containerClassName?, containerStyle?, load() }`、`ChartRenderer { render(ctx), dispose? }`、`ChartRenderContext { container, source, mode }` |
| 注册表 | `src/web/charts/registry.ts` | `Map<language, engine>`，语言大小写不敏感；`registerChartEngine` / `getChartEngine` |
| 引擎 | `mermaid-engine.ts` / `echarts-engine.ts` / `pele-engine.ts` | mermaid 包装既有 `renderMermaidDiagram`；echarts 用 `echarts/core`；pele 经 Pele API 把 Mermaid 12.1.0 语法渲染为 SVG、零依赖 |
| 引擎 store | `src/web/charts/diagram-engine.ts` | 反应式 `activeEngine`（默认 `pele`），`get/set/normalize/useDiagramEngine`；`registry` 按它解析 `mermaid` 引擎 |
| 入口 | `src/web/components/ChartBlock.tsx` | 查表 → 惰性 `load()` → `render()` → 卸载 `dispose()` |

`ChartBlock` 不知道自己渲染的是哪种图，所以加一个引擎只需两件事：实现 `ChartEngine` 并在 `registry.ts` 里注册语言。

## 生命周期

- `requestAnimationFrame` 推一帧再 `init`——块刚插入 DOM 时尺寸还是 0，立即 `init` 会得到一张压扁的图。
- `load()` 内部缓存渲染器：同一份 echarts 模块只 import 一次，`echarts.use()` 也只执行一次。
- cleanup 里取消未执行帧、标记 `cancelled`，并对已渲染的容器调 `dispose()`——React 严格模式的双挂载、切换文档、改主题都会走这条路径。
- ECharts 的 `ResizeObserver` 与实例一起挂在容器元素上，`dispose` 时一并撤销，避免容器被回收后仍在监听。

## 主题

`useOptionalTheme()` 给出 `light` / `dark`，作为 `mode` 传进 `render`：ECharts 走 `echarts.init(dom, mode === "dark" ? "dark" : undefined)`，mermaid 走自己的 `MERMAID_THEME_BY_MODE`。**主题切换 = 依赖变化 = 重跑 effect**，不再需要 `key={theme}` 重挂载整棵 markdown 树。

## 可切换引擎：Pele 默认 + Mermaid 回退（BACK-819）

mermaid 不再是硬接线的渲染器，而是注册表里的两个 engine 之一（`pele` / `mermaid`），由运行时激活的引擎 id 决定谁承接 `mermaid` 语言的围栏：

- `src/web/charts/pele-engine.ts`：`ChartEngine` 实现，`languages: ["mermaid"]`，`render()` 经 Pele API 把 Mermaid 12.1.0 语法同步渲染为 SVG，零依赖；`PALETTES` 含亮/暗 token。
- `src/web/charts/diagram-engine.ts`：基于 `useSyncExternalStore` 的反应式 store，`activeEngine` 默认 `pele`，导出 `get/set/normalize/useDiagramEngine`。
- `registry.ts`：`getChartEngine("mermaid")` 按 `getActiveDiagramEngine()` 解析；echarts 仍按语言（不受引擎切换影响）。
- `ChartBlock.tsx`：`useDiagramEngine()` 的引擎 id 进入渲染 effect 依赖，切换即重渲。
- 设置页 **Diagram Engine** 下拉（Pele 默认 / Mermaid）写 `config.diagramEngine`（`config.yml` 的 `diagram_engine` 键，出厂默认 `pele`）。

暗色主题下 Pele 线条不可见的根因是 `--pele-line`/`--pele-border`/`--pele-fg` 曾被设为近黑；改为亮值（`#c9d1d9` / `#8b949e` / `#e6edf3`）后恢复。`src/web/charts/pele-engine.test.ts` 验证双引擎渲染 doc-32 的 25/25 mermaid 块。

**设置在重启后失效的坑（BACK-846 修复）**：`file-system/operations.ts` 的 `parseConfig` 在 switch 里已把 `diagram_engine` 解析进 `config.diagramEngine`，但函数末尾的手写返回对象字面量漏了这个字段，解析值每次都被丢弃；且 `serializeConfig` 写出带引号的 `diagram_engine: "mermaid"`，旧的字面比较也匹配不上。补字段 + 解析时剥离引号后 `loadConfig()` 往返才稳定返回 `mermaid`。引申的通用教训：手写返回对象与解析循环很容易脱节，改配置字段时务必验一次往返。

## 安全：只吃 JSON

`echarts` fence 的正文是一段 ECharts option 的 **JSON**，引擎只做 `JSON.parse`，函数永远不执行——与 mermaid 的 `securityLevel: "strict"` 同一口径。非法 JSON 或未知 series 时回退为普通代码块，不崩不空白。

代价是 `custom` series 的 `renderItem`、axis 的 `formatter` 函数都用不了；需要动态文本时用 ECharts 模板串（`"{b}: {c}"`）。

## 全系列注册与守卫

引擎用 `echarts/core` tree-shaking 入口，显式 `use()` 注册 **23 个 series**（含 v6 新增的 `chord`）与全部坐标/图形组件（grid、polar、singleAxis、calendar、parallel、radar、transform、graphic、timeline、brush、aria、matrix、thumbnail…）。

漏注册的后果是**静默白屏**：`setOption` 抛错，异常被 `ChartBlock` 的 `catch` 吞成一行 warn，容器留白。`themeRiver` 就是这样栽在 `SingleAxisComponent` 上的。因此加了 `src/test/echarts-engine-registration.test.ts`——对照 `echarts/charts` 的每个导出断言「已注册」，漏一个就构建失败。

## 全屏浏览叠加层（BACK-846 / BACK-847）

`ChartBlock` 也是全屏入口的宿主：`FULLSCREEN_LANGS = { mermaid, echarts }` 决定右上角是否出现展开按钮。叠加层**在同一个组件内重新渲染**图表到干净容器，而不是克隆页面节点——经典 Mermaid 的 `run` 会跳过 `data-processed` 节点，克隆经常出空图；干净节点同时让 canvas 引擎可用。要点：

- 主题判定按 `getChartEngine(lang).id`，不是全局 `useDiagramEngine()`：Pele / ECharts 用 `mode: "dark"`，经典 Mermaid 用浅色 SVG + `invert(1) hue-rotate(180deg)`。
- canvas 引擎须在 `init` 前给容器显式像素尺寸；SVG 引擎在渲染后按 `viewBox` 做 contain-fit + 可读下限。
- 滚轮缩放用原生 `{ passive: false }` 绑定；关闭时 `renderer.dispose(target)` 销毁第二个实例的 `ResizeObserver`。
- 完整架构见 [[concepts/chart-fullscreen-overlay]]。

**查询直出也归到这里**：`view: echarts` 原由 `EchartsFromResult` 自建 effect 直接调引擎，绕过 `ChartBlock` 因而没有按钮；BACK-847 把它收敛成「构建 option → 交给 `<ChartBlock lang="echarts" source={optionJson} />`」的薄适配层。至此所有图表来源只有一条渲染路径，注册表、`fromQuery` 解析、主题、dispose 与全屏能力才真正统一。

## 与旧 mermaid 路径的差异

| | 旧 | 新 |
|---|---|---|
| 触发 | 渲染完成后扫描 DOM 替换 `<pre>` | `PreBlock` 在渲染时按语言返回组件 |
| 主题 | `key={theme}` 重挂载整个 markdown | effect 依赖 `mode`，只重绘图表 |
| 生命周期 | 全局 `initialize()`，无 per-block dispose | 每块独立 init / resize / dispose |
| 编辑器预览 | `MermaidAwarePre` | `ChartAwarePre`，与正文同一套查表逻辑 |

## Related Concepts

- [[concepts/chart-fullscreen-overlay]] — 挂在本组件上的全屏叠加层
- [[concepts/query-chart-binding]] — 让图表吃查询结果的两种方式
- [[concepts/markdown-pipeline]] — 围栏分支的挂载点
- [[concepts/sql-query-blocks]] — 图表视图所属的块模型
- [[concepts/cypher-live-query-block]] — 同为「围栏 → 实况渲染」的邻居

## Related Sources

- [[sources/back-812-core-echarts-engine]] — 建立者
- [[sources/doc-30-echarts-chart-engine-prd]] — 抽象的设计稿
- [[sources/m-17-echarts-chart-engine]] — 里程碑
- [[sources/back-640-mermaid-rendering-fixes]] — 被替换的旧路径上的修复历史
- [[sources/back-819-switchable-diagram-engine]] — 把 mermaid 改为可切换引擎、Pele 默认
- [[sources/doc-32-mermaid-diagram-gallery]] — 随本任务发布的 Mermaid 画廊（18 类 25 例）
- [[sources/back-846-mermaid-css-fullscreen]] — 全屏叠加层与引擎设置重启修复
- [[sources/back-847-echarts-css-fullscreen]] — 叠加层扩展到 ECharts、查询直出收敛到本组件
