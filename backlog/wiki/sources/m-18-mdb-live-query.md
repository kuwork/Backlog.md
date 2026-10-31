---
title: m-18 - MDB Live Query
labels: [source, milestone, mdb]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/milestones/m-18 - mdb-live-query.md
---

# m-18 - MDB Live Query

MDB（Access）实况查询引擎里程碑：新增 `mdb-query` 围栏代码块，Access 库载入内存 SQLite（`query_only`）复用 sqlite-query 渲染；含 GBK 解码修复与 Web 端 CSV 导出。与 m-11/m-12/m-15 同类。

## 范围

- 引擎：`src/mdb/{paths,query,export,block,discover}.ts` 复用 sqlite-query 内核核心。
- 渲染：`MdbQueryBlock` 薄包装 `SqlQueryBlock`（engine id=mdb）；`MermaidMarkdown` 注册 `language-mdb-query` 围栏；服务端加 `/api/mdb/{files,query,export-csv}`。
- 国际化：四 locale 加 `mdbQueryBlock` 字典；guideline 文档加 Live MDB Query Blocks 小节。
- 验收：`doc-33` 用真实 `lizheng.mdb` 经 CLI `doc create` 生成。

## 关联任务

- [[sources/back-832-mdb-live-query]] — 实现与覆盖审计
- [[sources/back-833-live-query-inline-sql-editor]] — 四个查询块内联编辑器（含 mdb）
- [[sources/back-834-consolidate-query-block-i18n]] — 查询块 i18n 合并
- [[sources/doc-33-mdb-live-query-demo]] — 验收样本

## 关联概念

- [[concepts/mdb-live-query]]
- [[concepts/sql-query-blocks]]
