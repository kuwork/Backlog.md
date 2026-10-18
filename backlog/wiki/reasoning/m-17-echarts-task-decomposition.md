---
title: m-17 图表引擎的任务分解推理
labels: [reasoning, charts, web-ui, planning]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
description: 从 doc-30 的 7 项拆分压缩为 3 个任务的理由：按耦合度合并、按依赖排序、测试并入 AC
---

# m-17 图表引擎的任务分解推理

## 起点

doc-30 的原始拆分建议是 7 项：`ChartEngine 抽象`、`ECharts 引擎实现`、`ChartBlock 组件`、`接入点收敛`、`方式 B`、`方式 A`、`测试`。

## 判断一：前四项是同一个不可分割的改动

`types.ts` 只是接口定义，没有 `ChartBlock` 就没有调用者；`ChartBlock` 不接进 `PreBlock` 就渲染不到任何文档；接入点收敛（删 `renderMermaidIn`、改 `PreBlock`、改名 `ChartAwarePre`）如果单独成任务，会留下一个「组件写好了但没人用」的中间态，且中间态无法独立验证。

四项合并成一个任务后，验收才能落在**可观察行为**上：某段 fence 在阅读视图出图、明暗切换重绘、非法 JSON 回退代码块。所以 7 项压成 5 项。

## 判断二：测试不单列

「测试」单列任务的典型问题是它与实现的任务完成定义重叠：实现的 DoD 本来就要求 `bun test` 通过。把测试写成 AC 条目（每类图表可渲染、主题切换、非法输入回退、查询联动），既保证覆盖，也不用维护一个「测试任务」的伪依赖。

这笔交易有例外：**回归守卫可以单独立测试文件**。`echarts-engine-registration.test.ts` 就是在修 `themeRiver` 白屏时补的——它不是某条 AC 的验证，而是防止未来新增 series 漏注册的机制，因此值得单独存在，但不需要单独任务。

## 判断三：B 与 A 必须排在核心之后，且 B 先于 A

两者都只依赖 `ChartBlock` 与引擎，互不依赖。先做 B 的理由是它更简单（改解析器 + 一个渲染分支 + 纯函数造 option），能最早暴露「option 从结果里拼出来」的语义问题；A 需要引入 Context 与订阅语义，复杂度更高，等 B 验证完数据形态再动手更稳。

## 判断四：示例文档并入核心任务的 AC

最初想把「写一份覆盖所有图表的示例文档」作为独立任务，但它没有独立价值——示例跑不通就说明核心任务没做完。并入 BACK-812 的 AC#7 后，它变成核心的验收手段之一，而不是可选项。

## 结果

3 个任务：BACK-812（核心 + 文档）、BACK-813（B）、BACK-814（A）。实际执行时三者都出现了超出原 AC 的修补（漏注册组件、pictorialBar 示例不可用、水位图画法错误），这些都记在 BACK-812 的 Implementation Notes 里，而不是新开任务——与本仓库「先修再补记录」的习惯一致。

## 相关

- [[sources/m-17-echarts-chart-engine]]
- [[sources/doc-30-echarts-chart-engine-prd]]
- [[sources/back-812-core-echarts-engine]]
- [[concepts/chart-block-engine]]
