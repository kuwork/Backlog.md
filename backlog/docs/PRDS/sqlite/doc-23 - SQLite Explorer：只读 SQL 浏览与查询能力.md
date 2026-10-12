---
id: doc-23
title: SQLite Explorer：只读 SQL 浏览与查询能力
type: design
created_date: '2026-10-13 01:14'
updated_date: '2026-10-13 01:24'
---
# SQLite Explorer：只读 SQL 浏览与查询能力

> 状态：设计稿 v1
> 参考：[Obsidian SQLite Explorer](https://community.obsidian.md/plugins/sqlite-explorer)
> 一期范围：**只做 `sqlite-query` 围栏代码块的阅读态渲染**。数据源 = **项目目录下任意位置的 `.sqlite` / `.sqlite3` / `.db` 文件**（忽略目录除外，见 §2）。CLI 子命令、MCP 工具、独立数据库浏览视图均不在本期。

---

## 0. 与参考插件的差异（先说清楚，不要照搬）

| 维度 | Obsidian SQLite Explorer | Backlog.md 一期 |
|---|---|---|
| SQL 引擎 | sql.js（WASM）——Electron 里装原生绑定要重编译 | `bun:sqlite`——Bun 内置原生绑定，服务端进程直接用 |
| 执行位置 | 前端渲染进程，整个库读进内存 | **服务端进程**执行，前端只发请求、只渲染 |
| 打开方式 | 文件读成 `Uint8Array`，内存库 | `new Database(path, { readonly: true })` 只读句柄 |
| 数据来源 | vault 任意位置 | 项目目录内任意位置（忽略目录除外），`<backlog>/databases/` 只是其中一处 |
| 代码块 | `sqlite-query` + table/list/value + Embed | 同名同义，行为对齐 |
| 浏览器视图 | 有（表选择器 / schema / 导出 CSV） | 本期不做，后续 |
| 多块共享 | 同库共享一个内存会话，渲染完关闭 | 服务端按 realpath 缓存句柄，空闲超时关闭 |

**结论**：交互语义照抄插件（这是它经过验证的部分），执行栈换成 `bun:sqlite` + HTTP API（这是 Bun 服务端天然更优的部分）。

---

## 1. 目标与非目标

### 1.1 目标
1. 在任意 Backlog 文档（task / doc / decision / memo / wiki）的**阅读视图**里，用 `sqlite-query` 围栏块嵌入一条**实时** SQL 查询。
2. 三种展示模式：`table`（默认）、`list`、`value`。
3. 只读保证：任何路径都写不到数据库文件。
4. Embed：把实时块**原地替换**为带时间戳的静态 Markdown 表格快照，便于分享/归档而不再依赖数据库文件。

### 1.2 非目标（本期明确不做）
- 写操作（INSERT / UPDATE / DDL / ATTACH / PRAGMA 写类）。
- CLI 子命令、MCP 工具、独立数据库浏览视图、表选择器、schema 面板、CSV 导出。
- 把 SQLite 文件登记进 `databases/registry.json`（该注册表只描述图数据库，见 §2.4）。
- 引入 sql.js / WASM 依赖。
- **项目目录之外**的任何路径（绝对路径、`..` 逃逸、符号链接指向项目外、临时目录）。项目内一律可达，不再限定 `databases/`。

---

## 2. 数据源与路径解析

### 2.1 搜索根：整个项目目录
数据源不再限定 `databases/`，而是 **`resolve(projectRoot)` 之下的任意位置**，`<backlog>/databases/` 退化为"用户习惯存放处"之一，不再有特殊地位。

发现规则**复用既有实现**，不另造一套：`src/file-system/operations.ts` 的 `searchProjectFiles` 已经在做项目内遍历，把它的排除集合提取为共享常量供两边共用：

| 规则 | 取值 |
|---|---|
| 排除目录 | `node_modules`、`.git`、`dist`、`build`、`.locks` |
| 隐藏目录 | 以 `.` 开头的目录跳过，`.backlog` 例外 |
| 扩展名白名单 | `.sqlite` / `.sqlite3` / `.db`（不区分大小写） |
| 起始根 | `resolve(projectRoot)` |

### 2.2 解析规则：只有一种写法

**`source` 一律是项目相对路径**，例如 `backlog/databases/shop.sqlite`、`data/shop.db`。没有第二种写法：

- **不接受前导 `/`。** node 的 `isAbsolute("/x")` 在 Windows 上同样为真，而项目对客户端传入路径的既定规则就是"相对路径，否则拒绝"（`wiki/developer-notes/security-gotchas.md` §1；BACK-436 / BACK-450 / BACK-479 均按此执行）。给 `/` 前缀开个口子等于把绝对路径重新放回来。
- **不接受文档相对路径。** Obsidian 插件的 note-relative 语法不照搬：同一个字符串有两种解释，正是包含性校验被"想当然"绕过的起点。

| 写法 | 结果 |
|---|---|
| `backlog/databases/shop.sqlite` | ✅ 项目根下该路径 |
| `/data/shop.sqlite` | ❌ 拒绝（前导斜杠） |
| `../outside.sqlite` / 绝对路径 / 盘符 / UNC / URL / `~` | ❌ 拒绝 |

### 2.3 与 Kuzu 用户数据库共存
`<backlog>/databases/` 下已有 `<name>.kuzu`（**目录**）、`<name>.graph.json`、`registry.json`。Kuzu 库是目录、SQLite 库是文件，扩展名白名单天然把两者分开；SQLite 文件**不进** `registry.json`，按路径直接引用，避免给图数据库注册表引入第二种语义。

### 2.4 安全闸门（fail-closed，四道全过才执行）
1. 拒绝前导 `/`、绝对路径、盘符、UNC、URL、`~`——项目安全约定（`security-gotchas.md` §1）：客户端给的路径必须是相对路径。
2. 归一化后必须落在 `resolve(projectRoot)` 内——**`..` 逃逸一律报错**，不做静默裁剪。
3. `realpath()` 后仍必须在项目根内——**符号链接逃逸在此被拦掉**；同时命中排除目录（§2.1）的一律拒。
4. 扩展名白名单 + SQLite 魔数校验（文件头 `SQLite format 3\0`），非 SQLite 直接报错，不交给引擎去猜。

任何一道不过：块内渲染错误信息（含原因），**不抛异常、不影响页面其余部分**。

> 边界含义：项目内的任何 SQLite 文件都**可读**——这是本特性 deliberate 的取舍（用户要求"所有数据库文件"）。因此闸门的作用只剩一条：**把访问面精确锁定在项目目录内**，而不是去猜哪些库"该"被看。只读保证由 §4 承担。

### 2.5 列出可用数据库
范围放大后"有哪些库"成了必要信息。一期加一个**最小支撑接口**（不是新入口，只是给代码块与后续浏览视图供数据）：

`GET /api/sqlite/files` → `[{ path, size, mtime }]`，`path` 为项目相对路径。

遍历结果按 mtime 聚合缓存 30s，避免每次渲染全项目扫盘。

---

## 3. 代码块语法

````markdown
```sqlite-query
source: backlog/databases/shop.sqlite
view: table
sql: |
  SELECT product, price, stock
  FROM inventory
  ORDER BY price DESC
```
````

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `source` | 是 | — | 数据库路径，按 §2.2 解析 |
| `sql` | 是 | — | 查询语句，必须只读（见 §4） |
| `view` | 否 | `table` | `table` \| `list` \| `value` |
| `refresh` | 否 | `manual` | 仅手动刷新；自动/定时刷新不支持 |

**解析**：只支持 YAML 的一个极小子集——顶层 `key: value` 与 `sql: |` 块标量。解析器放在 core（而非 web）下，便于单测，也便于将来 CLI / MCP 直接复用同一份语义。

**渲染时机**：仅阅读视图。编辑态一律显示源码原文。

---

## 4. 只读保证（三层，逐层收紧）

1. **静态校验（语句形状）**：必须以 `SELECT` 或 `WITH … SELECT` 开头；单语句——不允许内部分号，**仅容忍并剥离末尾一个分号**。
2. **关键字黑名单**：`INSERT` `UPDATE` `DELETE` `REPLACE` `CREATE` `ALTER` `DROP` `ATTACH` `DETACH` `PRAGMA` `VACUUM` `REINDEX` `ANALYZE` `BEGIN` `COMMIT` `ROLLBACK` `SAVEPOINT` `RELEASE`。
   匹配时**跳过双引号标识符与单引号字符串字面量**，所以 `"delete_log"`、`WHERE action = 'drop'` 这类写法合法（照搬插件规则，已验证过边界）。
3. **物理只读**：`new Database(path, { readonly: true })` 打开，并 `PRAGMA query_only = true`。即使前两层被绕过，引擎层也拒绝写入。

> 第 3 层不是"锦上添花"：它把"校验写错"从数据安全事故降级成一个 bug。

---

## 5. 执行与传输

### 5.1 接口
`POST /api/sqlite/query`

请求：`{ source, sql, view, maxRows?, docPath? }`（`docPath` 用于 note-relative 解析，见 §2.2）
响应：`{ columns: string[], rows: unknown[][], truncated: boolean, elapsedMs: number, dbPath: string }`

错误统一为 `{ error: string }` + 4xx，前端就地展示。

### 5.2 连接复用
服务端按 `realpath` 缓存 `Database` 句柄；同一页面多个块指向同一库时共享一个句柄，只读打开天然无写冲突。空闲 60s 无请求则关闭并从缓存移除。进程退出时全部关闭。

### 5.3 行数上限
默认 `SQLITE_MAX_ROWS = 500`（对齐插件默认值）。超出即截断并置 `truncated: true`，块内提示"已截断至 500 行"。上限同时是内存保护：不提供分页，超限就该改 SQL。

### 5.4 已知约束
`bun:sqlite` 是**同步**执行，没有内建查询超时。一条病态 SQL 会占住 Bun 主线程（Web 服务同进程）。缓解手段：只读 + 行数上限 + 无 ATTACH（不能跨库放大）。彻底隔离需放到 worker，本期不做，作为已知风险登记（§10）。

---

## 6. 阅读态渲染

在 `MermaidMarkdown` 的 fence 处理链上增加一支：`sqlite-query` 的 `pre/code` 节点替换为带 `data-sqlite-query` 的占位容器，挂载 React 组件 `SqliteQueryBlock`（对齐 mermaid 的"先渲染后增强"路径，不改动既有渲染管线）。

| 视图 | 渲染 |
|---|---|
| `table` | 标准网格，一行一条记录 |
| `list` | 每条记录竖向 key–value 列表（列多 / 列名即标签时好用） |
| `value` | 只取首行首单元格，纯文本内联（适合嵌一个聚合值） |

块头两个动作：
- **Refresh** — 按磁盘当前状态重跑。
- **Embed** — 替换为静态快照（§7）。

组件状态机：`loading` → `ready` / `error` / `empty`。错误与空集都要有明确文案，**不允许静默空白块**。

---

## 7. Embed 静态快照

把实时块原地替换为：

```markdown
<!-- sqlite-snapshot: 2026-10-13T01:14:00+08:00 source=backlog/databases/shop.sqlite -->
| product | price |
|---|---|
| … | … |
```

**写回策略**：服务端按**原块文本精确匹配**定位后替换；匹配不到（文件已被别处改动）就报错且不写——绝不猜测位置、绝不部分写入。写走既有文件写通道，与其他编辑同一套落盘语义。

Embed 是单向操作：替换后原 SQL 不再保留在文档中，UI 需明确提示这一点。

---

## 8. 配置

一期不新增 `config.yml` 键：行数上限先以常量 `SQLITE_MAX_ROWS` 落地（core 导出），待出现真实诉求再配置化（参考插件把 100 / 500 做成设置项，但那是它有两个上限的场景）。

---

## 9. 验收标准（对应里程碑 m-11）

1. 阅读视图渲染 `sqlite-query` 块，三种视图（`table` / `list` / `value`）输出正确；编辑态显示源码。
2. 路径解析：`source` 一律按**项目相对路径**解析；前导 `/` 被拒并提示改用相对写法；项目内任意子目录下的 SQLite 文件可正常查询。
3. 越界路径（前导 `/` / 绝对路径 / `..` 逃逸 / 指向项目外的符号链接 / 排除目录内 / 非白名单扩展名 / 非 SQLite 文件）被拒绝并在块内给出可读错误。
4. `GET /api/sqlite/files` 列出项目内 SQLite 文件（排除目录与隐藏目录内的不出现），结果走 30s 缓存。
5. 写类 SQL 被静态校验拒绝；`readonly` + `query_only` 作为物理兜底生效（校验放行但引擎拒写的路径有测试覆盖）。
6. 结果超 500 行截断并提示；`truncated` 透传到前端。
7. 同页多块指向同一库时复用同一句柄（有测试证明只打开一次）。
8. Embed 生成带时间戳的 Markdown 表格并写回；块文本匹配失败时不写入文件。
9. `bunx tsc --noEmit`、`bun run check .`、相关测试全绿。

---

## 10. 风险登记与后续

| 风险 | 影响 | 处置 |
|---|---|---|
| 同步执行无超时 | 病态 SQL 卡住 Web 服务主线程 | 只读 + 行数上限兜底；后续可移到 worker 线程 |
| 大结果集内存 | 服务端内存上涨 | 行数上限；不提供分页 |
| Embed 改写用户文件 | 定位错误会损坏文档 | 精确匹配才写，否则报错 |
| 数据库文件被外部进程改写 | 查询结果漂移 | Refresh 手动重跑；只读句柄下 SQLite 自身保证读取一致性 |
| **访问面扩大到整个项目** | 项目内任意 SQLite 文件都可被读到；Embed 快照会把数据固化进受版本控制的 Markdown，随文档外发 | 只读仍是硬保证（写不到盘）；文档侧提示"快照即副本"；敏感库不应放进项目目录 |
| 项目里的大体积 / 临时 `.db` | 打开慢、占内存 | 只读句柄 + 行数上限；`/api/sqlite/files` 带 size 便于识别；遍历缓存 30s |

**后续候选**（本期不做，按序排队）：独立数据库浏览视图（表选择器 / schema / 复制 Markdown / 导出 CSV）→ CLI 子命令 → MCP 只读查询工具 → 行数上限配置化。
