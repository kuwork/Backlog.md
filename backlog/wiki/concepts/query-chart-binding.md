---
title: 图表与查询结果的两种绑定方式
labels: [concept, web-ui, charts, query-block]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
---

# 图表与查询结果的两种绑定方式

图表能不能直接吃查询结果？m-17 给了两档答案，**同时存在、按需选择**：紧耦合让查询块自己变成图，松耦合让独立图表引用命名查询块。两者共用同一套 ECharts option 与同一张引擎注册表（[[concepts/chart-block-engine]]）。

## 一图看清差别

| | 方式 B：`view: echarts` | 方式 A：`fromQuery` |
|---|---|---|
| 声明位置 | 查询块内部 | 独立 `echarts` fence |
| 数据表 | **不可见**（块的输出就是图） | 可见，照常渲染表格 |
| 图的数量 | 一块一图 | 一个查询可被多个图引用 |
| 配置形态 | `chart` 字段：简单映射 / `option` + `@result` 占位 | 标准 option + `fromQuery` 引用 |
| 刷新驱动 | 该块自己的执行与 `refresh: auto` | 被引用块重跑后，订阅者重绘 |
| 适用 | 一查询一图、想省掉表格 | 一份数据多视图、想把查询块当数据源晒出来 |
| 来源 | BACK-813 | BACK-814 |

## 方式 B：块即图

```yaml
view: echarts
chart: |
  { "type": "bar", "categoryField": "category", "valueField": "revenue" }
```

两种写法：**简单映射**（`type` + `categoryField` + `valueField`，可选标题/轴名/图例名，覆盖 bar/line/pie/scatter）与**高级**（`option` 键放完整 option，数据位置写占位符）。占位符只匹配整值：`"@result"` → 整个结果集的对象数组，`"@result:<列名>"` → 该列的扁平数组。

## 方式 A：图引用块

查询块加 `id`，图表在 dataset 或 series 上写 `fromQuery`：

```json
{ "dataset": { "fromQuery": "monthly" } }
{ "type": "bar", "fromQuery": "monthly", "categoryField": "month", "valueField": "revenue" }
```

第一种替换出 `dataset.source`，第二种替换出该 series 的 `data`（`pie` 出 `{name, value}` 对）；`categoryField` / `valueField` 是引用侧的取列指令，替换后自身移除。若 option 没有 `xAxis`，会用第一个解析成功的 series 的 `categoryField` 补一条类目轴。

## 共同的设计约束

- **只做数据替换，不执行任何东西**：两种方式都不引入函数挂载点，XSS 面与手写 `echarts` fence 完全一致。
- **fail-closed 解析**：`view` 枚举、`chart` / `id` 字段都显式放行，未知字段照旧报错。
- **错误就地显示**：非法 JSON、缺必填字段、未知 id 都是块内可读消息，绝不空白或崩溃。
- **刷新有边界**：方式 A 的注册表是**每篇文档一个实例**，跨文档引不到；重复 `id` 只 warn 并由后写覆盖；未使用 `fromQuery` 的图表不订阅注册表，不会跟着无关查询重绘。

## 怎么选

先问「表要不要露出来」。要（评审、审计、多图共享一份数据）→ 方式 A；不要（仪表盘式的一块一图）→ 方式 B。两种可以混用：同一篇文档里既有 `view: echarts` 的块，也有命名块 + 多个 `fromQuery` 图表。

## Related Concepts

- [[concepts/chart-block-engine]] — 两种方式共同的渲染底座
- [[concepts/sql-query-blocks]] — 被扩展的块模型（`view: echarts` / `chart` / `id`）
- [[concepts/live-sync-pattern]] — 查询重跑 → 图表重绘的传播链
- [[concepts/cypher-live-query-block]] — 同样支持 `view` 扩展的 Cypher 块

## Related Sources

- [[sources/back-813-query-block-view-echarts]] — 方式 B
- [[sources/back-814-echarts-from-query]] — 方式 A
- [[sources/doc-30-echarts-chart-engine-prd]] — 两种方式的原始设想（§8.3）
- [[sources/doc-31-echarts-demo]] — 两种方式的活示例
- [[sources/m-17-echarts-chart-engine]] — 里程碑
