---
title: 共享任务身份
created_date: '2026-08-17 23:00'
updated_date: '2026-09-26 16:30'
labels: [concept, core, identity, git]
---

# 共享任务身份

跨分支、已完成、归档等不同来源的任务记录共享一个统一身份：canonical ID + 规范化仓库相对逻辑路径。

## 身份键

- `canonicalTaskId`：零填充不敏感、点前缀/大小写不敏感的分组 ID（如 `BACK-007` 与 `BACK-7` 等价）
- `normalizeRecordPath`：仓库相对的逻辑任务路径（不同 backlog 目录或子目录规范化）

## 解析规则

- **同一 ID + 同一路径** = 同一身份的多版本；工作副本权威
- **不同 live 路径** = 歧义；`Core.getTask` 抛出 `AmbiguousTaskIdError`，浏览器 API 返回 409 并附候选列表
- **任何 live 变体** 占用该 ID；全部归档/完成后 ID 可复用
- 确定性胜出顺序：工作副本 > 最近修改 > 最多完成项

## 用途

- CLI/MCP/浏览器/统计/生命周期/分配全部通过同一身份规则解析
- 修复等时间戳下扫描顺序可能释放 live ID 的竞态
- `ContentStore` 轻量语料快照在身份索引上缓存 active/completed 任务

## 身份规范扩展到文档与决策（BACK-596/598）

身份规范从任务扩展到文档/决策，统一走共享 entity-id 模块：

- `entityIdKey` 统一身份键生成
- 零填充归一（`doc-7` ≡ `doc-007`）
- 空 ID 不可寻址，直接报错
- path/slug/标题引用解析三趟：文档视图可分别按路径、标题、slug 消歧（[[sources/back-598-doc-view-disambiguate-path-title-slug]]）

## fail-closed 语义（BACK-596）

解析歧义或身份缺失时不猜测，各 surface 统一 fail-closed：

| 表面 | 行为 |
|---|---|
| CLI | 退出码 1 |
| 服务器 | HTTP 409 |
| MCP | `AMBIGUOUS_ID` |
| Web | 共享通知提示 |

## 草稿身份 fail-closed（BACK-642）

草稿同时携带文件名派生 ID 与 frontmatter ID 两个竞争身份，不同消费者规范化方式不一。`draftIdentityKey(id)`（`src/utils/task-path.ts`）成为唯一规范化权威（前缀小写、零填充/小数段不敏感，构建于 `canonicalTaskId` 之上）；所有草稿经 `resolveDraftFilePath` 单一查找器解析，歧义时抛出 `AmbiguousIdError` 并点名全部候选（CLI 退出 1、server 409、MCP `AMBIGUOUS_ID`）。`saveDraft` 收敛同身份文件名但绝不删除无法解析的文件；`demoteTask` 分配草稿 ID 时把文件名派生 ID 计入占用（[[sources/back-642-draft-identity-fail-closed]]）。

## 保留前缀守卫（BACK-647）

`backlog init --task-prefix` 曾接受 `draft`/`doc`/`decision` 等硬编码系统前缀，导致前缀路由消费者把任务当草稿处理。`src/utils/prefix-config.ts` 独占该规则（`RESERVED_TASK_PREFIXES` / `isReservedTaskPrefix` / `getTaskPrefixError`），在 CLI flag、向导、`initializeProject()` 与浏览器 init 端点（400）统一拒绝；存量项目继续可用，`doctor` 报告撞名并拒绝 `--fix`（[[sources/back-647-reserved-task-prefixes]]）。

## 排序权威与文件名承重约定（BACK-649/650）

- `compareTaskIds`（`src/utils/task-sorting.ts`）是唯一 ID 排序权威：`TaskIdentityIndex.getTasks()` 由 `localeCompare` 改走共享比较器，修复 1.9 排在 1.10 前的分歧；视图层不自行排序以保留 `--sort`/ordinal 语义（[[sources/back-649-shared-subtask-sorting]]）。
- 文件名 `<id> - <title>.md` 的 ` - ` 分隔符是承重约定：content-store watcher、decision watcher、文档去重、doctor 修复均依赖它。`sanitizeFilename` 对纯标点标题（如 `!!!`）回退为 `untitled` 占位段，绝不产生仅含 ID 的文件名（[[sources/back-650-untitled-filename-fallback]]）。

## 归档释放 ID（BACK-664）

归档记录被刻意排除在依赖语料之外：归档会把 ID 释放给下一个任务，残留的归档文件会让指向新持有者的依赖变为歧义。仅归档记录携带的依赖按未知 ID 拒绝；completed 记录则是合法依赖目标（[[sources/back-664-dependency-input-completed-predecessors]]）。清理语义见 [[concepts/task-lifecycle]] 的 vacated-ID 清理。

## 图内身份拆分：FileNode(path PK)（BACK-713）

Kuzu 图节点表由 `Task(id)` 改为 `FileNode(path PRIMARY KEY, id, ...)`:文件路径是唯一节点身份，任务 ID 降级为属性。改名/完成/降级/归档折叠为一次同 ID 迁移（删旧路径 + 建新路径 + 重建受影响边）；对外 `getPayload` 仍把路径翻译回任务 ID,API 不变（[[sources/back-713-filenode-rename]]）。

## 依赖校验中的身份处理（BACK-707/680）

- **canonicalise-but-preserve-stored-spelling**(BACK-707)：可解析候选仍被规范化（`358` → `BACK-358`)，但存量不可解析依赖按其磁盘拼写原样写回（`task-213` 保持 `task-213`)；比较前双方必须同方式规范化，否则容忍逻辑不触发（[[sources/back-707-dependency-gate-cycles]]）。自引用在解析后判出（`taskIdsEqual(resolved, subjectId)` → `SelfDependentTaskError`），依赖缺陷在 `doctor` 里一律按 warning 报告、退出码 0（[[decisions/doctor-dependency-defects-warning-exit-zero]]）。
- **批量去重**(BACK-680)：批量状态移动以 canonical 身份去重（前导零坍缩、裸数字补默认前缀）,cross-branch 卡片排除在批量写集外，歧义 ID 按任务逐个 fail-closed 报错（[[sources/back-680-batch-status-move]]）。

## Related Sources

- [[sources/back-567-cross-branch-task-identity]] — 身份索引实现
- [[sources/back-568-core-browser-task-boundary]] — 浏览器边界复用身份索引
- [[sources/back-596-fail-closed-document-decision-identity]] — BACK-596 文档/决策 fail-closed 身份
- [[sources/back-598-doc-view-disambiguate-path-title-slug]] — BACK-598 三趟引用解析
- [[sources/back-642-draft-identity-fail-closed]] — BACK-642 草稿身份 fail-closed 与 draftIdentityKey
- [[sources/back-647-reserved-task-prefixes]] — BACK-647 保留前缀守卫
- [[sources/back-649-shared-subtask-sorting]] — BACK-649 共享 compareTaskIds 排序
- [[sources/back-650-untitled-filename-fallback]] — BACK-650 untitled 文件名回退
- [[sources/back-664-dependency-input-completed-predecessors]] — BACK-664 completed 依赖目标与归档释放 ID
- [[sources/back-680-batch-status-move]] — BACK-680 批量移动的身份去重
- [[sources/back-707-dependency-gate-cycles]] — BACK-707 依赖写入门禁
- [[sources/back-713-filenode-rename]] — BACK-713 FileNode path PK 身份拆分
