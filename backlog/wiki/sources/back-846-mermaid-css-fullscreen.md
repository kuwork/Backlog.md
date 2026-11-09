---
title: BACK-846 - Mermaid 图表 CSS 全屏浏览入口
labels: [source, web-ui, charts, mermaid, lightbox]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
source_path: backlog/tasks/back-846 - Add-CSS-fullscreen-entry-for-Mermaid-diagrams.md
---

# BACK-846 - Mermaid 图表 CSS 全屏浏览入口

`ChartBlock` 渲染的 Mermaid / Pele 图表原本没有图片那样的全屏浏览入口。本任务在块右上角加展开按钮，打开一个暗色 CSS 叠加层，交互与图片 lightbox 对齐；过程中连带修掉引擎设置重启失效、极宽图被压扁、滚轮报错三个问题。

## 目标

- 右上角展开按钮（仅 SVG 类引擎），`viewFullscreen` 标签在五种语言同步落地。
- 暗底叠加层支持以光标为中心的滚轮缩放、放大/溢出时拖拽平移、左右旋转 90°、重置、Esc 与关闭按钮；打开时锁定页面滚动。
- 复用 lightbox 的 `zoomIn` / `zoomOut` / `resetZoom` / `rotateLeft` / `rotateRight` / `close` 文案，不新建一套字典。
- a11y：外层 `role="dialog" aria-modal`，缩放面 `role="application"`；背景点击关闭刻意不做（与 lightbox 一致），以符合 biome 的静态元素交互规则。

## 实现要点

**叠加层靠重新渲染，不靠克隆。** 早期方案把页面已渲染的 SVG `cloneNode` 进叠加层，但经典 Mermaid 引擎异步渲染、且其 `run` 会跳过带 `data-processed` 的节点，叠加层经常是空的。终态是每次打开都往一个干净容器重新 `load().render()`，SVG 与 canvas 引擎都可靠。

**暗底上的分引擎处理**：Pele 用 `mode: "dark"` 真·暗色（`--pele-*` 变量取自 `pele-engine.ts` 导出的 `peleDarkPalette`）；经典 Mermaid 没有暗色重渲染，对其浅色烘焙 SVG 施加 `filter: invert(1) hue-rotate(180deg)`。用户明确否决过「叠加白色卡片」的做法。

**尺寸策略是 contain-fit + 可读下限**：读 SVG 的 `viewBox`（无则退回 `getBoundingClientRect`）得固有宽高，先按 `min(availW/naturalW, availH/naturalH)` 全览缩放；若某边会小于可用区的 50%，则停止缩小、允许溢出并开放拖拽。这么做是为了救回宽高比极端的时序图——纯 contain 会把它压到约 1/6 屏高且文字不可读，而按高度铺满（曾考虑的方案 B）又会横向溢出好几屏。显式像素尺寸 + 父级 flex 居中，不依赖 SVG 自带的 `preserveAspectRatio`（部分 Mermaid 输出对齐左上，会把图钉在角落）。

**滚轮必须原生非 passive 绑定**：React 把 `onWheel` 委托成 passive 根监听器，其中调 `preventDefault()` 会被浏览器拒绝并抛 `Unable to preventDefault inside passive event listener`。改为 `overlayRef.addEventListener("wheel", …, { passive: false })`，并用 `viewRef` 读取最新视图状态以保证缩放中心正确。

**顺带修掉引擎设置重启回落 Pele**：`file-system/operations.ts` 的 `parseConfig` 在 switch 里确实解析了 `diagram_engine`，但函数末尾的返回对象字面量漏写 `diagramEngine` 字段，解析值每次都被丢弃；另 `serializeConfig` 写的是带引号的 `diagram_engine: "mermaid"`，旧逻辑直接字面比较也匹配不上。补字段 + 解析时剥离引号后，`loadConfig()` 往返验证得到 `diagramEngine => mermaid`。

## 验证

`tsc --noEmit`、`biome check` 干净；`chart-fullscreen-surface`（jsdom + Mermaid mock）覆盖叠加层非空、Pele 暗变量、经典 Mermaid 反相滤镜；`mermaid-preview` / `diagram-engine` / `mermaid-markdown` 相关测试全过。测试因叠加层改为异步重渲染，需在打开后 flush 定时器再断言。

## Related Concepts

- [[concepts/chart-fullscreen-overlay]] — 叠加层架构、分引擎主题与尺寸策略
- [[concepts/chart-block-engine]] — 承载全屏按钮的组件与引擎注册表

## Related Sources

- [[sources/back-847-echarts-css-fullscreen]] — 把同一叠加层扩展到 canvas 引擎
- [[sources/back-819-switchable-diagram-engine]] — Pele / 经典 Mermaid 双引擎的由来
- [[sources/doc-32-mermaid-diagram-gallery]] — 暴露极端宽高比问题的图表画廊

## Related Decisions

- [[decisions/fresh-render-for-fullscreen-overlay]] — 为什么叠加层重新渲染而非克隆
