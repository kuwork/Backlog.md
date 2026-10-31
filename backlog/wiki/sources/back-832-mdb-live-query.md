---
title: BACK-832 - MDB (Access) 实况查询实现与覆盖审计
labels: [source, mdb, web-ui]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-832 - MDB-Access-live-query-implementation-and-coverage-audit.md
---

# BACK-832 - MDB (Access) 实况查询实现与覆盖审计

MDB（Access）实况查询功能（`src/mdb/*`）已实现并验证：GBK 解码修复就位，Web 端 CSV 导出已接。本任务记录功能完整状态与覆盖审计结论。

## 覆盖

- `mdb-query` 围栏块在阅读视图实时渲染（table/list/value），复用 sqlite-query 的网格/分页/`toCell` 逻辑。
- Access 库经 `mdb-reader` 载入内存 SQLite 实例（`PRAGMA query_only=ON`），再由 `runSqliteQuery` 执行；支持跨表 JOIN 与完整 SQL 面。
- GBK/CP936 文本经 `decodeMdbText` 字节级恢复后正确显示（修复截图中乱码）。
- 导出 CSV 经 Web UI（File System Access API / 下载），与 sqlite/duckdb/cypher 同级。
- 四道 fail-closed 安全闸门：扩展名白名单、只读 SQL 校验、`query_only` pragma、源路径逃逸拒绝。

## 决策记录

CLI 与 MCP 保持现状——sqlite/duckdb 实况查询块同样没有 CLI/MCP 入口，MDB 与之对齐，不新增独立查询入口。

## 验收样本

`doc-33`（`backlog/docs/PRDS/mdb/`）用真实 `lizheng.mdb` 作验收样本，经 CLI `doc create` 生成而非手写。

## 覆盖范围对照

| 能力 | MDB | sqlite/duckdb |
|---|---|---|
| Web 渲染（table/list/value） | OK | OK |
| 导出 CSV（浏览器下载） | OK | OK |
| `copy_to` 写回 | 不支持（服务端拒） | 仅 duckdb |
| CLI 入口 | 无（保持现状） | 无 |
| MCP 工具 | 无（保持现状） | 无 |

## Related Concepts

- [[concepts/mdb-live-query]] — mdb-query 引擎概念页
- [[concepts/sql-query-blocks]] — 第四引擎接入同一内核
- [[concepts/query-chart-binding]] — 与 `fromQuery` 图表联动

## Related Sources

- [[sources/doc-33-mdb-live-query-demo]] — 验收样本文档
- [[sources/m-18-mdb-live-query]] — MDB Live Query 里程碑
- [[sources/back-833-live-query-inline-sql-editor]] — 四个查询块内联编辑器
