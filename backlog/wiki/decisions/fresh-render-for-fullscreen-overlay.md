---
title: 图表全屏叠加层采用干净容器重新渲染
labels: [decision, web-ui, charts]
created_date: 2026-11-10 00:27
updated_date: 2026-11-10 00:27
---

# 图表全屏叠加层采用干净容器重新渲染

## 背景

BACK-846 要给 Mermaid 图表加全屏浏览。最直觉的实现是把页面上已渲染好的 SVG `cloneNode` 进叠加层——零引擎调用、零异步、零主题问题。但实测在经典 Mermaid 引擎下叠加层内容为空，Pele 引擎却正常。同时 BACK-847 需要让 ECharts（canvas）也进同一个叠加层，而克隆位图节点天然不成立。

## 决定

叠加层每次打开都清空目标容器，按原 `source` 用 `getChartEngine(lang).load().render()` 在**干净节点**里重新渲染一次；主题、尺寸、dispose 全部围绕这次新渲染组织。所有引擎共用这条路径，`FULLSCREEN_LANGS` 成为唯一的能力开关。

## 理由

- 经典 Mermaid 异步渲染，且 `run` 会读容器 innerHTML 并跳过打了 `data-processed` 标记的节点。页面节点与克隆体都带这个标记，任何形式的「复用已渲染 DOM」都不可靠。
- 干净节点每次都是新的，没有处理标记，Pele 的同步渲染与 Mermaid 的异步渲染都能稳定出图。
- 重新渲染让 `mode` 成为可传参数：Pele / ECharts 直接要 `dark`，经典 Mermaid 保持浅色再用滤镜反相，不需要去改写已烘焙的 SVG 颜色。
- 代价只是多一次引擎 `load()`（模块已缓存）与一次渲染，换来 SVG / canvas 两类后端的行为统一。

## 被否方案

| 方案 | 否决原因 |
|---|---|
| 克隆页面 SVG 子树 | 经典 Mermaid 叠加层为空；canvas 克隆为空白位图 |
| 在叠加层里按 `mode: "dark"` 复用节点重渲染 | 同样撞上 `data-processed`，实测为空 |
| 叠加白色不透明卡片托住浅色图表 | 用户明确否决，要求切换图表自身主题为暗色 |
| 纯 contain 缩放 | 极端宽高比时序图被压到约 1/6 屏高、文字不可读 |
| 宽图按高度铺满（方案 B） | 高度清晰但横向溢出数屏，违背「避免宽度溢出」的约束，改用 contain + 可读下限 |
| React `onWheel` | passive 根监听器里 `preventDefault()` 抛错，改原生非 passive 绑定 |

## Related Concepts

- [[concepts/chart-fullscreen-overlay]] — 决定的落地形态
- [[concepts/chart-block-engine]] — 被复用的渲染契约

## Related Sources

- [[sources/back-846-mermaid-css-fullscreen]] — 决定产生与验证的任务
- [[sources/back-847-echarts-css-fullscreen]] — canvas 引擎受益于该决定
