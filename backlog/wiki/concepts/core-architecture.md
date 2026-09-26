---
title: 核心架构与数据流
labels: [concept]
created_date: 2026-05-06 00:00
updated_date: '2026-09-26 14:45'
---


# 核心架构与数据流

Backlog.md 的核心由四个协作类构成：`Core`、`FileSystem`、`ContentStore`、`SearchService`。它们形成从磁盘到内存、从原始数据到可搜索索引的完整流水线。

## 四大核心类

### 1. FileSystem（`src/file-system/operations.ts`）

- **职责**：直接操作 Markdown 文件（读写、列表、迁移、锁）
- **关键能力**：
  - `saveTask` / `loadTask` / `listTasks`：任务文件 CRUD
  - `withCreateLock`：基于 `proper-lockfile` 的全局任务创建锁，防止并发 ID 冲突
  - `ensureBacklogStructure`：自动创建 backlog 目录结构
  - `invalidateConfigCache`：配置变更时刷新缓存
  - 支持自定义 backlog 目录位置（`backlog/`、`.backlog/` 或自定义路径）
  - 支持两种配置存储位置：folder（`backlog/config.yml`）或 root（`backlog.config.yml`）

### 2. Core（`src/core/backlog.ts`）

- **职责**：领域逻辑的中心枢纽，所有高层操作都通过 Core 完成
- **聚合关系**：
  ```
  Core
  ├── fs: FileSystem
  ├── git: GitOperations
  ├── contentStore?: ContentStore（惰性初始化）
  └── searchService?: SearchService（惰性初始化）
  ```
- **关键能力**：
  - 任务 CRUD：`createTaskFromInput`、`updateTaskFromInput`、`archiveTask`、`completeTask`
  - 跨分支查询：`loadTaskById` 先查本地，再查其他本地分支，最后查远程分支
  - ID 生成：`generateNextId` 支持前缀自定义（如 `JIRA-`）、零填充、子任务编号
  - 序列计算：依赖图拓扑排序，计算可并行执行的任务序列
  - 配置迁移：自动将旧版配置格式迁移到新版
  - Git 集成：自动 add/commit（可选）、分支状态扫描

### 3. ContentStore（`src/core/content-store.ts`）

- **职责**：内存缓存 + 文件系统变更监视
- **设计**：
  - 内部维护 `Map<string, Task>`、`Map<string, Document>`、`Map<string, Decision>`
  - 通过 `node:fs/watch` 监视 `tasks/`、`docs/`、`decisions/`、`config.yml`
  - 文件变更时增量更新缓存并通知监听器
  - 对 `FileSystem.saveTask` 等方法进行 monkey-patch，确保写入后立即更新缓存
  - 支持手动递归监视器降级（针对不支持递归 watch 的平台）
- **事件模型**：`ready | tasks | documents | decisions`，附带版本号防止重复处理

#### 过期刷新守卫（BACK-540）

ContentStore 引入**逐项发布版本守卫 + 条件合并**解决竞态：
- 直接写入（`upsertTask`/`updateTaskFromDisk`/`updateDocumentFromDisk`/`updateDecisionFromDisk`）及 watcher 驱动的更新/删除递增对应逐项版本（`taskVersions`/`documentVersions`/`decisionVersions`/`wikiVersions`）
- 完整刷新路径（`refresh*FromDisk`）在读取前捕获版本，加载后经 `merge*` 合并——若项在加载期间被变更则丢弃过期快照
- `?? 0` 处理未初始化版本，确保 init 后首次刷新仍合并真实外部变更；同步按 root/epoch 检查发布

#### ordinal-only 重排保留 updated_date（BACK-534）

`Core.updateTask` 通过 `hasUpdatedDateRelevantChanges` 比较持久化内容，仅当内容/元数据变化时打 `updated_date` 时间戳；仅序号变更时恢复原值，消除无意义 diff 噪音。看板重排与批量更新改走集中式逻辑。

#### 块状 YAML 列表解析（BACK-533）

`parseConfig` 先经 gray-matter YAML 通道解析 statuses/labels（块状序列），保留内联括号行解析作为旧版非 YAML 配置兜底。

### 4. SearchService（`src/core/search-service.ts`）

- **职责**：基于 Fuse.js 的全文模糊搜索
- **设计**：
  - 订阅 `ContentStore` 事件，每次数据变更后重建 Fuse 索引
  - 索引字段权重：`title(0.35)`、`bodyText(0.3)`、`id(0.2)`、`idVariants(0.1)`、`dependencyIds(0.05)`、`modifiedFiles(0.15)`
  - 支持按状态、优先级、负责人、标签、修改文件过滤
  - 任务 ID 变体生成：支持前缀省略、大小写不敏感、子 ID 匹配（如 "7" 匹配 "TASK-0007"）

## 数据流

```
┌─────────────┐    初始化时加载    ┌─────────────┐
│  Markdown   │ ───────────────→ │ ContentStore│
│   文件系统   │                  │  内存缓存    │
└─────────────┘                  └──────┬──────┘
       ↑                                │ 变更事件
       │                          ┌─────┴─────┐
       │                          ↓           ↓
       │                    ┌────────┐   ┌──────────┐
       │                    │ Search │   │ WebSocket │
       │                    │Service │   │  广播     │
       │                    └───┬────┘   └──────────┘
       │                        │
       │                   ┌────┴────┐
       │                   ↓         ↓
       │              CLI 查询   Web UI 搜索
       │                   │         │
       └───────────────────┴─────────┘
                        Core.write
```

## 跨分支任务感知

`Core.loadTaskById` 实现了三层回退查询：
1. **本地当前分支**：直接通过 `FileSystem.loadTask` 读取
2. **其他本地分支**：`task-loader.ts` 通过 `git show` 扫描活跃分支中的同名任务文件
3. **远程分支**：同样通过 `git show` 扫描远程 refs

状态合并策略：`buildLatestStateMap` 按 `lastModified` 时间戳取最新版本，本地任务优先。

## 配置体系

配置存储在 YAML 中，关键字段：
- `projectName`、`statuses`、`labels`、`dateFormat`
- `checkActiveBranches`、`remoteOperations`、`activeBranchDays`：跨分支行为控制
- `autoCommit`、`bypassGitHooks`、`filesystemOnly`：Git 集成控制
- `prefixes.task`：任务 ID 前缀自定义
- `mcp.http`：MCP HTTP 传输配置（认证、CORS）
- `defaultPort`、`autoOpenBrowser`：Web UI 默认设置

## 共享任务身份（BACK-567）

`src/core/task-identity-index.ts` 引入统一的任务身份模型：
- 身份键 = `canonicalTaskId + normalizeRecordPath`（仓库相对逻辑路径）
- 同一 ID 在同一逻辑路径的本地/分支/已完成/归档记录视为同一身份的多个版本
- 确定性胜出顺序：工作副本 > most_recent > most_progressed
- 不同 live 路径产生 `AmbiguousTaskIdError`，在服务器返回 409 并附候选列表
- 任何 live 变体占用 ID；全部归档后 ID 可复用
- 修复了等时间戳下扫描顺序可能释放 live ID 的竞态

`src/core/backlog.ts` 用 `TaskIdentityIndex` 替代了 `buildLatestStateMap`/`filterTasksByStateSnapshots` 和 ID-keyed Map；保留了 `cross-branch-tasks.ts` 的 recentBranchesOnly 语义驱动 TUI 看板。

## 精确文件 autoCommit（BACK-561）

autoCommit 不再整目录暂存或清空共享 index：
- FileSystem 返回被替换/移动/归档的旧路径
- Git 层 `commitFiles` 按仓库拆分路径集，使用 `git commit --only` 仅提交 staged 路径
- `stageFileMove` 用 `git rm --cached` 暂存旧路径删除
- Core 每次写入通过 `commitWrittenFile` 或 `commitFiles` 精确提交触碰文件
- 用户其他 staged/unstaged/untracked 工作得以保留

## 轻量语料快照（BACK-568）

`ContentStore` 在 `TaskIdentityIndex` 之上缓存 `activeTasks`/`completedTasks` 并提供：
- `resolveTaskForRead` / `resolveTaskForMutation` 桥接到 Core
- 浏览器 handler 通过 Core 单一边界读写，不再重复读文件系统
- 未移植上游的 publication-owner / batchTaskUpdates / transitionTask 机制

## 增量跨分支加载架构（BACK-600/601/602、draft-125）

跨分支任务加载从"每次冷扫描"演进为增量体系：

- **不可变 tip 快照**：每个分支的加载结果以 tip 快照缓存，内容寻址、可复用
- **共享缓存**：多消费者共享同一快照缓存，避免重复 git 操作
- **有界 fetch**：10s 硬超时 + 进程组清理 + `GIT_TERMINAL_PROMPT=0` / `GCM_INTERACTIVE=Never` 环境钉死，防止 fetch 挂起或弹出交互提示
- **60s ref 租约**：远程 ref 信息带 60 秒租约，租约内不重复查询
- **请求合并**：并发相同加载请求合并为一次实际 Git 操作
- 效果：warm 读取从 394 次 Git 操作降到 ≤3

**publication-owner 体系**（BACK-601）是 BACK-602 的地基：epoch、generations/versions、`mergeConcurrentChanges`、config 事件构成发布所有权模型，增量加载在其上叠加。

## 本地快路径（BACK-600）

`queryTasks` 在 `includeCrossBranch: false` 时走纯本地快路径：直读文件系统、不初始化 ContentStore、不碰 Git，供只需要当前分支数据的调用方低成本使用。

## createRuntimeCore() 工厂（BACK-593）

`createRuntimeCore()` 成为唯一的 Core 构造路径，统一三端（CLI/MCP/Web）的 Core 创建逻辑：

- init 遵循 `BACKLOG_CWD` 环境变量决定的工作目录
- 找不到项目时优雅降级而非崩溃

## entity-id 共享模块（BACK-596）

文档/决策身份统一走共享 entity-id 模块（此前任务与文档/决策各有一套 ID 逻辑）：

- `AmbiguousIdError` 携带候选列表，在各 surface fail-closed 呈现
- 详见 [[concepts/task-identity]]

## ContentStore publish:false 回退（BACK-699）

`findIdentity` 的 rename 回退路径不再在未安装语料的情况下发布 freshness——即回退读取只返回身份解析结果，不推进发布版本指纹。这避免了"指纹已前进但语料未安装"的陷阱：消费者看到新指纹却读到旧数据（[[sources/back-699-findidentity-nonpublishing-fallback|BACK-699]]）。

## 批量状态移动 primitive（BACK-680）

core 提供批量移动 primitive，把多个任务一次性移动到目标状态，CLI 的多 ID `task edit` 与 TUI 多选移动共享该实现，保证锁与缓存失效语义一致（[[sources/back-680-batch-status-move|BACK-680]]）。

## 强制刷新与在途 fetch（BACK-660）

跨分支加载的强制刷新不再加入一个在途的过期 fetch（join 旧 fetch 会返回刷新前就已过时的结果）；强制刷新会等待在途 fetch 完成后发起新的加载，保证"强制"语义真正拿到新数据（[[sources/back-660-forced-refresh-stale-fetch-race|BACK-660]]）。

## Related Sources
- [[sources/back-533-config-block-yaml-lists]] — BACK-533 块状 YAML 列表
- [[sources/back-534-preserve-updated-date-ordinal-reorder]] — BACK-534 ordinal 保留时间戳
- [[sources/back-540-content-store-stale-refresh-guard]] — BACK-540 过期刷新守卫
- [[sources/back-660-forced-refresh-stale-fetch-race]] — BACK-660 强制刷新等待在途 fetch
- [[sources/back-680-batch-status-move]] — BACK-680 批量状态移动 primitive
- [[sources/back-699-findidentity-nonpublishing-fallback]] — BACK-699 findIdentity 非发布回退
