---
title: BACK-779 - duckdb-query 块显示/隐藏查询开关
labels: [source, duckdb, web-ui, ux]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-779 - Add-a-Show-Hide-Query-toggle-to-duckdb-query-blocks.md
---

# BACK-779 - duckdb-query 块显示/隐藏查询开关

m-12 第三个任务（镜像 BACK-774），给 `duckdb-query` 块加 Show/Hide Query 开关。开关本体是 BACK-778 通用 `SqlQueryBlock` 自带的共享 UI，本任务是接线 + 文案 + 每引擎组件测试，不是新控件。

## 目标

开关默认折叠，展开只读显示 `source` + SQL；展开/折叠不发查询请求，Refresh 不收起面板；解析失败时展开显示原始 fence 正文（而非仅错误文本）；`duckdbQueryBlock.showQuery` / `hideQuery` 四语言齐备且被开关使用；组件测试断言 `aria-expanded` / `aria-controls` 接线，及解析失败块展开露出原始正文。

## 实现要点

- 只是翻转一个标志：`src/web/components/DuckdbQueryBlock.tsx` 中 `actions.showHide` 从 `false` 改 `true`，无新渲染代码。行为与 SQLite 块一致：默认折叠（`queryOpen = false`），展开露出只读 `source:` 行加 `<pre>` 中的 SQL，切 `aria-expanded` / `aria-controls`；展开永不重跑查询，Refresh 重取行但保持面板展开。
- 不可解析的块仍渲染开关（它由 `engine.actions.showHide` 门控而非 `parsed.ok`），展开显示原始 fence 正文——对齐 SQLite 行为，并**取代**原 AC #5"解析失败时开关缺席"的措辞。
- `duckdbQueryBlock.showQuery` / `hideQuery` 四语言文案在 BACK-778 已随命名空间一次加齐，开关经 `engine.dict` 消费。

## 验证

`src/test/duckdb-query-block.test.tsx` 新增 `toggle()` 助手（跨两种文案态匹配 /query/i）与 BACK-779 套件，镜像 SQLite BACK-774 用例：默认隐藏、展开露出 source+SQL、无额外请求 + Refresh 保持展开、解析失败露原始正文；BACK-778 的门控测试收窄为只断言 Copy/Export 仍关闭。duckdb 组件套件 9 个测试绿；tsc、`bun run check .` 干净。

## Related Sources

- [[sources/back-778-duckdb-query-live-blocks]] — 前置任务：通用 SqlQueryBlock 与动作门控的来源
- [[sources/back-774-sqlite-query-show-hide-toggle]] — SQLite 侧镜像任务（行为契约照搬）
- [[sources/m-12-duckdb-explorer]] — 所属里程碑 DuckDB Explorer
- [[sources/doc-25-duckdb-explorer-prd]] — 设计来源 PRD
