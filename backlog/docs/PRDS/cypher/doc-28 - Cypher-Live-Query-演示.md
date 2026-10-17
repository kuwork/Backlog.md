---
id: doc-28
title: Cypher Live Query 演示
type: guide
created_date: '2026-10-17 01:04'
---
# Cypher Live Query 演示

BACK-802 ~ BACK-805 的验收样本（对应 m-15）。本文档所有 `cypher-query` 块在阅读视图里都会**实时执行**并把结果渲染出来；数据源用现成的 `demo` 演示图，不需要你准备数据。

## 数据源

| 项 | 值 |
|---|---|
| 数据库 | `demo`（注册名，用户库；公司 / 人员 / 项目 / 技能，18 节点 26 边） |
| schema | `Person` / `Company` / `Project` / `Skill` 节点；`WORKS_AT` / `LEADS` / `HAS_SKILL` / `MEMBER_OF` / `COOPERATES_WITH` 关系 |
| 对照 | `default`（语料图，§5 的 live 演示用它） |

```bash
bun run src/cli.ts browser --no-open   # 打开 Web UI，进入本页查看渲染结果
```

> [!IMPORTANT]
> `source` **一律是数据库注册名**（`backlog graph list` 列出的名称），不是路径。未知名与路径形态写法都会被拒绝（doc-27 §2）。

## 1. 表格视图（默认）

按公司汇总人数与平均评分：

```cypher-query
source: demo
view: table
query: |
  MATCH (p:Person)-[:WORKS_AT]->(c:Company)
  RETURN c.name AS company, COUNT(*) AS headcount, AVG(p.rating) AS avg_rating
  ORDER BY headcount DESC
```

## 2. 列表视图

单条记录字段竖向展示时用 `view: list`——张三的技能清单：

```cypher-query
source: demo
view: list
query: |
  MATCH (p:Person)-[:HAS_SKILL]->(s:Skill)
  WHERE p.name = '张三'
  RETURN s.name AS skill, s.category AS category
```

## 3. 单值视图

只要一个数（仪表盘式指标）时用 `view: value`，取结果第一行第一列。demo 图的人员总数：

```cypher-query
source: demo
view: value
query: MATCH (p:Person) RETURN COUNT(*)
```

## 4. 图视图

`view: graph` 把 node/relationship 结果渲染为力导向图，图例与 Databases 页共用同一份配置（组件右上角齿轮可改，立即生效）：

```cypher-query
source: demo
view: graph
query: |
  MATCH (p:Person)-[r:WORKS_AT]->(c:Company)
  RETURN p, r, c
```

> 注：RyuGraph 目前不支持无类型关系模式（`-[r]->` 匹配 0 行）与多类型并集（`-[r:A|B]->` 报 binder 错误），查询需带具体关系类型。

## 5. 实时刷新

`refresh: auto` 订阅 `graph-updated` 广播：语料图变化（新增/编辑任务等）后块会自动重跑。把任一任务改个状态，下面的计数会自己更新（块头的 Live 徽标可暂停/恢复）：

```cypher-query
source: default
view: value
refresh: auto
query: MATCH (f:FileNode) WHERE f.type = 'task' RETURN COUNT(*)
```

> 注：`demo` 这类用户库目前没有变更广播源，块上写 `refresh: auto` 时表现为等同 manual；按名匹配的逻辑已就绪，未来有携带库名的广播即可触发（doc-27 §7）。

## 6. 样式预设

`style` 字段三档可组合：`compact`（收紧行高字号）、`striped`（斑马纹）、`borderless`（去边框）。非法值静默忽略；sqlite-query / duckdb-query 块同样可写。下面用同一条项目查询对比五种写法：

默认（不写 style）：

```cypher-query
source: demo
view: table
query: |
  MATCH (pr:Project)
  RETURN pr.name AS project, pr.status AS status, pr.budget AS budget
  ORDER BY pr.startYear
```

`style: compact`（行高字号收紧，适合密集数据）：

```cypher-query
source: demo
view: table
style: compact
query: |
  MATCH (pr:Project)
  RETURN pr.name AS project, pr.status AS status, pr.budget AS budget
  ORDER BY pr.startYear
```

`style: striped`（斑马纹，长表更易扫读）：

```cypher-query
source: demo
view: table
style: striped
query: |
  MATCH (pr:Project)
  RETURN pr.name AS project, pr.status AS status, pr.budget AS budget
  ORDER BY pr.startYear
```

`style: borderless`（去边框，融入正文）：

```cypher-query
source: demo
view: table
style: borderless
query: |
  MATCH (pr:Project)
  RETURN pr.name AS project, pr.status AS status, pr.budget AS budget
  ORDER BY pr.startYear
```

`style: compact striped`（组合生效）：

```cypher-query
source: demo
view: table
style: compact striped
query: |
  MATCH (pr:Project)
  RETURN pr.name AS project, pr.status AS status, pr.budget AS budget
  ORDER BY pr.startYear
```

## 7. 空结果

查不到行时渲染空态，而不是报错：

```cypher-query
source: demo
view: table
query: MATCH (p:Person) WHERE p.city = '拉萨' RETURN p.name, p.role
```

## 8. 错误处理

未注册的数据库名会在块内给出可读错误（并列出可用库名），不影响页面其余部分：

```cypher-query
source: nope
query: MATCH (p:Person) RETURN p.name LIMIT 5
```
