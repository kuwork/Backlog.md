---
title: 图谱 CLI 命令
labels: [usermanual]
created_date: 2026-10-16 01:00
updated_date: 2026-10-28 15:35
---


# 图谱 CLI 命令

`backlog graph` 命令组让你在终端里直接对项目的任务/知识图谱跑只读 Cypher 查询，也可以创建自己的命名数据库、写入数据、从 CSV 导入。它是 Web 界面 Cypher 搜索（`backlog browser` 里的放大镜对话框）的命令行对应物，适合临时分析、脚本化处理与管道输出。完整的官方指南随时可以查看：

```bash
backlog instructions graph
```

> 查询是严格只读的：写关键字（`CREATE` / `DROP` / `DELETE` / `INSERT` / `MERGE` / `SET` / `UPDATE`）会被拒绝，图谱与 Markdown 语料都不会被修改。请在项目根目录（或其子目录）下运行，CLI 才能定位 `backlog/`。

## 后端与性能

- **后端现状**：默认后端是 **RyuGraph WASM**（Kuzu 的 MIT fork 的 WebAssembly 构建），在 Bun 的 WebAssembly 运行时内执行，各平台开箱即用，无需任何环境变量。原生 Kuzu 依赖已移除，`BACKLOG_GRAPH_BACKEND=kuzu` 不再是合法取值。`BACKLOG_GRAPH_BACKEND=memory` 可强制纯 JS 内存降级模式（不支持 Cypher）；ryu 初始化失败时也会自动回退到内存后端而不会崩溃，并打印一行英文告警说明失败路径与原因（`database path not visible to the WASM filesystem` 表示 MEMFS 看不到该路径，`engine error` 表示引擎自身故障——后者才需要上报）。数据库本体在 WASM 的内存文件系统里，缓存目录只存锁与指纹边车，这是正常现象。
- **快照复用**：对 `default` 图谱的命令首次运行需要完整构建（本仓库约 6–11 秒）；CLI 会把构建结果作为 JSON 快照写入操作系统缓存目录，之后只要语料指纹、解析器版本与图结构版本都未变，就直接从快照恢复（约快一倍），语料一变则自动重建并刷新快照。快照只是缓存，删除它最多损失一次重建。
- **每次调用独立**：CLI 每次运行都在内存中打开数据库、退出时关闭，与 Web 界面各自持有的图谱互不争抢（各自使用独立的槽位与锁）。

## 数据库概念

每个子命令都作用于一个**数据库名**：

- `default`：由 Markdown 语料派生的图谱（任务、草稿、里程碑、Wiki、文档、决策）。它是**只读缓存**，任何写操作都会被拒绝并提示改用 `graph create`。
- **用户数据库**：用 `backlog graph create` 创建，数据以 JSON 快照形式持久化在 `<backlog>/databases/` 下（随项目一起可被版本管理），跨进程可读可写。

```bash
backlog graph list                              # 列出 default 与所有用户数据库（含大小）
backlog graph create people "people and their relationships"   # 创建用户数据库
backlog graph describe people                   # 查看单个数据库的描述、时间与各表行数
backlog graph drop people                       # 删除数据库及其快照（default 不可删）
```

## 查看 schema

```bash
backlog graph schema default          # 打印节点表（含属性与主键）与关系表（含两端点）
backlog graph schema default --json   # 机器可读 JSON
```

`schema` 有别名 `show-schema`。`default` 图谱的节点表是 `FileNode`（每个 Markdown 文件一个节点，属性含 `path` / `id`（大写任务 ID）/ `type` / `title` / `status` / `updatedDate`）、`Tag`、`Meta`（内部记账，查询无意义）；关系表有 `ParentOf`（父→子）、`BelongsToMilestone`（任务→里程碑）、`DependsOn`（依赖方→被依赖方）、`SourcedFrom`、`LinksTo`、`TaggedWith`。注意节点标签是 `FileNode` 而不是 `File`。

## 运行 Cypher 查询

```bash
backlog graph query default "MATCH (n:FileNode) RETURN count(n)"
backlog graph query default "MATCH (a:FileNode)-[:ParentOf]->(b:FileNode) RETURN a.path, b.path LIMIT 10"
backlog graph query people "MATCH (a:Person)-[:KNOWS]->(b:Person) RETURN a.name, b.name"
```

- 第一个位置参数是数据库名，第二个是 Cypher 语句（请用引号包住；双引号各平台通用）。旧式单参数写法 `backlog graph query "MATCH ..."` 仍然有效，等价于查询 `default`。
- 默认输出对齐的纯文本表格（无 ANSI 转义，可安全管道）；`--json` 输出原始结果对象 `{ columns, rows, nodeKeys, truncated }`，供脚本消费。
- 交互显示上限为 500 行，超限时结果带截断提示；`--all` 取消该上限返回全部行。
- 任务 ID 以大写存储。沿关系查询时注意方向：`ParentOf` 是父→子，`DependsOn` 是依赖方→被依赖方。

## 写入用户数据库（insert）

```bash
backlog graph insert people "CREATE NODE TABLE Person(name STRING PRIMARY KEY, age INT64)"
backlog graph insert people "CREATE REL TABLE KNOWS(FROM Person TO Person)"
backlog graph insert people "CREATE (:Person {name: 'Alice', age: 30})"
```

`insert` 接受写 Cypher（`CREATE` / `MERGE` / `SET` / `DELETE`），每条语句执行成功后重写一次快照——持久但不是跨语句事务。写入受每数据库单持有者锁与快照指纹保护；`--force` 跳过指纹校验。`default` 拒绝 `insert`。快照是整库序列化/回放，数据量大约 1e5 行以内体验良好。

## 导入 CSV

```bash
# 作为节点导入：表名默认取文件名，可用 --node 指定，--map 改写列名
backlog graph import people data/people.csv --node Person --map "First Name=firstName"

# 无表头文件：列名自动生成为 column1、column2…
backlog graph import people data/raw.csv --no-header --node Raw

# 作为边导入：两列是两端点的主键，端点必须已存在（只匹配、不创建）
backlog graph import people data/knows.csv --rel KNOWS --from person --to friend --node Person
```

- **第一列是主键**；重复导入同一文件按主键更新已有行（upsert），不会产生重复边。
- 表不存在时自动创建并按列推断类型（`INT64` → `DOUBLE` → `BOOLEAN`，兜底 `STRING`）；空单元格成为 NULL。
- 格式错误的文件（列数不齐、引号未闭合、非法列名等）会在打开数据库**之前**报出行号，数据库保持原样。
- 边导入中找不到端点的行会被跳过并报告跳过行数；`--from-node` / `--to-node` 仅在关系表尚不存在时需要。
