---
title: BACK-775 - sqlite-query 结果复制为 Markdown
labels: [source, sqlite, web-ui, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-775 - Copy-sqlite-query-results-to-the-clipboard-as-Markdown.md
---

# BACK-775 - sqlite-query 结果复制为 Markdown

查询结果网格经常被贴进任务、决策和 memo，此前只能手敲表格。本任务给块头部加 Copy Markdown 动作：把组件状态里已有的 `SqliteQueryResult` 转成 GitHub 风格 Markdown 表放入剪贴板。纯客户端工作——无请求、无端点、不落盘；序列化器独立成模块以便不挂组件即可单测。

## 目标

`resultToMarkdownTable(result)` 生成 GFM 表（表头行 + 分隔行 + 每数据行一行）；列名或单元格内的竖线转义、内嵌换行折叠为 `<br>`、tab 变单空格；NULL 渲染为空单元格而非字符串 NULL（Markdown 无法灰显，写上 NULL 会与真文本值混淆）；单元格复用 `src/sqlite/query.ts` 的 JSON 安全契约；table/list 视图产出同一张表，value 视图复制单个标量为纯文本；只复制已加载的行（截断网格复制的正是读者所见）；剪贴板用 `navigator.clipboard`（同 MemoCard 模式），非安全来源（如 LAN http 地址）回退隐藏 textarea + execCommand，两条路都失败要显式报错；新 i18n 键 `copyMarkdown` / `copied` / `copyFailed` 四语言。

## 实现要点

- `src/sqlite/markdown.ts`（新）：`resultToMarkdownTable` + `cellToMarkdown`，无 React 无 fs；对 `SqliteCell` 只做**类型导入**，使 Web 组件引入它不会把 `bun:sqlite` 拖进浏览器 bundle——这是 `src/sqlite/` 继 `block.ts` 之后第二个面向 Web 的消费者，守住这条规则才让助手与引擎同目录共处值得。
- NULL 差异只争论一次并写在 `cellToMarkdown` 注释里：UI 网格灰显 NULL 因为有样式余量，Markdown 没有，所以写空单元格。
- 零行时禁用按钮的规则在**组件**而非序列化器：`resultToMarkdownTable` 对空结果仍返回裸表头（记录结构时有用），但块显示 "no rows"，复制一个不可见内容的按钮是谜题。
- 剪贴板回退存在的理由：本工具实践中经常经纯 http 的 LAN 地址打开，`navigator.clipboard` 是安全上下文限定 API；组件测试覆盖全部三种结局（异步 API、回退成功、双双被拒），因为这里的静默失败看起来与"什么都没发生"一模一样。
- **2026-10-13 后续变更**：空结果时 Copy 按钮改为**隐藏而非禁用**——灰着却占位的按钮读起来像"坏了"而非"无事可做"；`copyMarkdown` 在 `state.status === "ready" && rows.length > 0` 之外为 null，copied/failed 瞬态因此不可能触发；测试从 "disabled" 改为断言"元素不存在"。
- 测试立刻抓到的两个断言 bug：单列夹具的分隔行是 `| --- |` 而非 `| --- | --- |`；剪贴板 spy 数组在用例间共享泄漏，改为 stub 内重置 `writes.length = 0`。

## 验证

`bun test src/test/sqlite-markdown.test.ts src/test/sqlite-query-block.test.tsx` → 20 pass / 38 assertions（markdown 11 个新用例 + 组件 5 个新用例）；`bunx tsc --noEmit` 干净；`bun run check .` 0 错误。

## Related Sources

- [[sources/back-773-sqlite-query-live-blocks]] — 前置任务：查询块实时渲染本体
- [[sources/back-774-sqlite-query-show-hide-toggle]] — 前置任务：Show/Hide Query 开关（复用其组件测试 harness）
- [[sources/back-780-duckdb-copy-markdown]] — DuckDB 侧镜像任务（复用本任务的 markdown.ts 序列化器）
- [[sources/m-11-sqlite-explorer]] — 所属里程碑 SQLite Explorer Phase 1
- [[sources/doc-23-sqlite-explorer-prd]] — 设计来源 PRD
