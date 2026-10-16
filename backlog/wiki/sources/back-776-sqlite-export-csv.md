---
title: BACK-776 - sqlite-query 结果导出 CSV
labels: [source, sqlite, server, web-ui, security]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-776 - Export-sqlite-query-results-as-CSV-next-to-the-database.md
---

# BACK-776 - sqlite-query 结果导出 CSV

查询结果随浏览器标签页生灭。本任务给 `sqlite-query` 块加 Export CSV 动作，是本表面第一个写向端点，因此刻意不长成通用文件写入器：客户端只发查询本就发送的 `source` 与 `sql`，服务端重新解析 source、重新校验只读 SQL、经既有只读路径重跑语句，行数据与目标路径永不来自客户端。注意：任务落地后经 2026-10-13 产品裁决，目的地从"数据库旁"改为"用户自选"（见实现要点）。

## 目标

原始设计：`POST /api/sqlite/export-csv` 收 `{ source, sql, filename? }`，写入目标为（realpath 后）数据库文件父目录，默认文件名 `<db-basename>-<YYYYMMDD-HHmmss>.csv`，返回项目相对路径 + truncated 标志，不泄漏绝对路径；两道服务端闸门（`resolveSqliteSource` + `validateReadOnlySql`）重跑，拒绝口径与查询端点一致；join 后再查一次 containment（最终绝对目标必须在 realpath 项目根内、不在 `isScanSkippedDir` 跳过的目录内，父目录是指向项目外的符号链接要拒绝）；永不覆盖既有文件（先时间戳再 `-1`、`-2` 递增）；CSV 按 RFC 4180（含引号/逗号/CR/LF 的字段加引号、内嵌引号双写、CRLF 行尾、UTF-8 带 BOM 使 Windows Excel 正确读中文），NULL 保持空字段。

## 实现要点

- 整个设计挂在一个拒绝上：**客户端不给行、不给目标路径**。显而易见的实现（浏览器 post 已渲染网格、服务端按指示落盘）离"向服务器可达的任何位置写任意字节"只差一步。组件测试断言请求体恰好是 `{ source, sql }`。
- containment 故意查两遍：`isInsideProjectRoot` 从 `paths.ts` 导出而非重写（两份 containment 规则必然漂移）；第二遍对 join 后的目标查，今天不可达但廉价，且能在未来放宽 `filename` 规则时兜底，有直接测试钉住。
- filename 提示不静默修复：分隔符、盘符、UNC、`..`、前导点一律中文原因**拒绝**，仅 Windows 非法字符（`<>:"|?*`）替换——把 `../../x` 静默改写成 `x` 会把错误变成惊吓。Biome 拒绝正则中的字面控制字符转义（`noControlCharactersInRegex`），改用带 `u` 标志的 `\p{Cc}`。
- **2026-10-13 后续变更（需求级）**：①导出目的地归用户——服务端不再写文件，`exportSqliteCsv` 改名 `buildSqliteCsv`，重跑同样两道闸门与只读语句后返回 CSV **文本**加建议文件名，浏览器经 File System Access API（`showSaveFilePicker`）保存、不支持时 blob 下载回退，被取消的保存对话框按 `AbortError` 视作 no-op；②无可做之事时隐藏而非禁用（与 Copy 按钮一致），仅在保存进行中保持可见但禁用以避免头部闪烁。安全模型不变：行内容与目标路径依旧不从客户端出发。
- 随之删除的死代码：`csv.ts` 的 `sanitizeCsvName` / `firstFreeTarget`（服务端不再决定文件名）、`paths.ts` 的 `isInsideProjectRoot`（它只为写闸门存在，读闸门已把访问钉在项目内）；端点返回从项目相对路径改为 `{ filename, csv, rows, truncated }`。
- 测试成本笔记：520 行逐条 INSERT 花 26 秒，改 100 条一批后 17 用例套件 4 秒；Windows 上 `Database.close()` 后 `rmSync` 阻塞的坑同 BACK-773，清理走非等待 `rm`。
- 附带修正 m-11 里程碑描述（此前把 CSV 导出列为 Phase 1 范围外，与本任务矛盾）。发现的 CLI 坑：`backlog milestone edit m-11 -d ...` 会连带**改标题**为标识串，需用 `-t "SQLite Explorer Phase 1"` 恢复；且冒号后的 `\n` 以字面 `/n` 存活进文件，手工修复。
- 已知缺口：无端到端 HTTP 路由测试（测试中构造 `Core` 过重，既有 sqlite 套件同样没有），handler 是薄包装、决策都在模块层覆盖；`demo-shop.sqlite` 仍无脚本再生成（BACK-773 遗留）。

## 验证

变更前 70 pass / 147 assertions；变更后 `bun test src/test/sqlite-csv.test.ts src/test/sqlite-query-block.test.tsx src/test/sqlite.test.ts src/test/sqlite-markdown.test.ts` → 62 pass / 119 assertions；组件测试 stub `showSaveFilePicker` 并断言交给 writable 的确切文本及无行时按钮缺席；`bunx tsc --noEmit` 干净；`bun run check .` 0 错误。

## Related Sources

- [[sources/back-773-sqlite-query-live-blocks]] — 前置任务：查询块实时渲染与四道路径闸门
- [[sources/back-781-duckdb-export-csv]] — DuckDB 侧镜像任务（复用 renderCsvFile / defaultExportName 与安全契约）
- [[sources/m-11-sqlite-explorer]] — 所属里程碑 SQLite Explorer Phase 1（本任务附带修正其范围描述）
- [[sources/doc-23-sqlite-explorer-prd]] — 设计来源 PRD
