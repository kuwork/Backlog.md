---
title: doc-28 - Cypher Live Query 演示
labels: [source, guide, cypher, graph, web-ui]
created_date: 2026-10-18 01:00
updated_date: 2026-10-18 01:00
source_path: backlog/docs/PRDS/cypher/doc-28 - Cypher-Live-Query-演示.md
---

# doc-28 - Cypher Live Query 演示

**类型**: guide

m-15（BACK-802~805）的验收样本页：页内所有 `cypher-query` 块在阅读视图都会实时执行，数据源用现成的 `demo` 演示图（用户库，18 节点 26 边：Person / Company / Project / Skill，`WORKS_AT` / `LEADS` / `HAS_SKILL` / `MEMBER_OF` / `COOPERATES_WITH`），无需准备数据。

## 覆盖的八个场景

| 场景 | 演示点 |
|---|---|
| 表格视图 | 默认视图，按公司聚合人数与平均评分 |
| 列表视图 | 单条记录字段竖向展示 |
| 单值视图 | 取首行首列，仪表盘式指标 |
| 图视图 | node/relationship 渲染为力导向图，图例与 Databases 页共用 |
| 实时刷新 | `refresh: auto` 订阅 `graph-updated`（用 `default` 语料图演示） |
| 样式预设 | `style` 三档及组合（该字段后被 BACK-811 移除） |
| 空结果 | 查不到行渲染空态而非报错 |
| 错误处理 | 未注册库名给出可读错误并列出可用库 |

## 两条实测注意事项

- RyuGraph 目前**不支持无类型关系模式**（`-[r]->` 匹配 0 行）与多类型并集（`-[r:A|B]->` 报 binder 错误），查询必须带具体关系类型。
- `demo` 这类用户库目前没有变更广播源，写 `refresh: auto` 时表现为等同 `manual`；按名匹配逻辑已就绪，未来有携带库名的广播即可触发。

## Related Concepts

- [[concepts/cypher-live-query-block]] — 被演示的块能力全景

## Related Sources

- [[sources/doc-27-cypher-live-query-prd]] — 演示所验收的设计稿
- [[sources/m-15-cypher-live-query]] — 演示对应的里程碑
- [[sources/back-802-cypher-query-block-core]] — 文本三视图的实现任务
