---
id: doc-25
title: DuckDB Explorer：只读 SQL 浏览与查询能力
type: design
created_date: '2026-10-13 01:30'
updated_date: '2026-10-14 08:35'
---
# DuckDB Explorer：只读 SQL 浏览与查询能力

> 状态：设计稿 v1（与实现 m-12 对齐）
> 同源设计：[SQLite Explorer](../sqlite/doc-23%20-%20SQLite%20Explorer：只读%20SQL%20浏览与查询能力.md)（Backlog.md 的 SQLite Explorer）——本特性是它的**引擎对偶**，交互语义、安全模型、路径规则全部照搬，只换执行栈。
> 参考：[DuckDB Node.js API](https://duckdb.org/docs/stable/clients/node_neo/overview)
> 一期范围：**只做 `duckdb-query` 围栏代码块的阅读态渲染**。数据源 = **项目目录下任意位置的 `.duckdb` 文件**（忽略目录除外，见 §2）。CLI 子命令、MCP 工具、独立数据库浏览视图均不在本期。

---

## 0. 与 SQLite Explorer 的差异（同源设计，换引擎）

DuckDB Explorer 不是另起炉灶，而是把 SQLite Explorer（doc-23）的设计在 DuckDB 上再落一遍。两者**共享**校验、序列化与组件核心（见 §5.5），只有驱动相关的部分不同：

| 维度 | SQLite Explorer（m-11） | DuckDB Explorer（m-12） |
|---|---|---|
| 引擎绑定 | `bun:sqlite`——Bun 内置，零依赖 | `@duckdb/node-api`——DuckDB 官方 N-API 绑定（原生模块） |
| 打开方式 | `new Database(path, { readonly: true })` + `PRAGMA query_only` | `DuckDBInstance.create(path, { access_mode: "READ_ONLY" })` |
| 扩展名 | `.sqlite` / `.sqlite3` / `.db` | 仅 `.duckdb` |
| 魔数校验 | 文件头 offset 0 的 `SQLite format 3\0` | 文件头 **offset 8** 处的字面量 `DUCK`（前 8 字节是版本/校验头） |
| 连接模型 | 按 `realpath` 缓存句柄，空闲 60s 关闭 | **每个查询开/关一个实例**（DuckDB 的连接模型下缓存得不偿失，见 §5.2） |
| 值类型 | `bun:sqlite` 直接返回原生 JS 值 | `getRowObjects()` 返回 DuckDB 包装对象，需 `toCell` 强制转换（见 §5.4） |
| 代码块 | `sqlite-query` | `duckdb-query`（同名同义） |
| 其余（路径规则 / 只读三层 / 视图模式 / 动作按钮 / 上限） | — | **完全一致**，直接复用 |

**结论**：交互语义与安全模型照抄 SQLite Explorer（已被验证的部分），执行栈换成 `@duckdb/node-api`（DuckDB 官方绑定在 Bun 下可用，见 BACK-777 spike）。能用共享件的地方一律共享，绝不平行复制一套。

---

## 1. 目标与非目标

### 1.1 目标
1. 在任意 Backlog 文档（task / doc / decision / memo / wiki）的**阅读视图**里，用 `duckdb-query` 围栏块嵌入一条**实时** SQL 查询。
2. 三种展示模式：`table`（默认）、`list`、`value`。
3. 只读保证：任何路径都写不到数据库文件。
4. 与 SQLite Explorer 行为对齐：Refresh / Show-Hide Query / Copy Markdown（GFM 表格）/ Export CSV（保存到用户所选位置）。

### 1.2 非目标（本期明确不做）
- 写操作（INSERT / UPDATE / DDL / ATTACH / COPY / PRAGMA 写类）。
- CLI 子命令、MCP 工具、独立数据库浏览视图、表选择器、schema 面板。
- 把 DuckDB 文件登记进 `databases/registry.json`（该注册表只描述图数据库，见 §2.3）。
- 引入 `@duckdb/duckdb-wasm`（仅在原生绑定于 Bun 下不可用时才作为 fallback，spike 已证明不需要）。
- **项目目录之外**的任何路径（绝对路径、`..` 逃逸、符号链接指向项目外、临时目录）。
- **Embed 静态快照**（§7 保留设计，但同 m-11 一样本期不实现）。

---

## 2. 数据源与路径解析

### 2.1 搜索根：整个项目目录
数据源不限定 `databases/`，而是 **`resolve(projectRoot)` 之下的任意位置**，`<backlog>/databases/` 退化为"用户习惯存放处"之一。

发现规则**复用既有实现**：`src/duckdb/discover.ts` 与 `src/sqlite/discover.ts` 用同一套遍历语义与 30s 缓存。

| 规则 | 取值 |
|---|---|
| 排除目录 | `node_modules`、`.git`、`dist`、`build`、`.locks` |
| 隐藏目录 | 以 `.` 开头的目录跳过，`.backlog` 例外 |
| 扩展名白名单 | `.duckdb`（不区分大小写；**仅此一个**） |
| 起始根 | `resolve(projectRoot)` |

### 2.2 解析规则：只有一种写法

**`source` 一律是项目相对路径**，例如 `backlog/databases/shop.duckdb`、`data/warehouse.duckdb`。没有第二种写法：

- **不接受前导 `/`。** node 的 `isAbsolute("/x")` 在 Windows 上同样为真，而项目对客户端传入路径的既定规则就是"相对路径，否则拒绝"（`wiki/developer-notes/security-gotchas.md` §1；BACK-436 / BACK-450 / BACK-479 均按此执行）。
- **不接受文档相对路径。** 同一个字符串有两种解释，正是包含性校验被"想当然"绕过的起点。

| 写法 | 结果 |
|---|---|
| `backlog/databases/shop.duckdb` | ✅ 项目根下该路径 |
| `/data/shop.duckdb` | ❌ 拒绝（前导斜杠） |
| `../outside.duckdb` / 绝对路径 / 盘符 / UNC / URL / `~` | ❌ 拒绝 |

### 2.3 与 Kuzu / SQLite 库共存
`<backlog>/databases/` 下可能同时有 `<name>.kuzu`（**目录**）、`<name>.graph.json`、`registry.json`、`<name>.sqlite`。Kuzu 库是目录、SQLite 与 DuckDB 库是文件，扩展名白名单天然把三者分开；DuckDB 文件**不进** `registry.json`，按路径直接引用。

### 2.4 安全闸门（fail-closed，四道全过才执行）
1. 拒绝前导 `/`、绝对路径、盘符、UNC、URL、`~`——项目安全约定（`security-gotchas.md` §1）。
2. 归一化后必须落在 `resolve(projectRoot)` 内——**`..` 逃逸一律报错**，不做静默裁剪。
3. `realpath()` 后仍必须在项目根内——**符号链接逃逸在此被拦掉**；命中排除目录（§2.1）的一律拒。
4. 扩展名白名单 + **DuckDB 魔数校验**（文件头 **offset 8** 处的 `DUCK` 四字节；前 8 字节是版本/校验头，**不是**从 0 开始），非 DuckDB 直接报错，不交给引擎去猜。

实现上 §2 的闸门 1–3 与 SQLite 共用同一段代码（`src/sqlite/paths.ts` 导出的 `isNonRelativeSource` / `segmentsInsideProject`），只有闸门 4 的扩展名与魔数不同（`src/duckdb/paths.ts` 的 `isDuckdbFileName` / `hasDuckdbMagic`）。

任何一道不过：块内渲染错误信息（含原因），**不抛异常、不影响页面其余部分**。

> 边界含义：项目内的任何 DuckDB 文件都**可读**——这是本特性 deliberate 的取舍。因此闸门的作用只剩一条：**把访问面精确锁定在项目目录内**。只读保证由 §4 承担。

### 2.5 列出可用数据库
`GET /api/duckdb/files` → `[{ path, size, mtime }]`，`path` 为项目相对路径。遍历结果按 mtime 聚合缓存 30s，避免每次渲染全项目扫盘。

---

## 3. 代码块语法

````markdown
```duckdb-query
source: backlog/databases/shop.duckdb
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

**解析**：只支持 YAML 的一个极小子集——顶层 `key: value` 与 `sql: |` 块标量。解析器（`src/sqlite/block.ts` 的 `parseQueryBlock`）是**引擎无关**的，`sqlite-query` 与 `duckdb-query` 共用同一份语义，只有语言常量不同。

**渲染时机**：仅阅读视图。编辑态一律显示源码原文。

---

## 4. 只读保证（三层，逐层收紧）

1. **静态校验（语句形状）**：必须以 `SELECT` 或 `WITH … SELECT` 开头；单语句——不允许内部分号，**仅容忍并剥离末尾一个分号**。
2. **关键字黑名单**：`INSERT` `UPDATE` `DELETE` `REPLACE` `CREATE` `ALTER` `DROP` `ATTACH` `DETACH` `PRAGMA` `VACUUM` `REINDEX` `ANALYZE` `BEGIN` `COMMIT` `ROLLBACK` `SAVEPOINT` `RELEASE`（以及 DuckDB 特有的 `COPY`）。
   匹配时**跳过双引号标识符与单引号字符串字面量**，所以 `"delete_log"`、`WHERE action = 'drop'` 这类写法合法。
3. **物理只读**：`DuckDBInstance.create(path, { access_mode: "READ_ONLY" })` 打开。DuckDB 引擎层对只读实例**直接拒绝**任何 `CREATE` / `INSERT` / `UPDATE` 等（报 "read-only mode"），即使前两层被绕过也无法写入。

第 1、2 层**复用** `src/sqlite/validation.ts`（`validateReadOnlySql`，引擎无关），DuckDB 不解一套自己的。

> 第 3 层不是"锦上添花"：它把"校验写错"从数据安全事故降级成一个 bug。SQLite 用 `readonly` 句柄 + `PRAGMA query_only` 兜底，DuckDB 用引擎强制的 `READ_ONLY` 访问模式兜底，效果等价。

---

## 5. 执行与传输

### 5.1 接口
`POST /api/duckdb/query`

请求：`{ source, sql, view, maxRows? }`
响应：`{ columns: string[], rows: unknown[][], truncated: boolean, elapsedMs: number, dbPath: string }`
（与 SQLite 响应形状**逐字段一致**，故共享的前端类型与组件直接可用。）

`POST /api/duckdb/export-csv`
请求：`{ source, sql }`（**严格两键**）
响应：`{ filename, csv, rows, truncated }`——服务端返回 CSV 文本与建议文件名，浏览器负责写盘。

错误统一为 `{ error: string }` + 4xx，前端就地展示。

### 5.2 连接模型（与 SQLite 不同）
SQLite 按 `realpath` 缓存句柄、空闲 60s 关闭；**DuckDB 不走缓存**——每个查询 `create` 一个实例、跑完在 `finally` 里 `closeSync()`。

原因：DuckDB 的进程内 `DuckDBInstance` 连接模型与写锁语义更重，缓存带来的收益（省一次 open）不足以抵消"句柄长期驻留 + 空闲回收 + 多块共享"的复杂度；重开的代价可接受。只读打开天然无写冲突，多块指向同一库各自开各自的实例即可。

### 5.3 行数上限
默认 `DUCKDB_MAX_ROWS = 500`（对齐 SQLite）。硬上限 `DUCKDB_ABS_MAX_ROWS = 5000`（防止手写 `maxRows` 变成脚枪）。超出即截断并置 `truncated: true`，块内提示"已截断至 500 行"。上限同时是内存保护：不提供分页，超限就该改 SQL。

### 5.4 类型强制（DuckDB 特有）
`bun:sqlite` 返回原生 JS 值；DuckDB 的 `getRowObjects()` 返回**包装对象**（BIGINT、DECIMAL、TIMESTAMP、DATE、BLOB 都不是纯 JS 标量）。为了让共享的 `markdown.ts` / `csv.ts` / 前端类型原样可用，`query.ts` 的 `toCell` 把每个值强制成共享的 `SqliteCell` 联合：

| DuckDB 类型 | 到达 `toCell` 的形态 | 转换结果 |
|---|---|---|
| INTEGER / DOUBLE | `number` | 原样 |
| VARCHAR | `string` | 原样 |
| BOOLEAN | `boolean` | 原样 |
| NULL | `null` / `undefined` | `null` |
| BIGINT | `bigint` | 十进制字符串（如 `"13"`） |
| DECIMAL(w,s) | `{ width, scale, value: "3140n" }` | 按 scale 的定标十进制串（`"3.140"`） |
| TIMESTAMP | `{ micros }` | ISO 字符串 |
| DATE | `{ days }` | ISO 日期（`slice(0,10)`） |
| BLOB | `{ bytes }` | `<blob N 字节>` |

判别按**对象形状**（`micros` / `days` / `bytes` / `value`+`scale`），不 import 版本敏感的值类——绑定升级不会悄悄改变分派。

---

## 6. 阅读态渲染

在 `MermaidMarkdown` 的 fence 处理链上增加一支：`duckdb-query` 的 `pre/code` 节点替换为占位容器，挂载 React 组件 `DuckdbQueryBlock`（对齐 mermaid 的"先渲染后增强"路径，不改动既有渲染管线）。

`DuckdbQueryBlock` 是 `SqliteQueryBlock` 的**同构薄包装**：二者都包在通用的 `SqlQueryBlock` 之外，只提供「引擎 id / i18n 命名空间 / api 方法 / 哪些动作按钮可用」四个差异项（`QueryEngineConfig`）。

| 视图 | 渲染 |
|---|---|
| `table` | 标准网格，一行一条记录 |
| `list` | 每条记录竖向 key–value 列表（列多 / 列名即标签时好用） |
| `value` | 只取首行首单元格，纯文本内联（适合嵌一个聚合值） |

块头动作：
- **Refresh** — 按磁盘当前状态重跑。
- **Show / Hide Query** — 展开/收起只读的 `source` + SQL（默认收起，展开不触发查询）。
- **Copy Markdown** — 把当前结果序列化为 GFM 表格写入剪贴板（无内容时隐藏按钮）。
- **Export CSV** — 服务端重跑并生成 CSV 文本，浏览器保存到用户所选位置（无内容时隐藏按钮）。

组件状态机：`loading` → `ready` / `error` / `empty`。错误与空集都要有明确文案，**不允许静默空白块**。

---

## 7. Embed 静态快照（设计保留，本期未实现）

> 与 m-11 一致：Embed 不在本期范围（m-12 的任务只覆盖渲染 + Show/Hide + Copy + Export）。本节保留设计意图，供后续阶段取用。

把实时块原地替换为：

```markdown
<!-- duckdb-snapshot: 2026-10-13T09:35:00+08:00 source=backlog/databases/shop.duckdb -->
| product | price |
|---|---|
| … | … |
```

**写回策略**：服务端按**原块文本精确匹配**定位后替换；匹配不到（文件已被别处改动）就报错且不写——绝不猜测位置、绝不部分写入。写走既有文件写通道，与其他编辑同一套落盘语义。

Embed 是单向操作：替换后原 SQL 不再保留在文档中，UI 需明确提示这一点。

---

## 8. 配置

一期不新增 `config.yml` 键：行数上限先以常量 `DUCKDB_MAX_ROWS` 落地（core 导出），待出现真实诉求再配置化（与 SQLite 的 `SQLITE_MAX_ROWS` 策略一致）。

---

## 9. 验收标准（对应里程碑 m-12）

1. 阅读视图渲染 `duckdb-query` 块，三种视图（`table` / `list` / `value`）输出正确；编辑态显示源码。（BACK-778）
2. 路径解析：`source` 一律按**项目相对路径**解析；前导 `/` 被拒并提示改用相对写法；项目内任意子目录下的 `.duckdb` 文件可正常查询。（BACK-778）
3. 越界路径（前导 `/` / 绝对路径 / `..` 逃逸 / 指向项目外的符号链接 / 排除目录内 / 非 `.duckdb` 扩展名 / 非 DuckDB 文件）被拒绝并在块内给出可读错误。（BACK-778）
4. `GET /api/duckdb/files` 列出项目内 `.duckdb` 文件（排除目录与隐藏目录内的不出现），结果走 30s 缓存。（BACK-778）
5. 写类 SQL 被静态校验拒绝；`READ_ONLY` 作为物理兜底生效（校验放行但引擎拒写的路径有测试覆盖）。（BACK-778）
6. 结果超 500 行截断并提示；`truncated` 透传到前端；DuckDB 特有类型（BIGINT / DECIMAL / TIMESTAMP / DATE / BLOB）强制后渲染正确。（BACK-777 / BACK-778）
7. Show/Hide Query 默认收起，展开显示只读 `source` + SQL，展开/收起不触发查询。（BACK-779）
8. Copy Markdown 把当前结果序列化为 GFM 表格，NULL 成空单元格，无内容时隐藏按钮。（BACK-780）
9. Export CSV：客户端仅发 `{ source, sql }` 两键，服务端重跑并返回 CSV 文本 + 建议文件名，浏览器保存到用户所选位置；保存对话框取消视为 no-op。（BACK-781）
10. SQLite Explorer（m-11）表面**逐字节不变**——共享件重构用薄包装保住。（BACK-778）
11. `bunx tsc --noEmit`、`bun run check .`、相关测试全绿。

---

## 10. 风险登记与后续

| 风险 | 影响 | 处置 |
|---|---|---|
| 原生绑定加载失败 | 服务端进程无法执行 DuckDB 查询 | BACK-777 spike 已在 Bun 1.3.13 验证通过；fallback = `@duckdb/duckdb-wasm`（本期不用） |
| 每查询重开实例 | 比缓存句柄多一次 open 代价 | 只读 open 开销可接受；换取无空闲句柄生命周期管理 |
| 大结果集内存 | 服务端内存上涨 | 行数上限 500；不提供分页 |
| 病态 SQL 占住进程 | 可能阻塞 Web 服务主线程 | 只读 + 行数上限 + 无 ATTACH（不能跨库放大）兜底；彻底隔离需 worker，本期不做 |
| **访问面扩大到整个项目** | 项目内任意 `.duckdb` 都可被读到 | 只读仍是硬保证（写不到盘）；敏感库不应放进项目目录 |
| 项目里的大体积 / 临时 `.duckdb` | 打开慢、占内存 | 只读 open + 行数上限；`/api/duckdb/files` 带 size 便于识别；遍历缓存 30s |
| DuckDB 版本升级改变值包装形态 | `toCell` 分派失效 | 按对象**形状**判别而非 import 类；`duckdb.test.ts` 覆盖全部类型 |

**后续候选**（本期不做，按序排队）：Embed 静态快照 → 独立数据库浏览视图 → CLI 子命令 → MCP 只读查询工具 → 行数上限配置化。

---

## 11. 二期扩展：CSV / Excel 数据源（含读写示例）

> 状态：设计稿 v2 增补（2026-10-14）。引擎可行性已实测：Bun + `@duckdb/node-api` 下 `INSTALL` / `LOAD` 官方扩展成功，`READ_ONLY` 实例上同样可装载扩展（扩展写入用户目录缓存 `~/.duckdb/extensions`，不触碰数据库文件）。

### 11.1 扩展选型：只用官方扩展

| 方案 | 结论 | 理由 |
|---|---|---|
| 内置 `read_csv_auto`（CSV） | ✅ 采用 | 无需任何扩展，DuckDB 内置 |
| 官方 `excel` 扩展（`read_xlsx` / `COPY ... (FORMAT XLSX)`） | ✅ 采用 | core 签名扩展，读写均覆盖，体积可控 |
| `spatial` 扩展（`st_read` 走 GDAL XLSX 驱动） | ❌ 不用 | 为读 Excel 装整个 GDAL 栈（数十 MB），过重 |
| 社区 `rusty_sheet` 扩展（`read_sheet`） | ❌ 不用 | 社区扩展供应链信任需自行评估，能力被官方 `excel` 覆盖 |

### 11.2 读示例

```sql
-- CSV：replacement scan 直接读裸路径，无需扩展、无需函数
SELECT * FROM 'backlog/databases/demo-shop.csv';
-- 需要 sniffing 参数时再用函数形式
SELECT * FROM read_csv_auto('backlog/databases/demo-shop.csv');

-- Excel：官方 excel 扩展（core 扩展，autoload 默认开启——首次查询自动联网安装，之后走本地缓存，无需手写 INSTALL/LOAD）
SELECT * FROM 'backlog/databases/demo-shop.xlsx';
-- 需要参数时用函数形式：指定工作表 / 无表头 / 范围
SELECT * FROM read_xlsx('data.xlsx', sheet = 'Sheet2');
SELECT * FROM read_xlsx('data.xlsx', header = false, range = 'A2:E100');
```

> 已实测（Bun 1.3.13 + `@duckdb/node-api`）：CSV / XLSX 裸路径查询均通过；XLSX 在不写 `LOAD excel` 时由 autoload 自动装载。

### 11.3 写示例

```sql
-- 写 CSV：内置 COPY
COPY (SELECT * FROM inventory) TO 'output/inventory.csv' (HEADER);

-- 写 xlsx：官方 excel 扩展（HEADER true 才写表头行，否则 read_xlsx 回读得到 A1/B1 式列名）
COPY (SELECT * FROM inventory) TO 'output/inventory.xlsx' (FORMAT XLSX, HEADER true);
```

> 已实测：`COPY ... TO '...xlsx' (FORMAT XLSX, HEADER true)` 与 `read_xlsx` 回读均通过（Bun 1.3.13 + `@duckdb/node-api`）。

### 11.4 架构与约束

- **非 `.duckdb` 数据源不挂库**：对 CSV / XLSX 数据源开内存实例（`:memory:`），SQL 里以文件为查询目标；`resolveDuckdbSource` 的扩展名白名单（`src/duckdb/paths.ts` 的 `DUCKDB_EXTENSIONS`）放宽为 `.duckdb` / `.csv` / `.xlsx`，魔数校验仅对 `.duckdb` 生效。
- **`source` 保持必填，是所有数据源的安全锚点**：裸路径查询（`FROM 'file.csv'`）把文件引用挪进了 SQL 字符串，而 SQL 字面量无法可靠反向提取（拼接、变量、宏），所以访问控制不依赖解析 SQL，仍以 `source` 为基准过 §2 四道闸门；`source` 在 CSV / XLSX 场景的职责从"打开哪个库"变为"声明本块的主数据源"，同时用于决定实例类型（`.duckdb` → 只读挂库；`.csv` / `.xlsx` → 内存实例）与前端的文件列表 / 错误提示 / 缓存键。
- **SQL 字面量补充校验（best-effort 兜底，fail-closed）**：扫描 SQL 字符串字面量，`http(s)://` / `s3://` 等 URL 一律拒绝（防止 replacement scan 经 `httpfs` autoload 变成任意外联通道）；出现的本地文件路径必须逐个过 §2 闸门。解析不出的动态形态不拦（拦不住），硬保证仍由 `source` 闸门承担。
- **扩展装载不开放给用户 SQL**：`INSTALL` / `LOAD` / `COPY` 均被只读静态校验（§4 关键字黑名单）拦截——前两者是扩展装载，后者是写路径，二者都不允许出现在用户 SQL 里；扩展装载只走引擎 autoload，写路径只走服务端 `copy_to`。`excel` 是 core 扩展，引擎 autoload 默认开启——首次查询自动联网安装（之后命中本地缓存），服务端无需显式 `LOAD`；唯一要做的是把 autoload/autoinstall 失败转成块内可读错误，不静默失败。
- **读路径只读语义不变**：CSV / XLSX 查询沿用 §4 三层只读与 §5 行数上限、类型强制。
- **写路径是新增能力，与"数据源文件不被改"不冲突**：以块字段 `copy_to: <项目相对路径>` 显式开启（默认不开）；服务端把 `SELECT` 包装为 `COPY (<sql>) TO '<target>'`（`.csv` → `HEADER TRUE`；`.xlsx` → `FORMAT XLSX, HEADER TRUE`），在**当前实例**上执行——`.duckdb` 源是 `READ_ONLY` 句柄但 `COPY ... TO` 写的是独立文件，依旧被允许；**目标路径走 §2 同一套项目内闸门**（拒绝绝对路径 / `..` 逃逸 / 符号链接出界 / 被忽略目录），只允许写入项目内的 `.csv` / `.xlsx` 新文件，且禁止写入或覆盖 `.duckdb` 数据库本体。写随块运行（渲染 / 刷新）触发，幂等覆盖；响应带 `writtenTo`（项目相对路径）。`sqlite-query` 块携带 `copy_to` 会被服务端直接拒绝。
