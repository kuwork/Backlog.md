---
title: BACK-814 - fromQuery 引用命名查询块（方式 A）
labels: [source, web-ui, charts, query-block, realtime]
created_date: 2026-10-18 22:00
updated_date: 2026-10-18 22:00
source_path: backlog/tasks/back-814 - Approach-A-echarts-fromQuery-named-query-block.md
---

# BACK-814 - fromQuery 引用命名查询块（方式 A）

与方式 B 相反：查询块**继续显示表格**，一个或多个独立 `echarts` block 通过 `fromQuery: <id>` 引用它的结果。图与表并存，看数看形两不误。

## 三个部件

| 部件 | 实现 | 职责 |
|---|---|---|
| 命名 | 共享解析器新增可选 `id` 字段 | 三类查询块（sqlite / duckdb / cypher）通用，fail-closed 不变 |
| 发布 | `src/web/charts/query-result-registry.tsx` | `QueryResultProvider` + `useQueryResultRegistry`，**每篇文档一个实例** |
| 引用 | `src/web/charts/from-query.ts` | 纯函数 `resolveFromQuery(option, resolve)`，两种形态的数据替换 |

`SqlQueryBlock` 在查询成功后（首次执行与 `refresh: auto` 重跑都算）把自己的结果按 `id` 写进注册表；`ChartBlock` 从 Context 取 `resolve`，只有 source 里出现 `fromQuery` 时才把注册表版本纳入 effect 依赖——否则每个无关查询刷新都会重绘所有图表。

## 两种引用形态

| 写法 | 替换结果 | 用途 |
|---|---|---|
| `{ "dataset": { "fromQuery": "monthly" } }` | `dataset.source` = 对象数组（每行 `{列名: 值}`） | 推荐：多系列共享一份数据，靠 `encode` 映射 |
| `{ "type": "bar", "fromQuery": "monthly", "categoryField": "month", "valueField": "revenue" }` | 该 series 的 `data`；`pie` 出 `{name, value}` 对 | 直接给简单图喂数 |

`categoryField` / `valueField` 只是**引用侧的取列指令**，替换后自身被移除，不会污染最终的 option。若 option 里没有 `xAxis`，会用第一个解析成功的 series 的 `categoryField` 补一条类目轴。

## 生命周期与边界

- **同文档作用域**：注册表按文档挂载（`MermaidMarkdown` 包 Provider），跨文档引不到。
- **重复 id**：`set` 时 `console.warn`，后写覆盖前写——不静默、也不崩。
- **未知 id**：整体解析失败并返回「未找到查询 id: xxx」，由渲染层就地显示。
- **自动重绘**：查询重跑 → 注册表更新 → 订阅者 effect 重跑 → `setOption` 覆盖。没用 `fromQuery` 的图表不订阅，不跟着重绘。
- **仍然只吃 JSON**：`fromQuery` 是数据占位，不是函数挂载点，XSS 面与方式 B 相同。

## Related Concepts

- [[concepts/query-chart-binding]] — 两种方式的取舍与边界
- [[concepts/chart-block-engine]] — 解析发生在 option 进入引擎之前
- [[concepts/live-sync-pattern]] — 查询刷新驱动的图表重绘
- [[concepts/sql-query-blocks]] — 新增的 `id` 字段

## Related Sources

- [[sources/back-812-core-echarts-engine]] — 前置依赖
- [[sources/back-813-query-block-view-echarts]] — 另一种联动方式
- [[sources/doc-30-echarts-chart-engine-prd]] — §8.3.A 的来源
- [[sources/doc-31-echarts-demo]] — §25–§28 的活示例
- [[sources/back-804-cypher-query-refresh-auto]] — 查询重跑机制的上游
