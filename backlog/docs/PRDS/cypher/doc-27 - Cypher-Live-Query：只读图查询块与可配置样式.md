---
id: doc-27
title: Cypher Live Query：只读图查询块与可配置样式
type: specification
created_date: '2026-10-16 15:27'
updated_date: '2026-10-17 00:10'
---
# Cypher Live Query：只读图查询块与可配置样式

> 状态：设计稿 v2（行数上限改为配置驱动，见 §5.3）
> 同源设计：[DuckDB Explorer](../duckdb/doc-25%20-%20DuckDB-Explorer：只读-SQL-浏览与查询能力.md) 与 SQLite Explorer（doc-23）——本特性是它们的**引擎对偶**，交互语义、安全模型、组件核心全部照搬，只换执行栈。
> 一期范围：**只做 `cypher-query` 围栏代码块的阅读态渲染**（`table` / `list` / `value` / `graph` 四种视图）。CLI 子命令、MCP 工具不在本期（Cypher 已各有现成通道，见 §1.2）。
> 与 SQL 块的一个本质差异：图数据库有 `graph-updated` 热更新广播，因此 `cypher-query` 可以提供 SQL 块做不到的 **`refresh: auto` 真实时刷新**（§7）。

---

## 0. 与 SQL Explorer 的差异（同源设计，换引擎）

Cypher Live Query 不是另起炉灶，而是把 SQL Explorer 的设计在 RyuGraph 上再落一遍。三者**共享**块解析、校验思路与组件核心（见 §5.5），只有驱动相关的部分不同：

| 维度 | SQLite / DuckDB Explorer | Cypher Live Query |
|---|---|---|
| 引擎绑定 | `bun:sqlite` / `@duckdb/node-api` | `ryugraph-wasm/sync`（WASM，已随 `RyuGraphStore` 引入） |
| 数据源标识 | `source` = **项目相对文件路径**（四道闸门防逃逸） | `source` = **数据库名**（注册表内名称，非路径，见 §2） |
| 只读保证 | 静态校验 + 关键字黑名单 + 物理只读打开 | `runCypher` 现成只读门禁（正则拦截 CREATE/DROP/DELETE/MERGE/SET/UPDATE），见 §4 |
| 视图模式 | `table` \| `list` \| `value` | `table` \| `list` \| `value` \| **`graph`**（图视图，见 §6） |
| 刷新 | 仅 `manual`（文件无变更通知） | `manual` \| **`auto`**（订阅 `graph-updated` 广播，见 §7） |
| 样式配置 | 硬编码 Tailwind；行为参数走 `backlog config` | 行为参数同上 + **图视图图例复用 BACK-794** + 新增块级 `style` 字段（见 §8） |
| 响应形状 | `{ columns, rows, truncated, elapsedMs }` | 同形状，另带 `nodeKeys`（图高亮用，现成字段） |

**结论**：交互语义与安全模型照抄 SQL Explorer（已被 m-11 / m-12 验证的部分），执行栈换成 `RyuGraphStore.runCypher`（`src/graph/store.ts:847`）。能用共享件的地方一律共享，绝不平行复制一套。

---

## 1. 目标与非目标

### 1.1 目标
1. 在任意 Backlog 文档（task / doc / decision / memo / wiki）的**阅读视图**里，用 `cypher-query` 围栏块嵌入一条**实时** Cypher 查询。
2. 四种展示模式：`table`（默认）、`list`、`value`、`graph`。
3. 只读保证：任何路径都写不到图数据库。
4. 与 SQL Explorer 行为对齐：Refresh / Show-Hide Query / Copy Markdown（GFM 表格）/ Export CSV（保存到用户所选位置）。
5. 差异化能力：`refresh: auto` 时随图数据热更新自动重跑；`graph` 视图样式可配置。

### 1.2 非目标（本期明确不做）
- 写操作（CREATE / MERGE / DELETE / SET / DROP）。
- CLI 子命令与 MCP 工具——Cypher 已有 `backlog graph query` 与 `graph_query` 等六个 MCP 工具，查询块不重复覆盖这两个面。
- 图数据库的创建 / 导入 / schema 编辑（走 Databases 页与既有 CLI/MCP）。
- **Embed 静态快照**（§9 保留设计，与 m-11 / m-12 一样本期不实现）。
- 对 `sqlite-query` / `duckdb-query` 回填 `graph` 视图或 `auto` 刷新（无对应数据源能力）。

---

## 2. 数据源：数据库名，不是路径

### 2.1 只有一种写法

**`source` 一律是图数据库的注册名**，即 `backlog graph list` 列出的名称（含默认语料图），例如 `tasks`、`wiki-corpus`。与 SQL 块的路径语义**刻意不同**：

- 图数据库是 `<backlog>/databases/` 下的**目录**（RyuGraph/Kuzu 存储格式），不是单文件，"项目相对路径"对目录型库没有单文件语义。
- 数据库名经注册表（`databases/registry.json`）间接解析到存储位置，**天然没有路径逃逸面**——不需要 SQL 块的"四道闸门"，等价防线是：名称必须命中注册表，否则直接报错。

| 写法 | 结果 |
|---|---|
| `source: tasks`（已注册） | ✅ |
| `source: nope`（未注册） | ❌ 错误："数据库 nope 不存在，可用：tasks, …" |
| `source: backlog/databases/x.kuzu` / 绝对路径 / `..` | ❌ 拒绝（非注册名，按同一条规则 fail-closed） |

> 设计取舍：也可以接受路径形式并复用 §2.4 闸门，但那会引入"目录型库的路径语义"这一新概念，而注册名已经把访问面精确锁死——**拒绝未知名就是全部闸门**。这与 DuckDB 块"source 是安全锚点"的精神一致，只是锚点从路径换成了注册名。

### 2.2 语料图与热更新

语料图（corpus graph）由 GraphService 维护：core notify hook + 递归 `fs.watch` + 定时 reconcile，150ms 防抖收敛后 emit `onChanged` → 服务端广播 `graph-updated`（`src/graph/service.ts:30-37,193-207`；`src/server/index.ts:314-325`）。用户自建库经 `graph create` / `graph import` 写入后同样触发。这条广播链是 §7 `refresh: auto` 的全部前提，**本期不新增任何 watcher**。

---

## 3. 代码块语法

````markdown
```cypher-query
source: tasks
view: graph
refresh: auto
style: compact
query: |
  MATCH (t:Task)-[:BelongsToMilestone]->(m:Milestone)
  RETURN t.id AS task, t.title AS title, m.title AS milestone
  LIMIT 20
```
````

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `source` | 是 | — | 数据库注册名，按 §2 解析 |
| `query` | 是 | — | Cypher 语句，必须只读（见 §4） |
| `view` | 否 | `table` | `table` \| `list` \| `value` \| `graph` |
| `refresh` | 否 | `manual` | `manual` \| `auto`；`auto` 订阅 `graph-updated`（§7） |
| `style` | 否 | 全局默认 | 块级样式预设（`compact` \| `striped` \| `borderless`），见 §8.3 |

**解析**：复用 `src/sqlite/block.ts` 的 `parseQueryBlock`（引擎无关的 YAML 极小子集解析器），语句字段名在 Cypher 块为 `query`（SQL 块为 `sql`）——解析器对字段名参数化，或两块共用 `query` 别名二选一，实现时取改动小者。

**渲染时机**：仅阅读视图。编辑态一律显示源码原文。

---

## 4. 只读保证

`RyuGraphStore.runCypher`（`src/graph/store.ts:847-876`）已实现两层防护，查询块**直接使用，不加第三层**：

1. **静态校验（语句形状）**：正则拦截 `CREATE` / `DROP` / `DELETE` / `MERGE` / `SET` / `UPDATE`，命中即拒。
2. **调用面收窄**：写路径只存在于 `runWrite`（`:883-895`），查询块只接 `runCypher`，结构上摸不到写通道。

> 与 SQL 块的差异说明：SQL 块需要三层是因为静态黑名单可能被绕过，靠引擎物理只读兜底；RyuGraph 的 `runCypher` 已是服务端唯一查询入口且校验经过 BACK-765~771 实战检验。本期不重复造物理只读层，但**把"校验放行却造成写入"列为回归测试场景**——若将来校验被削弱，测试先红。

---

## 5. 执行与传输

### 5.1 接口

复用现有 Databases 页路由 `POST /api/graph/db-cypher`（`src/server/index.ts:3138-3167`）还是新增 `/api/graph/cypher-query`，实现时按响应形状对齐程度决定——**对外契约必须与 SQL 块同形**，使共享前端组件直接可用：

请求：`{ source, query, view?, maxRows? }`
响应：`{ columns: string[], rows: unknown[][], truncated: boolean, elapsedMs: number, nodeKeys?: string[] }`
（`nodeKeys` 仅 `graph` 视图消费，`table` / `list` / `value` 忽略。）

`POST /api/graph/export-csv`（新增）
请求：`{ source, query }`（**严格两键**，对齐 SQL 块）
响应：`{ filename, csv, rows, truncated }`——服务端返回 CSV 文本与建议文件名，浏览器负责写盘。

错误统一为 `{ error: string }` + 4xx，前端就地展示。

### 5.2 连接模型

无新模型：语料图走 GraphService 常驻实例，用户库走 `RyuGraphStore` 既有打开/快照路径（`src/graph/snapshot.ts`、`browser.ts`）。查询块不持有句柄、不引入缓存。

### 5.3 行数上限（配置驱动，不是常量）

行数上限**与 SQL 块同源，一律来自 `backlog config`**：默认值取 `queryMaxRows` 配置键（默认 500），硬上限 5000 防止手写 `maxRows` 变成脚枪。超出即截断并置 `truncated: true`，块内提示"已截断至 N 行"（N 为配置值）。上限同时是内存保护：不提供分页，超限就该改查询。

> 现有 `DEFAULT_CYPHER_ROW_CAP` 常量（500，CLI 在用）保留为无配置时的回退值，但块的有效上限始终跟随 `queryMaxRows`。明确**禁止**为 Cypher 新增 `CYPHER_MAX_ROWS` 之类的硬编码常量——SQL 块"先常量、后配置化"的历史不在这里重演，因为配置键已经存在。

### 5.4 类型强制（Cypher 特有）

Cypher 的 RETURN 里除标量外还有 **node / relationship 对象**。强制规则（对齐 `printCypherResult` 的剥离思路，`src/cli.ts:6863-6903`）：

| Cypher 类型 | 转换结果 |
|---|---|
| 标量（int / float / string / bool / null / date） | 原样转 JS 标量 |
| node | `{ _label, id, title, … }` 剥掉 `_id/_src/_dst` 内部句柄后序列化为 JSON 串（table/list/value 视图）；同时记入 `nodeKeys` |
| relationship | `(src)-[TYPE]->(dst)` 紧凑串 |
| path | 节点与关系交替的紧凑串 |

`graph` 视图不走此转换，直接用原始 node/rel 结构喂给 `CypherResultGraph`。

### 5.5 共享件重构（关键约束）

`SqlQueryBlock.tsx` 当前是 sqlite/duckdb 两薄壳共享的核心。本期把它泛化为**引擎无关的 `QueryBlock`**：薄壳提供「引擎 id / i18n 命名空间 / api 方法 / 可用动作按钮 / 可用视图集合」五个差异项（扩展现有 `QueryEngineConfig`）。验收标准第 10 条据此设防：**SQL 两块表面逐字节不变**。

---

## 6. 阅读态渲染

在 `MermaidMarkdown` 的 fence 处理链（`src/web/components/MermaidMarkdown.tsx:422`）增加一支：`cypher-query` 的 `pre/code` 节点替换为占位容器，挂载 `CypherQueryBlock`——与 mermaid、SQL 块同一"先渲染后增强"路径，不改既有渲染管线。

`CypherQueryBlock` 是共享 `QueryBlock` 外的**同构薄包装**，仅比 SQL 薄壳多一件事：`view: graph` 时把结果交给 `CypherResultGraph`（`src/web/components/CypherResultGraph.tsx`，上限 3000 节点，超限时降级为 table 并提示）。

| 视图 | 渲染 |
|---|---|
| `table` | 标准网格，一行一条记录 |
| `list` | 每条记录竖向 key–value 列表 |
| `value` | 只取首行首单元格，纯文本内联（适合嵌一个聚合值） |
| `graph` | 力导向图渲染 node/rel，复用 Databases 页的图组件与图例系统 |

块头动作与 SQL 块逐项对齐：Refresh / Show-Hide Query / Copy Markdown / Export CSV（无内容时隐藏后两个按钮）。`refresh: auto` 时块头额外显示"Live"徽标与"暂停/恢复"开关（§7）。

组件状态机：`loading` → `ready` / `error` / `empty`。错误与空集都要有明确文案，**不允许静默空白块**。

---

## 7. `refresh: auto`：订阅 graph-updated（差异化能力）

SQL 块的 `refresh` 只有 `manual`——底层是磁盘文件，没有变更通知，轮询代价不值。Cypher 块不同：GraphService 的热更新链已经把"图变了"精确推到了 WebSocket（`graph-updated`，防抖后广播）。`refresh: auto` 的语义：

1. 块挂载后监听 `graph-updated` 消息（客户端已有此通道，`src/web/App.tsx:1006-1058`）；
2. 收到后置脏，**再等 500ms 静默期**（防抖，避免批量导入时每条关系触发一次重跑）后重跑查询；
3. 重跑结果与现值**深比较**，相同则不重渲染（防闪烁）；
4. 块头"Live"徽标 + 暂停/恢复开关；暂停只停重跑，不摘监听；
5. 仅限 `source` 与 `graph-updated` 载荷中的库名匹配——不匹配不跑。

**代价与护栏**：auto 是 opt-in（默认 manual）；文档里多块 auto 指向同一库时，一次广播最多触发每块一次重跑（500ms 静默期合并）；查询本身受 `queryMaxRows` 上限保护。服务端不加推送计算，推送的只是"变了"这个信号，重跑仍是客户端发起的普通 HTTP 查询——**服务端零新状态**。

---

## 8. 样式配置（三层）

### 8.1 行为参数：复用 `backlog config`

行数、分页沿用现成键（`queryMaxRows` / `paginationPageSize` / `defaultPagination`），前端经 `fetchConfig()` 读取，保存后经 `config-updated` → `backlog-config-updated` 事件热更——本期**零新增 config 键**。

### 8.2 图视图样式：复用 BACK-794 图例系统

`graph` 视图的节点颜色分桶、关系线型/箭头/颜色/别名，**直接按 `source` 库名读同一份 `graph-legend-config`**（`src/web/utils/graph-legend-config.ts`，localStorage 存储，`GraphLegendSettings` 面板编辑）。用户在 Databases 页配好的图例，在查询块里自动一致；改图例立即生效，不写入 markdown，不产生文档 diff。

### 8.3 块级样式：新增 `style` 字段

SQL 块样式目前硬编码 Tailwind（`SqlQueryBlock.tsx`）。本期以 `style` 字段开通用化的头：

- 取值：`compact`（行高/字号收紧）| `striped`（斑马纹）| `borderless`（去边框），可多值 `style: compact striped`；
- 实现为 `QueryBlock` 根容器的修饰 class → 对应既有 Tailwind utility 组合，**不引入 CSS-in-JS、不新增主题文件**；
- 同时回灌给 `sqlite-query` / `duckdb-query`（共享 `QueryBlock` 后零成本）——让样式字段成为三块通用能力，而不是 Cypher 私有。

非目标：不开放任意 CSS、不做每用户主题覆盖（如需，归入后续"主题令牌"议题，单独立项）。

---

## 9. Embed 静态快照（设计保留，本期未实现）

> 与 m-11 / m-12 一致：本节保留设计意图，供后续阶段取用。

把实时块原地替换为：

```markdown
<!-- cypher-snapshot: 2026-10-16T15:30:00+08:00 source=tasks view=table -->
| task | milestone |
|---|---|
| … | … |
```

写回策略与 SQL 块完全相同：服务端按**原块文本精确匹配**定位后替换，匹配不到即报错不写；走既有文件写通道。`graph` 视图不可快照（图无法 GFM 化），Embed 按钮在 graph 视图下隐藏。

---

## 10. 验收标准

1. 阅读视图渲染 `cypher-query` 块，四种视图（`table` / `list` / `value` / `graph`）输出正确；编辑态显示源码。
2. `source` 按数据库注册名解析；未注册名、路径形态写法均被拒，块内给出可读错误（含可用库名列表）。
3. 写类 Cypher（CREATE / MERGE / DELETE / SET / DROP / UPDATE）被 `runCypher` 拒绝并在块内展示；"校验放行却写入"有回归测试。
4. 结果按配置的 `queryMaxRows` 上限截断并提示；`truncated` 透传；node / relationship / path 类型强制后渲染正确。
5. `graph` 视图渲染与 Databases 页同一套 `CypherResultGraph`；超 3000 节点降级 table 并提示；图例按 `source` 库名读取，与 Databases 页一致。
6. `refresh: auto`：`graph-updated` 后 500ms 静默期内多次变更只触发一次重跑；结果相同不重渲染；暂停开关生效；默认 manual 行为与 SQL 块一致。
7. Show/Hide Query 默认收起，展开显示只读 `source` + Cypher，不触发查询；Copy Markdown 输出 GFM 表格；Export CSV 走 `{ source, query }` 两键，浏览器存盘，取消视为 no-op。
8. `style` 字段三档样式在三种文本视图生效，且 `sqlite-query` / `duckdb-query` 同样可写。
9. `queryMaxRows` 等 config 键对 Cypher 块生效并热更。
10. SQLite / DuckDB 查询块表面**逐字节不变**——共享件重构用薄包装保住。
11. `bunx tsc --noEmit`、`bun run check .`、相关测试全绿。

---

## 11. 风险登记与后续

| 风险 | 影响 | 处置 |
|---|---|---|
| `refresh: auto` 遇上批量导入 | 高频重跑 | 500ms 静默期 + 结果深比较 + opt-in 默认关；三块以上 auto 可在后续做"每库合并一次通知" |
| WASM 图引擎大结果集内存 | 服务端内存上涨 | `queryMaxRows` 硬上限；graph 视图另有 3000 节点上限 |
| node/rel 序列化膨胀 | table 视图单元格过长 | 紧凑串格式（§5.4）；超长截断加省略号 |
| 共享 `QueryBlock` 泛化改坏 SQL 块 | 既有能力回归 | 验收第 10 条逐字节设防；SQL 块既有测试必须先绿 |
| `graph-updated` 广播面扩大 | 每个在线客户端都收 | 广播本就存在且轻量（仅信号）；查询块只是新消费者 |
| 图例配置存 localStorage | 换浏览器/机器样式丢失 | 沿用 BACK-794 既定取舍；跨端同步归入后续配置化议题 |

**后续候选**（本期不做，按序排队）：Embed 静态快照 → `auto` 的"每库合并通知"优化 → 块级 `style` 扩展为主题令牌 → MCP 资源形式暴露查询块 → CLI `graph query --watch`（终端内 live，复用 `watch-json.ts` 的 stat 签名轮询）。
