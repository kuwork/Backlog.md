---
title: BACK-774 - sqlite-query 块显示/隐藏查询开关
labels: [source, sqlite, web-ui, ux]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-774 - Add-a-Show-Hide-Query-toggle-to-sqlite-query-blocks.md
---

# BACK-774 - sqlite-query 块显示/隐藏查询开关

BACK-773 渲染的 `sqlite-query` 块只给读者看结果行，看不到背后的语句，核对数字要切编辑模式找围栏块。本任务在块头部加 Show/Hide Query 开关，展开时只读内联展示 `source` 与 SQL。纯 Web 侧：开关不发请求、不重跑查询，不含 Copy/Export（那是 BACK-775/776）；显示状态只在组件内、默认折叠、不持久化、不在指向同一 source 的两个块之间共享。

## 目标

每种块状态（loading / ready / empty / error）都渲染恰好一个开关且查询进行中可用；解析失败的块展开时逐字显示原始 fence 正文（定位块 YAML 笔误的最快途径）；默认折叠，展开不发额外请求，Refresh 不收起已展开面板；展开面板以只读等宽文本显示 `source` 与语句，保留换行、长行横向滚动；新 i18n 键 `sqliteQueryBlock.showQuery` / `hideQuery` 覆盖 en / ja / zh-CN / zh-TW；真按钮带 `aria-expanded` / `aria-controls`，键盘可达，样式与同行 Refresh 按钮一致。

## 实现要点

- `src/web/components/SqliteQueryBlock.tsx`：一个 `useState`、一个常驻按钮（`aria-controls` 的 id 来自 `useId`）、面板渲染 `source` + 解析后 SQL（解析失败回退原始块 prop）。
- 唯一真实成本在测试 harness 而非功能：BACK-773 已教训过"单测全绿不等于接线正确"，所以"展开不重查"用**计数 `/api/sqlite/query` 的 fetch 调用**断言（首绘 1 次、Refresh 后 2 次、面板仍在）——这是全套件中唯一能在有人把块正文塞进查询 `useEffect` 依赖时报错的测试。
- `<pre>` 踩中 list 视图同一个坑：`.wmde-markdown` 以 (0,1,1) 特异性给每个 `<pre>` 加代码块外观，压过一切 utility class，故 `PRE_RESET` 以内联样式应用，注释指向既有的 `dt`/`dd` 重置。

## 验证

`bun test src/test/sqlite-query-block.test.tsx` 4 pass；`bun test src/test/mermaid-markdown.test.tsx src/test/sqlite.test.ts` 85 pass；`bunx tsc --noEmit` 干净；`bun run check .` 0 错误（14 个既存 `any` 警告）。无 locale 完整性测试，但 `TranslationDict` 由 `en.ts` 派生，ja/zh-CN/zh-TW 缺键即 tsc 错误而非静默回退英文。

## Related Sources

- [[sources/back-773-sqlite-query-live-blocks]] — 前置任务：查询块实时渲染本体
- [[sources/back-775-sqlite-copy-markdown]] — 后继任务：结果复制为 Markdown
- [[sources/back-779-duckdb-query-show-hide-toggle]] — DuckDB 侧镜像任务（同一共享开关的接线）
- [[sources/m-11-sqlite-explorer]] — 所属里程碑 SQLite Explorer Phase 1
- [[sources/doc-23-sqlite-explorer-prd]] — 设计来源 PRD
