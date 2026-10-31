---
title: BACK-833 - 实况查询内联 SQL 编辑器
labels: [source, web-ui]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-833 - Live-query-inline-SQL-editor.md
---

# BACK-833 - 实况查询内联 SQL 编辑器

四个实况查询块（sqlite-query/duckdb-query/mdb-query/cypher-query）在阅读视图渲染结果，但无法就地改语句：任何编辑都要离开页面、打开源 `.md`、重载。本任务给共享查询块加上内联编辑流。

## 交互

- 查询面板展开（Show query）时，面板首行右端出现编辑入口。
- 点击进入编辑态：语句变为语法高亮编辑器（Prism token 色衬透明 textarea，主题感知），带 Save/Test/Discard 三个动作 + Format 按钮（仅 SQL 引擎，原地重排缩进，不写文件）。
- Test 跑改动后的语句但**不写盘**，坏编辑在碰文件前可见。
- Save 把新语句写回源 Markdown 并立即重跑，网格刷新。
- Discard 丢弃编辑、恢复原语句、退出编辑。
- 测过的草稿跨分页、刷新、CSV 导出持续：翻页/刷新后继续显示草稿；结果集缩小后页码自动回弹进范围。

## 块定位与写回

- 首版按语句文本定位会失败：`parseQueryBlock` 剥离块标量缩进，解析语句与文件缩进不一致，`indexOf` 永远不匹配。现改为发送**整段围栏体**——这是唯一与文件逐字节一致的形式（`MermaidMarkdown` 的预处理均代码区间感知，围栏内容不动）。服务端定位该体、要求其唯一且被围栏包裹、只重写 `sql`/`query` 字段并原子写；返回重写后的体，块采纳它以便二次编辑仍能找到自己。
- `resolveQueryBlockFile` 依次试绝对路径、项目根、各集合根，返回项目内存在的候选（不同表面传的 path 风味不同）。
- 新端点 `POST /api/query-block/save`：路径守卫 + `.md` 白名单，定位围栏体、只重写 sql/query 字段、原子写（临时文件 + rename）。
- Milestone 在其类型中无 path，保持只读（不新增字段穿核心加载器）。

## 编辑器与 Format

- `HighlightedSqlEditor`：透明 textarea 叠滚动同步的 Prism 高亮 `<pre>`，复用阅读视图 token span，继承明暗主题；盒度量两侧一致使 token 对齐光标；层 `pointer-events:none`、随 `onScroll` 同步。
- Format 按钮（`engine.highlightLanguage === "sql"`；Cypher 无共享格式化器）用 `sql-formatter` `format`（`keywordCase:"upper"`，DuckDB→Postgres 方言、SQLite/MDB→standard SQL），仅预览不改文件；不可解析的语句原样保留并瞬时提示 `formatFailed`。

## 验证

`tsc --noEmit`、`biome` 干净；`query-block-save.test.ts` 17/17（块标量/行内/行内转块标量/Cypher `query:`/no-op/三种尾换行围栏/各种拒绝）；mdb 14/14（含三类缓存）；三套共 62/62；doc-33 副本端到端往返重写真实 `sql: |` 块。

## Related Concepts

- [[concepts/sql-query-blocks]] — 内联编辑影响所有查询块
- [[concepts/mdb-live-query]] — mdb-query 同享编辑流
- [[concepts/web-server]] — 写回端点

## Related Sources

- [[sources/back-832-mdb-live-query]] — 第四引擎
- [[sources/back-834-consolidate-query-block-i18n]] — 查询块 i18n 合并
