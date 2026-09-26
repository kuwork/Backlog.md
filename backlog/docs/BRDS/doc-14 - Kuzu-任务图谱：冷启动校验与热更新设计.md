---
id: doc-14
title: Kuzu 任务图谱：冷启动校验与热更新设计
type: design
created_date: '2026-09-23'
updated_date: '2026-09-26 07:06'
---
# Bun + KuzuDB 任务图谱：冷启动校验与热更新设计

> 状态：设计稿 v1
> 范围：一期覆盖 `tasks/`、`drafts/`、`milestones/`、`completed/`；`archive/` 不做考虑；`wiki/`、`decisions/`、`docs/` 三期再议。
> 源文件：仓库根目录 `KUZU-GRAPH-SYNC.md`（本文为其归档副本，两者内容保持同步）

---

## 0. 核心原则（先立规矩）

1. **Markdown 文件是唯一事实源，`graph.kuzu` 只是派生缓存。**
   任何写入方（CLI / Web / MCP / 编辑器 / git）只允许写文件，**永远不直接写图数据库**。图的可信度不靠"写入方记得更新"，而靠同步引擎对文件系统的持续对账。
2. **Kuzu 是嵌入式单文件库，同一时刻只允许一个进程打开。**
   这是本设计最重要的物理约束：**必须由一个常驻的图谱服务（Graph Service）独占持有 `graph.kuzu`**，其他进程通过 IPC（HTTP / Unix socket）与它交互。绝不允许 CLI、Web、MCP 各自开库写文件——那会损坏数据库或互相覆盖。
3. **Fail-safe 方向永远是"重建"。**
   指纹对不上、缓存丢失、解析报错、扫描中途文件消失——一律走全量重建，绝不"宁可信其旧"。
4. **Fail-closed 语义对齐 `src/utils/readiness.ts`。**
   依赖 ID 解析不到唯一任务 → 记入 `missingDependencies` 告警并保留为"悬空"，**不许静默丢弃**（初版方案的 `MATCH + MERGE` 会无声 no-op，这是必须修掉的坑）。

---

## 1. 图谱模型（一期）

### 1.1 数据源目录

| 目录 | 一期 | 节点类型 |
|---|---|---|
| `backlog/tasks/` | ✅ | `FileNode { type: "task" }` |
| `backlog/drafts/` | ✅ | `FileNode { type: "draft" }` |
| `backlog/milestones/` | ✅ | `FileNode { type: "milestone" }` |
| `backlog/completed/` | ✅ | 已完成任务，`FileNode { type: "task" }` + 终态 status（依赖判定/图谱灰显需要） |
| `backlog/archive/` | ❌ 不考虑 | 明确排除，不入白名单 |
| `backlog/wiki/`、`decisions/`、`docs/` | 三期 | 同一 `FileNode` 表，扩展 `type` 取值（见三期设计 doc-15） |
| `config.yml` | ✅（指纹参与） | 不建节点，statuses 变更触发重建 |

扫描范围用**白名单**实现，禁止 `**/*.md` 全目录扫——`assets/`、二进制附件混进来既慢又容易炸哈希。

### 1.2 Schema

```cypher
CREATE NODE TABLE IF NOT EXISTS FileNode (
  path STRING PRIMARY KEY,   -- 规范化项目相对路径（如 tasks/back-217 - Create-web-UI.md），文件就是节点身份
  id STRING,                 -- 任务 ID（back-217 / draft-N / m1），仅任务类文件有；知识文件为 NULL
  type STRING,               -- task | draft | milestone（三期扩展 wiki | decision | document）
  title STRING,
  status STRING,             -- 任务状态；非任务节点为 NULL
  updatedDate STRING
);
-- 三种业务语义三张边表：层级（ParentOf）、归属（BelongsToMilestone）、依赖（DependsOn）
CREATE REL TABLE IF NOT EXISTS ParentOf(FROM FileNode TO FileNode);           -- 层级父子：parent -> child，允许跨 type
CREATE REL TABLE IF NOT EXISTS BelongsToMilestone(FROM FileNode TO FileNode); -- 归属：task -> milestone
CREATE REL TABLE IF NOT EXISTS DependsOn(FROM FileNode TO FileNode);          -- 依赖：任务/草稿 -> 任务/草稿
CREATE NODE TABLE IF NOT EXISTS Meta(name STRING PRIMARY KEY, value STRING);
```

设计说明：

- **节点表叫 `FileNode`、主键是文件相对路径，而不是 `Task(id)`。** 图谱节点就是 Markdown 文件，文件路径是唯一稳定的身份；任务 ID 只是任务类文件的一个属性。初版用 `Task(id)` 主键 + `filePath` 属性，等于给文件造了第二套身份，文件移动/改名时还要维护两套身份的映射。改成 `path` 主键后，节点增删直接由文件的增删决定，"移动/改名"在图谱层就是删旧节点建新节点，不再有身份漂移问题。
- **单一 FileNode 节点表 + type 区分**，而不是多张节点表：任务/草稿/里程碑会互相连边（任务依赖任务、任务归属里程碑），Kuzu 的 REL 表端点绑定节点表，单一节点表让所有边类型共用一套端点，查询和增量删除都简单。三期知识文件（wiki/decision/document）也进这同一张表，只扩展 `type` 枚举（doc-15）。
- **按业务语义拆三张边表**："层级"、"归属"、"依赖"是三种业务语义（级联规则、进度聚合、解锁逻辑完全不同），不能混在一张表里。
- **父子（ParentOf）不再按 type 拆分**：文件层行为决定了跨 type 父子是**合法常态**——降级/转正会生成新 ID 但不清 `parentTaskId`，降级草稿会原样挂着一个 task 父（见 §3.5）。如果按 type 拆表，这些真实状态会被误判为非法。type 语义由查询侧过滤表达（任务树/草稿树各取所需）。
- **依赖（DependsOn）的文件层保证**：ID 作废操作（降级/归档）时 core 会主动清理"别人依赖它"的引用，任务完成（complete）保留全部引用——所以依赖边在源文件层面基本不会悬空，图谱的 fail-closed 规则只兜外部编辑/git 合并带来的漏网情况。
- **任务 ID 引用（`dependencies`/`parentTaskId`/`milestone`）的解析**：导入时先扫全部文件建立 `id -> path` 映射，建边时把 ID 翻译成 `path` 主键；ID 解析不到唯一文件 → fail-closed（见 §1.4）。

### 1.3 关系建边规则（fail-closed）

| frontmatter 来源 | 边 | 建边条件 | 不建边时 |
|---|---|---|---|
| `parentTaskId` | `ParentOf` | 目标 ID 解析到唯一记录，**type 不限**（任务挂任务、草稿挂任务、草稿挂草稿均合法） | 指向不存在或歧义的 ID（典型：父任务已降级/归档作废）→ 记入 `invalidRelations`，节点照常入图，等价于展示层"孤儿置顶" |
| `milestone`（按标题匹配） | `BelongsToMilestone` | 存在唯一同名 milestone | 无匹配或重名 → 记入 `invalidRelations` |
| `dependencies` | `DependsOn` | 目标解析到唯一记录（task/draft 均可） | 记入 `missingDependencies` |

注意：

- **"合法"与"悬挂"的界线是目标 ID 是否存在，而不是 type 是否相同**。跨 type 父子如实建边（图谱反映"这个草稿原来挂在哪个任务下"）；只有指向作废/不存在 ID 的引用才算非法。
- 里程碑之间的层级、里程碑的 `parentTaskId` 一期不支持——出现则记 `invalidRelations`。
- `milestone` 字段按**标题**归属时若存在同名里程碑，视为 ambiguous，同样 fail-closed。

### 1.4 解析规则（fail-closed）

- 依赖 ID 解析到 0 条或 >1 条记录 → 节点照常入图，依赖边**不建**，记入校验报告 `missingDependencies`。
- 同一任务 ID 出现在多个文件 → 全部标记 `ambiguous`，相关 `DependsOn`/`ParentOf` 边全部不建。
- frontmatter 缺 `id` → 跳过该文件并在报告里记 warning，不让单文件毒化整次导入。

典型查询（语义拆表 + 查询侧过滤 type）：

```cypher
-- 里程碑进度：归属任务的总数/完成数
MATCH (m:FileNode {type:"milestone"})<-[:BelongsToMilestone]-(t:FileNode)
RETURN m.title, count(t) AS total,
       sum(CASE WHEN t.status = "Done" THEN 1 ELSE 0 END) AS done;

-- 任务树：只沿 ParentOf 走、用 type 过滤出任务分支
MATCH (root:FileNode {type:"task", id:$id})-[:ParentOf*0..5]->(sub)
WHERE sub.type = "task"
RETURN root, sub;

-- 草稿树同理：WHERE sub.type = "draft"
```

### 1.5 Schema 版本（表结构版本号）

表结构不是一次性的：这一版把表名从 `Task` 改成了 `FileNode`，下一版可能加字段（如 `priority`）、换主键。Kuzu 的 `CREATE TABLE IF NOT EXISTS` 对**已存在的名字是静默 no-op**，所以旧库不会因为新代码的 DDL 而自动升级——它会带着旧表和绑在旧端点上的边表继续活下去，直到某次写入报错，或更糟：`COPY` 把边写进过期边表**不报错**，数据静默落到没人读的地方。因此缓存文件必须能说明"我是什么形状"。

| schemaVersion | 图的形状 | 何时出现 |
|---|---|---|
| **1**（当前） | `FileNode(path PK, id, type, title, status, updatedDate)` + `ParentOf` / `BelongsToMilestone` / `DependsOn` | 本次改名后 |
| 无版本行 | 任意旧形状（含初版 `Task(id)`） | 早于本机制，或全新空文件 |

规则：

- 版本号写在库自己的 `Meta` 表（`schemaVersion` 行），常量在 `src/graph/store.ts` 的 `SCHEMA_VERSION` / `SCHEMA_VERSION_KEY`，紧邻 `SCHEMA_DDL`。**改 DDL 就升这一个常量**，不写迁移代码，也不维护"曾经用过的表名"清单。
- 打开文件时（`KuzuGraphStore.init`）比对版本：一致 → 直接复用（DDL 那一遍是 no-op，顺带修复缺表）；不一致 → `clear()`：`CALL show_tables()` **枚举**现存表 → 先删 REL 再删 NODE（Kuzu 拒绝删除仍被边表引用的节点表）→ 按 DDL 重建 → 写回版本号。枚举而非写死表名，正是"下次再改表名"也能清干净的原因。
- **没有版本行 = 过期**：一条规则同时覆盖两种情形——全新文件（没有东西可删）与改名前的 `Task(id)` 文件（被同一条路径清掉）。
- 与 `PARSER_VERSION`（§2.1，`src/graph/fingerprint.ts`）分工不同、互不替代：前者管**图的形状**（DDL），后者管**文件解析出的形状**（新增 frontmatter 字段、kind 映射变化等）。两者都会触发重建；schema 升版本这一路还额外依赖"清空后 store 为空"——冷启动的 `nodeCount > 0` 与首轮 reconcile 都不会走快路径。
- 验证方式：`bun build src/graph/store.ts --target=node --external kuzu` 转译后用 Node 驱动真实 store（Bun 载入 kuzu 原生绑定会崩），覆盖四种输入——改名前的文件被清成 `FileNode`、当前版本文件**数据不丢**、盖着后续版本的文件被清重建、全新文件盖章。

---

## 2. 冷启动：增量指纹校验

### 2.1 指纹设计

不做"全量读文件重算哈希"，做 **Merkle 风格的每文件哈希缓存**，旁车文件 `graph.kuzu.meta.json`：

```json
{
  "parserVersion": 3,
  "files": {
    "tasks/back-217 - Create-web-UI.md": { "size": 4821, "mtimeMs": 1758660000000, "hash": "a1b2c3..." },
    "milestones/m1.md": { "size": 912, "mtimeMs": 1758650000000, "hash": "d4e5f6..." }
  }
}
```

汇总指纹 = `sha256(PARSER_VERSION + 排序后的 "relPath|hash" 列表)`。

**冷启动快路径**（毫秒级）：

```
打开 kuzu（唯一持有者进程）
  → 读取 meta 缓存
  → 白名单目录 stat 扫描（不读内容）
  → 逐文件：size + mtime 未变 → 复用缓存哈希；变了 → 重读该文件算哈希
  → 汇总指纹 vs 库内/旁车存的指纹
      ├─ 一致 → 直接复用图谱，冷启动结束（连 gray-matter 解析都不跑）
      └─ 不一致 → 增量重建（见 2.2）
```

注意点：

- **`PARSER_VERSION` 必须混入指纹**——解析逻辑或 Schema 升级后，文件没变也要强制重建。
- **git checkout 友好**：git 不重写未变更文件，mtime 不变，缓存依然命中；改动的文件自动 miss 重算。方向安全。
- **mtime 粗粒度文件系统**（部分 Windows/网络盘 1s 粒度）→ 必须配对 `size` 一起判；极端情况误失效也只是多一次重建，无害。
- **缓存文件丢失/损坏** → 视为指纹 null → 全量重建并重写缓存。

### 2.2 增量重建（指纹 miss 时）

per-file 缓存天然给出**变更集**，不需要全量 `clearGraph()`：

```ts
const added   = [...scanned.keys()].filter(k => !cache.has(k));
const removed = [...cache.keys()].filter(k => !scanned.has(k));
const changed = [...scanned.keys()].filter(k => cache.has(k) && cache.get(k)!.hash !== scanned.get(k)!.hash);
```

1. `removed` + `changed` 的旧文件：按路径主键 `DETACH DELETE` 对应节点及其出边入边。
2. `added` + `changed` 的新文件：解析 → 批量插入（Kuzu `COPY FROM` 或多值参数 MERGE，**禁止逐条 await**，几百任务逐条 MERGE 是秒级，批量是毫秒级）。
3. 二次解析后重建跨文件边（依赖可能指向刚变动的文件）：边一律在**全部节点落位后**统一构建。
4. 写回 meta 缓存与新指纹。

---

## 3. 热更新：五种写入方，一条出口

### 3.1 架构总图

```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐
│  CLI    │  │  TUI    │  │ Web UI  │  │  MCP    │  │ 编辑器/git    │
│(一次性) │  │(长驻交互)│  │(Bun.serve)│ │(stdio)  │  │(直接改文件)   │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘
     │            │            │             │              │
     └────────────┴─────┬──────┴─────────────┘              │
                        ▼                                   │
        ┌───────────────────────────────┐                   │
        │ core 变更层（completeTask /   │                   │
        │ moveTasksToStatus / editTask  │                   │
        │ / reorderTask / ...）统一挂钩 │                   │
        └───────────────┬───────────────┘                   │
                        │ 写 md + notify(paths)             │
                        ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│              backlog/*.md 文件系统（唯一事实源）               │
└──────────────────────────┬──────────────────────────────────┘
                           │ ① 内置方：写完调 notify(paths)
                           │ ② 外置方：Bun.watch 监听兜底
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        Graph Service（常驻，唯一持有 graph.kuzu）           │
│   debounce 合并 → 增量对账 → 重导 → 更新指纹 → 广播刷新        │
└─────────────────────────────────────────────────────────────┘
```

关键规则：

- **通知挂钩下沉到 core 变更层，而不是各入口各写一份。**
  已确认 CLI、TUI（`board.ts`、`milestones.ts`）、Web、MCP 全部经由 `core.*` 变更函数写文件（`completeTask`、`archiveTask`、`moveTasksToStatus`、`reorderTask`、`createTaskFromInput`、`editTaskInTui`、`updateMilestone`……）。在 core 变更层写完文件的位置统一调 `notify(changedPaths)`，**一个挂钩天然覆盖所有内置写入方**，新增入口也不会漏。注意几个变更函数一次操作改 N 个文件（拖拽批量改状态 `moveTasksToStatus`、排序 `reorderTask`、autoCommit 触发的 git 操作），挂钩必须收集并批量上报变更路径列表，而不是只报主任务。
- **CLI / TUI 属于独立一次性或交互式进程，不发通知时由监听兜底。** 内置方走"主动通知"路径（最及时、最精确）；若进程与 Graph Service 不同进程，通过 IPC `POST /internal/invalidate` 送达；Graph Service 未运行则跳过，冷启动指纹对账兜底。
- **编辑器 / git / 手工改动走"文件监听"兜底路径**：`Bun.watch` 挂在 `backlog/tasks|drafts|milestones|completed` 四个目录上。注意 TUI/CLI 开启 `autoCommit` 时会产生 git commit——文件已被 notify 覆盖，git 本身不触发 md 内容变化，监听路径收到的事件会被 pending Set 去重，无需特殊处理。
- 两条路径**汇聚到同一个去重入口**（变更路径 Set + debounce），不区分来源。同一路径 100ms 内被通知 10 次也只重导一次。

### 3.2 Graph Service 内部

```ts
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function notify(paths: string[]) {
  for (const p of paths) pending.add(normalize(p));
  if (timer) clearTimeout(timer);
  timer = setTimeout(runIncrementalSync, 150);   // 防抖窗口
}

async function runIncrementalSync() {
  timer = null;
  const batch = [...pending]; pending.clear();
  await withLock(async () => {                   // 防重入
    const { added, removed, changed } = await diffScanned(batch);
    await applyToGraph({ added, removed, changed });
    await saveFingerprint();
    broadcastGraphChanged();                     // 通知 Web 前端重拉 /api/graph
  });
}
```

- **debounce 150ms**：吃掉编辑器连续保存、git checkout 批量重写文件的抖动；批量改动在窗口后一次 diff 完成。
- **`withLock` 防重入**：防抖只是概率性合并，防抖窗口后新通知到达时，上一次同步可能还没跑完；必须串行化。
- **广播**：Web 前端 SSE / WebSocket 收到 `graphChanged` 后重拉图谱接口，实现"保存即刷新"，前端不需要轮询。

### 3.3 各写入方的接入方式

| 写入方 | 写文件动作 | 通知动作 | 备注 |
|---|---|---|---|
| CLI（一次性进程） | `core.*` 变更函数写 md | core 挂钩触发；同进程直发，否则 IPC `POST /internal/invalidate`（未运行则跳过，冷启动兜底） | CLI 自身**不开库** |
| TUI（交互式长驻） | 同上：看板拖拽改状态、`editTaskInTui`、里程碑编辑、完成/归档 | 同 CLI；批量操作（`moveTasksToStatus`/`reorderTask`）一次上报全部变更路径 | 长驻进程，若与 Graph Service 同机可保持一条 IPC 长连接，比逐次 HTTP 更省 |
| Web UI | HTTP handler 写 md | 进程内直接 `notify()` | Web 服务即 Graph Service 宿主，推荐同进程部署 |
| MCP | tool call 写 md | 进程内 `notify()` 或 IPC | 若独立于 Graph Service 进程，走 IPC |
| 编辑器 / git / 脚本 | 直接改文件 | 无感知，靠 `Bun.watch` 兜底 | 唯一延迟来源（~150ms），可接受 |

**实现落点**：在 core 变更层（`src/core/` 中写任务文件的公共出口，如 task 变更与 milestone 变更函数的收尾处）加一个可注入的 `onFilesChanged(paths: string[])` 回调——Graph Service 存在时注入 notify 实现，不存在时注入 no-op。这样 CLI/TUI/Web/MCP 四个入口零改动、零感知。

**跨进程并发写 Kuzu 是禁区**：如果 MCP server 与 Web 服务是两个进程，二者都不能开库。约定：**谁先启动谁持有库文件**（用 `graph.kuzu.lock` 文件锁抢占），另一方以 IPC client 身份工作；持锁进程退出时释放锁。

### 3.4 一致性兜底（三层）

1. **第一层：主动通知**（CLI/Web/MCP）——实时、精确。
2. **第二层：文件监听**——兜住所有旁路写入，防抖后增量对账。
3. **第三层：冷启动/定时对账**——Graph Service 每次启动必跑指纹校验；长驻进程可每 5 分钟做一次廉价 stat 扫描对账（防止 watcher 丢事件，如部分编辑器原子写导致的 rename 事件乱序）。watcher 丢一个事件不丢正确性，最多晚 5 分钟修正。

### 3.5 特殊迁移场景

> 以下均以项目实际实现为准（`core/backlog.ts`）：**降级与转正都会生成新 ID**（`generateNextId`），原 ID 作废（vacated），旧文件删除、新文件写入。

- **任务降级为草稿**（`tasks/x.md` 删除 + `drafts/draft-N.md` 新建，ID 变化）：
  - core 会做 vacated ID 清理：扫描全部活跃 + 已完成任务，把指向作废任务 ID 的 `dependencies`/`references` 条目**移除**（`collectVacatedIdCleanup`，有专门测试覆盖）。因此图谱层**不会产生指向作废 ID 的悬空依赖边**——源文件里已经没有这个引用了。
  - 清理是**单向**的：只清"别人依赖它"这个方向；**降级草稿自己的 `dependencies`（它依赖别人）原样继承保留**（仅移除指向自身旧 ID 的自引用）。同理 `parentTaskId` 不在清理范围内。
  - 但 **`parentTaskId` 不在清理范围内**：降级后的草稿原样继承原任务的 `parentTaskId`，其原子任务的 `parentTaskId` 也仍指向作废 ID。展示层靠 `groupSubtasksUnderParents` 读时容错（孤儿放到顶层）。图谱层按 §1.3 规则处理：**降级草稿 → 原父任务的跨 type `ParentOf` 边照常建**（图谱如实呈现层级来源）；指向作废 ID 的悬挂 `parentTaskId` 不建边、记入 `invalidRelations`。与文件真相一致。
  - 增量同步视角 = 旧路径删节点 + 新路径加节点，涉及它的所有边（依赖、父子、归属）随节点删除而消失，新节点按新 ID 重新解析建边。
- **草稿转正任务**（`drafts/x.md` 删除 + `tasks/task-N.md` 新建，ID 同样变化，子任务号沿 `parentTaskId` 派生）：处理方式与降级对称——删旧节点、建新节点、按新 ID 重建边；core 同样不做 vacated 清理的逆向操作（不会把别人对草稿的依赖搬给新任务），图谱层按 fail-closed 规则收敛。
- **任务完成/归档**（`tasks/` → `completed/`）：一期 `completed/` 已在白名单内。主键是路径，所以目录变化 = 旧路径删节点 + 新路径加节点；任务 id 不变且文件内容一致，增量逻辑比对解析出的 id 集合后识别为"同 id 迁移"——删旧节点建新节点（status 终态），并在同一批次末尾统一重建边（依赖、父子、归属），等效于节点随文件迁移、关系不丢。
- **重命名文件但 id 不变**：同样命中"同 id 迁移"——`removed + added` 合并处理时比对解析出的 id 集合，同 id 即迁移节点（删旧建新、重建边），避免被误当作"删一个任务加一个全新任务"。

---

## 4. 校验清单（冷启动 + 重建后）

快路径（指纹命中）之后做，全部是毫秒级 Cypher：

```sql
MATCH (n:FileNode) RETURN count(n);                        -- == 白名单解析任务总数
MATCH (:FileNode)-[r:DependsOn]->() RETURN count(r);       -- == 期望边数
```

慢路径（重建后 / 可懒执行）：

```sql
MATCH (a:FileNode)-[:DependsOn*1..]->(a) RETURN a.path;      -- 循环依赖（递归查询，不放进冷启动关键路径）
```

语义级校验（复用项目现有能力，不自造）：

- 解析期产出 `missingDependencies` / `ambiguousIds` 报告，随 `/api/graph` 一并下发，前端把悬空依赖画成灰色虚线。
- 状态语义（`isReady` / `isBlocked`）直接调用 `readiness.ts`，不要在图查询里重写一份判定逻辑。

---

## 5. 边界与风险

| 风险 | 对策 |
|---|---|
| 多进程并发打开 `graph.kuzu` | 文件锁单持有者；后来者降级为 IPC client |
| 初版方案的 `MATCH+MERGE` 静默丢悬空依赖 | 解析期 fail-closed，悬空依赖显式入报告 |
| `split("---")` 解析多文档不可靠 | 用 gray-matter 只解析单个文件 frontmatter；文件级隔离 |
| watcher 丢事件（原子写、rename 乱序） | 定时对账兜底（3.4 第三层） |
| Kuzu npm 包在 Windows 的 node-gyp 编译 | CI 出预编译产物或提供 `:memory:` 降级模式 |
| 库文件损坏（掉电等） | 启动指纹校验失败即全量重建，kuzu 文件可随时删掉重生成，不做备份依赖 |
| 大仓库首次全量导入 | 批量插入 + 后台线程，服务先以"构建中"状态响应 |

---

## 6. 分期落地

1. **一期（本文范围）**：`tasks/` + `drafts/` + `milestones/` + `completed/`；指纹冷启动 + notify/watch 热更新；Web UI 与 Graph Service 同进程部署。
2. **二期**：CLI 独立进程与 IPC 协议固化；批量导入性能压测（万级任务）与 `COPY FROM` 优化。
3. **三期**：`wiki/`、`decisions/`、`docs/` 入图（`FileNode.type` 扩展 `wiki`/`decision`/`document` 取值 + 语义链接边），白名单与解析器按目录注册，指纹机制无需改动。
