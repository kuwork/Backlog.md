---
title: 图表全屏叠加层接线与陷阱
labels: [execution, web-ui, charts]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
extracted_from:
  - BACK-846
  - BACK-847
---

# 图表全屏叠加层接线与陷阱

## 适用场景

给 `ChartBlock` 支持的新引擎接全屏浏览，或排查「按钮不出现 / 叠加层空白 / 图表太小 / 滚轮报错」。BACK-846（SVG）与 BACK-847（canvas、查询直出）两次接线总结。

## 标准步骤

1. 把 fence 语言加进 `FULLSCREEN_LANGS`；若该来源根本不经过 `ChartBlock`（如 `view: echarts` 的 `EchartsFromResult`），先把来源改造成 `ChartBlock` 的适配层，否则按钮永远不会出现。
2. 用 `getChartEngine(lang).id` 决定主题与反相，不要读全局 `useDiagramEngine()`。只有经典 Mermaid 需要 `invert(1) hue-rotate(180deg)`。
3. canvas 引擎在 `render` 前给叠加层容器设显式像素宽高（90vw × 90vh）；SVG 引擎在 `render` 后读 `viewBox` 做 contain-fit + 每边 50% 可读下限，再设显式像素尺寸由 flex 居中。
4. effect cleanup 里 `cancelled = true`、`cancelAnimationFrame`、`renderer.dispose(target)`、`target.replaceChildren()`。
5. jsdom 无法提供 canvas context 时，给引擎加 `__XXX_MOCK__` 注入点返回 stub `ChartRenderer`；断言打开后 flush 一次再检查叠加层内容（叠加层是异步重渲染）。
6. 回归：按钮存在、叠加层非空/非克隆、dark 模式、无反相、尺寸、关闭时 dispose，以及来源链路（真实 `SqlQueryBlock`）上的按钮。

## 常见陷阱

- **React `onWheel` 是 passive**：其中 `preventDefault()` 会被浏览器拒绝并抛 `Unable to preventDefault inside passive event listener`。必须 `addEventListener("wheel", …, { passive: false })`，并用 ref 读最新 view 以保证缩放中心。
- **Mermaid `data-processed`**：`run` 跳过已处理节点，克隆或复用节点都出空图；必须干净容器重渲染。
- **`echarts.init` 读创建时尺寸**：自动撑开的 flex 盒是 0×0，位图空白；尺寸必须在 init 前给。
- **`preserveAspectRatio` 不可控**：部分 Mermaid 输出用 `xMinYMin`，会把图钉在左上角；自算 fit 并设显式像素尺寸。
- **引擎 id 拿错**：全局 diagram 设置只管 `mermaid` 块，拿它判断 ECharts 会误加反相滤镜。
- **独立渲染路径绕过 ChartBlock**：查询直出曾自建 effect 调 engine，放宽白名单无效；先确认所有来源都进同一组件。
- **dispose 只做在主渲染 effect**：叠加层是第二个渲染容器，关闭时也要销毁，否则 ECharts 实例与 `ResizeObserver` 泄漏。
- **配置往返丢字段**：`parseConfig` 的返回对象字面量漏写 `diagramEngine`，加上序列化值带引号而解析未剥离，导致引擎设置重启回落 Pele；排查「设置不生效」时先验 `loadConfig()` 往返。

## Related Sources

- [[sources/back-846-mermaid-css-fullscreen]] — SVG 引擎接线与四项后续修复
- [[sources/back-847-echarts-css-fullscreen]] — canvas 引擎与查询直出链路收敛
