---
title: 共享能力的入口收敛模式
labels: [pattern, architecture, web, verification]
created_date: 2026-11-10 00:40
updated_date: 2026-11-10 00:40
---

# 共享能力的入口收敛模式

当一个能力已经挂在主渲染组件上，要把它扩展到「看起来一样」的另一类内容时，先问：**产出这份内容的路径是否都经过该组件**。若存在旁路，正确做法是把旁路收敛成薄适配层委托给统一底座，而不是把能力复制到每条路径上。

## 适用场景

- 同一语义内容有多个构造入口：fence 块、查询直出、预览与导出、SSR 与交互路径
- 新增能力只加在某一个组件，随后发现别的入口没有该能力
- 代码里出现两份重复的渲染与生命周期管理：主题、ResizeObserver、dispose

## 症状与根因

BACK-847 给 `echarts` 围栏加全屏按钮后，`view: echarts` 的查询直出仍然没有按钮。根因不是「遗漏 echarts 语言」，而是 `EchartsFromResult` 用私有 effect 直接调 `echartsEngine.load().render()`，整条路径**绕过 `ChartBlock`**；能力挂在 `ChartBlock` 上，所以永远不会出现。见 [[sources/back-847-echarts-css-fullscreen]]。

判定三问：

| 问题 | 为什么 |
|---|---|
| 产出同一语义内容的路径共有几条？ | 只数主入口会得出「已全覆盖」的错觉 |
| 能力挂在共享底座，还是挂在某条路径的组件上？ | 挂在组件上就天然只对那条路径生效 |
| 每条路径是否都把内容交给底座？ | 有一条例外就是缺口 |

## 标准做法

1. **列入口清单**：搜索底座组件的所有调用点，以及所有产出同类内容（同一 fence 语言、同一 option 结构、同一数据源）的地方。
2. **优先收敛**：把旁路改造成「只负责生成底座输入」的薄适配层。BACK-847 把 `EchartsFromResult` 改成 `buildEchartsOption(chart, result)` → `JSON.stringify` → `<ChartBlock lang="echarts" source={...} />`，删掉重复的 render effect、主题读取、ResizeObserver 与 dispose。
3. **删除分叉的生命周期代码**：主题、resize、dispose 只留在底座一处；旁路留着就会漂移。
4. **区分全局设置与块级身份**：`useDiagramEngine()` 返回的是全局 pele/mermaid 设置，对 echarts 块毫无意义；块级主题判断必须读解析后的 `engine.id`，否则 ECharts 会被误加经典 Mermaid 的反相滤镜。见 [[concepts/chart-block-engine]]。
5. **给每条入口各加一条断言**：既测组件链路，也测真实业务组件链路（`SqlQueryBlock` → `view: echarts`）。只测主入口无法防回归。

## 常见陷阱

| 陷阱 | 实例 | 预防 |
|---|---|---|
| 把「语言已注册」当成「所有入口已覆盖」 | BACK-847 首轮把 `echarts` 加进 `FULLSCREEN_LANGS` 就宣布完成 | 以「产出路径」而不是「语言名」为覆盖单位 |
| 已有测试反向固化缺口 | 两处测试原本断言「echarts 不显示全屏按钮」 | 扩展能力时先把「不支持」的断言翻转为「支持」 |
| 全局设置与块级 id 混用 | `engineId` 被拿去判断 echarts 的暗色 | 用 `getChartEngine(lang).id` |
| 配置往返不对称 | `serializeConfig` 写带引号值、`parseConfig` 直接比较且返回对象漏 `diagramEngine`，导致引擎设置重启回落 Pele | 保存与读取做 round-trip 验证，返回值用展开而非手写对象字面量 |
| 复制能力而非收敛 | 在旁路再实现一遍全屏逻辑 | 单点实现加多入口适配层 |
| canvas 旁路补能力时缺显式尺寸 | `echarts.init` 拿到 0×0 容器渲染空白 | 底座统一在 render 前设像素尺寸，见 [[execution/chart-fullscreen-overlay-gotchas]] |

## 与相邻模式的区别

[[patterns/cross-surface-feature-addition]] 处理「新增字段要穿透数据模型、持久化、CLI/TUI/Web/MCP、文档」的**纵向分层**遍历；本模式处理「已有能力要覆盖所有产出同一内容的入口」的**横向收敛**。前者逐层加字段，后者先消灭分叉路径。

## Related Sources

- [[sources/back-847-echarts-css-fullscreen]] — 首轮漏掉查询直出、随后收敛回 ChartBlock 的完整案例
- [[sources/back-846-mermaid-css-fullscreen]] — 能力最初挂在 ChartBlock 上的那一轮
- [[sources/back-844-korean-web-ui-locale]] — 同类「补齐所有入口」在 i18n 字典与编辑器外壳上的变体

## Related Concepts

- [[concepts/chart-block-engine]] — 统一渲染底座
- [[concepts/chart-fullscreen-overlay]] — 被扩展的能力
- [[concepts/query-chart-binding]] — 查询直出与围栏两条数据来源
- [[decisions/fresh-render-for-fullscreen-overlay]] — 干净容器重渲染的裁决
