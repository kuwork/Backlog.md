---
title: BACK-780 - duckdb-query 结果复制为 Markdown
labels: [source, duckdb, web-ui, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-780 - Copy-duckdb-query-results-to-the-clipboard-as-Markdown.md
---

# BACK-780 - duckdb-query 结果复制为 Markdown

m-12 第四个任务（镜像 BACK-775），让 `duckdb-query` 块把结果以 GitHub 风格 Markdown 表复制到剪贴板。序列化**复用** `src/sqlite/markdown.ts`（`resultToMarkdownTable` / `cellToMarkdown` 只消费通用 `{ columns, rows }` 网格），Copy 动作本体是通用 `SqlQueryBlock` 的共享 UI，因此 DuckDB 路径不需要新序列化器。

## 目标

table/list 视图复制整个网格、value 视图复制单个单元格；NULL 变空单元格，竖线/换行/tab 转义与 SQLite 路径完全一致（共享 `markdown.ts`）；无可复制内容时按钮**隐藏**而非禁用，成功提示约 2 秒后复原，失败显式报错；`duckdbQueryBlock.copyMarkdown` / `copied` / `copyFailed` 四语言齐备；剪贴板在非安全上下文（纯 http LAN 地址）回退隐藏 textarea。

## 实现要点

- 复用的成立依据：DuckDB 的 `toCell`（BACK-778）已把每个 DuckDB 类型强制进 `SqliteCell` 联合，BACK-778 的 `duckdb.test.ts` 证明强制转换正确，本任务证明它原样抵达剪贴板。
- 实现量只是翻转标志：`src/web/components/DuckdbQueryBlock.tsx` 中 `engine.actions.copy` 从 `false` 改 `true`；`copyMarkdown` / `copied` / `copyFailed` 四语言文案 BACK-778 已加齐，按钮经 `engine.dict` 消费。
- 头条测试用例喂给组件一个全 DuckDB 类型网格（BIGINT→`"1234567890123"`、DECIMAL→`"3.140"`、TIMESTAMP→ISO、DATE→ISO 日期、BLOB→`<blob 4 字节>`、NULL→`null`），断言复制的 GFM 表逐字等于 `| id | amount | ts | day | blob | note |` + 分隔行 + `| 1234567890123 | 3.140 | 2026-10-13T08:30:00.000Z | 2026-10-13 | <blob 4 字节> |  |`——行尾的 `|  |` 正是 NULL→空单元格的证明。另覆盖 value 视图裸标量（`3.140`）、失败路径显示 "Copy failed"、空结果按钮缺席；共享的 2 秒 "copied" 复原由 SQLite 套件（BACK-775）覆盖。
- BACK-778 的门控测试随之改名为"保持 Export CSV 动作关闭"——Show/Hide 与 Copy 已上线，只剩 Export CSV（BACK-781）未开。

## 验证

duckdb 组件套件 13 个测试绿；`bunx tsc --noEmit`、`bun run check .` 干净。

## Related Sources

- [[sources/back-778-duckdb-query-live-blocks]] — 前置任务：通用组件、toCell 与动作门控的来源
- [[sources/back-775-sqlite-copy-markdown]] — SQLite 侧镜像任务（markdown.ts 序列化器的原始实现）
- [[sources/m-12-duckdb-explorer]] — 所属里程碑 DuckDB Explorer
- [[sources/doc-25-duckdb-explorer-prd]] — 设计来源 PRD
