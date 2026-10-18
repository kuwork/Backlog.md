---
title: BACK-813 - 查询块 view: echarts（方式 B）
labels: [source, web-ui, charts, query-block]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
source_path: backlog/tasks/back-813 - Approach-B-query-block-view-echarts-tight-coupling.md
---

# BACK-813 - 查询块 view: echarts（方式 B）

让查询块**自己变成图**：结果不再渲染成表格，而是按 `chart` 字段直接出图。它是 `value` 视图的图表版——块内只有图，没有可见的数据表。

## 语法面

```yaml
view: echarts
chart: |
  { "type": "bar", "categoryField": "category", "valueField": "revenue" }
```

- 解析器把 `view` 枚举扩到 `table / list / value / echarts`（Cypher 还有 `graph`），`chart` 进 `knownFields`——**fail-closed 不变**，未知字段仍然报错。
- `chart` 必须是 JSON：单行串或 `chart: |` 块标量皆可。

## 两种写法

| 形式 | 形态 | 适用 |
|---|---|---|
| 简单映射 | `type` + `categoryField` + `valueField`，可选 `title` / `name` / `categoryAxisName` / `valueAxisName` | bar / line 等直角坐标系，一行配置出图 |
| 高级 | `option` 键放完整 ECharts option，数据位置写 `@result` 或 `@result:<列名>` | 多系列、双轴、自定义样式 |

`pie` 自动生成 `name`/`value` 对象数组，`scatter` / `effectScatter` 生成 `[x, y]` 对，其余按 category 轴 + value 轴填充。

## `@result` 占位符的两个形状

| 占位符 | 替换为 |
|---|---|
| `"@result"` | 整个结果集的**对象数组**（每行一个 `{列名: 值}`），喂 `dataset.source` 最省事 |
| `"@result:<列名>"` | 该列的**扁平数组**，喂 `series.data` / `xAxis.data` |

替换是**深度递归**的（option 树任意层级），但只匹配**整值等于**占位符的字符串——不做字符串内插。这一条是为了保持语法无歧义，也让 XSS 面与独立 fence 完全一致：仍然只有 `JSON.parse`，没有函数执行。

## 实现

- `src/web/charts/echarts-query.ts`：纯函数 `buildEchartsOption(chartJson, result)`，非法 JSON / 缺必填字段抛中文错误，由渲染层就地显示。
- `src/web/charts/EchartsFromResult.tsx`：复用 echarts 引擎的 `load / render / dispose`，主题、ResizeObserver、卸载清理全部免费继承。
- `SqlQueryBlock.tsx` 新增 `view === "echarts"` 分支，sqlite / duckdb / cypher 三个引擎通用。

## 边界

- 图表是这个块的**全部输出**，没有表格可看；想同时保留可见查询，用 [[sources/back-814-echarts-from-query|方式 A]]。
- `chart` 缺失或 JSON 非法时块内显示错误，不崩、不空白。

## Related Concepts

- [[concepts/query-chart-binding]] — 与方式 A 的取舍
- [[concepts/chart-block-engine]] — 被复用的引擎与生命周期
- [[concepts/sql-query-blocks]] — 被扩展的块模型

## Related Sources

- [[sources/back-812-core-echarts-engine]] — 前置依赖
- [[sources/back-814-echarts-from-query]] — 另一种联动方式
- [[sources/doc-30-echarts-chart-engine-prd]] — §8.3.B 的来源
- [[sources/doc-31-echarts-demo]] — §23–§24 的活示例
- [[sources/back-811-remove-style-field-add-highlight]] — 同一块模型上一次字段增删
