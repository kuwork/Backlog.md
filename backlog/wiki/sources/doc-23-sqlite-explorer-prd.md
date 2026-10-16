---
title: doc-23 - SQLite Explorer 只读查询设计
labels: [source, design, sqlite, web-ui]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/docs/PRDS/sqlite/doc-23 - SQLite Explorer：只读 SQL 浏览与查询能力.md
---

# doc-23 - SQLite Explorer 只读查询设计

SQLite Explorer 一期设计稿（v1），参考 Obsidian SQLite Explorer 插件但明确不照搬其实现栈：交互语义照抄（`sqlite-query` 围栏块 + table/list/value 视图 + Embed），执行栈换成 `bun:sqlite` + HTTP API 服务端执行，不引入 sql.js/WASM。一期只做阅读态代码块渲染；CLI 子命令、MCP 工具、独立数据库浏览视图、CSV 导出之外的浏览面均不在本期。对应里程碑 [[sources/m-11-sqlite-explorer|m-11]]，验收样本见 [[sources/doc-24-sqlite-explorer-demo|doc-24]]。

## 目标

1. 任意 Backlog 文档（task / doc / decision / memo / wiki）的阅读视图里，用 `sqlite-query` 围栏块嵌入实时 SQL 查询，三种展示模式 `table`（默认）/ `list` / `value`；编辑态一律显示源码。
2. 只读保证：任何路径都写不到数据库文件。
3. Embed：把实时块原地替换为带时间戳的静态 Markdown 表格快照（写回按原块文本精确匹配定位，匹配不到即报错不写）。

## 实现要点

- **数据源与路径**：搜索根为 `resolve(projectRoot)` 下任意位置（`<backlog>/databases/` 只是习惯存放处）；发现规则复用 `src/file-system/operations.ts` 的 `searchProjectFiles` 遍历语义——排除 `node_modules` / `.git` / `dist` / `build` / `.locks`，跳过点开头目录（`.backlog` 例外），扩展名白名单 `.sqlite` / `.sqlite3` / `.db`。`source` 一律是项目相对路径：不接受前导 `/`（Windows 下 `isAbsolute("/x")` 为真，见 `wiki/developer-notes/security-gotchas.md` §1），不接受文档相对路径。SQLite 文件不进 `databases/registry.json`（该注册表只描述 Kuzu 图数据库）。
- **安全闸门（fail-closed 四道）**：拒绝前导 `/` / 绝对路径 / 盘符 / UNC / URL / `~`；归一化后必须落在项目根内（`..` 逃逸报错不静默裁剪）；`realpath()` 后仍在项目根内（拦符号链接逃逸）且不在排除目录；扩展名白名单 + SQLite 魔数校验（文件头 `SQLite format 3\0`）。任一不过：块内渲染错误原因，不抛异常、不影响页面其余部分。
- **只读三层**：静态校验（必须以 `SELECT` 或 `WITH … SELECT` 开头、单语句、仅容忍末尾一个分号）→ 关键字黑名单（`INSERT` `UPDATE` `DELETE` `REPLACE` `CREATE` `ALTER` `DROP` `ATTACH` `DETACH` `PRAGMA` `VACUUM` `REINDEX` `ANALYZE` `BEGIN` `COMMIT` `ROLLBACK` `SAVEPOINT` `RELEASE`，匹配时跳过双引号标识符与单引号字符串字面量）→ 物理只读（`new Database(path, { readonly: true })` + `PRAGMA query_only = true`）。第三层把"校验写错"从事故降级为 bug。
- **执行与传输**：`POST /api/sqlite/query`（请求 `{ source, sql, view, maxRows?, docPath? }`，响应 `{ columns, rows, truncated, elapsedMs, dbPath }`）；`GET /api/sqlite/files` 列出项目内 SQLite 文件（按 mtime 聚合缓存 30s）。服务端按 `realpath` 缓存句柄，多块共享，空闲 60s 关闭。默认 `SQLITE_MAX_ROWS = 500`，超出截断并置 `truncated: true`，不提供分页。已知约束：`bun:sqlite` 同步执行无查询超时，病态 SQL 会占住 Web 服务主线程（worker 隔离留作后续）。
- **渲染**：在 `MermaidMarkdown` 的 fence 处理链上增加 `sqlite-query` 分支，`pre/code` 节点替换为占位容器并挂载 React 组件 `SqliteQueryBlock`；块头动作 Refresh（重跑）与 Embed（静态快照）；组件状态机 `loading` → `ready` / `error` / `empty`，不允许静默空白块。块语法只支持 YAML 极小子集（顶层 `key: value` 与 `sql: |` 块标量），解析器放在 core 便于单测与 CLI/MCP 复用。
- **配置**：一期不新增 `config.yml` 键，行数上限以 core 导出常量落地。
- **风险登记**：访问面扩大到整个项目为 deliberate 取舍（项目内任意 SQLite 可读，Embed 快照会把数据固化进受版本控制的 Markdown）；后续候选按序排队：独立数据库浏览视图 → CLI 子命令 → MCP 只读查询工具 → 行数上限配置化。

## Related Concepts

- [[concepts/web-ui-features]] — 阅读态渲染管线与 MermaidMarkdown fence 链所在面
- [[concepts/kuzu-graph]] — `databases/registry.json` 只描述图数据库，SQLite 文件刻意不进注册表

## Related Sources

- [[sources/m-11-sqlite-explorer]] — 本设计对应的实施里程碑（验收标准在 §9）
- [[sources/doc-24-sqlite-explorer-demo]] — 本设计的验收演示文档
- [[sources/doc-25-duckdb-explorer-prd]] — 同设计的 DuckDB 引擎对偶
