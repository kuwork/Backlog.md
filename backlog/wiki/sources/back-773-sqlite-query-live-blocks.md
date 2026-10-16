---
title: BACK-773 - sqlite-query 代码块渲染实时结果
labels: [source, sqlite, web-ui, feature]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-773 - Make-sqlite-query-code-blocks-render-live-results.md
---

# BACK-773 - sqlite-query 代码块渲染实时结果

m-11（SQLite Explorer）第一个任务，让 `sqlite-query` 围栏代码块端到端真正可用：新建 `src/sqlite/` 模块解析块、强制只读 SQL、把 `source` 按**项目相对路径**在四道 fail-closed 闸门后解析，并在服务端用 `bun:sqlite` 只读句柄执行；Web UI 阅读视图渲染结果块。设计来源 doc-23 PRD（任务描述中引用为 doc-16 §2–§6）。范围裁剪：Embed 不属于本任务（留给 m-11 task 4）。

## 目标

解析块字段（`source` / `sql`（行内或 `|` 块标量）/ `view` / `refresh`），缺字段、未知字段、非法 `view` 给出可读报错；只读校验要求 `SELECT` 或 `WITH … SELECT` 开头、禁内部分号（容忍一个结尾 `;`）、关键字黑名单忽略引号与字符串字面量但**保留注释**（被注释掉的写操作同样拒绝）；服务端 `POST /api/sqlite/query` 返回 `{ columns, rows, truncated, elapsedMs, dbPath }`，失败 400 带中文原因；`GET /api/sqlite/files` 列项目 SQLite 文件（30s 缓存）；阅读视图渲染 table / list / value 三视图及 loading / error / empty / truncated 状态和 Refresh 按钮，编辑模式保留原始源码。

## 实现要点

- 模块划分：`block.ts`（YAML 子集解析）、`validation.ts`（引号/注释感知的只读校验）、`paths.ts`（source 解析 + 四道闸门，与 `searchProjectFiles` 共享排除目录常量）、`query.ts`（只读 `bun:sqlite`、500 行上限、空闲句柄缓存、JSON 安全值转换）、`discover.ts`（30s 缓存的全项目列举）。Web 侧经 `MermaidMarkdown` 的 `pre` override 挂载 `SqliteQueryBlock`。
- **`source` 只接受项目相对路径**：doc-16 初稿抄了插件的 `/` 前缀语法，但项目安全规则（`wiki/developer-notes/security-gotchas.md` §1，BACK-436/450/479 均执行）要求客户端路径必须相对；Windows 上 `isAbsolute("/data/shop.sqlite")` 为 true。前导 `/` 有独立报错，note-relative 变体被放弃而非保留第二含义。
- **只读的承重层是第三层**：形状校验 + 关键字黑名单只是 best-effort，`new Database(path, { readonly: true })` 加 `PRAGMA query_only` 才让校验漏洞只是 bug 而非事故；有绕过校验直接跑 `CREATE TABLE` 的测试钉住。关键字扫描刻意保留注释（fail-closed），首词与分号检查则剥离注释。
- **containment 两侧都要 realpath**：Windows 上项目根可能以 8.3 短路径（`ADMINI~1`）传入而文件 realpath 是长名，`relative()` 会算出 `..\..` 误拒所有数据库。
- 三个只有浏览器实查才暴露的缺陷：react-markdown 把 fence 正文作为**行数组**而非字符串传入（修复为递归 `textOf()`）；list 视图每行一个 grid 导致列宽逐行漂移（改为一整个 grid + `display: contents` + `minmax(6rem,max-content)`）；`.wmde-markdown` 自带 `dt`/`dd` 规则特异性 (0,2,1) 压过一切 Tailwind utility，重置只能内联样式。
- Windows 测试陷阱：`Database.close()` 后文件短暂锁定，`rmSync` 会**阻塞 21 秒**，清理改为非等待 `rm`；进程首个 SQLite 文件打开成本高，测试套件模块加载时预热一次。

## 验证

新增 28 个测试；`bunx tsc --noEmit`、`bun run check .` 与 sqlite 套件全绿。评审夹具 `backlog/databases/demo-shop.sqlite`（20 客户 / 15 产品 / 80 订单 + `order_details` 视图）与 `doc-23` 演示文档逐块覆盖三视图、空结果与全部四种拒绝路径。已知缺口：Embed 未实现；`demo-shop.sqlite` 是二进制 fixture 且不被 `.gitignore` 覆盖，提交前需决定随库发布还是脚本生成。

## Related Concepts

- [[concepts/web-ui-features]] — 浏览器阅读视图的 Markdown 渲染面（本任务在其中新增查询块类型）

## Related Sources

- [[sources/back-778-duckdb-query-live-blocks]] — DuckDB 侧镜像任务（本任务的组件被其重构为通用 SqlQueryBlock）
- [[sources/back-774-sqlite-query-show-hide-toggle]] — 后继任务：给结果块加 Show/Hide Query 开关
- [[sources/back-775-sqlite-copy-markdown]] — 后继任务：结果复制为 Markdown
- [[sources/back-776-sqlite-export-csv]] — 后继任务：结果导出 CSV
- [[sources/m-11-sqlite-explorer]] — 所属里程碑 SQLite Explorer Phase 1
- [[sources/doc-23-sqlite-explorer-prd]] — 设计来源 PRD
- [[developer-notes/security-gotchas]] — §1 客户端路径必须相对的安全规则，决定了 source 只收项目相对路径
