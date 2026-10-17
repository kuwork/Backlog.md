## v1.53.5-CN Release Notes

> 上一个版本：[v1.53.4-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.4-CN)
>
> 这是一个**功能版本**，覆盖 2026-10-09 ~ 2026-10-16 的 39 个任务（BACK-763 ~ BACK-801），含四个里程碑（m-11 SQLite Explorer、m-12 DuckDB Explorer、m-13 Graph CLI、m-14 Graph MCP）的完整交付。主线一句话：**知识图谱能力三面落地**——Web 端 Cypher 搜索、全新 `backlog graph` CLI 命令组、六个 `graph_*` MCP 工具——同时图谱执行引擎从 Kuzu 原生绑定切换为 RyuGraph WASM；另一条主线是文档内**实况 SQL 查询块**（`sqlite-query` / `duckdb-query`，含 CSV/Excel 数据源与分页浏览）。另有 memo CLI 增强、里程碑 Web 体验打磨与若干修复。无数据迁移需求。

### 🎯 主要亮点

- **图谱后端切换为 RyuGraph WASM（BACK-766）**：kuzu 原生 NAPI 绑定在 Bun/Windows 下段错误（崩溃指向 `kuzujs.node`），用 Kuzu 的 MIT fork `ryugraph-wasm@25.9.2` 的 WebAssembly 构建替换——WASM 在 Bun 的 WebAssembly 运行时内执行，绕开 NAPI 崩溃面。ryu 自此成为**默认后端**（不再需要 `BACKLOG_GRAPH_BACKEND`），kuzu 依赖与 `KuzuGraphStore` 整体移除，后端类型收敛为 `"ryu" | "memory"`；六平台打包不再需要 kuzu native sidecar。
- **`backlog graph` CLI 命令组（BACK-767~772）**：`query`（只读 Cypher，表格/`--json`/`--all`）、`schema`（内省节点表与关系端点）、`list`/`describe`/`create`/`drop`（命名用户数据库）、`insert`（写路径）、`import`（CSV 节点/关系导入）；用户库以 JSON 快照持久化在 `<backlog>/databases/`；派生 default 图经快照复用，不再每次全量重建（实测 5985ms → 1133ms 量级）。
- **六个 graph MCP 工具（BACK-784~790）**：`graph_query` / `graph_schema` / `graph_list_databases` / `graph_describe_database` / `graph_create_database` / `graph_import_csv`，镜像 CLI 的一次性开-跑-关模型，配套 `backlog://workflow/graph` 指南与 `backlog instructions graph`。
- **文档内实况 SQL 查询块（BACK-773~781、796、797）**：`sqlite-query` 与 `duckdb-query` 围栏块在 Web 阅读视图渲染实时只读查询结果（表格/列表/单值三视图），块动作含 Show/Hide Query、Copy Markdown、Export CSV；DuckDB 侧还支持项目内 `.csv` / `.xlsx` 数据源与可选 `copy_to` 写出；行上限、分页页大小、默认分页均入 `config.yml` 与设置页。
- **里程碑 Web 体验补齐（BACK-782、791、792、795）**：弹窗内预览本地 documentation、详情页任务关系图谱入口、带外 `milestone add` 实时到达 Web 客户端、里程碑 ID 三端统一大写 `M-N` 显示。

---

### 🕸️ 知识图谱：Cypher 搜索与后端切换

#### Web 图谱页 Cypher 搜索（BACK-765）

- `/knowledge` 与 `/graph` 页面控制簇新增放大镜入口，弹窗展示 schema 提示（节点表 FileNode/Tag/Meta，关系表 ParentOf/BelongsToMilestone/DependsOn/SourcedFrom/LinksTo/TaggedWith）与 Cypher 输入；搜索将画布**过滤为命中诱导子图**（命中节点 + 两端都命中的边），重新聚类并自动适配视口；过滤期间图例变为结果集摘要；重开弹窗回填上次语句。
- 后端新增 `POST /api/graph/cypher`：`src/graph/store.ts` 的 `runCypher` 只读执行，拦截 CREATE/DROP/DELETE/INSERT/MERGE/SET/UPDATE，默认 500 行上限。
- 最终形态经三轮验收返工定为"过滤到结果集"而非初版"高亮命中"（高亮方案因知识图谱默认隐藏任务类节点而看似无效）。

#### 图谱后端切换 RyuGraph WASM（BACK-766）

- `RyuGraphStore` 是 `KuzuGraphStore` 的移植版，`prepare`/`execute`、`query(sql, params)`、`CALL show_tables()` 均可用；唯一实质差异是 `getAllRows()` 返回列并行数组，`rowsFromResult` 把列名 zip 回去。
- Bun/embind 的 int64→BigInt 不兼容用幂等脚本 `scripts/patch-ryugraph.cjs` 修复（挂 `postinstall`；patch-package 因 `bun.lock` 不可用）。INT64 结果列的 `ToBigInt` 崩溃来自 Bun 的 wasm embind shim，JS 层无法根治，捕获后回退 `toString()` 文本解析路径。
- 顺带修掉边静默丢失：WASM 下 `COPY ... FROM CSV` 不报错但导入零条边（用户表现为"图谱没有边"），改用 `UNWIND + MATCH + MERGE` 的 `upsertEdgesViaRunner`，全量与增量路径统一。
- `resolveGraphBackend()` 默认 ryu、仅识别 `memory` 覆盖；`RyuGraphStore.init()` 失败告警并回退 memory 单例。已知限制：补丁耦合 25.9.2 版本；六平台编译二进制内联 `.wasm` 尚未端到端验证。

---

### 🖥️ `backlog graph` CLI 命令组（里程碑 m-13）

#### query / schema（BACK-767、768）

- `backlog graph query "<cypher>"`：打开 ryu store、进程内建图、执行只读语句，默认打印对齐表格（无 ANSI 转义，管道下对齐），`--json` 输出 columns/rows/nodeKeys；写关键字被拦截，memory 后端给出明确不支持信息。
- `backlog graph schema`：经 ryu 只读内省过程（`show_tables` / `table_info` / `show_connection`）打印全部节点表属性（名称、类型、主键）与关系表端点（形如 `FileNode -[:ParentOf]-> FileNode`），`--json` 输出结构化 schema。实测本仓库 9 张表（NODE：FileNode、Meta、Tag；REL：ParentOf 等六种）。
- **关键架构约束**：唯一 Bun 兼容的 ryu 构建 `ryugraph-wasm/sync` 把图存在 Emscripten 进程内 MEMFS，不落真盘——每个 CLI 进程从空 store 开始，故引入一次性协调助手 `reconcileGraphStoreOnce`（`src/graph/reconcile-once.ts`）。
- **数据模型修正**：测试中发现 `ParentOf` 边存反了（child→parent，与"父→子"语义矛盾），交换参数后全量与增量路径同时修正。正确查询方向：查子任务 `MATCH (p {id:X})-[:ParentOf]->(c)`，查父任务 `MATCH (c {id:X})<-[:ParentOf]-(p)`。

#### 多数据库与写路径（BACK-769）

- `graph query <db> "<cypher>"` 接受数据库参数（旧单参数形式视为 `default`）；`graph list`/`describe` 列出各库描述、kind 与表/节点/边计数；`graph create <db> "<desc>"`/`drop <db>` 注册与删除用户库；`graph insert <db> "<cypher>"` 执行写 Cypher 并持久化；写 `default` 被拒并指向 `create`。
- 持久化：用户库快照存 `<backlog>/databases/<name>.graph.json`（`backlog/`、`.backlog/`、自定义目录都适用；该目录不在图谱扫描白名单内，快照永远不会被当语料摄取）；schema DDL 可由内省重建，hydration 固定 DDL → 节点 → 边顺序。
- `default`（派生库）保持只读、留在 OS 缓存目录——它是 markdown 事实的可重建缓存；用户库是用户数据、随项目版本化。
- 并发安全：写强制按库单持锁（读可无锁，快照原子替换）；`registry.json` 记录 `snapshotFingerprint`，写前比对"登记值 vs 载入值 vs 盘上现值"，不符即中止并展示两个哈希，`--force` 显式覆盖。
- 验证中修掉五个缺陷，包括快照 dump 继承 500 行展示上限导致静默丢行（`runCypher` 新增 `maxRows` 选项，`DEFAULT_CYPHER_ROW_CAP = 500`，dump 传 `Number.POSITIVE_INFINITY`）。

#### CSV 导入（BACK-770、BACK-771）

- `graph import <db> <csv> [--node T] [--header] [--map a=b,...]`：ryu `COPY FROM` 在 WASM 下静默导入零行，故必须 node fs 读文件、分批参数化 `UNWIND` 插入；缺表按推断类型（INT64/DOUBLE/BOOLEAN/STRING）自动建表，首列即主键；重复导入按主键 upsert，幂等；畸形文件在开 store 前完成全部校验，数据库保持原样。
- 参数绑定统一"文本进、Cypher 端 CAST"（Bun embind 下 JS number 传 INT64 参数直接抛错）；值在 JS 侧校验，绝不信 ryu 的静默 NULL。
- 关系导入：`import <db> <csv> --rel KNOWS --from <col> --to <col>` 按两端键 `MATCH` 建边，节点不存在的行跳过并计数，`MERGE` 不叠重边。
- scoped hydrate：`graph query` 冷开只加载语句引用的表，判不出时回退全量（错误的部分 hydrate 会让查询对着没建的表跑出"无行"而非报错，是只读工具最坏的失败模式）。实测收益有限：5050 行两表库上只查 50 行表为 3.08s vs 全量 3.71s；`BACKLOG_GRAPH_DEBUG=1` 打印所选范围。
- Web UI 只读浏览：新增 **Databases 页**（各库列表带行计数 + 按库限定的 Cypher 框），后端加 `GET /api/graph/databases` 与 `POST /api/graph/db-cypher`；结果表通用渲染（不假定 FileNode schema）；常驻服务器首次 hydrate 后按快照指纹比对、文件变了才重放。

#### 派生图快照复用（BACK-772）

- 派生 default 图持久化为 OS 缓存目录里的 JSON 快照（`<dbPath>.graph.json`，语料缓存而非用户数据，删掉只花一次重建）；语料指纹、`PARSER_VERSION`、图 `SCHEMA_VERSION` 三者全匹配则还原快照而非重解析语料，任何不匹配一律回退全量重建。
- 服务快照前过七道检查（meta 缓存存在、后端匹配、双版本匹配、聚合指纹匹配、快照哈希已记录且盘上文件仍哈希为该值）。实测：重建 + dump 11042ms vs hydrate 5166-5663ms（另一组 5985ms vs 1133ms，1039KB 快照、1569 节点/4600 边），查询结果完全一致。

---

### 🤖 图谱 MCP 工具组（里程碑 m-14，BACK-784~790）

- 新建 `src/mcp/tools/graph/` 工具域（三文件模式），在 `src/mcp/server.ts` 的**两个**注册点接入（正常模式与 fallback 升级均可用）。
- **方案决策**：原计划复用长驻 `GraphService` 单例，实际改为镜像 CLI 的一次性模型（每次调用 open → prepare → query → close，落在 `src/mcp/tools/graph/graph-access.ts`）——MCP 进程内驻留 GraphService 会在启动时重建整个语料，且写工具运行时存在同一 ryu 数据库被二次打开的风险；`default` 经 `reuseSnapshot` 复用 Web UI 写出的快照，结果与 UI 一致。
- 六个工具：`graph_query`（只读，写关键字以 `VALIDATION_ERROR` 拒绝）、`graph_schema`、`graph_list_databases`、`graph_describe_database`（以上 `readOnlyHint: true`）、`graph_create_database` 与 `graph_import_csv`（`destructiveHint: true`；create 要求调用方显式 `acknowledged: true` 且先于任何写操作校验）。错误分层清晰：CSV 错误 `VALIDATION_ERROR`、写失败 `OPERATION_FAILED`、未知库 `RESOURCE_NOT_FOUND`。
- 指南（BACK-790）：新增 `src/guidelines/mcp/graph.md`，接入共享指南注册表，`backlog instructions graph` 与 `get_backlog_instructions` 均能取到；顺带把孤儿 CLI graph 指南接回 `cli-instructions/index.ts`（此前 `backlog instructions graph` 报 "Unknown instruction guide"）。
- 测试配置变化：图谱测试加载 ryu WASM 超过 bun 默认 hook 超时，`package.json` 的 `test` 脚本改为 `bun test --timeout 30000`（该 bun 版本不认 bunfig 的 `[test] timeout`）。

---

### 🗄️ Databases 页：真实行数、Cypher 结果图与可配置图例

#### 真实行数与自动刷新（BACK-783）

- `default` 行此前显示"重建"占位符；新增 `GraphService.getCounts()`，从已在运行的图谱服务填充真实节点/边数，刻意不 await 冷启动，计数在 `graph-ready` 广播后页面重新拉取时补齐。
- 计数语义**包含 Tag 节点**（初版漏算 181 个 Tag 导致 Web UI 读数 1407 而图谱页头部显示 1588）；`Meta` 簿记节点保持排除。注意图谱页头部是**视图**计数、Databases 行是**全 store** 计数，只有图例全开才一致，这是设计而非 bug。
- 查询框下新增可点击回填的 `show_tables` / `table_info` 提示，并附 `backlog graph schema` 说明；刷新失败保留旧表，避免单次网络抖动拖垮选中数据库。

#### Cypher 结果图谱视图（BACK-793）

- Databases 页结果区提供**表格 / 图谱 / 并列**三种视图模式（选择跨重跑保留），每次运行有独立相机令牌；图窗格复用从 GraphView 提取共享的 `GraphCanvas.tsx` 引擎（力导向布局、d3-zoom、四叉树命中、延迟 hover、点击聚焦飞入、拖拽重启模拟），交互与知识图谱逐项对齐，唯独不含 Cypher 搜索框。
- 传输层修复是拦路虎：`serializeCypherValue` 曾剥掉节点单元格的 `_id` 与关系的 `_src`/`_dst`，现保留内部 id；顺带修复 `POST /api/graph/cypher` 上 `count()` 结果使 `Response.json` 抛错的既有崩溃。
- 行上限可退出：Cypher 框"every row"复选框发 `maxRows: null`，CLI `graph query --all` 同样（600 节点库实测默认截断 500、`--all` 报 600）；超过 3000 节点图窗格拒绝绘制并说明原因。内部 `Meta` 簿记节点在结果含真实数据时默认隐藏。
- "View ALL" 一键示例语句 `MATCH (n) OPTIONAL MATCH (n)-[r]-() RETURN n,r`（`OPTIONAL MATCH` 承力，去掉会静默丢掉所有无关系节点）。

#### 可配置图例（BACK-794）

- 结果图标题栏新增图例设置面板：节点 caption 支持 `{{field}}` 模板；着色为两层模型——第 1 层节点类型拥有色相，第 2 层字段子类（等宽分箱、分位数、单阈值、按值、contains、前缀、布尔等快捷方法，或自写有序规则，先匹配胜、隐式 Other 兜底）只变明度；规则条件是小型布尔表达式（`==`/`!=`/`>`/`contains`/`startsWith`/`&&`/`||`/`!`，写错的条件是解析错误而非静默真值）。
- 关系按类型配置线型（solid/dashed/dotted/long-dashed）× 箭头（无/始端/末端/两端），以线条实物小样预览。
- 图例继续兼任过滤器；配置按数据库命名空间存 localStorage，残缺/不可解析条目回退默认；面板为草稿式（编辑实时预览、保存才持久化）；全屏从 Fullscreen API 改为 CSS 最大化（短按 Esc 释放钉住焦点、长按 600ms 退出）。

---

### 📊 实况 SQL 查询块：SQLite Explorer（m-11）与 DuckDB Explorer（m-12）

#### sqlite-query 块（BACK-773~776）

- `sqlite-query` 围栏代码块端到端可用：`src/sqlite/` 模块解析块字段（`source` / `sql` / `view` / `refresh`），`source` 按**项目相对路径**在四道 fail-closed 闸门后解析（拒绝前导 `/`、绝对路径、`..` 逃逸，realpath 必须在项目根内），服务端 `bun:sqlite` 只读句柄 + `PRAGMA query_only` 执行——形状校验与关键字黑名单只是 best-effort，引擎级只读才是承重层。
- `POST /api/sqlite/query` 返回 `{ columns, rows, truncated, elapsedMs, dbPath }`；`GET /api/sqlite/files` 列项目 SQLite 文件（30s 缓存）；阅读视图渲染 table/list/value 三视图及 loading/error/empty/truncated 状态，编辑模式保留原始源码。
- 块动作三个：**Show/Hide Query**（BACK-774，展开只读显示 source 与 SQL，不发请求、不重跑查询；解析失败的块展开显示原始 fence 正文）；**Copy Markdown**（BACK-775，GFM 表格入剪贴板，竖线转义、换行折叠 `<br>`、NULL 渲染为空单元格，非安全上下文回退隐藏 textarea + execCommand）；**Export CSV**（BACK-776，安全契约：客户端只发 `{ source, sql }`，行数据与目标路径永不来自客户端；服务端重跑两道闸门后返回 CSV 文本，浏览器经 File System Access API 由用户自选保存位置，blob 下载兜底；RFC 4180 + UTF-8 BOM 使 Windows Excel 正确读中文）。

#### duckdb-query 块与 CSV/Excel 数据源（BACK-777~781、796）

- 先导 spike（BACK-777）证真：`@duckdb/node-api@1.5.6-r.1` 在 Bun 下可加载，`{ access_mode: "READ_ONLY" }` 打开后引擎本身拒绝写语句（与 SQLite `PRAGMA query_only` 同构）；DuckDB 类型逐项强制到共享 `SqliteCell` 契约（BIGINT→string、DECIMAL→定点小数字符串、TIMESTAMP→ISO、DATE→ISO 日期、BLOB→`<blob N 字节>`）。
- 做法是**通用化**而非复制（BACK-778）：SQLite 的块解析器改为引擎无关 `parseQueryBlock`，`SqliteQueryBlock` 重构为通用 `SqlQueryBlock`（按引擎配置参数化），SQLite 表面逐字节不变；DuckDB 三个动作按钮（BACK-779/780/781）按里程碑逐个打开，`POST /api/duckdb/query` 与 `/api/duckdb/files` 镜像 SQLite 路由。
- CSV/Excel 数据源（BACK-796）：`duckdb-query` 块接受项目内 `.csv`（`:memory:` 实例 + replacement scan 裸路径 `FROM 'file.csv'`，无需装扩展）与 `.xlsx`（官方 excel 扩展，autoload，用户 SQL 不写 INSTALL/LOAD）；离线无缓存时装扩展失败渲染可读中文错误。可选 `copy_to` 字段把 SELECT 结果包装为 `COPY (<sql>) TO '<target>'` 写出 .csv/.xlsx（目标过同样的项目内门禁且永不可是既有 .duckdb 文件）。**共享安全加固**：`validateReadOnlySql` 黑名单新增 INSTALL/LOAD/COPY，SQL 字符串字面量中的 URL scheme 直接拒绝、路径样字面量逐个过项目内门禁。

#### 行上限可配置与分页浏览（BACK-797）

- 硬编码 500 行上限搬进配置：`query_max_rows`（默认 500，钳制最大 5000）、`pagination_page_size`（默认 50）、`default_pagination`（默认 false），`saveConfig` 持久化、设置页可编辑；既有 config.yml 缺键照常工作。
- 块头部新增"分页浏览"开关：开启时用户 SQL 被包成子查询、`LIMIT`/`OFFSET` 下推引擎（另发 `SELECT COUNT(*)` 子查询取 `totalRows`），永远不物化全量结果，**豁免 5000 硬顶**——这正是分页存在的意义：浏览超 5000 行的数据集。预览模式补报真实总行数（"已截断至 500 行（共 N 行）"）。
- 落地经历七轮评审返工，修掉的实质 bug 包括：`serializeConfig`/`parseConfig` 漏处理三个新键导致保存后静默丢弃；配置缓存永不失效（改为每块挂载时现取 + `backlog-config-updated` 事件原地重取，设置保存即时生效）；共享 `Switch` 组件 sr-only 复选框无定位祖先导致切换时滚动跳空白（同潜伏 bug 在另两个调用点一并修复）。

---

### 📝 memo CLI 增强

- **`memo update --tags`（BACK-763）**：CLI 补齐标签更新能力，与 core/MCP/REST 三表面对齐；`--tags` 可整体替换标签集（逗号分隔或重复 flag），显式空值清空全部标签，可与 `--content`/`--append` 同用，仅传 `--tags` 是合法更新。
- **TTY 交互式多行捕获（BACK-764）**：裸跑 `backlog memo create`（不带 `--content`）在交互式终端此前直接退出 1；现进入交互式捕获，逐行原样录入，Ctrl+D（raw 模式，VS Code 集成终端与 Git Bash 均有效）或仅含 Ctrl+Z 的行结束；提示写 stderr 不进正文；空输入仍走既有空内容报错；Ctrl+C 退出码 130；管道/重定向路径完全不变。新模块 `src/core/interactive-input.ts`。

---

### 🏁 里程碑相关

- **弹窗本地文档预览（BACK-782）**：里程碑详情弹窗的本地 documentation 条目从惰性 span 变为可点击预览控件，打开共享的 `FilePreviewModal`（对齐任务弹窗行为）；http(s) 条目保持外链。
- **任务关系图谱入口（BACK-791）**：里程碑详情进度区右上角新增图谱开关（无任务时隐藏），展开以该里程碑全部任务为根的多根关系子图（`buildRelationshipSubgraph` 支持 `string | string[]`），按里程碑持久视口与图例过滤；顺带修复里程碑↔任务图谱往返的三处状态丢失缺陷（双击里程碑节点路由、遮挡保留 vs 真关闭重置的区分）。
- **带外变更不达客户端修复（BACK-792）**：Milestones 页开着时 CLI `milestone add` 的新桶只显示代号不显示标题——根因是两个独立缺口：服务器从不监听 `backlog/milestones/`（修复：复用 TUI 的 `milestone-watcher`，广播 `milestones-updated`），客户端桶标签无兜底（修复：对任务引用但实体未加载的里程碑按 id 逐个拉取，只增式合并，防重复重拉）。
- **ID 显示统一大写 M-N（BACK-795）**：新增共享助手 `formatMilestoneId`（`src/core/milestones.ts`），Web 里程碑列表/详情（`M-9 — Title`）、TUI 行与详情头部（`M-N - Title`）、`milestone list --plain` 小节标题（`## M-N - Title (n tasks)`）三端统一；纯显示层改动，存储与别名解析不变。

---

### 🐛 其他缺陷修复

- **wiki 树请求崩溃刷屏（BACK-798）**：没有 `backlog/wiki` 目录的项目里，`getWikiTree()` 对缺失目录抛 ENOENT、每次请求打一整段错误栈（用户可见的空树结果本是对的）；现 ENOENT 时 warn 一次并返回 `[]`，对齐 `listWikiPages()` 的容忍行为。
- **编译二进制 DuckDB 原生绑定打包（BACK-800）**：`bun run build` 在 Windows 失败（打包器静态解析全部 8 平台绑定分支，而 `bun install` 只装宿主平台）；修掉后 exe 启动即崩 `ERR_DLOPEN_FAILED`（oven-sh/bun#44063：`bun compile` 只解 `.node` 不解其链接的兄弟共享库）。修复：`scripts/build.ts` 按 `BACKLOG_BUILD_TARGET` 把 7 个非目标绑定标记 external，虚拟模块插件把目标绑定的兄弟共享库嵌进 exe；`src/duckdb/query.ts` 改动态 import 懒加载、首次加载前把内嵌库写入 `os.tmpdir()`（write-then-rename 容忍并发）；CI/release 矩阵加 `duckOs`/`duckCpu` 并给 `bun install` 传 `--os/--cpu`。验证：编译 exe 冒烟测试经 `/api/duckdb/query` 对 CSV 完成端到端查询；本地交叉编译 `bun-linux-arm64` 成功。

---

### 📚 指南与技能分发

- **Agent 指南精炼（BACK-799）**：指南索引补齐 graph/memos/documents 条目；documents 指南（CLI+MCP）新增 Live SQL Query Blocks 小节（此前 SQL 能力实际不可发现；CLI 版额外警告块内含反引号不能走 `--content`）；task-finalization 要求记录 modified files 并对账实施计划；状态机细节从 overview 迁进 task-execution（`{{STATE_MACHINE}}` 占位符机制零渲染器改动）。README.md / README.en.md 同步更新。
- **`backlog migrate install`（BACK-801）**：`task-migration-architect` 技能（上游迁移 A/B/C 分类方法论）像 llm-wiki-for-backlog 一样嵌入二进制，新增 `backlog migrate install <agent>`（claude/codex/agents，`--force` / `--dry-run`）。难点是技能内的 `current-branch-migration-exclusions.md` 属 fork 私有项目记忆：直接嵌入会泄漏进发布二进制、全覆盖安装又会冲掉用户副本——解法是模板 + seed-only 写入（嵌入 `.template.md`，安装时仅在缺失时写入，`--force` 也不覆盖）。嵌入脚本泛化为 `scripts/embed-skills.ts`（多技能 + seed-file 映射）；SKILL.md 增加排除清单 bootstrap 流程与 MIGRATION GUIDELINES 注入指引；入口指引覆盖 root entry、agent nudge、instructions overview、agent guidelines。

---

### 🧪 质量基建

- **图谱线**：graph-foundation + graph-sync + web-graph-cypher-reveal 60 例（BACK-766）；reconcile-once 4 例 + 图谱套件 77 例（BACK-767）；schema 内省实图验证 + 套件 69 例（BACK-768）；11 个 snapshot/reconcile 测试加全套件、所有用户库流程跨进程端到端验证（BACK-769）；14 个新 csv-import 测试加六个图谱套件 96 例、scratch 项目 1200 行约 2.4s 端到端（BACK-770）；快照复用三个新测试 + 7 个 reconcile-once 测试（BACK-772）。
- **MCP 线**：`mcp-graph.test.ts` 从 4/4 逐任务增长到 23/23（BACK-784~789，含写关键字拒绝、未知库清晰错误、无确认拒绝、重名冲突、畸形 CSV 精确行列号报错）；`mcp-server.test.ts` 12 通过（BACK-790，顺带补上自 BACK-784 起一直红的全量工具列表断言）。
- **SQL 查询块线**：sqlite 新增 28 测试（BACK-773）→ Show/Hide 4 例 + 85 例（BACK-774）→ 20 pass/38 assertions（BACK-775）→ 62 pass/119 assertions（BACK-776）；duckdb 套件 19 个（BACK-778）→ 组件 9（779）→ 13（780）→ 15 + 后端 14（781）；CSV/Excel 后 duckdb 扩到 35 用例、sqlite 28 保持绿（BACK-796）；分页后 SQLite 31 / DuckDB 38，每引擎含 6000 行分页豁免 5000 硬顶用例（BACK-797）。
- **Web 图谱线**：cypher-graph 11 个单测 + 5 个冒烟测试（BACK-793）；graph-legend-config 57 断言，57 个定向 + 472 个 web-graph 测试通过（BACK-794）；21 个用例覆盖里程碑图谱入口与往返状态（BACK-791，两条回归守卫均经"故意回退修复"验证会变红）。
- **其余**：memo tags 8/8 + 相关套件 48/48（BACK-763）；stdin 捕获 27/27（BACK-764）；里程碑 documentation 套件 23 例（BACK-782）；里程碑广播/带外拉取守卫均经"禁用修复即变红"验证（BACK-792）；filesystem 76 通过（BACK-798）；指南相关 58 个测试（BACK-799）；duckdb.test 38 通过 + 编译 exe 冒烟（BACK-800）；migrate-install 8 用例 + 共 27 测试（BACK-801）。
- 全程 `bunx tsc --noEmit` 与 `bun run check .` 干净（仅剩 14 条预存 `noExplicitAny` 警告）；四语言（en / ja / zh-CN / zh-TW）文案齐备。
- **已知测试环境噪音**：BACK-778 期间全量 `bun test` 因一个无关既存测试挂起未完成，只断言 scoped 回归；BACK-794 记录全仓套件约 154-161 个失败全部定位到本任务未触碰区域（server-* 端点并行超时、duckdb musl 绑定解析、git uv_spawn ENOENT 等环境问题），代表性失败文件单独跑全绿。

---

### ⚙️ 版本与升级说明

**命令面 / 契约变化**

- **新增 CLI 命令**：`backlog graph query <db> "<cypher>" [--json] [--all]`、`graph schema [--json]`（别名 `show-schema`）、`graph list` / `describe` / `create` / `drop` / `insert` / `import <db> <csv> [--node T | --rel R --from --to] [--header] [--map]`；`backlog memo update --tags`；`backlog memo create` 在 TTY 上进入交互式多行捕获；`backlog migrate install <agent> [--force] [--dry-run]`；`backlog instructions graph` 指南上线。
- **新增 MCP 工具六个**：`graph_query` / `graph_schema` / `graph_list_databases` / `graph_describe_database`（只读）、`graph_create_database` / `graph_import_csv`（`destructiveHint: true`，create 需显式 `acknowledged: true`）；新增 MCP 资源 `backlog://workflow/graph`。
- **新增 REST 端点**：`POST /api/graph/cypher`、`GET /api/graph/databases`、`POST /api/graph/db-cypher`、`GET /api/sqlite/files`、`POST /api/sqlite/query`、`POST /api/sqlite/export-csv`、`GET /api/duckdb/files`、`POST /api/duckdb/query`、`POST /api/duckdb/export-csv`。
- **新增配置键三个**（均可选，既有 config.yml 缺键照常工作）：`query_max_rows`（默认 500，上限 5000）、`pagination_page_size`（默认 50）、`default_pagination`（默认 false）；Web 设置页可编辑，保存即时生效无需重启。
- **图谱后端契约变化**：默认后端从 MemoryGraphStore 换为 RyuGraph WASM；`BACKLOG_GRAPH_BACKEND=kuzu` 不再有效（仅识别 `memory` 强制降级，其余一律 ryu）；kuzu npm 依赖移除，升级后 `node_modules/kuzu` 残留（约 13MB `kuzujs.node`）需手动删除；`scripts/patch-ryugraph.cjs` 挂 `postinstall`，补丁耦合 `ryugraph-wasm@25.9.2`，升级该依赖时必须复核补丁是否仍命中。
- **图数据库位置**：用户数据库快照存项目内 `<backlog>/databases/<name>.graph.json`（可随项目版本化，不会被图谱扫描当语料摄取）；派生 default 图快照存 OS 缓存目录（`<dbPath>.graph.json`），是语料缓存，删掉只花一次重建。
- **里程碑 ID 显示**：Web/TUI/CLI plain 三端统一大写 `M-N`（如 `M-9 — Title`）；纯显示层改动，存储格式与别名解析（`m-9` 输入仍可用）不变。
- **DuckDB 打包**：编译二进制首次包含 DuckDB 原生绑定，`duckdb-query` 块在打包版可用；自建二进制的用户注意 `scripts/build.ts` 现按 `BACKLOG_BUILD_TARGET` 解析目标平台，交叉编译需 `bun install --os <target> --cpu <target>` 装到目标绑定。
- 无数据迁移需求。

**需要留意的行为变化**

- **图谱重建后 `ParentOf` 边方向修正**：此前实际存储为 child→parent，与文档语义矛盾；现已修正为父→子。手写 Cypher 的用户注意正确方向：查子任务 `MATCH (p {id:X})-[:ParentOf]->(c)`，查父任务 `MATCH (c {id:X})<-[:ParentOf]-(p)`。
- **Web 图谱 Cypher 搜索是"过滤到结果集"**：搜索后画布只显示命中诱导子图（非高亮），图例变为结果集摘要，清除按钮恢复原状。
- **`graph query` 默认 500 行上限**：可用 `--all` 解除（Web 侧对应 Cypher 框的"every row"复选框）；超过 3000 节点的结果图拒绝绘制（表格不受影响）。
- **SQL 只读黑名单扩充**：`INSTALL` / `LOAD` / `COPY` 关键字现在在 sqlite-query 与 duckdb-query 块中一律被拒绝（含注释中被注释掉的写操作）；此前能跑的含这些关键字的块升级后会报错。
- **导出 CSV 目的地归用户**：服务端不再往数据库旁写文件，而是返回 CSV 文本由浏览器经 File System Access API 让用户自选保存位置（不支持时 blob 下载回退）。
- **Export/Copy 按钮空结果时隐藏而非禁用**：无可做之事时按钮不出现，这不是坏了。
- **CLI 图谱命令的延迟**：ryu WASM 图不跨进程持久化，每个 CLI 进程需 hydrate 快照或重建语料；快照复用后实测约 1.1~5.7s（视语料规模），快照失效（语料变更、版本升级）时回退全量重建。
- 开发者注意：`package.json` 的 `test` 脚本改为 `bun test --timeout 30000`（图谱测试加载 WASM 超 bun 默认超时）；显式指定测试文件路径时 bun 忽略 bunfig 的 `timeout`，CLI 子进程测试需加 `--timeout 60000`。

---

### 未跟进

- ~~`graph insert` dump 空快照~~：BACK-793 记录的"insert 报成功但 dump 出空快照（countNodes=0）"经本期复核为**误报**——`countNodes` 只数节点实例，`CREATE NODE TABLE` 这类纯 schema 语句 dump 时本来就是 0；数据语句（`CREATE (:Person ...)`）实测快照正确落盘（schema + 节点俱在），水合读回正常。该条目从遗留清单移除（BACK-793 任务记录与 wiki source 页已相应更正）。
- ryu WASM 六平台编译二进制内联 `.wasm` 尚未端到端验证（BACK-766 已知限制）；`patch-ryugraph.cjs` 与 ryugraph-wasm 25.9.2 字面量耦合。
- 用户库快照是全量 dump/hydrate，O(库大小)，约 1e5 行以内可用；`graph insert` 每条语句一次快照写，多语句载入非原子（BACK-769 已知限制）。
- 图谱 CLI 的 scoped hydrate 实测收益有限（进程启动与 JSON 解析占大头），保留 `BACKLOG_GRAPH_DEBUG=1` 观测。
- m-11 的 Embed 视图未实现（留给 SQLite Explorer task 4）；`demo-shop.sqlite` 评审夹具是二进制 fixture，随库发布还是脚本生成未定（BACK-773 遗留）；sqlite/duckdb 导出无端到端 HTTP 路由测试（BACK-776 遗留，决策都在模块层覆盖）。
- 测试环境遗留：`backlog instructions command` describe 块连跑的测试隔离问题（task-prefix 用例配置泄漏，干净树可复现，非本期引入）；全仓套件若干环境性失败（server-* 并行超时、duckdb musl 绑定解析、git uv_spawn ENOENT 等，见质量基建）；`milestones-tui` 4 个弹窗计时用例本机基线 flaky。
