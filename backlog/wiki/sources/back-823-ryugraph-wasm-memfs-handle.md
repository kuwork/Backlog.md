---
title: BACK-823 - RyuGraph WASM 改用 MEMFS 句柄路径并把图谱消息改成英文
labels: [source, graph, wasm, i18n]
created_date: 2026-10-28 15:18
updated_date: 2026-10-28 15:18
source_path: backlog/tasks/back-823 - Fix-RyuGraph-WASM-init-path-and-convert-graph-messages-to-English.md
---

# BACK-823 - RyuGraph WASM 改用 MEMFS 句柄路径并把图谱消息改成英文

`backlog browser` 能起来，但日志里永远有一行 `RyuGraph (WASM) backend init failed, falling back to memory`，缓存目录里只有 `backlog-graph-<hash>.kuzu.lock` 与 `.meta.json`，从来没有 `.kuzu`。于是 Cypher 检索（Web UI 放大镜、`backlog graph query`、graph MCP 查询工具）全线不可用，而 memory 后端是进程级的，冷启动快路径永远不生效，指纹缓存也白存。

## 根因

`RyuGraphStore.init()` 把**宿主绝对路径**交给 `new ryu.Database(...)`（例如 `/Users/<user>/Library/Caches/backlog.md/graph/backlog-graph-<hash>.kuzu`），而 `ryugraph-wasm/sync` 是浏览器 Emscripten 构建，文件系统是 MEMFS——只有 `FS.mount(MEMFS, {}, "/")` 加 `createDefaultDirectories()` 预建的 `/tmp`、`/home`、`/dev`、`/proc` 等几个目录，宿主路径根本不可达。建库路径返回 ENOENT，`openGraphStore` 据此降级 memory。

这不是 macOS 特有：宿主路径对 MEMFS 不可达在三个平台一致，六个发布目标（darwin/linux/windows × arm64/x64）同样中招。BACK-823 的分析报告还证伪了另一条路——换成 `ryugraph-wasm/nodejs/sync`（真 NODEFS）在 Bun 下直接崩 `Aborted(Module.thisProgram has been replaced by thisProgram)`。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/graph/store.ts` | 新增 `memfsDatabasePath(dbPath)`：`/tmp/ryu-<sha256(全路径)[0:32]>.kuzu`；`RyuGraphStore.init()` 用它开库，`this.dbPath`（宿主路径）继续给锁与边车用；新增 `ensureMemfsTmp()` 经 `ryu.getFS()` 做 `analyzePath`/`mkdirTree("/tmp")` 防御 |
| 同上 | 降级告警改英文并带原因标签：`[graph] RyuGraph (WASM) backend init failed for <dbPath>, falling back to memory (Cypher unavailable) - <reason>: <message>`，`reason` 为 `database path not visible to the WASM filesystem`（匹配 Cannot open file / ENOENT / IOException）或 `engine error` |
| `src/graph/paths.ts` | 头注释订正：`dbPath` 只是句柄名，宿主不落 `.kuzu`；`graphCacheDir()` **未改动**（叶子目录仍是 `graph`） |
| `src/cli.ts`、`src/graph/{store,csv-import,databases,snapshot,browser}.ts`、`src/mcp/tools/graph/{graph-access,handlers}.ts` | 图谱表面约 147 行中文用户可见文案转英文（含 `--help` 选项/参数描述、图例文本渲染器、多行错误拼接），消息形状、退出码、选项名不变 |
| `src/server/index.ts` | `/api/graph/cypher`、`/api/graph/db-cypher`、`/api/graph/legend`、`/api/sqlite/query`、`/api/duckdb/query`、`/api/sqlite/export-csv` 的 `{ error }` 转英文——Web UI 把这些 `error.message` 原样渲染在本地化界面里 |
| 6 个测试文件 | 断言旧中文措辞的用例更新；`graph-snapshot` 新增回归：宿主风格路径开出 `backend === ryu`、宿主不产生 `.kuzu`/`.meta.json`、两个宿主路径不塌进同一个 MEMFS 库 |

## 为什么用全路径哈希而不是 basename

basename 跨项目不唯一（两个用户的库都可能叫 `articles.kuzu`），且 Windows 上分隔符不同；hex 摘要在所有平台都是 POSIX 安全字符。哈希的是**完整宿主路径**，所以项目、slot（port/tui）、用户自定义库各自映射到不同的 MEMFS 路径，不会共用同一个内存库——共用会致命：第二个 store 的 `wipe()` 会清掉第一个 store 的表。

缓存的叶子目录名保持 `graph`：曾有把叶子改成 `.graph` 的请求，确认原目录本来就不叫 `kuzu` 后撤回，本任务只停止把宿主路径当作 WASM 句柄。

## 验证与遗留

- graph 各套件 + cypher + cli-graph-legend + mcp-graph(+legend) + graph-legend API + server-cypher-query-endpoint：286 pass / 0 fail
- `graph-snapshot`：14/14（改前 11 fail / 2 pass），冷启动不再打印降级告警
- `tsc --noEmit` 与 biome 干净（`store.ts` 有既存的 `any` 警告）
- 明确不动：`src/core/state-machine.ts` 的 locale 默认措辞、中文注释与测试夹具/用户数据（图例名、任务标题）、`src/sqlite/block.ts` 与 `src/web/charts/from-query.ts`
- 既有无关红：`src/test/mcp-server.test.ts:326` 的 MCP 工具列表缺 memo 三件套

## Related Concepts

- [[concepts/kuzu-graph]] — 图谱引擎、缓存路径与降级链
- [[concepts/graph-cli]] — `graph` / `graph legend` 命令表面
- [[concepts/mcp-server]] — graph MCP 工具的错误文案
- [[concepts/web-server]] — 查询端点把 `error.message` 原样交给前端

## Related Execution

- [[execution/ryugraph-wasm-gotchas]] — MEMFS 路径不可达这一坑并入陷阱集

## Related Decisions

- [[decisions/memfs-handle-over-nodejs-backend]] — 用 MEMFS 句柄而非 NODEFS 构建

## Related Sources

- [[sources/back-766-ryugraph-wasm-backend-switch]] — 默认后端切换为 RyuGraph WASM 的来源
- [[sources/back-765-knowledge-graph-cypher-search]] — 依赖 Cypher 检索的搜索 UI
