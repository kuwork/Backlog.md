---
title: BACK-781 - duckdb-query 结果导出 CSV
labels: [source, duckdb, server, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-781 - Export-duckdb-query-results-as-CSV.md
---

# BACK-781 - duckdb-query 结果导出 CSV

m-12 收官任务（镜像 BACK-776），给 `duckdb-query` 块打开 Export CSV 动作。引擎层（`buildDuckdbCsv`）、`POST /api/duckdb/export-csv` 路由与 API 客户端都在 BACK-778 已建好，本任务只是把 `DuckdbQueryBlock` 包装里的 `engine.actions.export` 翻为 `true`。

## 目标

`buildDuckdbCsv` 复用共享的 `validateReadOnlySql` + `resolveDuckdbSource` + `runDuckdbQuery`，再用共享 `renderCsvFile` / `defaultExportName` 序列化（UTF-8 BOM + RFC 4180），返回完整 CSV 文本与建议的 `<db stem>-<timestamp>.csv` 文件名；`POST /api/duckdb/export-csv` 返回与 SQLite 导出相同的 `{ filename, csv, rows, truncated }` 形状；客户端请求体严格只有 `{ source, sql }` 两个键（组件测试断言）；浏览器经共享 `saveTextFile`（File System Access API，blob 下载回退）把返回文本存到用户自选位置；Export 按钮仅在 ready 且非空时渲染，保存对话框被取消（`AbortError`）按 no-op 处理；`duckdbQueryBlock.exportCsv` / `exporting` / `exported` / `exportFailed` 四语言齐备。

## 实现要点

- 安全契约与 SQLite 导出一致且不变：行内容与目标路径永不从客户端出发；服务端重跑两道闸门并重执行，只回 CSV 文本；目的地由用户选而非服务端决定（该裁决来自 BACK-776 的 2026-10-13 需求变更，DuckDB 侧直接继承终态）。
- `buildDuckdbCsv` 的命名/引号/建前拒绝用例由 `src/test/duckdb.test.ts` 覆盖（如"生成带 `<stem>-<timestamp>.csv` 文件名与 BOM 正文的 CSV"、"在校验闸门拒绝写关键字"）。
- 组件测试 harness stub `showSaveFilePicker` 并捕获导出请求体：断言保存路径以建议文件名写入返回的 CSV（BOM + CRLF）、请求体经 `Object.keys` 断言**严格**两键、服务端拒绝时内联显示 "Export failed"、空结果时按钮缺席。
- BACK-778 的门控测试删除：Show/Hide（BACK-779）、Copy（BACK-780）、Export（本任务）全部上线后，DuckDB 已无待门控的动作按钮。

## 验证

duckdb 组件套件 15 个测试、duckdb 后端套件 14 个测试绿；`bunx tsc --noEmit`、`bun run check .` 干净。至此 DuckDB 块三个动作（Show/Hide、Copy Markdown、Export CSV）全部上线，m-12 任务集完成。

## Related Sources

- [[sources/back-778-duckdb-query-live-blocks]] — 前置任务：buildDuckdbCsv、路由与客户端接线的实际建设处
- [[sources/back-776-sqlite-export-csv]] — SQLite 侧镜像任务（安全契约与"目的地归用户"裁决的来源）
- [[sources/m-12-duckdb-explorer]] — 所属里程碑 DuckDB Explorer（本任务收官）
- [[sources/doc-25-duckdb-explorer-prd]] — 设计来源 PRD
