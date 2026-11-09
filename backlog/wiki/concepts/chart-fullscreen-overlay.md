---
title: 图表全屏浏览叠加层
labels: [concept, web-ui, charts, lightbox]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
---

# 图表全屏浏览叠加层

`ChartBlock` 右上角展开按钮打开的一层暗色 CSS 叠加层，让任意受支持引擎的图表脱离文档宽度全屏查看。由 BACK-846 建立（Mermaid / Pele），BACK-847 扩展到 ECharts 与查询直出。它与图片 lightbox 共享交互词表，但**不共享实现**：lightbox 围绕 `img src`，这里围绕一次新的图表渲染。

## 入口与适用范围

`FULLSCREEN_LANGS = { mermaid, echarts }`。判定用 fence 语言，而**主题与尺寸判定用块实际引擎 id**（`getChartEngine(lang).id`）——`useDiagramEngine()` 返回的是全局 Pele/Mermaid 设置，对 ECharts 块没有意义，误用会让 ECharts 被当成经典 Mermaid 反相。

覆盖面不止围栏块：`view: echarts` 的查询直出经 `EchartsFromResult` 把 option 交给 `ChartBlock`，因此同样带按钮。所有图表来源收敛到一条渲染路径，是这套叠加层成立的结构前提。

## 渲染：干净容器重渲染

叠加层每次打开都 `target.replaceChildren()`，再 `getChartEngine(lang).load().render({ container: target, source, mode, resolveQuery })`。不克隆页面节点，也不复用旧容器：

- 经典 Mermaid 异步渲染，且 `run` 跳过带 `data-processed` 的节点——克隆或复用节点会得到一个空叠加层。
- 干净节点让 SVG 与 canvas 引擎走同一条链路，无需为位图另写分支。
- 容器是 React 渲染的普通 div，`role="application"`；关闭时 `renderer.dispose(target)` 销毁 canvas 实例与 `ResizeObserver`。

## 暗色策略按引擎分流

叠加层底色是 `bg-black/90`，页面亮色主题下浅色图表的深色线条会消失。裁决结果：

| 引擎 | 做法 |
|---|---|
| Pele | `mode: "dark"` 真·暗色，`--pele-*` 变量取自 `peleDarkPalette` |
| ECharts | `mode: "dark"`，`echarts.init(dom, "dark")` 内置主题 |
| 经典 Mermaid | 没有暗色重渲染，浅色烘焙 SVG 加 `filter: invert(1) hue-rotate(180deg)` |

反相是颜色取反（蓝会变橙），不是原生暗色；优点是零成本可读，代价是色相不保真。叠加白色底卡片曾被明确否决。

## 尺寸策略

| | SVG 引擎 | canvas 引擎 |
|---|---|---|
| 时机 | 渲染后读 `viewBox`（退回 `getBoundingClientRect`） | 渲染**前**给容器设 90vw × 90vh 显式像素盒 |
| 算法 | `fit = min(availW/W, availH/H)`；若某边 < 可用区 50% 则停止缩小、允许溢出 | 无 fit，图表自填满盒子 |
| 居中 | 显式像素尺寸 + 父级 flex 居中 | 容器本身居中 |
| 溢出 | 触发时 `hasOverflow` 打开 scale=1 下的拖拽 | 复位 `hasOverflow = false` |

不依赖 SVG 自带的 `preserveAspectRatio`——部分 Mermaid 输出用 `xMinYMin`，会把图钉在左上角且无论怎么缩都看不全。可读下限是对「极宽时序图被 contain 压到 1/6 屏高」与「按高度铺满导致横向溢出数屏」两端的折中。

## 交互

滚轮缩放以光标为中心、拖拽平移、左右 90° 旋转、重置、Esc 与关闭按钮；打开时锁 `body` / `html` 滚动。滚轮必须用 `addEventListener("wheel", …, { passive: false })` 原生绑定，React 委托的 passive 根监听器里 `preventDefault()` 会被拒绝并抛错；`viewRef` 持有最新 `ViewState`，避免原生监听器闭包读到过期 translate。

## Related Concepts

- [[concepts/chart-block-engine]] — 叠加层挂靠的组件、注册表与引擎生命周期
- [[concepts/query-chart-binding]] — 查询直出为何也要收敛到 ChartBlock
- [[concepts/web-ui-features]] — Web UI 交互特性总览

## Related Sources

- [[sources/back-846-mermaid-css-fullscreen]] — 建立叠加层
- [[sources/back-847-echarts-css-fullscreen]] — 扩展到 canvas 与查询直出

## Related Decisions

- [[decisions/fresh-render-for-fullscreen-overlay]] — 重渲染替代克隆的取舍
