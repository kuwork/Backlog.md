## v1.53.6-CN Release Notes

> 上一个版本：[v1.53.5-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.5-CN)
>
> **功能版本**，覆盖 2026-10-16 ~ 10-18 的 10 个任务（BACK-802 ~ BACK-811），含 m-15 Cypher Live Query、m-16 Graph Legend Persistence 两个里程碑。主线：**文档内实况 Cypher 查询块**（`cypher-query`，四视图 + `refresh: auto`）与**图例配置落到项目文件**（一份 YAML，Web / CLI / MCP / 手改四面打通并热重载）。另含 `style` 字段引入即撤回、查询源码改为真正的语法高亮。无数据迁移（浏览器里的旧图例配置首次打开时自动上迁一次）。

### 主要亮点

- **`cypher-query` 块（BACK-802~804）**：第三种实况查询块，对已注册图谱库跑只读 Cypher。`source` 是**注册名不是路径**，不在名单即 400 并列出可用库；四视图（table / list / value / graph），图谱视图超 3000 节点降级为表格。做法是**泛化共享内核**（`parseQueryBlock` 的语句字段名参数化为 `sql` / `query`），SQLite / DuckDB 表面逐字节不变。
- **`refresh: auto`（BACK-804）**：订阅 `graph-updated`（载荷新增数据库名），500ms 静默期合并突发，结果深比较相同则跳过重渲染；Live 徽章 + 暂停 / 恢复（暂停只停重跑，订阅不断开）。默认仍是 manual。
- **图例配置持久化（BACK-806~810）**：单文件 `backlog/databases/graph-legends.yaml`（原子写 + 容错读），Web 面板写穿、CLI `graph legend`、MCP `graph_legend_*`、手改 YAML 四种写法落到同一份存储；文件 watcher 让带外写入热重载；"无变化不刷新"在 PUT、watcher 基线、浏览器比对三层各拦一次。
- **`style` 引入即撤回 + 查询源码高亮（BACK-805 → 811）**：三预设只活了一个任务——`markdown.css` 未分层导入压过 Tailwind 工具类，jsdom 只断言类名（测试绿、像素不变），故 fail-closed 移除；改为在"显示查询"面板做真正的语法高亮（Cypher 走 `cypher` 语法，两个 SQL 引擎走 `sql`）。

### 实况 Cypher 查询块（m-15）

- **块核心（BACK-802）**：`cypher-query` 围栏块，字段 `source` / `query` / `view` / `refresh`。新增 `POST /api/graph/cypher-query`，返回与两个 SQL Explorer 同构的网格，共享 `QueryBlock` 零改动渲染；node / relationship / path 按 PRD 5.4 强制为紧凑标量，原始结构只在 `view: graph` 时随 `graphRows` 下发；行上限沿用 `query_max_rows`（默认 500、硬顶 5000，**本期无新增配置键**）；`POST /api/graph/export-csv` 只收 `{ source, query }`，服务端重跑，行数据永不来自客户端。42 个新测试，27 个既有 SQL 块测试原样绿。
- **图谱视图（BACK-803）**：`view: graph` 复用 Databases 页的 `CypherResultGraph` 与图例配置；超 3000 节点降级为强制化表格并给出提示。146 个相关测试。
- **`refresh: auto`（BACK-804）**：264 个定向测试，两个 SQL 块的请求 / 响应与错误文案逐字节不变。

### 图例配置持久化（m-16）

- **服务端（BACK-806）**：`src/graph/legend-store.ts` 存储 + `GET /api/graph/legend?database=X`（无配置 204、缺参 400）与 `PUT /api/graph/legend`（非 plain object 400 且不动文件；`config: null` 删除该库条目；写入未造成语义变化则只回 204、不广播）。新广播 `graph-legend-updated`。7 个集成测试。
- **浏览器（BACK-807）**：挂载时以服务器为准，仅本地有时一次性上迁；`localActivity` 计数丢弃迟到的恢复响应，飞行中的恢复不会回退更新的编辑；保存前在 localStorage 标记 pending（失败保留，下次挂载把本地副本推上去）；写穿失败时面板**保持打开**并在页脚给出原因（新 i18n 键 `legendSaveFailed`，四语齐备）；`pinAutomaticTypeColors` 把自动类型颜色钉进 YAML（显式色、规则明度梯度、兜底色仍保持派生，面板 × 可把类型交回自动）。顺带修掉 `throwResponseError` 漏 `return` 吞掉服务端错误的潜伏 bug。6 单元 + 7 组件 + 5 钉色用例。
- **CLI（BACK-808）**：`graph legend get <db> [--json]`（默认人类可读摘要，未知库给明确提示并 exit 0）、`set <db> <file>|--stdin`（非法 YAML 或非映射载荷非零退出且不动存储；JSON 也能吃，YAML 是其超集）、`remove <db>`（幂等）。复用同一 store，无第二条存储路径。11 个测试，CLI graph 指南新增章节。
- **MCP（BACK-809）**：`graph_legend_get`（条目缺失是 `configured: false` 而非错误）、`set`（非对象拒绝且不动存储）、`remove`（幂等）；get 标注只读、另两个为写。10 个测试，`mcp/graph.md` 按实际工具重写、删掉旧的 workaround 文案。
- **watcher（BACK-810）**：缺口产自"BACK-809 实现时发现 `databases/` 是唯一没有 watcher 的内容目录"。监听目录而非文件（temp+rename 换 inode），settle + 双读，逐库做键序无关深比较（重排键不算变化）；新项目监听父目录、目录出现后迁移；在服务器 `start()` 而非惰性服务里启动，首个客户端连上前的编辑不漏。9 util + 6 WS + 1 浏览器测试，图例回归 sweep 91 pass / 0 fail。

### `style` 撤回与查询源码高亮（BACK-805 → 811）

- BACK-805 给三种查询块加 `style` 三预设（compact / striped / borderless，可组合、非法值静默忽略）；BACK-811 端到端撤回：`block.ts` 移除字段与解析分支，`SqlQueryBlock.tsx` 只保留一种固定外观（即无该字段时此前的渲染），**现在带 `style` 的块解析失败**并列出剩余字段，三种块语法一致；两份 agent 指南同步删行（readme 从未记录该字段）。
- 替代：新增 `src/web/utils/code-highlight.tsx`，用与 Markdown 预览同一个 refractor 实例分词 + `hast-util-to-jsx-runtime` 转 JSX，未知语法或分词抛错回退纯文本；渲染进 `<pre><code class="language-*">`，由 `markdown.css` 的 `.token.*` 与主题 `--color-prettylights-syntax-*` 着色。
- 文档顺带补齐（readme 双语、CLI 与 MCP 两份 documents 指南、CLI overview 指针、agent nudge 描述 `cypher-query`）记在 BACK-811 上——它们属于 m-15 交付物，没有独立任务。

### 质量基建

- Cypher 块线：42 → 146 → 264，收尾四个查询块套件 52/52（style 用例改为"拒绝 + 默认外观"回归，新增 `web-code-highlight.test.tsx`）。
- 图例线：服务端 7 + 浏览器 6/7/5 + CLI 11 + MCP 10 + watcher 9/6/1，回归 sweep 91 pass / 0 fail。
- 指南 29/29，markdown-renderer 与 web-page 128/128；各任务收尾 `bunx tsc --noEmit` 与 biome 干净，新增用户可见文案四语言齐备。

### 版本与升级说明

**新增契约**：块类型 `cypher-query`；CLI `backlog graph legend get|set|remove`；MCP `graph_legend_get|set|remove`；REST `POST /api/graph/cypher-query`、`POST /api/graph/export-csv`、`GET|PUT /api/graph/legend`；WS 消息 `graph-legend-updated`（并把 database 加进既有的 `graph-updated` 载荷）；项目内文件 `<backlog>/databases/graph-legends.yaml`。无新增配置键。

**需要留意的行为变化**

- **图例配置换了家**：localStorage → 项目文件，团队 / 多机可共享同一份配置；不希望它进版本库请自行 ignore。首次打开面板自动上迁一次，此后以服务器为准。
- **带 `style` 的查询块现在解析失败**（该字段引入即撤回，readme 从未记录）。
- **"显示查询"面板现在有语法高亮**，此前是纯文本。
- **保存图例会把自动类型颜色钉进 YAML**；想回到自动，用面板里的 × 清除该类型的颜色。
- **Cypher 块的 `source` 不是路径**，必须是 `backlog graph list` 能列出的数据库注册名。
- **`refresh: auto` 的重跑不等于重绘**（结果深比较相同不重渲染）；暂停只停重跑，订阅仍在。
- **图例写穿失败时面板不关闭**、页脚给出原因；带外写入（CLI / MCP / 手改）现在热重载打开着的面板，Web 侧编辑只产生一次刷新。

### 未跟进

- `style` 撤回后**不留兼容**，这是刻意的 fail-closed；将来要做块级样式，前提是解决 `markdown.css` 的分层导入。
- 图例存储是**整文件 YAML 读写**，库数量与规则复杂度上升后的规模未压测。
- 沿用 1.53.5 遗留：m-11 的 Embed 视图未实现；ryu WASM 六平台编译二进制内联 `.wasm` 未端到端验证；`patch-ryugraph.cjs` 与 `ryugraph-wasm@25.9.2` 字面量耦合；用户库快照仍是全量 dump/hydrate（约 1e5 行以内可用）；sqlite / duckdb 导出无端到端 HTTP 路由测试；全仓套件仍有环境性失败（server-* 并行超时、duckdb musl 绑定解析、git uv_spawn ENOENT），与本期改动无关。
