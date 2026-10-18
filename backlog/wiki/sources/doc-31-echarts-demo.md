---
title: doc-31 - ECharts 图表演示
labels: [source, guide, web-ui, charts, demo]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
source_path: backlog/docs/PRDS/echarts/doc-31 - ECharts-图表演示.md
---

# doc-31 - ECharts 图表演示

m-17 的活演示页，839 行：**28 个 `echarts` fence、4 个 `chart` 字段、5 个 `sqlite-query` 块**，在 Web 阅读视图里打开即出图，样式与 doc-28（Cypher 实时查询演示）一脉相承。

## 三段结构

| 段 | 节 | 内容 |
|---|---|---|
| 一、独立图表 | §1–§22 | 每个内置 series 一节，配可直接复制的 option JSON |
| 二、查询直出 | §23–§24 | `view: echarts` 的简单映射式与高级 `option` + `@result` 式 |
| 三、图表引用查询 | §25–§28 | `fromQuery`：命名查询、series 级、dataset 级、生命周期 |

末尾「验收对照」表把 812/813/814 各自的「看什么」映射到具体节号。

## 为什么取代了 `echarts-examples.md`

最初的示例文件放在 `src/guidelines/cli-instructions/echarts-examples.md`，但 `cli-instructions` 目录的文件要在 `index.ts` 里注册才会进 `backlog instructions` 输出——它没有注册，`documents.md` 里的相对链接在终端是死的。迁移成 Backlog 文档后：`doc create` 生成、`doc update --content` 灌内容，且在 Web UI 里是活的。

## 故意不渲染的两节

- **§20 custom**：`custom` series 必须有 `renderItem` **函数**，JSON 表达不了，硬写成 fence 只会得到空图，所以用 `json` fence 只给形状。
- **§21 map**：`map`/`geo` 需先 `registerMap` 注册 GeoJSON，且地图数据必须来自合规来源；引擎**不内置地图数据**是刻意留白——把合规这一步交给显式接入。

## 验证中踩到的坑

- **主题河流静默白屏**：`singleAxis` 组件漏注册 → `setOption` 抛错被 promise 的 `.catch` 吞掉，容器留白；补上组件后 `singleAxis: {}` 仍然不出河流带，必须 `{ "type": "time" }`。
- **`symbolRepeat` 与 `symbolBoundingData`**：单独 `symbolRepeat` 时层数由数值决定；一旦同时写 `symbolBoundingData`，长度就按满值铺满、数据值不参与，必须配 `symbolClip` 才能裁回。
- **`image://` 图片 symbol**：不带 `symbolRepeat` 时一张图只贴在柱子起点（像掉在横轴上）；本地图片写 `image:///assets/images/xxx.jpeg`（`backlog/assets` 挂在 `/assets/`），且按 `symbolSize` 拉伸、不保比例。
- **叠币水位的正确画法**：底层用同形状 `pictorialBar + symbolRepeat + data:[100]` 当轨道，水位线以上会留一排灰币、看着像满格；正解是底层换成浅色 `bar`，只让彩色层 `symbolClip`。

验证方法从「数 SVG 节点」改为 **SSR 渲成 SVG 再用 resvg 转 PNG 看图**——只数节点会漏掉图形贴错位置这类问题。

## Related Concepts

- [[concepts/chart-block-engine]] — 页面里每个 fence 的渲染者
- [[concepts/query-chart-binding]] — 第二、三段演示的两套联动

## Related Sources

- [[sources/doc-30-echarts-chart-engine-prd]] — 设计稿
- [[sources/m-17-echarts-chart-engine]] — 交付里程碑
- [[sources/back-812-core-echarts-engine]] — 独立 fence 与系列覆盖
- [[sources/back-813-query-block-view-echarts]] — §23–§24
- [[sources/back-814-echarts-from-query]] — §25–§28
- [[sources/doc-28-cypher-live-query-demo]] — 同类演示页
