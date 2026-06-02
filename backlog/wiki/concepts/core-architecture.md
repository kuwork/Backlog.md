---
type: concept
title: 核心架构与数据流
updated: 2026-05-06
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
