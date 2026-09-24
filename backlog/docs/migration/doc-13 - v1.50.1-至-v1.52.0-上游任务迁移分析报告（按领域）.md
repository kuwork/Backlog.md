---
id: doc-13
title: v1.50.1 至 v1.52.0 上游任务迁移分析报告（按领域）
type: guide
created_date: '2026-09-15 05:49'
updated_date: '2026-09-24 00:27'
---
# 上游任务迁移分析报告（v1.50.1 .. v1.52.0，按领域）

本报告对应 `doc-12` 中全部条目（含跳过项），逐项给出上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与迁移建议。所有结论以**上游 merge commit 与 fork 工作树的 file:line 对照**为依据。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准，凡与其「不应回退的内容」重合的上游改动一律标为跳过。

## 分析方法说明

每项按以下维度给出结论：

| 维度 | 说明 |
|------|------|
| 任务核心目的 | 上游任务要解决的问题或提供的功能 |
| 变更内容摘要 | 上游 merge commit 实际改动的文件与逻辑 |
| 与当前定制代码的交集风险 | 高 / 中 / 低 + 理由（含 fork 侧 file:line） |
| 适合迁移的内容 | 可复用的具体逻辑或修复 |
| 需要排除/调整的内容 | 不应照搬的部分（含排除清单条目） |
| 迁移优先级 | A（必须合入）/ B（评估合入）/ C（跳过） |
| 迁移建议 | ①直接复用 / ②参考重写 / ③忽略 |

---

# 一、CLI / Core（命令行与核心数据）

## CORE-1：BACK-401 Add dueDate support for tasks and milestones across CLI, TUI, Web, and MCP

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 为任务与里程碑引入可选 `dueDate`，贯通 CLI / TUI / Web / MCP 全链路的创建、编辑、清除、列表与详情。 |
| **变更内容摘要** | 上游在 `src/types/index.ts`（Task/Milestone/TaskCreateInput/TaskUpdateInput 加 `dueDate?`）、`src/markdown/parser.ts`（对 `due_date` 加引号包裹并 `normalizeUtcDateTime`）、`src/markdown/serializer.ts`（`due_date` 写出）、`src/utils/utc-datetime.ts`（新增 79 行，`normalizeUtcDateTime` 将值规范为「分精度 UTC」，并**显式拒绝 date-only 值**）、`src/utils/task-edit-builder.ts`（`dueDate === null` → 置 null 清除）、`src/cli.ts`、`src/commands/task-wizard.ts`、`src/core/backlog.ts`、`src/mcp/*`、`src/server/index.ts`、Web/TUI 多文件新增 dueDate 接线。 |
| **与当前定制代码的交集风险** | 高 — 上游语义与 fork 直接冲突：上游 `dueDate` 是 **UTC date-time**，上游 `normalizeUtcDateTime` 拒绝 date-only（见 `src/markdown/parser.ts` 上游改动），清除用 `null`；而 fork 的 `dueDate` 是 **date-only 字符串**（`src/types/index.ts:71`），date 体系采用「存储 UTC / 展示本地时区」且清除用空串 `""`（`src/core/backlog.ts:1744` `applyOptionalDateField`；`src/cli.ts:4086` `clearDueDate ? ""`）。更关键：fork 已**自带** dueDate 全链路接线 —— CLI 创建/编辑/清除（`src/cli.ts:1956`、`3397-3413`、`4086`）、MCP handler（`src/mcp/tools/tasks/handlers.ts:41`、`141`）、Web 弹窗（`src/web/components/TaskDetailsModal.tsx:84`、`131`、`350`、`869`）、markdown 解析/序列化（`src/markdown/parser.ts:198`、`serializer.ts:70`）。 |
| **适合迁移的内容** | 无净新增能力；上游仅把 fork 已有的 dueDate 换成另一种（冲突的）存储格式并补了若干表面接线，而 fork 表面接线已齐全。 |
| **需要排除/调整的内容** | 排除上游 `normalizeUtcDateTime`（UTC date-time + 拒 date-only）、`utc-datetime.ts` 新文件、以及 `task-edit-builder.ts` 的 `null` 清除语义；保持 fork 的 date-only + `localDateTimeToStoredUtc`（`src/utils/date-utc.ts`）+ `""` 清除策略。依据**排除清单 §2**。 |
| **迁移优先级** | 初判 AB → 深度分析 C类。理由：fork 已有等价 end-to-end 能力且上游日期语义与 fork 既定策略正面冲突，直接迁移会回退 fork 的 date-only 字段体系。 |
| **迁移建议** | ③忽略。本任务不导入；fork 的 dueDate 能力已在位且受排除清单 §2 保护。若后续发现某表面（如 MCP milestone schema）缺字段，单独按 fork 语义补，不引用上游实现。 |

---

## CORE-2：BACK-548 Expose bidirectional dependency graphs in task details

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在任务详情中展示双向依赖图（它依赖谁、谁依赖它），包含直接/传递层级、缺失/歧义节点与环检测。 |
| **变更内容摘要** | 新增 `src/core/task-detail.ts`（`loadTaskCorpus(core, {includeCrossBranch})`、`TaskDetail = Task & { dependencyGraph }` 只读派生，不写回）、`src/utils/dependency-graph.ts`（`buildDependencyGraph`，边方向 from→to，`dependencyDepth`/`dependentDepth` 跳数，BFS 有界、fail-closed、确定性）、`src/utils/task-record-index.ts`（新）、`src/formatters/dependency-graph-text.ts`（新）、`src/web/components/DependencyGraphSection.tsx`（新）；修改 `src/core/task-detail.ts`/`task-identity-index.ts`/`readiness.ts`/`formatters/json-output.ts`/`task-plain-text.ts`（签名改吃 `TaskDetail`）/`mcp/tools/tasks/handlers.ts`/`server/index.ts`（**删除** `/api/tasks/:id/dependency-graph` 独立端点，图并入详情响应）/`web/App.tsx`/`TaskDetailsModal.tsx`/`lib/api.ts`/`ui/task-viewer-with-search.ts`。 |
| **与当前定制代码的交集风险** | 中 — fork **完全缺失**依赖图能力：`src/core/task-detail.ts`、`src/utils/dependency-graph.ts`、`src/utils/task-record-index.ts` 均不存在（已 `ls` 确认）。但两处需谨慎：① `src/utils/readiness.ts` 是 fork 自研（`createReadinessGraph:49`、`getTaskReadiness:87`、`formatReadinessBlockers:124`），上游把 readiness 改为复用共享 corpus loader（删除「corpus 三重加载」），不可整体覆盖 fork 的就绪度逻辑；② `src/web/components/TaskDetailsModal.tsx` 与 `src/server/index.ts` 为 fork 重度定制，并入图字段须适配 fork 的详情响应结构。 |
| **适合迁移的内容** | 依赖图纯模型 `dependency-graph.ts`、`task-record-index.ts`、`task-detail.ts` 的 `loadTaskCorpus`/`TaskDetail` 派生、`DependencyGraphSection.tsx`、CLI/TUI 的 `Depends on`/`Dependents` 渲染、JSON 中 `task.dependencyGraph` 字段、`server/index.ts` 删除独立端点并并入详情。 |
| **需要排除/调整的内容** | 调整 `src/utils/readiness.ts`：保留 fork 自研就绪度计算，仅接入上游的「共享 corpus loader」以消除重复加载，不得用上游 `readiness.ts` 整文件替换。Web `TaskDetailsModal` 与 `server/index.ts` 图字段并入须对齐 fork 现有详情接口，不套用上游删除/新增的行号上下文。无对应排除清单节号，但适用**排除清单 §6 通用原则（自研能力优先参考重写）**。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：fork 缺失该能力（真空白），功能独立且价值明确，应合入。 （口径校正：依赖图是新能力（fork 净空白），非共用模块缺陷，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写。以 fork 结构重建 `task-detail.ts` 详情读取路径与 `dependencyGraph` 派生，新增纯模型文件，保留自研 `readiness.ts` 仅做 loader 共享化。 |

---

## CORE-3：BACK-626 Make task archive, complete, and demote local-first like view and edit

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 `archive`/`complete`/`demote` 等生命周期命令像 view/edit 一样默认只查本地工作副本（`includeCrossBranch: false`），避免误改跨分支任务。 |
| **变更内容摘要** | `src/cli.ts` 中对 `loadTaskById`/`archiveTask`/`completeTask`/`demoteTask` 传入 `{ includeCrossBranch: false }` 并补 `LOCAL_TASK_LOOKUP_HINT`；`src/core/backlog.ts` 给 `archiveTask`/`completeTask`/`demoteTask` 增加 `options: TaskReadOptions = {}` 形参并下传 `loadTaskForMutation(taskId, options)`。 |
| **与当前定制代码的交集风险** | 中 — fork 的 `archiveTask`/`completeTask`/`demoteTask` 当前签名为 `(taskId, autoCommit?)`（`src/core/backlog.ts:2753`、`2865`、`2938`），无 `options` 形参，且 `loadTaskForMutation` 内部读取策略可能与上游不同；fork 的生命周期命令是否已是 local-first 需核对，但接口形态差异意味着不能整段套用。 |
| **适合迁移的内容** | 为 `archiveTask`/`completeTask`/`demoteTask` 增加 `options` 形参并将 `includeCrossBranch: false` 透传到 `loadTaskForMutation`；CLI 调用处加本地查找提示。 |
| **需要排除/调整的内容** | 直接用上游 diff 行号覆盖 `backlog.ts` 会失败（fork 方法体已含日期字段/级联逻辑）；须按 fork 的 `loadTaskForMutation` 实参形态改动。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：属行为修正（local-first），有益但非新能力，且需对齐 fork 既有读取路径，工作量可控。 |
| **迁移建议** | ②参考重写。在 fork 三个生命周期方法中加 `options` 形参并下传 local-first 开关，CLI 调用补提示。 **已落地（2026-09-22，[BACK-691](/task/691)，与 CORE-32 合并）**：CLI archive/complete 预检改 `loadTaskById(taskId, {includeCrossBranch:false})` 并移除不可达的跨分支守卫（branch-only 与 view 同为 not-found）；core 三方法加 `TaskMutationOptions`，local-only 时经 `loadWorkingCopyTask`（工作副本索引、歧义 fail-closed）。上游的 LOCAL_TASK_LOOKUP_HINT 未引入——fork 的 local-first 解析直接复用 view 的 not-found 文案，语义等价。 |

---

## CORE-4：BACK-627 Prevent forced allocation refresh from joining an in-flight stale fetch

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复任务 ID 分配时的竞态：强制刷新若「搭上」一个已在途的旧 fetch，会导致推送期间到达的新任务不可见；改为等该 fetch 结束后强制再触发一次。 |
| **变更内容摘要** | `src/core/backlog.ts` 的 `refreshRemoteRefsForTaskRead` 增加逻辑：当 `force` 为 true 且已有 `remoteRefRefRefreshPromise` 在途时，先 `await` 它结束（并校验 `git` 未被重指向后）再发起新 fetch；非强制请求保持原 join-or-start 行为。 |
| **与当前定制代码的交集风险** | 中 — fork 已实现 `refreshRemoteRefsForTaskRead`（`src/core/backlog.ts:450`）与 `REMOTE_REF_REFRESH_INTERVAL_MS` 租约，方法体已含 fork 的 Git 操作封装，行号/上下文与上游不同，需按 fork 实体重写而非整段替换。 |
| **适合迁移的内容** | 「force 时若已有在途 refresh 则先 await 其结束、再发新 fetch、并在 `git` 重指向后短路」的竞态修复逻辑。 |
| **需要排除/调整的内容** | 不得覆盖 fork 在 `refreshRemoteRefsForTaskRead` 中已有的分支/远端刷新逻辑；仅并入 gated await 控制流。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：上游正确性修复，fork 存在同方法可承载，价值高、改动小。 |
| **迁移建议** | ②参考重写。将 gated 控制流移植到 fork 的 `refreshRemoteRefsForTaskRead`（`:450`）。 |

---

## CORE-5：BACK-628 Stop findIdentity rename fallback from publishing freshness without installing the corpus

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 `ContentStore.findIdentity` 的 rename 回退路径：仅为解析单个任务身份而加载语料时，不应把该加载发布为共享跨分支新鲜度状态。 |
| **变更内容摘要** | `src/core/backlog.ts` 的 `loadContentStoreCorpus` 增加 `options?: { publish?: boolean }`，默认 `publishSharedState: options?.publish ?? true`；`src/core/content-store.ts` 的 `taskLoader` 类型加 `TaskLoaderOptions { publish? }`，`findIdentity` 回退改为 `loadTasksWithLoader(undefined, { publish: false })`。 |
| **与当前定制代码的交集风险** | 中 — fork 的 `loadContentStoreCorpus`（`src/core/backlog.ts:3460`）当前仅收 `progressCallback`、内部写死 `publishSharedState: true`（`:3483`、`:3607`），与上游签名不同；`content-store.ts` 的 `findIdentity` 回退路径在 fork 中形态需核对。**该风险已消除（2026-09-24，[BACK-699](/task/699)）**：核对结果 —— fork 的回退路径（现 `content-store.ts:1089`）与 loader 闭包（现 `backlog.ts:358`）与上游改前完全同形，仅行号不同（loader 现于 `backlog.ts:3944`，末行 `:3970`），故已按上游形接入。 |
| **适合迁移的内容** | 给 fork 的 corpus loader 增加「throwaway load」（`publish: false`）语义，并在 `findIdentity` 之类的单身份解析回退中传入，避免污染共享状态。 |
| **需要排除/调整的内容** | 按 fork 的 `loadContentStoreCorpus` 形参与 `content-store.ts` 现有 `taskLoader` 定义接入，不套用上游行号上下文。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：上游正确性修复，fork 存在可承载的同名方法，改动小且价值高。 |
| **迁移建议** | ②参考重写。为 fork corpus loader 增加 `publish` 选项并应用于身份解析回退。**落地（2026-09-24，[BACK-699](/task/699)）**：新增 `TaskLoaderOptions { publish?: boolean }`（`content-store.ts:31`）、构造参数（`:157`）、`loadTasksWithLoader`（`:2188`）、`taskLoader` 调用（`:2194`）；rename 回退改 `loadTasksWithLoader(undefined, { publish: false })`（`:1089`）；`loadContentStoreCorpus` 末行改 `publishSharedState: options?.publish ?? true`（`backlog.ts:3970`），故 `loadCurrentContent`/`refreshTasksFromDisk` 仍默认发布。两条回归用例覆盖两个方向（回退不得占用已移动的 ref；安装方必须仍安装），5 变体回退矩阵各只红其因果负责的用例。**复现插曲**：首版用例在未修复代码上竟为绿 —— store 绑定 watcher 后会自行跑一次 config 稳定读并发布，把回退的指纹副作用盖掉；改成等待 store 自身 `config` 事件（`store.subscribe`）而非 sleep 后才稳定变红。 |

---

## CORE-6：BACK-635 Reserve draft, doc, and decision prefixes at init

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 `backlog init` 与 `doctor` 中阻止把 `draft`/`doc`/`decision` 这类系统保留前缀用作可配置任务前缀，避免 ID 错路由。 |
| **变更内容摘要** | `src/utils/prefix-config.ts` 新增 `DOC_PREFIX`/`DECISION_PREFIX`/`RESERVED_TASK_PREFIXES` 与 `isReservedTaskPrefix(prefix)`、`getTaskPrefixError(prefix)`；`src/core/init.ts` 在初始化时调用 `getTaskPrefixError` 抛错；`src/server/index.ts`、`InitializationScreen.tsx`、`cli-doctor` 接入检测；新增 `prefix-config.test.ts` 等。 |
| **与当前定制代码的交集风险** | 低 — fork 的 `src/utils/prefix-config.ts`（395 行）仅定义 `DRAFT_PREFIX`（`src/utils/prefix-config.ts:13`），无 `isReservedTaskPrefix`/`getTaskPrefixError`；`src/core/init.ts` 在 `:157-179` 处理 `prefixes`，但无保留前缀校验。属纯增量、无覆盖风险。 |
| **适合迁移的内容** | `isReservedTaskPrefix` / `getTaskPrefixError` 两个校验函数，以及 `init.ts` 与 `doctor` 的接入点。 |
| **需要排除/调整的内容** | fork `init.ts` 的 prefixes 处理在 `:157-179`，需把校验插在「保留既有前缀 / 采用自定义前缀」之前，而非照搬上游在 `:116` 的插入点。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：fork 缺失该防护，纯增量、低风险、收益明确。 （口径校正：init 前缀保留是预防性防线，非已发生缺陷，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写。新增校验函数并接入 fork 的 `init.ts`（`:157-179`）与 doctor 流程；函数可基本复用上游实现。 |

---

## CORE-7：BACK-636 Fail closed on ambiguous draft identities

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 对草稿身份解析采用 fail-closed：歧义/不可读/文件名漂移的草稿在读写与提升前必须显式失败，而非静默选错文件。 |
| **变更内容摘要** | 新增/改造：`src/utils/duplicate-detection.ts` 加 `DraftIdentityFindings`、`detectContentIdentityIssues`；`src/file-system/operations.ts` 加 `withDraftLock`、`resolveDraftFilePath`、`extractDraftIdFromFilename`、`findDuplicateDraftFilenameGroups`、`diagnoseDraftIdentity`；`src/core/backlog.ts` 加 `diagnoseDraftIdentity()`，提升/编辑草稿时先取 `canonicalId`、持锁、fail-closed 解析；`src/cli.ts`/`server/index.ts`/`ui/*` 接入；`TuiTaskEditFailureReason` 增加 `"ambiguous"`。多 commit（b581cb3ce、268a6a956、7a19e1d00、110431c37，其中 110431c37 仅为任务记录文档）。 |
| **与当前定制代码的交集风险** | 高 — fork 已有草稿文件操作（`src/file-system/operations.ts` 的 `getDraftsDir:300`、`archiveDraft:851`、`promoteDraft:881`、`saveDraft:972`、`loadDraft:1000`、`listDrafts:1023`），但 `duplicate-detection.ts` 仅 `detectDuplicateTaskIds`（`src/utils/duplicate-detection.ts:28`），**缺少草稿身份诊断**；上游对 `cli.ts`/`backlog.ts`/`operations.ts` 改动面大，与 fork 定制的 cli（日期字段、set/add/remove 语义）必然冲突。 |
| **适合迁移的内容** | `withDraftLock` 锁机制、`resolveDraftFilePath`/`extractDraftIdFromFilename`、`findDuplicateDraftFilenameGroups`、`diagnoseDraftIdentity` 与 `TuiTaskEditFailureReason` 的 `ambiguous` 变体。 |
| **需要排除/调整的内容** | 上游 `cli.ts` 大段重写不得直接套用（fork cli 含 §5 的 set/add/remove 语义与 date-utc 接线）；草稿提升/编辑逻辑须保留 fork 既有 `promoteDraft`/`saveDraft` 行为。无排除清单节号适用，但适用**排除清单 §6 通用原则**。 |
| **迁移优先级** | 初判 AB → 深度分析 A类。理由：fork 缺失草稿身份 fail-closed 纪律（真空白 + 健壮性缺口），应合入。 |
| **迁移建议** | ②参考重写。以 fork 的 `operations.ts` 草稿方法为基础接入锁与 fail-closed 解析，不直接替换上游 cli/backlog 大段。 |

---

## CORE-8：BACK-637 Preserve consecutive blank lines inside fenced code blocks in notes (issue 930)

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复解析：实现笔记（implementation notes）中围栏代码块内的连续空行在序列化往返后丢失的问题（issue 930）。 |
| **变更内容摘要** | `src/markdown/structured-sections.ts` 增加约 157 行，对 fenced code block 内部连续空行做保留（解析/序列化对称处理）；新增 `implementation-notes.test.ts`、`structured-sections-code-fences.test.ts`。 |
| **与当前定制代码的交集风险** | 低 — fork 的 `src/markdown/structured-sections.ts` 经检索**无** `fence`/`blank`/`preserve`/`consecutive` 相关逻辑，说明 fork 尚未处理该问题；该文件改动自包含，不触碰 fork 的日期/依赖/统计定制。 |
| **适合迁移的内容** | fenced code block 内连续空行的解析与序列化保留逻辑（纯函数，可整体移植）。 |
| **需要排除/调整的内容** | 仅须对齐 fork `structured-sections.ts` 现有函数签名（如 `parseStructuredSections`/`serializeStructuredSections` 的命名与入参），不引用上游行号。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 A类。理由：fork 缺失该解析正确性修复，自包含、低风险。 |
| **迁移建议** | ②参考重写。将上游保留逻辑移植到 fork 的 `structured-sections.ts` 对应解析/序列化函数；函数级可基本复用。 |

---

## CORE-9：BACK-638 Allow task list --status to accept several statuses

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 `task list --status` 支持多值（重复 flag 或逗号分隔），与 `--exclude-status`/`--type` 对齐。 |
| **变更内容摘要** | 新增 `src/utils/status-filter.ts`（`normalizeStatusSet`、`statusMatchesSet`）；`src/types/index.ts` 的 `TaskListFilter.status` 由 `string` 扩为 `string 或 string[]`；同步修改 `src/core/backlog.ts`、`src/core/content-store.ts`、`src/file-system/operations.ts` 三处状态比较；`src/utils/task-search.ts` 的状态过滤改为 `normalizeStatusSet`/`statusMatchesSet`；`src/cli.ts`、`help-schema.ts`、`ui/*` 接入；`src/ui/components/filter-header.ts`、`unified-view.ts`、`view-switcher.ts` 调整。 |
| **与当前定制代码的交集风险** | 中 — fork **已实现**多 `--status`：CLI 用 `normalizeCliStatusList(core, rawStatuses, "--status")"`（`src/cli.ts:2068`、`2471`），`content-store.ts` 已 `Array.isArray(filter.status)`（`:280-283`）。但 fork **缺失** `src/utils/status-filter.ts`，且 fork 的 `src/utils/task-search.ts` 仍走单值 `statusLower === statusLower` 匹配（上游将其改为多值）——即 fork 的搜索路径仍是旧行为，与列表路径不一致。 |
| **适合迁移的内容** | `status-filter.ts` 的 `normalizeStatusSet`/`statusMatchesSet` 工具，以及将 fork `task-search.ts`（`:272` `applyTaskFilters`）的状态过滤统一为多值，消除搜索路径与列表路径的不一致。 |
| **需要排除/调整的内容** | fork 的 CLI flag 累加已具备，无需重做；上游对 `backlog.ts`/`content-store.ts`/`file-system/operations.ts` 的状态比较改动 fork 已等价实现，跳过。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：用户可见的多状态功能 fork 已具备，上游增量主要为新增 `status-filter.ts` 工具并统一搜索路径；属对齐/增强而非净新增。 |
| **迁移建议** | ②参考重写。引入 `status-filter.ts` 并用以统一 fork `task-search.ts` 的状态过滤；CLI 累加逻辑保留 fork 现有实现。 |

---

## CORE-10：BACK-639 Make drafts editable from the CLI and TUI

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让草稿可从 CLI 与 TUI 编辑（标题/状态/优先级/引用等），并锁定草稿变更区间、统一草稿身份解析，fail-closed 后再变更。 |
| **变更内容摘要** | 10 个 commit（40482ca09、2a0b99be6、46d2cd5e0、eff71ca78、8e9efb39a、7099bb479、bf184f531、19bbc798c、d3ea7943f、700c693fc）。核心：`src/cli.ts`（约 1361 行改动，新增 `draft edit` 及 TUI 草稿编辑）、`src/core/backlog.ts`（约 458 行，草稿编辑/锁定/解析）、`src/file-system/operations.ts`（约 321 行，锁区间、文件名匹配）、`src/commands/task-wizard.ts`、`src/utils/duplicate-detection.ts`、`src/utils/prefix-config.ts`、`src/utils/status.ts`、`src/utils/task-path.ts`、`src/ui/board.ts`、`src/ui/task-viewer-with-search.ts`；新增 `cli-draft-edit.test.ts`（1013 行）等。 |
| **与当前定制代码的交集风险** | 高 — fork 已有草稿文件操作（`operations.ts:300-1023`）但**可能没有 `draft edit` 命令 / TUI 草稿编辑**（待 fork cli 进一步核对，无 `draft edit` 子命令证据）；上游对 `cli.ts` 改动 1361 行，与 fork 定制 cli（日期字段、set/add/remove 语义 §5、`date-utc.ts`）必然大面积冲突；上游 `task-path.ts` 大幅精简（fork 同名文件结构不同）。 |
| **适合迁移的内容** | `draft edit` 命令与 TUI 草稿编辑能力、`withDraftLock` 锁区间、草稿身份的 fail-closed 解析与「绑定到所选文件」的编辑语义。 |
| **需要排除/调整的内容** | 上游 `cli.ts` 大段不得整段套用；须保留 fork 的 `--ref/--doc/--depends-on` set 语义与 `--add-*`/`--remove-*`/`--clear-*` 体系（**排除清单 §5**），以及 `date-utc.ts` 的 UTC 转换接线。上游 `task-path.ts` 重写需对照 fork 同名文件适配。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：fork 缺失「从 CLI/TUI 编辑草稿」这一能力（真空白），应合入；但集成成本最高。 （口径校正：草稿可编辑是新能力，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写。以 fork `operations.ts`/`backlog.ts` 草稿方法为基础重建 `draft edit` 与 TUI 编辑，严格保留 §5 的 set/add/remove/clear 语义与 §2 的日期处理。**已落地（2026-09-22，[BACK-683](/task/683)）**：CLI 的 `draft edit` 与 TUI 的编辑键共用任务编辑的字段选项链与 `editTaskInTui` 路径（草稿身份经 `resolveDraftFilePath` fail-closed，歧义时拒绝编辑、原文件不动），未整段套用上游 `cli.ts`。 |

---

## CORE-11：BACK-640 Use one identity lookup for tasks, documents, decisions, and drafts

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 统一任务/文档/决策/草稿的身份查找入口（单一解析器）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。该意图在实际工作中由 BACK-636（CORE-7）的 `resolveDraftFilePath`/`extractDraftIdFromFilename`/`diagnoseDraftIdentity` 与 BACK-639（CORE-10）的草稿锁定/解析纪律落地，并非独立 commit。 |
| **与当前定制代码的交集风险** | 低 — 无单独上游代码可冲突；相关能力已在 CORE-7/CORE-10 中作为草稿身份解析的一部分覆盖。 |
| **适合迁移的内容** | 无（由 CORE-7、CORE-10 承载）。 |
| **需要排除/调整的内容** | 本范围无上游代码，无需排除。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：worklist 记录为 C 类且无独立 commit，其目标被 CORE-7/CORE-10 实现覆盖，不单独导入。 |
| **迁移建议** | ③忽略。作为记录项跳过；相关实现随 CORE-7、CORE-10 一并迁移。 |

*draft 不导入，C 类。*

---

## CORE-12：BACK-643 Add a project task attribute for monorepo backlogs

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 为任务新增单值 `project` 属性（monorepo 多包场景），含校验、持久化、CLI/MCP/列表/搜索/TUI/Web 全链路过滤与展示。 |
| **变更内容摘要** | 新增 `src/utils/project-config.ts`（`getProjectValues`、`matchesProjectFilter`、`resolveProjectValue`、`noProjectsConfiguredMessage`、`formatValidProjectValues`）；`src/types/index.ts` 的 `Task`/`TaskCreateInput`/`TaskUpdateInput` 加 `project?`；`src/markdown/parser.ts`/`serializer.ts` 加 `project:` frontmatter；`src/core/backlog.ts` 加 `normalizeProject` 校验与过滤、`project` 读写；`src/core/content-store.ts`/`search-service.ts` 接入；CLI `--project`（create/edit/list/search、`config get projects`、completions、help）；MCP `task_create`/`task_edit` 加 `project`；Web `ProjectBadge.tsx`（新）、`Board`/`TaskCard`/`TaskColumn`/`TaskDetailsModal` 徽标与编辑；TUI `project.ts`（新）、`board.ts`/`filter-header.ts`/`unified-view.ts` 过滤。 |
| **与当前定制代码的交集风险** | 中 — fork **完全缺失** `project` 任务属性：`src/types/index.ts` 的 `Task` 无 `project` 字段（仅有 `BacklogConfig.projectName:355`，语义不同），`TaskListFilter` 也无 `project`；因此属净新增，无语义回退风险。但改动面覆盖 fork 已定制的 `cli.ts`/`mcp/handlers.ts`/`web/*`/`ui/*`，需逐面接入。 |
| **适合迁移的内容** | `project-config.ts` 校验工具、`project` 字段在类型/parser/serializer/core 的持久化与校验、CLI/MCP/列表/搜索的 `project` 过滤、`ProjectBadge` 与 TUI 过滤控件。 |
| **需要排除/调整的内容** | 各表面接入须套用 fork 现有结构（如 Web 弹窗的日期指示器与 AC 进度环、cli 的 set/add/remove 语义 §5），不覆盖 fork 定制；`config get projects` 须对齐 fork 配置读取。无排除清单节号直接适用（属净新增）。 |
| **迁移优先级** | 初判 AB → 深度分析 B类。理由：fork 缺失该属性（真空白），全链路价值明确，应合入。 （口径校正：project 属性是新能力（跨 58 文件），由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写。新增 `project-config.ts` 并逐面接入 fork 结构；类型/parser/serializer 加 `project` 字段，保留 fork 既有 frontmatter 处理。 |

---

## CORE-13：BACK-643.1 Core: Add project field to task domain model and persistence

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在任务领域模型与持久化层加入 `project` 字段（BACK-643 的子任务）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。该子任务的内容已包含在 BACK-643 主干 commit `7f9eabcd9` 中（类型/`parser`/`serializer`/`backlog` 的 `project` 字段与 `project-config.ts`）。 |
| **与当前定制代码的交集风险** | 低 — 无独立上游代码；主干 CORE-12 已覆盖，fork 缺失该字段（真空白）。 |
| **适合迁移的内容** | 无单独内容（见 CORE-12）。 |
| **需要排除/调整的内容** | 本范围无上游代码。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：worklist 记录为 C 类且无独立 commit，是 CORE-12 的分解项，随 CORE-12 一并合入。 |
| **迁移建议** | ③忽略。作为 CORE-12 的子任务跳过，不单独导入。 |

*draft 不导入，C 类。*

---

## CORE-14：BACK-643.2 CLI: Add --project flag to task create/edit, config get, and completions

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 CLI 的 `task create`/`edit`/`list`/`search` 与 `config get projects`、completions、help 中加 `--project`（BACK-643 子任务）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。该子任务内容已包含在主干 commit `7f9eabcd9` 的 CLI 改动中。 |
| **与当前定制代码的交集风险** | 低 — 无独立上游代码；随 CORE-12 接入 fork 定制 cli 时须保留 §5 的 set/add/remove 语义。 |
| **适合迁移的内容** | 无单独内容（见 CORE-12）。 |
| **需要排除/调整的内容** | 本范围无上游代码。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：C 类记录、无独立 commit，是 CORE-12 分解项。 |
| **迁移建议** | ③忽略。随 CORE-12 一并合入，不单独导入。 |

*draft 不导入，C 类。*

---

## CORE-15：BACK-643.3 MCP: Add project parameter to task_create and task_edit tools

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 MCP 的 `task_create`/`task_edit` 工具加 `project` 参数（BACK-643 子任务）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。已包含在主干 commit `7f9eabcd9` 的 MCP handler 改动中。 |
| **与当前定制代码的交集风险** | 低 — 无独立上游代码；随 CORE-12 接入 fork MCP handler（`src/mcp/tools/tasks/handlers.ts`）。 |
| **适合迁移的内容** | 无单独内容（见 CORE-12）。 |
| **需要排除/调整的内容** | 本范围无上游代码。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：C 类记录、无独立 commit，是 CORE-12 分解项。 |
| **迁移建议** | ③忽略。随 CORE-12 一并合入，不单独导入。 |

*draft 不导入，C 类。*

---

## CORE-16：BACK-643.4 Add project-based filtering to task list, search, and server API

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 `task list`/搜索/服务端 API 加 `project` 过滤（BACK-643 子任务）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。已包含在主干 commit `7f9eabcd9` 的 `backlog.ts`/`search-service.ts`/`server/index.ts` 改动中。 |
| **与当前定制代码的交集风险** | 低 — 无独立上游代码；随 CORE-12 接入 fork 过滤逻辑。 |
| **适合迁移的内容** | 无单独内容（见 CORE-12）。 |
| **需要排除/调整的内容** | 本范围无上游代码。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：C 类记录、无独立 commit，是 CORE-12 分解项。 |
| **迁移建议** | ③忽略。随 CORE-12 一并合入，不单独导入。 |

*draft 不导入，C 类。*

---

## CORE-17：BACK-643.5 TUI: Display and filter task project in board and detail views

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 TUI 看板与详情视图展示并过滤 `project`（BACK-643 子任务）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。已包含在主干 commit `7f9eabcd9` 的 `ui/project.ts`（新）、`board.ts`/`filter-header.ts`/`unified-view.ts` 改动中。 |
| **与当前定制代码的交集风险** | 低 — 无独立上游代码；随 CORE-12 接入 fork TUI（注意 fork 自研泳道 `swimlane` 不被覆盖）。 |
| **适合迁移的内容** | 无单独内容（见 CORE-12）。 |
| **需要排除/调整的内容** | 本范围无上游代码。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：C 类记录、无独立 commit，是 CORE-12 分解项。 |
| **迁移建议** | ③忽略。随 CORE-12 一并合入，不单独导入。 |

*draft 不导入，C 类。*

---

## CORE-18：BACK-643.6 Web UI: Display and edit task project

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Web UI 展示并编辑任务 `project`（BACK-643 子任务）。 |
| **变更内容摘要** | 本范围无上游代码（`commits: []`）。已包含在主干 commit `7f9eabcd9` 的 `ProjectBadge.tsx`（新）与 `Board`/`TaskCard`/`TaskColumn`/`TaskDetailsModal` 改动中。 |
| **与当前定制代码的交集风险** | 低 — 无独立上游代码；随 CORE-12 接入 fork Web（保留 fork 弹窗日期指示器与 AC 进度环等定制）。 |
| **适合迁移的内容** | 无单独内容（见 CORE-12）。 |
| **需要排除/调整的内容** | 本范围无上游代码。 |
| **迁移优先级** | 初判 C → 深度分析 C类。理由：C 类记录、无独立 commit，是 CORE-12 分解项。 |
| **迁移建议** | ③忽略。随 CORE-12 一并合入，不单独导入。 |

---

## 汇总

- 共 21 条：A类 7 条（CORE-2、6、7、8、10、12、19），B类 6 条（CORE-3、4、5、9、20、21），C类 8 条（CORE-1 深度降为 C；CORE-11、13、14、15、16、17、18 为 worklist 原 C 类记录，无独立 commit）。
- 重分类（初判 AB → 深度分析）：CORE-1 AB→C；CORE-3/4/5/9/20/21 AB→B；CORE-2/6/7/8/10/12/19 维持 A。

*draft 不导入，C 类。*

---

## CORE-19：BACK-648 Fall back to a placeholder filename for punctuation-only titles

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 当任务标题仅由标点组成时，`sanitizeFilename` 会得到空名，导致文件无法保存；改为回退到占位文件名。 |
| **变更内容摘要** | `src/file-system/operations.ts` 约 18 行：在 `sanitizeFilename` 结果为空时回退到占位名（如 `untitled` 类）；`filesystem.test.ts` 新增 101 行用例。 |
| **与当前定制代码的交集风险** | 低 — fork 的 `src/file-system/operations.ts` 用 `sanitizeFilename(task.title)` 生成文件名（`src/file-system/operations.ts:506`），检索未见标点-only 的占位回退；改动自包含，仅触及文件名生成，不碰 fork 日期/依赖/统计定制。 |
| **适合迁移的内容** | `sanitizeFilename` 在结果为空时回退占位文件名的分支。 |
| **需要排除/调整的内容** | 须对齐 fork `sanitizeFilename` 现有实现（若 fork 已自定义 sanitize 逻辑），将回退分支嵌入；不引用上游行号。无排除清单节号适用。 |
| **迁移优先级** | 初判 AB → 深度分析 A类。理由：fork 缺失该健壮性修复，低风险、自包含。 |
| **迁移建议** | ②参考重写。将空结果回退逻辑并入 fork 的 `sanitizeFilename`（`:506` 附近）；函数级可基本复用上游分支。 |

---

## CORE-20：BACK-649 Single-source task search config and filters in core

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 将任务搜索配置与过滤逻辑统一到 core 单一来源（`task-search.ts` + `search-service.ts`），消除 `Core.applyTaskFilters` 与 `SearchService` 中重复的状态/优先级/标签/项目匹配实现。 |
| **变更内容摘要** | `23403d5b` 单 commit（窗口内首版）：`task-search.ts` 重写为唯一属主（新增 `buildTaskSearchBodyText`/`buildTaskSearchFields`/`TASK_SEARCH_FUSE_OPTIONS`/`createTaskFilterMatcher`）；删除 `Core.applyTaskFilters`（backlog.ts −81 行）；`SearchService` 消费共享构建器并删除内部 `NormalizedFilters`（−283 行级）；MCP handlers −85 行；`applySharedTaskFilters` 整体删除（board/unified-view 改调 `applyTaskFilters`）；新增 `task-search-parity.test.ts`（276 行）。**窗口内后续提交（2026-09-21 追认）**：`task-search.ts` 又被 `7f9eabcd`（BACK-643 给共享匹配器加 project 谓词）、`05fbbdd3`（BACK-638 多状态并入）、`f1c14f6a`（BACK-672）触碰——v1.52.0 终版含 project 匹配，fork 落地应以首版为基准、剔除 project 部分。 |
| **与当前定制代码的交集风险** | 高 — **实测补齐（2026-09-21）**：fork 过滤实现共五份且语义漂移——`Core.applyTaskFilters`（backlog.ts:621，labels any-only 且忽略 labelMatch）、`SearchService` 两份（search-service.ts:392 `applyTaskFilters` + `matchesTaskFilters`，any-only）、utils `applyTaskFilters`/`applySharedTaskFilters`（labelMatch any\|all）、MCP 本地 all+大小写敏感（handlers.ts:199-205, 272-278）、CLI 本地 all（cli.ts:272,2742）——labels 语义六处分歧；bodyText 构建漂移：utils（task-search.ts:148-149）含 labels/assignee、`SearchService`（search-service.ts:592-622）不含（探针实测：query `infrastructure` / `@morgan` 本地索引命中、SearchService 空）；Fuse 配置两处逐字重复，fork 侧多 `fileName:0.25` 键（BACK-481 wiki 搜索自研，上游共享配置无）；且 fork 搜索集合含 wiki 实体（search-service.ts:301-309），上游 v1.52.0 搜索集合不含 wiki（2026-09-22 实测，grep 0 命中）。fork 已先行统一状态匹配（`src/utils/status-filter.ts` 四方共用），方向与上游一致。 |
| **适合迁移的内容** | 单一来源架构四件套（`buildTaskSearchBodyText`/`buildTaskSearchFields`/`TASK_SEARCH_FUSE_OPTIONS`/`createTaskFilterMatcher`）；「labels/assignee 全表面可搜」方向——探针实测 fork 复现该缺陷；上游 `task-search-parity.test.ts` 适配后作现成回归套件（其 import 的 `buildTaskSearchBodyText` fork 尚不存在，适配即补齐单一属主）。 |
| **需要排除/调整的内容** | ① 以 `23403d5b` 首版为基准，剔除 project 谓词（fork 无 project 字段，CORE-12 未迁移）；② 保留 fork `SearchService` 的 `fileName:0.25` 键、`fileName` 实体字段与 **wiki 语料**（BACK-481 自研，上游搜索集合无 wiki），落地形态为扩展共享配置（`{...TASK_SEARCH_FUSE_OPTIONS, keys: [...TASK_SEARCH_FUSE_OPTIONS.keys, { name: 'fileName', weight: 0.25 }]}`）而非替换；回归用 BACK-481 的 AC 加一条「wiki 页按文件名可搜到」用例；③ 保留 fork 过滤面（statusExcluded/parentTaskId），按 fork `TaskListFilter` 对齐共享谓词签名；④ `applySharedTaskFilters` 不宜照搬上游删除——fork 有消费者（board.ts:389、unified-view.ts:172，board 调用面带 fork 定制），改薄包装或迁移调用点；⑤ MCP labels 大小写敏感缺陷随统一顺手对齐为不敏感。适用**排除清单 §6 通用原则（参考重写）**。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（维持，2026-09-21 重分析实测加固）。理由：非数据丢失/安全/核心路径不可用，按分类口径不入 A；但 fork 缺陷已探针量化（跨表面同一查询结果不同、labels 六处分歧），迁移价值确凿。 **已落地（2026-09-22，[BACK-685](/task/685)）**：单一来源四件套收敛进 fork task-search.ts（谓词语义 = 五份实现并集，labelMatch 默认 any）；parity 套件 14 例全绿，变异回退矩阵（语料/接线/fileName 键三变体 × 精确红名单）验证判别力；tsc/check 干净。 |
| **迁移建议** | ②参考重写。以首版为基准把过滤谓词收敛进 fork `task-search.ts`（保留 fileName/statusExcluded/parentTaskId 与 `applySharedTaskFilters` 消费者），`SearchService`/`Core`/`MCP` 三处改消费共享谓词；parity 套件适配为回归；为 CORE-21 的硬前置。 **落地说明（2026-09-22，[BACK-685](/task/685)）**：wiki 语料与 fileName:0.25 键按保留项落地（服务侧 Fuse = 共享 options + 扩展键，wiki 断言钉在「命中必须来自 fileName 键」）；MCP labels 大小写敏感缺陷顺带修复；scoreThreshold 与 fork ID 变体算法原样保留，board/unified-view 消费者零改动。 |

---

## CORE-21：BACK-650 Route TUI and milestone-page task search through the shared core search

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 TUI 任务查看器与里程碑页的任务搜索也走与 CLI/Web 相同的 core 共享搜索，保证各表面结果一致。 |
| **变更内容摘要** | `9a42e89b` 单 commit（显式承接 BACK-649 Stage 2）：`task-viewer-with-search.ts` −115 行（SearchService 回退分支与手写 post-filter 折叠进共享索引路径）；`MilestonesPage.tsx` −41 行（私有 Fuse 删除，改浏览器端 import 共享 `createTaskSearchIndex` 在桶内任务上检索）；`task-search-parity.test.ts` +64 行、新增 `web-milestones-page-search.test.tsx`。**窗口内后续提交（2026-09-21 追认）**：`b2616cab`（BACK-670 撤销，净零）、`f1c14f6a`（BACK-672）、`53bbf721`（BACK-678）触碰 viewer，但属其他条目域。 |
| **与当前定制代码的交集风险** | 中 — **实测补齐（2026-09-21）**：fork viewer 双路径原样在——task-viewer-with-search.ts:206-243 建双引擎、:640-695 双分支，回退分支带 ~50 行手写 post-filter（里程碑过滤用标题相等比较 :668-677，与共享侧 `createMilestoneFilterMatcher`（milestone-filter.ts:110）的 NO_MILESTONE/ID 解析语义不同；ready 过滤重复实现 :687-690；阈值 0.45 硬编码两处 :656,662）；fork web 里程碑页私有 Fuse（MilestonesPage.tsx:147-156，键仅 title/id + exact-id/substring 预匹配），查 label/body/assignee 恒空。fork TUI 无任何里程碑分组交互面——`board --milestones` 的 `milestoneMode` 仅在非 TTY 管道分支生效（board.ts:266-287，输出静态 Markdown），交互 TUI 恒按状态分列，上游 v1.52.0 逐字同构（2026-09-22 实测校正）；本条目 TUI 半仅涉任务查看器。 |
| **适合迁移的内容** | 双路径折叠思路（fork 待删块与上游删除块形状逐行对应）；里程碑页共享索引路由（上游为浏览器端直接 import 共享索引，不经 API）；ready 过滤收敛到单条管线；上游 `web-milestones-page-search.test.tsx` 可作回归参照。 |
| **需要排除/调整的内容** | ① CORE-20 先落地（共享谓词是前提，须串行）；② fork readiness 引擎保留（与 fork 已落地的「readiness 只做 JSON 发布、不收敛 core」决策一致），折叠后 ready 过滤仍走 fork `buildReadinessGraph`/`getTaskReadiness`；③ 里程碑页 exact-id/substring 预匹配行为在共享索引路由后消失，去留需定夺（建议保留为前置短路以维持交互惯性）；④ fork viewer 定制渲染（AC 条形等）不动。适用**排除清单 §6 通用原则**。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（维持，2026-09-21 重分析实测加固）。理由：一致性增强而非净新增，fork 缺陷实测存在但非关键缺陷口径。 **已落地（2026-09-22，[BACK-686](/task/686)）**：viewer 双路径折叠为单条共享路径（手写 post-filter 全移除）；MilestonesPage 私有 Fuse 删除、路由共享索引（label/body 可达）；web 套件 6 例 + 变异矩阵（2 变体 × 精确红名单）验证。 |
| **迁移建议** | ②参考重写。与 CORE-20 同波次串行（第四波排序不变）；TUI 半折叠 fork viewer 双路径，web 半路由 fork `MilestonesPage` 到共享索引（预匹配去留按用户定夺）。 **落地说明（2026-09-22，[BACK-686](/task/686)）**：预匹配短路按建议保留为前置短路；随之暴露并修复客户端 bundle 污染（taskIdsEqual 迁入纯模块 task-id.ts，服务端核心出 web 图，浏览器实测恢复）；TUI viewer 无自动化脚手架属既有缺口，接线由 tsc 兜底、语义由 parity 套件钉住。 |

---

## CORE-22：BACK-651 Remove the temp-file roundtrip in README board export

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 去掉 `src/readme.ts` 生成 README board 时写临时文件 `.temp-board.md` 再读回的 roundtrip（竞态、残留文件、`Bun.$` shell 依赖）。 |
| **变更内容摘要** | 上游 `135bafd76` 改 `src/readme.ts:2` 的 import 由 `exportKanbanBoardToFile` 改为 `generateKanbanBoardWithMetadata`；`src/readme.ts:19-21` 去掉临时文件写入、`src/readme.ts:36-42` 去掉 `Bun.$ rm` 清理；并让 `src/board.ts` 排序非变异（`[...items].sort()`）。另 `src/board.ts:100` 处上游改为非变异排序。 |
| **与当前定制代码的交集风险** | 低 — fork `src/readme.ts:19-21` 仍用 `exportKanbanBoardToFile` + `Bun.$ rm` 的临时文件逻辑（与上游改造前一致）；fork `src/board.ts:68` 已存在 `generateKanbanBoardWithMetadata`，`src/board.ts:316` 有 `exportKanbanBoardToFile` 内部也调用它，复用条件具备。fork `src/board.ts:101` 为 `items.sort(...)`（变异排序），与上游修复的同一 bug 同源。 |
| **适合迁移的内容** | `src/readme.ts` 改为直接调用 `generateKanbanBoardWithMetadata(tasks, statuses, projectName)`（对应 fork `src/readme.ts:20-21,37-42`）；以及把 fork `src/board.ts:101` 的 `const sortedItems = items.sort(...)` 改为 `const sortedItems = [...items].sort(...)`。 |
| **需要排除/调整的内容** | 无排除项。注意 fork README 还带 `BOARD_START/BOARD_END` 标记与 License 段插入逻辑（`src/readme.ts:50-67`），上游同一函数结构一致，保持 fork 现有标记处理即可，不要删减。 |
| **迁移优先级** | B类（必须合入）— 初判 AB → 深度分析 A类：纯重构、无语义变更、fork 已具备被调函数、零定制回退风险。 （口径校正：去掉临时文件中转属内部实现清理，无行为变更，由 A 类归入 B 类评估。） |
| **迁移建议** | ①直接复用：对照上游 `src/readme.ts` 改写 `updateReadmeWithBoard`，并顺带修复 `src/board.ts:101` 的排序变异。 |

---

## CORE-23：BACK-656 Reject self-referential and cyclic task dependencies

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在统一校验入口 `validateDependencies` 拒绝任务把自己列为依赖（自引用）和会形成循环（cycle）的依赖；`backlog doctor` 报告既有自依赖与循环。 |
| **变更内容摘要** | 上游 `1cacf62a6`（+ `0276f7559` 扩到 cycle、`ab0022f49`/`e51540013` 收尾）新增 `src/utils/dependency-graph.ts` 的 `findCycleThroughRoot`（依赖图模块 fork 不存在）；改 `src/utils/task-builders.ts:39` 的 `validateDependencies(dependencies, core, target?)`，增加自引用抛错与循环检测；新增 `findDependencyDefects` 供 doctor 用；`src/cli.ts:489+` 增加 `printDependencyDefectsReport` 并在 doctor 中调用；新增 `loadDependencyCorpus`/`dependencyGraphCorpus` 助手。 |
| **与当前定制代码的交集风险** | 高 — fork 完全缺失 `src/utils/dependency-graph.ts`，而上游整条能力以该模块为基础。fork `src/utils/task-builders.ts:39-61` 的 `validateDependencies` 仅做存在性检查（只查 `tasks`+`drafts`，不查 completed/archived，也无自引用/循环判断），签名是 `(dependencies, core)`，上游改为 `(dependencies, core, target?)`。fork `src/cli.ts` 的 doctor（`src/cli.ts:5604` 附近）无依赖缺陷报告。迁移须整体引入依赖图模块并改写 fork 的 `validateDependencies` 签名与全部调用点。 |
| **适合迁移的内容** | `findCycleThroughRoot`、`findDependencyDefects`、`validateDependencies` 的自引用/循环分支、`printDependencyDefectsReport` 及 doctor 集成；corpus 需覆盖 tasks/drafts/completed/archived。 |
| **需要排除/调整的内容** | 上游 `validateDependencies` 内部用 `core.queryTasks({ includeCrossBranch: false })` 构建 corpus；fork 的 `queryTasks()` 默认行为需核对是否含跨分支，必要时对齐 `includeCrossBranch` 语义，避免与 fork 跨分支可见性策略冲突（见排除清单 §6 通用原则）。引入新模块不得触碰 fork 自研 `src/utils/readiness.ts`。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：属真空能力（fork 当前根本不挡自引用/循环），价值明确，但因依赖全新 `dependencyGraph` 模块且改动 `validateDependencies` 签名/调用点，需整模块移植与回归，非简单摘樱桃。 |
| **迁移建议** | ②参考重写：先将 `src/utils/dependency-graph.ts`（含 `buildDependencyGraph`/`findCycleThroughRoot`/`buildDependencyTree`）整体作为新文件引入，再据此改写 fork `src/utils/task-builders.ts` 的 `validateDependencies` 与 `src/cli.ts` doctor；保留 fork 既有的依赖解析/跨分支处理风格。 |

---

## CORE-24：BACK-658 Resolve dependency targets in completed and archived tasks

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 `validateDependencies` 把依赖目标解析范围从「工作副本 + 草稿」扩到**已完成**与**归档**记录（`backlog/completed/`、`backlog/archive/`），使「依赖一个已完成任务是正常的」能被创建/编辑、依赖列表可再编辑；配套打通 web 依赖输入的可解析与可下钻。 |
| **变更内容摘要** | 上游 `133108417`（closes #942）的源码改动只有 `src/utils/task-builders.ts`（另加两组测试）：corpus 由 `[tasks, drafts]` 扩为 `[tasks, drafts, completed, archived]`，并保留既有 `core.loadTaskById(resolved, …)` 工作副本歧义检查；纯校验扩展，不影响 readiness/图语义，上游 commit 自述「nothing here overlaps the planned self/cycle checks (BACK-656)」。fork 侧已由 [BACK-664](/task/664) 落地（`src/utils/task-builders.ts:83-88`），并额外覆盖 web 依赖输入的解析与下钻。 |
| **与当前定制代码的交集风险** | 中 → 已消解。**实测补齐（2026-09-19）**：本行原记「corpus 只查 tasks+drafts，故依赖已完成会被拒」——该症状现不存在：`src/utils/task-builders.ts:83-88` 的 corpus 为 `queryTasks() + listDrafts() + listCompletedTasks()`，已完成目标在 CLI / MCP / web 的 create 与 edit 上均被接受（`src/test/dependency.test.ts:365`、`:378` 固化）。另一处结论同时更正：fork 的 `resolveUniqueDependency`（`src/utils/task-builders.ts:44-61`）先于本次改动即存在，故本条目**不依附 CORE-23**、可独立落地（上游 commit 亦自述与 BACK-656 无重叠）。 |
| **适合迁移的内容** | 已完成。corpus 扩到 completed、`known` 扩为三源并集（`src/utils/task-builders.ts:83-88`）；同一身份被多条记录认领时 fail-closed 抛 `AmbiguousTaskIdError`（`resolveUniqueDependency`:44-61），同一任务的不同写法不再重复持久化（`:102-105`）。web 侧：下拉按 BACK-662 的 `completed=true` 提供已完成候选、chip 解析出标题并可点击、点击以只读弹窗打开（BACK-663 语义）。 |
| **需要排除/调整的内容** | 两处与上游的**有意分歧**，均已由测试固化：①**归档排除** —— fork 的 ID 分配器只数 active ∪ completed，归档会**释放** ID，故把归档记录留在 corpus 会让「依赖复用了该 ID 的新任务」变成歧义、该 ID 不可作目标；`rejects a dependency on an archived task`（`src/test/dependency.test.ts:396`）与 `resolves an archived id to the task that reused it`（`:412`）是设计要求，不是缺口。②**保留上游第二道闸**（`src/utils/task-builders.ts:98-101`）—— `queryTasks()` 把一个身份坍缩为一条记录，看不到 `backlog/tasks/` 内两份同身份文件，只有工作副本查找能 fail-closed；`fails closed when several working-copy files claim one identity`（`:460`）覆盖该形状，跨 store 重身份另由语料层拦截（`:442`）。`core.queryTasks()` 的跨分支可见性按 fork 配置决定，本次未改动该语义（排除清单 §6 未触发）。 |
| **迁移优先级** | A类（必须合入）— 已落地：[BACK-664](/task/664)（Done）。**（口径校正：原记「实现上依附 CORE-23 的函数重写」不成立 —— fork 的 `validateDependencies` 早已有 `resolveUniqueDependency` 收敛，本次只是扩 corpus 并保留第二道闸；CORE-23 的自引用/环检测仍是净空白，与本次同函数但无依赖关系，可分头落地。）** |
| **迁移建议** | ②参考重写 → **已落地**：[BACK-664](/task/664)。实际形态与上游差一处（归档不纳入）、同上游一处（不改 `loadTaskById` 调用本身，只保留其歧义检查作用）；守卫改为 fail-closed 后，原先静默「取第一条」的输入变成硬报错，属有意收紧，须与任务记录一并登记。 |

---

## CORE-25：BACK-659 Include grandchild subtasks in board export grouping

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 markdown board 导出（`backlog board export`）只嵌套一层子任务、导致孙级子任务（父任务的子任务又是子任务）被丢弃的问题。 |
| **变更内容摘要** | 上游 `ea809c223` 改 `src/board.ts`：将原本 `for (const t of top) { result.push(t); result.push(...subs); }` 的单层展开，改为递归 `pushWithChildren(t)`（`src/board.ts:124-145` 附近），按现有 `children` 映射深度优先铺平，同层仍按 ID 升序。 |
| **与当前定制代码的交集风险** | 中 — fork `src/board.ts:128-139` 正是“一层展开”写法（`result.push(t); ...; result.push(...subs);`），与上游修复前一致，因此 fork 存在该 bug：孙级子任务在导出 board 中丢失。fork 的 `children` 映射（`src/board.ts:98`）和排序前缀 `└─ ` 形状（`src/board.ts:154`）与上游同源，可对齐。 |
| **适合迁移的内容** | 把 fork `src/board.ts:128-139` 的最终列表构建改为递归 `pushWithChildren`，保持 `children` 映射与 ID 升序排序不变。 |
| **需要排除/调整的内容** | 无排除项。注意 fork 的 `buildKanbanStatusGroups`（`src/board.ts:13`）与 `generateMilestoneGroupedBoard`（`src/board.ts:181`）若也有子任务铺平逻辑，需一并核对是否同样只展开一层（当前范围只看主 board 函数，迁移时自查这两个入口）。 |
| **迁移优先级** | B类（必须合入）— 初判 AB → 深度分析 A类：纯 bug 修复、作用域封闭在 `src/board.ts`、不与任何 fork 定制冲突。 （口径校正：board 导出补全属功能完善，由 A 类归入 B 类评估。） |
| **迁移建议** | ①直接复用：对照上游 `src/board.ts` 递归改写 fork 同段代码。 |

---

## CORE-26：BACK-660 Reject nested section markers in notes and fix append truncation

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 `--notes` 等分段输入若内含自身 sentinel marker 会嵌套标记、隐藏内容，以及抽取时遇行内子串即截断的问题；改为“拒绝而非静默剥离”，并统一为按整行、深度感知的块扫描。 |
| **变更内容摘要** | 上游 `3d73793b9` 改 `src/core/backlog.ts:272+` 新增 `assertSectionInputsSafe`（在 `createTaskFromInput`/`applyTaskUpdateInput` 共享输入边界校验 description/plan/notes/finalSummary 及 append 系列）；`src/markdown/structured-sections.ts` 用统一 `findSentinelBlocks` 替换原 5 个正则；新增 `assertSectionInputHasNoMarkerLines` 导出。 |
| **与当前定制代码的交集风险** | 中 — fork `src/markdown/structured-sections.ts` 中无 `findSentinelBlocks`/`assertSectionInputHasNoMarkerLines`（grep 无命中）；fork `src/core/backlog.ts:2014-2033` 仅对 comment body/author/created 做了 comment marker 守护，对 SECTION 类 marker（NOTES/BEGIN/END）无守护，故 fork 存在上游所述“嵌套 marker 隐藏内容”缺陷。 |
| **适合迁移的内容** | 在 fork 的 `applyTaskUpdateInput`/`createTaskFromInput` 输入边界加 `assertSectionInputsSafe`（对 description/plan/notes/finalSummary 及其 append 变体）；引入 `findSentinelBlocks` 替代 fork 现有分段抽取正则/逻辑。 |
| **需要排除/调整的内容** | 上游 `structured-sections.ts` 重写幅度大（173 行），需核对 fork 该文件是否已有分叉实现（如 BACK-637 fence 处理）。保留 fork 既有的 fenced 跨 family 示例不变量；若 fork 的分段抽取被甘特/其它定制复用，需回归。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：修复真实缺陷且属防御性正确改进，但上游对 `structured-sections.ts` 做了近乎重写，需评估与 fork 分叉实现的差异后参考移植。 |
| **迁移建议** | ②参考重写：先加输入边界的 marker 拒绝守卫（低风险、高收益），再按需采用 `findSentinelBlocks` 替换 fork 的分段抽取实现。 |

---

## CORE-27：BACK-662 Add references and modifiedFiles to task list --json

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 `task list --json` 与 `search --json` 的任务摘要投影中加入 `references` 和 `modifiedFiles`，避免外部工具逐任务再拉取。 |
| **变更内容摘要** | 上游 `28f74ef94` 改 `src/formatters/json-output.ts`：在 `TaskSummaryJson`（紧凑摘要类型）加 `references: string[]` 与 `modifiedFiles: string[]`（`src/formatters/json-output.ts:17-18` 附近），并在 `toTaskSummaryJson`（`src/formatters/json-output.ts:107`）填充 `task.references ?? []` / `task.modifiedFiles ?? []`；同时从 `TaskDetailsJson` 移除这两字段（上移到共享基类）。 |
| **与当前定制代码的交集风险** | 低 — fork `src/formatters/json-output.ts:6-26` 的 `TaskSummaryJson` 不含 `references`/`modifiedFiles`（仅 `TaskDetailsJson` 在 `src/formatters/json-output.ts:45` 有 `references`）；fork 摘要由 `toTaskSummaryJson`（`src/formatters/json-output.ts:107`）生成。增量字段，无冲突。注意 fork AC 字段名是 `acceptanceCriteriaItems`（上游 `toTaskDetailsJson` 也已用 `task.acceptanceCriteriaItems`，一致）。 |
| **适合迁移的内容** | 在 fork `TaskSummaryJson` 增加 `references: string[]` 与 `modifiedFiles: string[]`，并在 `toTaskSummaryJson` 填充；保持 `TaskDetailsJson` 现状（其已含 `references`）。 |
| **需要排除/调整的内容** | 无排除项。注意保持 fork 已有的额外摘要字段（`dueDate`/`plannedStart`/`actualStart`/`actualEnd` 等，`src/formatters/json-output.ts:21-25`）不被动。 |
| **迁移优先级** | B类（必须合入）— 初判 AB → 深度分析 A类：纯增量、schemaVersion 1 内可加、与 fork 定制零冲突。 （口径校正：JSON 契约扩展属增量能力，由 A 类归入 B 类评估。） |
| **迁移建议** | ①直接复用：对照上游 `src/formatters/json-output.ts` 在 fork 同类型同函数补两个字段。**落地（2026-09-23，[BACK-697](/task/697)）**：同形落地 —— `TaskSummaryJson` 增 `references` / `modifiedFiles`、`toTaskSummaryJson` 由记录填充（缺省空数组）、`TaskDetailsJson` 去掉重复声明（详情载荷内容不变，两字段经共享摘要类型继续带出）；上游改的那句 `CLI-INSTRUCTIONS.md` 紧凑字段清单在 fork 无对应物（本仓没有任何 shipped 面枚举摘要字段），故未改任何文档，与同域先例一致；用例补「无 references / modifiedFiles 的任务返回空数组」一条，并把 search 行与 view 载荷一并钉住。 |

---

## CORE-28：BACK-663 Dependency graph follow-ups from BACK-548 review

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 处理 BACK-548 评审遗留的 7 个低危项：树渲染递归改显式栈、BFS 去 `queue.shift`、TUI 过滤 corpus 合并重复 canonical id、跨分支已完成依赖在 web 图渲染为缺失、图链接导航后冗余拉取等。 |
| **变更内容摘要** | 上游 `35a94ca93`（+ `46f3f1426` 仅文档）：改 `src/utils/dependency-graph.ts` 的 `buildDependencyGraph`（加 `ambiguousIds` 选项、BFS 改游标）、`findCycleThroughRoot`（BFS 改游标）、`buildDependencyTree`（递归改显式栈）；`src/core/task-detail.ts` 的 `loadTaskCorpus` 增加 `ambiguousIds` 与跨分支 completed 合并；`src/ui/task-viewer-with-search.ts` 的 `mergeDependencyCorpusTasks`；web `src/web/App.tsx` 同步效果；`src/utils/readiness.ts` 仅 +1 行。 |
| **与当前定制代码的交集风险** | 高（依附性）— 上游全部改动建立在 `src/utils/dependency-graph.ts` 之上，而该模块 fork 完全缺失（确认无 `src/utils/dependency-graph.ts`）。fork 的 `src/core/task-detail.ts` 亦无 `loadTaskCorpus`/`toTaskDetail` 这些上游 corpus 抽象。因此本条在 fork 侧“无依附基座”，属对不存在模块的后续打磨。 |
| **适合迁移的内容** | 仅当 CORE-23/31/32 先把 `dependency-graph.ts` 与 `loadTaskCorpus` 引入 fork 后，本条的栈/BFS/ambiguous 合并改进才有落点；可一并移植 `buildDependencyTree` 显式栈与 `loadTaskCorpus` 的 `ambiguousIds`。 |
| **需要排除/调整的内容** | 依赖图模块整体为 fork 真空能力，引入时需对齐 fork 的跨分支可见性（排除清单 §6）。上游针对 web 图链接/跨分支 completed 的改动，需结合 fork 自研 web 看板（含泳道）结构适配，不能覆盖。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：本质是“模块 absent 后的后续优化”，本身不可独立迁移，须作为 CORE-23 依赖图模块移植的伴随项，优先级低于基座引入。 |
| **迁移建议** | ②参考重写：在 CORE-23 移植 `dependency-graph.ts` 时，直接采用上游的栈/BFS 健壮写法；`loadTaskCorpus` 的 `ambiguousIds` 合并需在 fork 实现该 corpus 时一并考虑。 |

---

## CORE-29：BACK-664 Read the Backlog overview once per conversation instead of per request

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 把 agent nudge 从“每个用户请求都跑 `backlog instructions overview`”改为“每轮对话开头跑一次，未读过才重读”，减少重复读取静态内容。 |
| **变更内容摘要** | 上游 `dedeaa06a` 仅改文档/测试：`src/guidelines/cli-agent-nudge.md:7` 文案改写；本仓库 `AGENTS.md` 实例同步；`src/test/cli-init-create.test.ts:220` 断言文案更新。无运行时代码逻辑改动。 |
| **与当前定制代码的交集风险** | 低 — 纯指南文案变更，不触碰 src 运行时代码。但 fork 是深度定制（含中文本地化），其 `AGENTS.md`/指南文件可能已是中文或不同措辞，需确认是否同源。 |
| **适合迁移的内容** | 将“每轮对话开头读一次、未读才重读”的语义带入 fork 的 agent 指南文案（若 fork 仍用英文 nudge 模板则直接对齐；若已中文本地化则意译等价）。 |
| **需要排除/调整的内容** | 不得因套用上游英文文案覆盖 fork 已有的中文本地化指南；只迁移“一次/对话”的语义，保留 fork 指南结构。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：文档同步类，无代码风险，但需尊重 fork 本地化，非逐字复制。 |
| **迁移建议** | ②参考重写：在 fork 对应指南文件应用“每轮对话读一次”的措辞，勿整体替换。 |

---

## CORE-30：BACK-669 Close residual self-dependency gaps from the BACK-656 review

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 收尾 BACK-656 评审中遗留的自依赖边界缺口（创建/编辑路径的残余自依赖检查）。 |
| **变更内容摘要** | 上游 `e51540013`（同一 commit 也列于 CORE-23）改 `src/cli.ts`、`src/utils/task-builders.ts` 的 `validateDependencies` 自依赖分支、`src/test/cli-doctor.test.ts`、`src/test/dependency.test.ts`。与 CORE-23 的 `1cacf62a6` 是同一功能的不同提交，无独立代码增量。 |
| **与当前定制代码的交集风险** | 高（与 CORE-23 同源）— 本条目 commit 与 CORE-23 重叠，fork 缺失 `dependency-graph.ts` 与自依赖校验，修复点同 CORE-23。 |
| **适合迁移的内容** | 无独立于 CORE-23 的内容；其自依赖校验代码已在 CORE-23 的 `validateDependencies` 重写中覆盖。 |
| **需要排除/调整的内容** | 见 CORE-23（依赖图模块引入 + `validateDependencies` 签名/调用点改写）。勿重复实现同一函数。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：被 CORE-23 完全吸收，单独列为迁移单元无意义。 |
| **迁移建议** | ②参考重写：作为 CORE-23 的一部分落地，不单独摘樱桃。 |

---

## CORE-31：BACK-672 Compute task readiness once in core and carry isReady on task lists

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 把原本由 CLI/MCP/web/TUI 各自重算的 readiness 收敛到 core（基于 `loadTaskCorpus` 已构建的 corpus），列表/搜索/board 投影携带 `isReady` 布尔，任务详情携带完整 `readiness`，消除多界面口径不一致。 |
| **变更内容摘要** | 上游 `f1c14f6a9`（+ `09d536479` 仅文档）删除 `src/utils/readiness.ts` 的 `loadReadinessGraph`（使其变纯 util，去掉 `Core` 依赖），删除 `src/utils/task-search.ts` 的 `ready?` 过滤器分支；在 `src/core/task-detail.ts` 新增 `toTaskDetail(task, corpus)` 与 `withReadiness(tasks, corpus)`；`src/cli.ts`、`src/formatters/json-output.ts`、`src/mcp/tools/tasks/handlers.ts`、`src/web/App.tsx`（~256 行）、`src/web/components/TaskDetailsModal.tsx`、`src/ui/*` 全面切换为从 corpus 派生。 |
| **与当前定制代码的交集风险** | 高 — 与 fork 自研 `src/utils/readiness.ts` 对撞。fork `src/utils/readiness.ts:142-149` 的 `loadReadinessGraph(core)` 用 `core.queryTasks({includeCrossBranch:false}) + listCompletedTasks + loadConfig` 构建图，被 fork 的 `src/cli.ts`（--ready 过滤）、`src/ui/task-viewer-with-search.ts`、web `TaskDetailsModal.tsx`、MCP handlers 直接使用。上游则删除该入口、改由 core corpus 派生 `isReady` 并上移到列表。若直接套用上游“删除 `loadReadinessGraph`”会破坏 fork 全部调用方；且 fork 的 readiness 含跨分支/配置语义，与上游 `loadTaskCorpus` 默认可能不同。 |
| **适合迁移的内容** | 增量价值：给 `task list --json`/`search --json` 的摘要加 `isReady`（复用 fork 既有 `getTaskReadiness` 在列表投影上一次性计算），以及 `task view --json` 的 `readiness` 载体。可保留 fork 的 `getTaskReadiness`/`createReadinessGraph` 算法。 |
| **需要排除/调整的内容** | 严禁删除 fork `src/utils/readiness.ts` 的 `loadReadinessGraph`（上游删除动作与 fork 自研能力冲突，排除清单 §6 通用原则适用：复杂共享逻辑参考重写而非直接复用）；不得用上游 `loadTaskCorpus` 覆盖 fork 的跨分支/配置化 readiness 口径；web `App.tsx` 的 ~256 行重构需结合 fork 自研看板/统计页共存（排除清单 §3、§4），不能覆盖。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：高碰撞点，核心语义 fork 已具备，真正缺口只是“列表携带 isReady”增量；应参考重写而非整段替换。 |
| **迁移建议** | ②参考重写：保留 fork `src/utils/readiness.ts` 全量，仅在 `src/formatters/json-output.ts` 的 `toTaskSummaryJson` 用 fork 既有 `getTaskReadiness` 一次性算 `isReady`，并在 `toTaskDetailsJson` 附 `readiness`；不动 `loadReadinessGraph` 及其调用方。 |

---

## CORE-32：BACK-673 Clean dependency references when archiving or demoting a task

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 `task archive` 只清理 active 任务对它的依赖引用（completed 记录仍指向它），且 `task demote` 完全不清引用，导致释放的 ID 被新任务复用后旧引用静默解析到无关任务的问题；统一在 core 做“vacated id 清理”。 |
| **变更内容摘要** | 上游 `c4326c944`（+ `876523cec` 仅文档）改 `src/core/backlog.ts`：`archiveTask`/`demoteTask`/`demoteTaskWithUpdates` 返回值由布尔/`string或null` 改为 `{success, cleanedTaskIds}`，新增 `collectVacatedIdCleanup`/`writeVacatedIdCleanup`、`sanitizeVacatedTaskLinks`（取代 `sanitizeArchivedTaskLinks`）；新增 `src/utils/task-links.ts`（`withoutVacatedTaskLinks`）；`src/utils/dependency-graph.ts` 增加 `formatDependencyCleanupMessage`（fork 无该模块）；并改 `src/cli.ts`、`src/mcp/tools/tasks/handlers.ts`、`src/server/index.ts`、`src/ui/board.ts`、`src/ui/task-lifecycle.ts`、`src/ui/task-viewer-with-search.ts`、`src/web/App.tsx`、`src/web/components/TaskDetailsModal.tsx`、`src/web/lib/api.ts` 以展示清理结果。 |
| **与当前定制代码的交集风险** | 高 — fork `src/core/backlog.ts:2753` `archiveTask` 返回布尔、内部只调 `sanitizeArchivedTaskLinks`（`src/core/backlog.ts:643`，仅 active）；fork `src/core/backlog.ts:2938` `demoteTask` 返回 `string或null` 且**完全不清引用**（上游所述 bug fork 存在）；调用方强依赖现有返回类型：`src/cli.ts:3556` `const success = await core.archiveTask(task.id)`、`src/cli.ts:3632` `const newDraftId = await core.demoteTask(taskId)`、`src/mcp/tools/tasks/handlers.ts:475/517`、`src/server/index.ts:1311/1358`、`src/ui/board.ts:1273/1524`、`src/ui/task-viewer-with-search.ts:1229`、`src/web/App.tsx:762`、`src/web/components/TaskDetailsModal.tsx:1066`、`src/web/lib/api.ts:299/311`。上游改返回类型会直接破坏这些点；且依赖 `dependency-graph.ts`/`task-links.ts`（fork 均无）。 |
| **适合迁移的内容** | 核心修复：在 fork `archiveTask`/`demoteTask`/`demoteTaskWithUpdates` 中扫描 active **与** completed corpus 里指向被释放 ID 的依赖/引用并写回；`demoteTask` 增加引用清理（fork 当前缺失）。清理文案可本地实现等价提示。 |
| **需要排除/调整的内容** | 不要直接采用上游“返回值改为 `{success, cleanedTaskIds}`”的破坏性签名变更，否则需同步改动上述全部调用方；建议保留 fork 现有布尔/`string或null` 返回，另以副作用返回或日志输出清理信息。引入 `formatDependencyCleanupMessage` 需先有 `dependency-graph.ts`（见 CORE-23）；若暂不入图模块，可用 fork 本地等价提示替代，避免引入缺失模块依赖。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：修复 fork 真实存在的 demote 不清引用缺陷，价值高，但改动面大（返回类型 + 缺失模块依赖 + 多调用方），须参考重写并保护现有接口。 |
| **迁移建议** | ②参考重写：在 fork `src/core/backlog.ts` 的 `archiveTask`/`demoteTask` 内补“扫描 completed + active 依赖并写回”的逻辑，保留现有返回类型；清理提示本地实现，避免强依赖 `dependency-graph.ts`/`task-links.ts`。 **已落地（2026-09-22，[BACK-691](/task/691)，与 CORE-3 合并）**：按本行建议保留布尔/string 返回，清理经 `collectVacatedIdCleanup`（active + completed 双语料）落地，completed 记录 `fs.saveTask` 原地写回（store 经 saveTask patch 自动发布，无需上游的 refreshCompletedTask）；上报走 `onVacatedIdCleanup` 回调（CLI/MCP 一行、server 响应附加 cleanedTaskIds、TUI footer 拼接），未改 15 处调用方；`demoteTaskWithUpdates`（task edit -s Draft）同锁段清理且降级草稿自引用一并清洗；task complete 不清理；ID 复用策略未动。上游的 withVacatedIdCleanup 锁内重扫/失败标签（archiveState/demotionState）未移植，残留窗口与上游一致（创建后引用不锁、ID 复用前显示为 unknown task ID）。 |

---

## CORE-33：BACK-676 Make agent task descriptions carry the why

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修正 agent 指南中任务 description 示例只写“做了什么”而不写“为什么存在”，让示例与文案一致地强调描述要带背景/动机。 |
| **变更内容摘要** | 上游 `04c4210fb`（+ `c0f72f574` 仅文档）改 `src/guidelines/cli-instructions/task-creation.md`（Step 4 措辞 + 示例 `-d` 值加“需求在前”对比）、`src/guidelines/mcp/task-creation.md`（Step 5 同要求 + 首条示例）；`src/test/cli-guidance.test.ts`、`src/test/mcp-server.test.ts` 增加文案断言。纯指南/测试，无运行时逻辑。 |
| **与当前定制代码的交集风险** | 低 — 仅指南文案与测试字符串，不触碰 src 运行时。fork 可能已有中文本地化指南，需确认同源。 |
| **适合迁移的内容** | 把“description 应说明为什么（问题/触发/用户需求），不要复述验收标准”的要求与示例带入 fork 对应任务创建指南。 |
| **需要排除/调整的内容** | 勿整体覆盖 fork 本地化指南；只迁移该要求与示例语义。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：文档同步，无代码风险，尊重本地化。 |
| **迁移建议** | ②参考重写：在 fork 任务创建指南应用等价措辞与示例，不整文件替换。 |

---

## CORE-34：BACK-678 Make due date a date-only string everywhere

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 把 due date 从“被当作 UTC datetime”改为纯粹的 `YYYY-MM-DD` 日级字符串（存储/输入/显示一致），修复因 BACK-677 把它卷入本地时区转换导致跨时区日期偏移的回归。 |
| **变更内容摘要** | 上游 `53bbf7215`（+ `cf7f82a9b`/`59e474c8a`/`78c2bac53`/`f526eaad1`，多数为文档重塑）新增 `src/utils/due-date.ts` 的 `normalizeDueDate`（返回 `YYYY-MM-DD`，容忍遗留时间但只保留日）；把 8 个原本 `import { normalizeUtcDateTime } from "../utils/utc-datetime.ts"` 的调用点改为 `normalizeDueDate`；涉及 `src/cli.ts`、`src/commands/task-wizard.ts`、`src/core/backlog.ts`、`src/file-system/operations.ts`、`src/formatters/task-plain-text.ts`、`src/markdown/parser.ts`、`src/mcp/*`、`src/server/index.ts`、`src/ui/*`、`src/web/*` 等 32 文件。上游明确声明 created/updated 的 UTC 时间戳不受影响。 |
| **与当前定制代码的交集风险** | 低（对 actualStart/actualEnd）／中（对 fork 日期基建）— 经 grep 五个提交，`actualStart`/`actualEnd` 在上游 BACK-678 全量改动中**零命中**，上游也明言不改 created/updated 的 UTC 语义。fork 侧：`src/utils/utc-datetime.ts` 在 fork 不存在（fork 用 `src/utils/date-utc.ts` 的 `localDateTimeToStoredUtc`，仅用于 `actualStart`/`actualEnd`，见 `src/cli.ts:68,1960,1962,3407,3410`），故上游“删除 utc-datetime.ts / 改 8 处 import”对 fork 无直接对应文件；fork `src/markdown/parser.ts:198/246` 的 `dueDate` 经 `normalizeDate` 已为 date-only 字符串（基线确认）。即“dueDate 为 date-only”这一核心目标 fork 已达成，与上游终态一致。真正风险在于：若机械套用上游 32 文件 diff，会误改 fork 的 `date-utc.ts`/`localDateTimeToStoredUtc`（actualStart/actualEnd 的 UTC date-time 语义），违背排除清单 §2。 |
| **适合迁移的内容** | 仅增量：上游 `normalizeDueDate` 对“遗留带时间 due_date 只保留日”的容忍处理（`src/utils/due-date.ts` 可参考引入为独立小工具，不影响 actuals）；以及 web `type="date"` 输入、CLI `--due-date` 帮助文案等 fork 可能仍带 `(UTC)` 后缀处的清理。 |
| **需要排除/调整的内容** | 排除清单 §2：严禁移除/改写 fork 的 `src/utils/date-utc.ts` 与 `localDateTimeToStoredUtc`，不得把 `actualStart`/`actualEnd` 的 UTC date-time 语义改为 date-only；不得移除 Markdown 解析中对 `due_date`/`planned_start`/`planned_end` 的支持；保持“存储 UTC、展示本地时区”策略。上游 `utc-datetime.ts` 在 fork 不存在，对应删除动作不适用。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：核心语义 fork 已满足，主要工作是确认无回退 + 选择性补强；须以排除清单 §2 为硬约束，避免误伤 actuals。 |
| **迁移建议** | ②参考重写：核对 fork 各 surface 是否仍对 dueDate 显示 `(UTC)` 或 datetime 输入，若有则对齐为 date-only；引入 `normalizeDueDate` 仅用于 dueDate，绝不触及 `date-utc.ts`/`localDateTimeToStoredUtc`（actualStart/actualEnd）。 **已落地（2026-09-22，[BACK-690](/task/690)）**：核对结论 = 核心 fork 已满足（存储 / CLI / Web / TUI viewer 全线 date-only，dueDate 不经 localDateTimeToStoredUtc），唯一残留是 overview 的 `formatDateForStats` 把 date-only 拼成 `T00:00:00Z` 再按本地时区渲染、西半球提前一天；修复 = date-only 分支改本地午夜解析（去 Z），带时间的 UTC 时间戳分支不动，TZ 钉定子进程用例（America/Los_Angeles -8 / Pacific/Kiritimati +14）验证判别（回退态恰好 -8 一条红）。`normalizeDueDate` 未引入：fork `normalizeDate` 已保 date-only 基线，对遗留带时间 due_date 的「只保留日」容忍差异未处理（极老数据才触发，web `type="date"` 输入会显示为空），留待遇到真实数据再议。 |

---

## CORE-35：BACK-679 Quote assignee and reporter under every frontmatter key spelling

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 assignee/reporter 在各种 frontmatter key 拼写下都被引号包裹（YAML 安全）。 |
| **变更内容摘要** | worklist `commits` 为空，本范围（v1.50.1..v1.52.0）无对应上游代码可摘樱桃；仅知标题语义，无 commit/文件证据。 |
| **与当前定制代码的交集风险** | 低（无代码可对照）— 因本范围无上游提交，无法判定与 fork 定制的交集；frontmatter 序列化在 fork `src/markdown/` 与 `src/file-system/operations.ts` 中，但无上游改动可比对。 |
| **适合迁移的内容** | 无（本范围无上游代码）。 |
| **需要排除/调整的内容** | 本范围无上游代码，跳过；若后续单独评估，需先在上游定位真实提交再分析。 |
| **迁移优先级** | C类（跳过）— 初判 C → 深度分析 C类：记录类条目、本范围无上游代码，不导入。 |
| **迁移建议** | ③忽略：本范围无上游代码，draft 不导入。 |

*draft 不导入，C 类。*

---

## CORE-36：BACK-680 Stop one bad draft from hiding every draft

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复一个解析失败的 draft 导致全部 draft 列表不可见的问题（容错单条 draft）。 |
| **变更内容摘要** | worklist `commits` 为空，本范围无对应上游代码可摘樱桃；仅标题语义，无 commit/文件证据。 |
| **与当前定制代码的交集风险** | 低（无代码可对照）— 无上游提交；fork 的 draft 列举在 `src/utils/task-builders.ts`/`src/core/backlog.ts` 与 web draft 页，但无可比对的上游改动。 |
| **适合迁移的内容** | 无（本范围无上游代码）。 |
| **需要排除/调整的内容** | 本范围无上游代码，跳过。 |
| **迁移优先级** | C类（跳过）— 初判 C → 深度分析 C类：记录类条目、本范围无上游代码，不导入。 |
| **迁移建议** | ③忽略：本范围无上游代码，draft 不导入。 |

*draft 不导入，C 类。*

---

## CORE-37：BACK-682 Make frontmatter preprocessing robust to valid YAML shapes

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让 frontmatter 预处理在遇到合法但异常的 YAML 形状时不再崩溃/误处理。 |
| **变更内容摘要** | worklist `commits` 为空，本范围无对应上游代码可摘樱桃；仅标题语义，无 commit/文件证据。 |
| **与当前定制代码的交集风险** | 低（无代码可对照）— 无上游提交；fork 的 frontmatter 解析在 `src/markdown/frontmatter.ts`/`parser.ts`，但无可比对的上游改动。 |
| **适合迁移的内容** | 无（本范围无上游代码）。 |
| **需要排除/调整的内容** | 本范围无上游代码，跳过。 |
| **迁移优先级** | C类（跳过）— 初判 C → 深度分析 C类：记录类条目、本范围无上游代码，不导入。 |
| **迁移建议** | ③忽略：本范围无上游代码，draft 不导入。 |

*draft 不导入，C 类。*

---

## CORE-38：BACK-686 Watch task lists with the existing JSON output

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 新增 `backlog task list --json --watch`：首屏立即输出完整匹配列表，之后文件变更/周期对账触发刷新，复用现有 JSON 字段与封套，抑制未变化响应。 |
| **变更内容摘要** | 上游 `39912b864` 新增自包含模块 `src/commands/watch-json.ts`（`watchJson(directories, read, output)`，`src/commands/watch-json.ts:1-112`，含 FS 监听、1s 周期对账、SIGINT/SIGTERM/EPIPE 处理、慢消费者/断管处理）；`src/cli.ts` 约 750 行重构（把 `task list` 抽出为共享路径以挂载 watch）；`src/formatters/json-output.ts` +6 行；`CLI-INSTRUCTIONS.md`/`README.md` 文档与测试更新。 |
| **与当前定制代码的交集风险** | 中（真空能力）— 经核查 fork `src/cli.ts` 无 `--watch`/`watchJson`，无 `src/commands/watch-json.ts`，`src/commands/` 目录（advanced-config-wizard/completion/configure-advanced-settings/help-schema/instructions/mcp/overview/task-wizard/wiki-install）亦无该文件。故 fork **确实完全缺失**此能力（与提示“是否真的完全缺失”的担忧一致）。上游 750 行 cli.ts 重构主要为把 `task list` 抽公共函数，fork 的 `task list` 结构不同，需自行接线，不能直接套用那 750 行。 |
| **适合迁移的内容** | `src/commands/watch-json.ts` 模块本身可基本原样引入（自包含、仅依赖 `read` 回调返回规范 JSON 字节）；并在 fork `src/cli.ts` 的 `task list --json` 分支加 `--watch` 选项，用 fork 既有列表 JSON 生成函数作为 `read` 回调。 |
| **需要排除/调整的内容** | 不要照搬上游 750 行 cli.ts 重构（可能涉及 fork 自有 filter/sort/limit 实现与输出封套）；保持 fork 现有 `task list` 行为与输出格式，仅在其上叠加 watch 模式；`json-output.ts` 的 +6 行通常是 envelope 复用，需确认与 fork 现有 `kind: "task-list"` 封套一致。 |
| **迁移优先级** | B类（评估合入）— 初判 AB → 深度分析 B类：确属真空能力且价值明确，但接线须适配 fork cli 结构，非直接复用上游重构。 |
| **迁移建议** | ②参考重写：引入 `src/commands/watch-json.ts` 原样模块；在 fork `src/cli.ts` 的 `task list --json` 处最小化接线 `--watch`，`read` 回调复用 fork 现有列表 JSON 生成，避免移植 750 行重构。 |

---

## CORE-39：BACK-671 Add a dependency-ordered graph layout to task list

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 为 `task list` 增加一种按依赖顺序排布的图渲染模式。 |
| **变更内容摘要** | worklist `commits` 列 `31b17432d`，但 `code_files` 为空；该提交内容为“Reshape BACK-671 as a task list graph rendering mode”，仅重塑 backlog 任务 Markdown 文档（`backlog/tasks/...md`），无 src 代码改动。 |
| **与当前定制代码的交集风险** | 低（无代码）— 唯一提交只改任务文档，无代码可比对；且该功能依赖 `dependencyGraph`（fork 缺失，见 CORE-23/28），即便有代码也不具备基座。 |
| **适合迁移的内容** | 无（仅文档重塑，非实现）。 |
| **需要排除/调整的内容** | 本范围无实现代码；若未来要落地该图布局，须先完成 CORE-23 依赖图模块引入。 |
| **迁移优先级** | C类（跳过）— 初判 C → 深度分析 C类：仅任务文档改写，无代码，draft 不导入。 |
| **迁移建议** | ③忽略：本范围仅文档重塑，无代码可摘樱桃。 |

*draft 不导入，C 类。*

---

## CORE-40：BACK-222 Improve parent and subtask presentation in the Web UI

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Web 任务弹窗中改进父任务与子任务的层级展示与进度呈现。 |
| **变更内容摘要** | worklist `commits` 列 `518b423ce`，`code_files` 含 `src/utils/task-subtasks.ts`、`src/web/App.tsx`、`src/web/components/TaskDetailsModal.tsx` 及两个测试。该提交确实改了代码（task-subtasks.ts +37 行、TaskDetailsModal.tsx +120 行），但按 worklist 分类为 C 类。 |
| **与当前定制代码的交集风险** | 中（真实代码但分类跳过）— fork `src/web/components/TaskDetailsModal.tsx` 已有大量自研定制（AC 进度环等，基线确认），上游在此文件 +120 行做父子/子任务进度展示，可能与 fork 自研弹窗结构冲突；`src/utils/task-subtasks.ts` fork 是否存在需迁移时再核。按分类指令本条目 draft 不导入。 |
| **适合迁移的内容** | （按 C 类不导入）若后续改判：可考虑上游 task-subtasks.ts 的层级/进度计算与 TaskDetailsModal 的父子区段。 |
| **需要排除/调整的内容** | 当前按 worklist 为 C 类，draft 不导入；其改动与 fork 自研弹窗共存需谨慎，不得覆盖 fork 现有 AC 进度环等定制。 |
| **迁移优先级** | C类（跳过）— 初判 C → 深度分析 C类：虽含真实代码，但依 worklist 分类为 C 类，draft 不导入；同时提示其为 fork 真空缺口（父子展示可能缺失），建议后续单独评估是否升为 A/B。 |
| **迁移建议** | ③忽略（本范围）：draft 不导入；如需纳入，作为独立任务参考重写以保全 fork 弹窗定制。 |

*draft 不导入，C 类。*

---

## CORE-41：BACK-601 Readiness follow-ups: draft dependencies, board filter carry, cross-branch graph

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | readiness 的后续打磨：draft 依赖的 readiness、board 过滤携带 readiness、跨分支依赖图的一致性。 |
| **变更内容摘要** | worklist `commits` 为空，本范围（v1.50.1..v1.52.0）无对应上游代码可摘樱桃；其多数能力实际由 CORE-31（BACK-672）的上游实现覆盖（CORE-31 说明亦提及“likely dissolves most of BACK-601”）。 |
| **与当前定制代码的交集风险** | 低（无代码可对照）— 无上游提交；其目标与 fork 自研 `src/utils/readiness.ts`（CORE-31 已分析）高度相关，但本范围无具体代码。 |
| **适合迁移的内容** | 无（本范围无上游代码）；相关能力见 CORE-31 的参考重写方案。 |
| **需要排除/调整的内容** | 本范围无上游代码，跳过；与 CORE-31 一并考量，勿重复。 |
| **迁移优先级** | C类（跳过）— 初判 C → 深度分析 C类：记录类条目、本范围无上游代码，且能力由 BACK-672（CORE-31）覆盖，不导入。 |
| **迁移建议** | ③忽略：本范围无上游代码，draft 不导入；其诉求在 CORE-31 处理。 |

---

## 汇总索引

| 编号／上游 | 初判 → 深度分析 与 结论 |
|----------|------|
| CORE-22 BACK-651 | 初判 AB → A类：纯重构，fork 已具备被调函数，直接复用 |
| CORE-23 BACK-656 | 初判 AB → B类：真空能力，须整体引入 dependency-graph 模块 |
| CORE-24 BACK-658 | 初判 AB → A类：已完成目标不再被拒，已由 [BACK-664](/task/664) 落地；不依附 CORE-23，归档按设计排除 |
| CORE-25 BACK-659 | 初判 AB → A类：board 孙级缺失 bug，封闭修复 |
| CORE-26 BACK-660 | 初判 AB → B类：真实缺陷，structured-sections 近乎重写，参考移植 |
| CORE-27 BACK-662 | 初判 AB → A类：JSON 摘要增量字段，零冲突 |
| CORE-28 BACK-663 | 初判 AB → B类：依赖图模块 absent 后的后续打磨，依附 CORE-23 |
| CORE-29 BACK-664 | 初判 AB → B类：文档同步，尊重本地化 |
| CORE-30 BACK-669 | 初判 AB → B类：与 CORE-23 同 commit，被完全吸收 |
| CORE-31 BACK-672 | 初判 AB → B类：与 fork 自研 readiness 高碰撞，参考重写 |
| CORE-32 BACK-673 | 初判 AB → B类：修复 fork demote 不清引用，但改返回类型+缺模块，参考重写 |
| CORE-33 BACK-676 | 初判 AB → B类：文档同步，尊重本地化 |
| CORE-34 BACK-678 | 初判 AB → B类：核心语义 fork 已满足，排除清单 §2 硬约束，选择性补强 |
| CORE-38 BACK-686 | 初判 AB → B类：确认真空缺失，引入 watch-json 模块+最小接线 |
| CORE-35 BACK-679 | 初判 C → C类：本范围无上游代码 |
| CORE-36 BACK-680 | 初判 C → C类：本范围无上游代码 |
| CORE-37 BACK-682 | 初判 C → C类：本范围无上游代码 |
| CORE-39 BACK-671 | 初判 C → C类：仅文档重塑，无代码 |
| CORE-40 BACK-222 | 初判 C → C类：含真实代码但按分类跳过，提示为真空缺口 |
| CORE-41 BACK-601 | 初判 C → C类：无代码，能力由 CORE-31 覆盖 |

*draft 不导入，C 类。*

---

# 二、TUI

## TUI-1：BACK-551 Show acceptance criteria completion on TUI task summaries

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 TUI 任务摘要（看板卡片行、任务列表行）显示由 acceptance criteria 实时推导的完成进度条（10/5 格）。 |
| **变更内容摘要** | 新增 `src/ui/acceptance-criteria-progress.ts:1-23`（`formatAcceptanceCriteriaProgress`，isInProgress 过滤 + 10/5 格）；**实测补齐（2026-09-20）该文件在本迁移窗口内被后续三次提交覆盖，本条只是首版**：`371132106`（BACK-657，08-30）把 `█`/`░` 方块字形换成纯 ASCII `#`/`-`（Block Elements 在缺字形终端会渲染成空白或 `?`），`508e96692`（BACK-666，08-31）压成 5/3 格并给填充段上色（green/yellow/red，见 `completionColor`），`5d727d61b`（BACK-642，08-30）另加 CLI / MCP 的 `(ac: x/y)` 后缀；故 **v1.52.0 的实际形态是 `[####-] 4/5`（5/3 格 ASCII + 彩色），而非首版的 10/5 格方块**，三者的关系见 TUI-7 / TUI-9 / SRV-2。`src/ui/board.ts:122-141` 的 `formatTaskListItem` 接入进度前缀、`buildRenderedTaskListItems:143-153` 增加 `availableWidth`；`src/ui/status-icon.ts:13-25` 的 `getStatusStyle` 改为小写键 + `.trim().toLowerCase()` 归一化；`src/ui/task-viewer-with-search.ts:65-88` 新增导出 `formatTaskViewerListItem` 并接入列表 itemRenderer，resize 时 `taskList?.updateItems()`。 |
| **与当前定制代码的交集风险** | 低。**实测补齐（2026-09-20）**：详情页的 AC **计数**并非本轮新增——`TaskDetailsModal` 的段标题早就写成 `${acceptanceCriteria} (${checkedCount}/${totalCount})`（`TaskDetailsModal.tsx:1722`，`src/web/locales/zh-CN.ts:221` 渲染为「验收标准」，该计数可追溯至 `c13a14d14`，2025-09-07，早于本迁移窗口），BACK-569 并未改动该文件。故 fork 的详情页里「标题计数」与「进度条」是**并存的两层**，fork 早已自行落地同能力（BACK-569，`src/ui/acceptance-criteria-progress.ts` 与上游逐字等价，此前唯一差异为 `WIDE_PROGRESS_MIN_WIDTH` 见 `:9`（fork 32 / 上游 40），落地 [BACK-675](/task/675) 时已对齐为 40）；`board.ts:122-140` 的 `formatTaskListItem` 已接入进度前缀、`board.ts:493-494` 按列宽算 `availableWidth`。**两侧插入点原为恰好相反（2026-09-20 实测复核）**：~~fork **详情页有**进度行（`task-viewer-with-search.ts:1551-1556`，位于 `generateDetailContent` 内）而**列表行没有**（`:853-867` 仍是内联 renderer）；上游则**列表行有**（`formatTaskViewerListItem`，`:85` 调用）而**详情页没有**（v1.52.0 的 AC 段直接从 `formatHeading` 接 `buildAcceptanceCriteriaItems`，无 `progressLine` 一行）~~——**后续修正（2026-09-20，用户实测后定案）**：详情页不绘制进度条，`generateDetailContent` 的 AC 段回到「标题 + 清单」，该插入点差异随之消失，两侧形态一致（条形只在行上），自研的宽度管线一并还原。`status-icon.ts:13-25` 确实未加 `.trim().toLowerCase()`，但进度判断在 formatter 内自带归一化，功能不受影响。 |
| **适合迁移的内容** | 无。fork 的 board 卡片行已显示实时进度（~~详情页摘要区亦并列显示~~，**后续修正（2026-09-20）**已移除该进度行）；上游有、fork 无的那一处是「task view 左侧列表行」，属两种形态的取舍，非缺失；上游另有的 `status-icon.ts` 大小写归一化在 fork 无独立价值（见「需要排除/调整的内容」）。 |
| **需要排除/调整的内容** | **实测补齐（2026-09-20）**：① 不得照搬上游对 `status-icon.ts` 映射键的英文状态名重写——fork 的 status 集合可配置，且进度判断已自带归一化；② 上游 AC #8「CLI and MCP output remain unchanged」与 fork 现状相反，fork 的 `formatAcceptanceCriteriaSummarySuffix`（`acceptance-criteria-progress.ts:13`）已由 `src/cli.ts:2597`、`src/cli.ts:2630`、`src/mcp/tools/tasks/handlers.ts:99` 消费，CLI/MCP 列表主动输出 `(ac: x/y)`，属 fork 自研扩展，照上游重写会与之对撞；③ ~~保留 `WIDE_PROGRESS_MIN_WIDTH=32`，不要回退为上游 40~~——**后续修正（2026-09-20）**：[BACK-675](/task/675) 实测该阈值是两侧唯一可变项（宽度公式两侧逐字相同），分歧集中在特定窗口（看板 3 列 = 终端 108–131 列，同为 36 列宽时 fork 显示 5 格而上游 3 格），故**改为对齐上游 40**。 |
| **迁移优先级** | 初判 AB → 深度分析 B类 → **并入 BACK-675（2026-09-20 定案）**：fork 的 BACK-569 早于上游 BACK-551 落地，board 卡片与详情页已覆盖上游 AC 的实质（就能力而言可判「已满足」）；但上游该文件在窗口内连续演进三次（ASCII → 紧凑彩色 → CLI/MCP 后缀），故本条不再作为独立的「已满足」条目结案，而与 TUI-7 / TUI-9 合并为 [BACK-675](/task/675) 一次性落到最终形态。 |
| **迁移建议** | **定案修正（2026-09-20，用户决定）**：本条不再单列。它与 TUI-7 / TUI-9 同属 `src/ui/acceptance-criteria-progress.ts` 的连续演进，三者已合并为一个任务 [BACK-675](/task/675)，直接落到上游最终形态（ASCII `#`/`-` + 彩色 + 5/3 格 + clamp 取整），不做分步。原先的「已满足 / 不迁移」判定只针对「fork 是否已有等价能力」，该结论仍成立（board 卡片行可显示进度，见「交集风险」行；~~详情页进度行~~ **后续修正（2026-09-20）**已移除）；但既然 TUI-7 / TUI-9 要做，把 TUI-1 的首版形态一并收敛到最终版更省事，故升回 B 类并入 BACK-675。需登记的剩余缺口仅 Testing：上游 AC #9 要求「TUI rendering tests cover partial / none / all-checked / both widths」，fork 的 `src/test/tui-acceptance-criteria-progress.test.ts` 原为 5 pass / 0 fail 且断言全部打在纯函数层，`formatTaskListItem`（`src/test/strip-tags.test.ts:38-60` 用 `status: "To Do"` 的 fixture）无含 AC 的任务行断言。**后续修正（2026-09-20）**：测试扩至 18 pass，补上 board 行（含看板自算列宽 36 的窄列场景）与「详情段不出现条形」两面。该草稿已删除、未升级。 **已落地（2026-09-20）**。 |

---

## TUI-2：BACK-588 Make the TUI help popup robust to resize and wrapped lines

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 帮助弹窗在终端尺寸变化 / 行被换行包裹时重新排版、按实际渲染行数推导滚动边界并 clamp 偏移，关闭时移除 resize 监听。 |
| **变更内容摘要** | `src/ui/components/help-popup.ts:56-131` 新增 `HELP_POPUP_WIDTH`、`getHelpText()`、`getMaxScrollOffset()`、`applyLayout()`、`onResize()`，并在 `setImmediate` 调 `applyLayout`、注册 `screen.on("resize", onResize)`、`finish` 时 `removeListener("resize", onResize)`；`src/ui/components/filter-popup.ts:18` 的 `ScrollableViewport` 类型增加 `getScrollHeight(): number`。 |
| **与当前定制代码的交集风险** | 低。fork 的 `createPopupChrome` 已具备 `reflow`（`filter-popup.ts:128-147`），但 fork 的 `openHelpPopup`（`help-popup.ts:91-147`）**无** resize 处理：无 `onResize`/`applyLayout`/`getMaxScrollOffset`/`getScrollHeight`，`maxScrollOffset` 在 `help-popup.ts:134` 静态计算，且 `finish`（`help-popup.ts:121-127`）未移除 resize 监听。fork 自研帮助弹窗共享同一缺陷。 **已落地（2026-09-20，[BACK-677](/task/677)）**：真实根因是弹窗用 `top: "center"`（blessed 在**绘制时**才解析，resize 后弹窗自己就重新居中了），而 backdrop 是**绝对坐标**（创建时算一次）→ 窗口变矮时弹窗上移/越界、灰底留在原地。真机式探针：80x24 → 80x12 旧实现灰带比弹窗多出 7 行；修复后 `popup top=1 h=10` / `backdrop 0..12`。 |
| **适合迁移的内容** | `applyLayout`+`onResize` 重排逻辑、`getScrollHeight` 类型补充、`removeListener` 清理。 **已落地（2026-09-20，[BACK-677](/task/677)）**：接入 `createPopupChrome` 早已返回的 `reflow`，新增 `getMaxScrollOffset`/`applyLayout`/`onResize`，并给 `filter-popup.ts` 的 `ScrollableViewport` 补 `getScrollHeight`。 |
| **需要排除/调整的内容** | 无排除清单冲突（纯 TUI 弹窗）。保留 fork 的快捷键集合（`help-popup.ts:129` 的 `escape/q/Q/?`）。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（必须合入）。fork 确受影响，缺陷代码在 `help-popup.ts:91-147` 缺 resize 分支。 （口径校正：帮助弹窗鲁棒性属体验补丁，由 A 类归入 B 类评估。） **已落地（2026-09-20，[BACK-677](/task/677)）**：`help-popup.test.ts` 8 用例 / 48 断言通过；回退验证只注掉 backdrop 那 4 行即恰好 1 条红（只注 top 一行会假绿——stale 值 0 与正确值 0 相等），证明断言可判别。 |
| **迁移建议** | ②参考重写：将上游 `applyLayout/onResize/getMaxScrollOffset` 接入 fork `openHelpPopup`，并给 `ScrollableViewport` 类型补 `getScrollHeight`；关闭时 `removeListener`。 **落地说明（2026-09-20，[BACK-677](/task/677)）**：另加 `getHelpPopupHeight` 的 `Math.min(screen.height, preferred)` 上限、`scrollBy` 改读当前 bound、`finish` 里 `removeListener`；探针定位 backdrop 用 `screen.children.find(c => c !== popup && c.type === "box")`。 |

---

## TUI-3：BACK-589 Improve composer usability at extreme terminal sizes

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 依据选择器实际显示宽度推导 composer 几何，在极端高度下保留完整可编辑行与可见光标；内容放不下时纵向堆叠选择器而非依赖固定断点。 |
| **变更内容摘要** | `src/ui/components/task-composer.ts` 重写 `getTaskComposerLayout`（`getTaskComposerLayout` + `TaskComposerLayoutOptions` + `getSelectorContentWidths` 用 `Bun.stringWidth`、`stackSelectors` 字段、`PREFERRED_POPUP_WIDTH=72` 等）；`openTaskComposer` 中 `applyLayout`、`setFieldGeometry`、字段导航按 `stackSelectors` 分支；新增 `import { DEFAULT_STATUSES }`。 |
| **与当前定制代码的交集风险** | 中。fork 的 `getTaskComposerLayout`（`task-composer.ts:108-126`）使用固定断点：`compact = screenWidth < 64 或 screenHeight < 20`、`popupWidth: screenWidth < 76 ? "96%" : 72`，无 `stackSelectors`/`getSelectorContentWidths`/`Bun.stringWidth`（grep 确认无这些符号），即上游改进的动态堆叠在 fork 缺失。改动局限于 composer 自身，不触及排除清单领域。 **已落地（2026-09-20，[BACK-678](/task/678)）**：实测 80x8 时 form 视口只剩 1 行（3 行带框文本输入只画出顶边框，无编辑行、无光标）；80 列时状态选择器 20 格 < `Status: In Progress ▼` 需要的 21 格 → 尾部 ▼ 被裁。 |
| **适合迁移的内容** | 动态 `stackSelectors` 推导与字段几何分支、`getSelectorContentWidths` 宽度计算。 **已落地（2026-09-20，[BACK-678](/task/678)），但 fork 未移植 `stackSelectors`**：fork 无 Type 选择器，且 fork 的 compact 本来就已把两个选择器各自铺满一行，该字段在 fork 恒为死状态；实际落地的是 `popupHeight`/`popupWidth` 几何重算，以及把 `compact` 改由「选择器内容宽度 / 可见表单高度」推导。 |
| **需要排除/调整的内容** | 保留 fork 自研的 composer 其余结构（帮助文本、字段集）；不要覆盖 fork 已有的 compact 模式语义。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（评估合入）。fork 已有 compact 兜底，非崩溃级缺陷；属极端尺寸可用性增强。 **已落地（2026-09-20，[BACK-678](/task/678)）**：新增 `tui-task-composer-layout.test.ts`（4 用例 / 72 断言）+ 既有 `tui-task-composer.test.ts` 2 条；回退整份实现恰好 6 条新断言红。证据边界：win32 下 `createScreen` 传 `mouse: false`、`screen.lines` 在非 TTY 下为空，故只能停在 widget 几何层。 |
| **迁移建议** | ②参考重写：把上游 `stackSelectors` 推导与几何分支并入 fork `getTaskComposerLayout`/`applyLayout`/导航逻辑。 **落地说明（2026-09-20，[BACK-678](/task/678)）**：实现按 fork 自定——常量 `TEXT_INPUT_HEIGHT`/`POPUP_*_CHROME`/`PREFERRED_POPUP_WIDTH` + `getLongestSelectorWidth`（用 `Bun.stringWidth` 量**所有**选项，含 Draft/None），不搬上游的 `stackSelectors` 字段与 `getSelectorContentWidths` 命名，`TaskComposerLayoutOptions` 只带 `statuses/priorities`。 |

---

## TUI-4：BACK-590 Support mouse clicks in the TUI task composer

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让所有字段的指针点击走统一的 focus 过渡（文本字段进入输入态、选择器打开 picker），统一焦点样式与滚动来源。 |
| **变更内容摘要** | `src/ui/components/task-composer.ts:705-718` 将原本每个 selector 的 `widget.on("click", () => void openPicker(field))` 改为遍历 `["title","description","status","type","priority"]` 调 `focusField(field)`，并对 status/type/priority 额外 `openPicker`，返回 `false` 阻止冒泡自动聚焦。 |
| **与当前定制代码的交集风险** | 低 → **已落地（2026-09-20，[BACK-679](/task/679)）**：fork 已有 `focusField`。缺陷比「未接入」更深——两个文本框根本没绑 `click`（`inputOnFocus: false`），选择器的 `click` 既不先走 `focusField` 也不返回值，于是 blessed 祖先链 `element click` 把同一 widget 二次聚焦，而 `screen.focused` setter 的 `_focus(el, old)` **无条件** `old.emit("blur")` → 自 blur → `readInput` 刚建立的读态立刻被 `_done` 翻回 false（随后按 Escape 落到 `done(null, null)` 抛 `TypeError: done is not a function`）；真机 100x30 复现为「点描述后 `screen.focused` 确是 description，但 `_reading=undefined`、边框仍灰、Title 仍黄，输入落不进去」。 |
| **适合迁移的内容** | 文本字段点击 → `focusField`。**实测补齐（2026-09-20）**：上游遍历里的 type 选择器**不在 fork surface**（fork 无 Type 选择器，composer 字段只有 Title / Description / Status / Priority），故「type 点击 → `openPicker` 并放宽 `openPicker` 形参」不适用，未移植。 |
| **需要排除/调整的内容** | 无排除清单冲突。保留 fork 的 `focusField` 实现与自研选择器；上游的 type 分支整体剪掉，`openPicker` 签名不放宽。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（评估合入）→ **已落地（2026-09-20，[BACK-679](/task/679)）**：选择器点击原本已可用，文本点击属体验增强、自包含。 |
| **迁移建议** | ②参考重写，**实现按 fork 自定（2026-09-20）**：四类字段的 `click` 统一汇入 `focusField`（文本复用 `readInput`、选择器调 `openPicker`），handler `return false` 阻断冒泡；回归用例走真实鼠标派发路径（`program.emit("mouse", ...)`，坐标取渲染后 `lpos` 中心）。 |

---

## TUI-5：BACK-592 Make TUI text field insertion Unicode-safe

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 将终端显示单元光标映射到安全的 UTF-16 码点边界，自管 composer 两个文本字段的可打印插入，保留 astral 字符（emoji）与精确光标位置。 |
| **变更内容摘要** | `src/ui/components/task-composer.ts` 新增 `CaretLines.displayWidth`、`WIDE_CHARACTER_PLACEHOLDER`、`isHighSurrogate/isLowSurrogate`、`visibleLineText`、`codePointWidth`、`safeCodePointBoundary`、`indexAtDisplayColumn`；重写 `caretIndexFromCursor`/`cursorFromCaretIndex` 使用 `displayWidth` 与 `safeCodePointBoundary`；新增 `setTextAtCaret`/`insertText`；`ownInputKeys` 增加 `isTextInsertion(ch)` 分支调 `insertText` 自管插入（不再把可打印字符交给 widget 默认监听）。 |
| **与当前定制代码的交集风险** | 高（Windows/Unicode 相关，需重点核实）。fork 的 `caretIndexFromCursor`（`task-composer.ts:37-46`）与 `cursorFromCaretIndex`（`task-composer.ts:49-61`）是**旧版** UTF-16 实现（用 `.length`，无 `safeCodePointBoundary`/`displayWidth`）；fork 的 `ownInputKeys`（`task-composer.ts:620-629`）对可打印字符直接 `listener(ch, key)`，**未**自管插入（无 `insertText`/`isTextInsertion`，grep 确认缺失）。fork 仅在 `deletionStart`（`task-composer.ts:69-79`）处理了删除时的代理对，但**插入路径未处理** → emoji/宽字符会按 UTF-16 切割产生替换字符并污染任务文件、光标错位。 |
| **适合迁移的内容** | `insertText`/`isTextInsertion`/`setTextAtCaret`、`safeCodePointBoundary`、`codePointWidth`、`WIDE_CHARACTER_PLACEHOLDER`、在 `caretIndexFromCursor`/`cursorFromCaretIndex` 接入 `displayWidth`（`strWidth`）。 |
| **需要排除/调整的内容** | 无排除清单冲突（纯 TUI 文本输入）。保留 fork 已有的 `ownInputKeys` Tab/Backspace/Delete 拦截骨架。 |
| **迁移优先级** | 初判 AB → 深度分析 A类（必须合入）。fork 确缺失 Unicode 安全插入路径，缺陷代码在 `task-composer.ts:620-629` 的 `ownInputKeys` 默认透传与 37-61 的旧版游标换算。 |
| **迁移建议** | ②参考重写：将上游 `insertText`/`isTextInsertion`/`safeCodePointBoundary`/`displayWidth` 机制并入 fork 的 `ownInputKeys` 与游标换算函数，适配 fork 的 `syncInputs`/字段读写接口。 |

---

## TUI-6：BACK-646 Count emoji as double-width in the TUI

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 将 neo-neo-bblessed 升到 1.0.10（库内已含 Unicode 16 Emoji_Presentation 宽表），使 emoji 按双宽计算，避免看板列边界漂移。 |
| **变更内容摘要** | 仅依赖升级：`package.json`/`bun.lock`/`bun.nix` 中 `neo-neo-bblessed` 由 `1.0.9` → `1.0.10`，并删除本地补丁 `patches/neo-neo-bblessed@1.0.9.patch`；新增回归测试 `src/test/tui-emoji-width.test.ts`。无 `src/ui` 代码改动（修复在库内）。 |
| **与当前定制代码的交集风险** | 低（但属 Windows/Unicode 相关需核实）。fork 的 `package.json:44` 为 `neo-neo-bblessed: "1.0.9"`，且无 `patches/` 目录（已确认 `ls patches/` 不存在）→ fork 为**未打补丁的 1.0.9**，emoji 宽表缺陷真实存在（emoji 按 1 列计量，列边界漂移）。 |
| **适合迁移的内容** | 升 `neo-neo-bblessed` 至 `1.0.10`（package.json/bun.lock/bun.nix 三处），并补 `src/test/tui-emoji-width.test.ts` 回归测试。 |
| **需要排除/调整的内容** | 无排除清单冲突。若 fork 后续有其它对 1.0.9 的依赖假设需一并验证。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（必须合入）。fork 确认处于 1.0.9 且无补丁，缺陷真实；升级是纯依赖变更、风险低。 （口径校正：emoji 双宽属渲染修正，不损坏数据，由 A 类归入 B 类评估。） |
| **迁移建议** | ①直接复用：在三处清单将版本改为 `1.0.10`（保持 sha512 与上游一致），新增回归测试；执行 `bun install` 后在 Windows 终端验证 emoji 双宽。**已落地（2026-09-20）**：[BACK-676](/task/676) 在三处清单把版本升到 `1.0.10`、补上 sha512 与 Nix hash，并新增 `src/test/tui-emoji-width.test.ts` —— 本地无 `patches/` 目录，升级即全部改动；新用例 4 pass／0 fail，仓库外对照 `1.0.9` 时 emoji 与 layout regex 三条变红、未变宽度的一条仍绿。 |

---

## TUI-7：BACK-657 Make the TUI acceptance-criteria bar degrade gracefully without Block Element glyphs

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | AC 进度条改用纯 ASCII（`#`/`‑`），避免终端字体缺 Block Element 字形（U+2588/U+2591）时条形变空白、非 UTF-8 locale 下变 `?`。 |
| **变更内容摘要** | `src/ui/acceptance-criteria-progress.ts:9-13` 新增 `FILLED_CELL="#"`/`EMPTY_CELL="-"`，`formatAcceptanceCriteriaProgress` 末行由 `█`/`░` 改为 `FILLED_CELL`/`EMPTY_CELL`；并加说明注释（blessed 仅保证 DEC Special Graphics 回退，ASCII 低于 `~` 绕过所有字符集翻译）。 |
| **与当前定制代码的交集风险** | 低（Windows 相关需核实）。fork 的 `acceptance-criteria-progress.ts:21` 仍用 `█`.repeat/`░`.repeat（Block Element 字形），**无** ASCII 降级 → 在中文 Windows 旧控制台（代码页 GBK/非 UTF-8 locale）或缺失字形的字体下会渲染为 `?`/空。 |
| **适合迁移的内容** | 将填充/空白字形改为 `#`/`-`（含常量抽取）。 |
| **需要排除/调整的内容** | 注意与 TUI-9 合并实施（TUI-9 在 ASCII 基础上加颜色与压缩格数，是最终形态）；阈值取上游的 `WIDE_PROGRESS_MIN_WIDTH=40`（**后续修正（2026-09-20）**：原拟保留 fork 的 32，见 TUI-1 行的后续修正）。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（必须合入）。fork 确用 Block Element 字形且无降级，缺陷在 `acceptance-criteria-progress.ts:21`，对 Windows 非 UTF-8 环境确为真实风险。 （口径校正：字形降级属兼容性补丁，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写：**已与 TUI-1 / TUI-9 合并为单一任务 [BACK-675](/task/675)**（2026-09-20 定案）。三者同属 `src/ui/acceptance-criteria-progress.ts` 的连续演进，分步实施会中途留下「ASCII 但格数未压缩」的中间态，故一次性重写 `formatAcceptanceCriteriaProgress` 到上游最终形态：`FILLED_CELL="#"` / `EMPTY_CELL="-"` + 5/3 格 + `completionColor` 上色 + clamp 取整。阈值对齐上游的 `WIDE_PROGRESS_MIN_WIDTH=40`（**后续修正（2026-09-20）**：原拟保留 fork 32，实测会在 108–131 列窗口与上游分歧）。 **已落地（2026-09-20）**。 |

---

## TUI-8：BACK-661 TUI multi-select move with shift-arrow recruitment

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在看板 MOVE 模式下用 Shift+↑↓ 招募相邻任务高亮、Shift+M 选入移动集合，多任务作为整块预览与落位；并把 `closeBoard` 改为幂等以等待进行中的写。 |
| **变更内容摘要** | `src/ui/board.ts` 的 `MoveOperation` 增 `selectedIds`/`highlightTaskId`；新增 `getMoveSetIds`/`getPreviewMovingIds`/`mapInsertionIndex`/`getInsertionBase`/`updateMoveSelection`/`collapseHighlight`；`buildRenderedTaskListItems` 改收 `ReadonlySet<string>`；`getProjectedColumns` 支持整块 ghost 插入；方向键/`Enter` 处理接入 collapse 与招募；`closeBoard` 改为 `closingBoard ??= (...)` 单例并 await `pendingMoveWrite`；footer 提示更新。另含 `help-popup.ts` 提示文案增强。 |
| **与当前定制代码的交集风险** | 中（较大特性）。fork 的 `MoveOperation`（`board.ts:408-415`）仅含 `taskId/originalStatus/originalIndex/targetStatus/targetIndex`，**无** `selectedIds`/`highlightTaskId`；`getProjectedColumns`（`board.ts:669` 起）为单 ghost；`closeBoard`（`board.ts:885-896`）非幂等。结构相似但为单任务移动，多选招募属净新增。 |
| **适合迁移的内容** | 多选集合/高亮招募逻辑、`getMoveSetIds`/`getPreviewMovingIds`/`mapInsertionIndex`/`collapseHighlight`、`closeBoard` 幂等化、`buildRenderedTaskListItems` 的 `Set` 入参。 |
| **需要排除/调整的内容** | 无排除清单冲突（纯 TUI 看板交互）。保留 fork 已有的 `getProjectedColumns`/`pendingMoveWrite` 框架，仅扩展字段。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（评估合入）。fork 缺失多选移动（净新特性，工作量中高），但非缺陷修复，可评估后纳入。 |
| **迁移建议** | ②参考重写：将上游多选招募逻辑并入 fork 的 `MoveOperation` 与 `getProjectedColumns`/`renderBoardTui` 方向键与 `closeBoard`，注意 fork 自定义字段集。 |

---

## TUI-9：BACK-666 Compact colored acceptance-criteria bar in the TUI

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 将 AC 进度条压缩（宽 5 格 / 窄 3 格），用 `wrapStatusColor` 按完成比上色（全完成绿、≤1/3 红、之间黄），并 clamp 取整保证有进度至少 1 格、未完成永不满格；保留 TUI-7 的 ASCII 字形与 `x/y`。 |
| **变更内容摘要** | `src/ui/acceptance-criteria-progress.ts` 引入 `import { wrapStatusColor }`、`WIDE_PROGRESS_CELLS=5`/`COMPACT_PROGRESS_CELLS=3`、`completionColor()`，重写 `formatAcceptanceCriteriaProgress` 产出 `[{red-fg}#{/}----] 1/7` 形式并 clamp。依赖 TUI-7 的 `FILLED_CELL`/`EMPTY_CELL`。 |
| **与当前定制代码的交集风险** | 低。fork 当前既无 ASCII（见 TUI-7）也无颜色/压缩（10/5 格、Block 字形）。上游此提交是 TUI-7 之后对同文件的最终演进，fork 可直接采用该最终形态，避免分步回退。 |
| **适合迁移的内容** | 最终的 `formatAcceptanceCriteriaProgress`（ASCII+彩色+5/3 格+clamp 取整）。 |
| **需要排除/调整的内容** | 不要保留 fork 旧 `█`/`░` 与 10/5 格（会被此提交覆盖）；阈值取上游的 `WIDE_PROGRESS_MIN_WIDTH=40`（**后续修正（2026-09-20）**：原拟保留 fork 32，见 TUI-1 行）；该选择不影响颜色/字形语义。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（必须合入）。与 TUI-7 共同补齐 fork 既缺失的降级与可读性；属上游同范围最终形态，应一并合入。 （口径校正：彩色进度条属展示优化，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写：**已与 TUI-1 / TUI-7 合并为单一任务 [BACK-675](/task/675)**（2026-09-20 定案），以本提交的最终形态为准重写 `formatAcceptanceCriteriaProgress`（叠加 TUI-7 的 ASCII 常量），阈值对齐上游的 `WIDE_PROGRESS_MIN_WIDTH=40`（**后续修正（2026-09-20）**）。**fork 侧另需补一处上游没有的活**：~~详情页调用 `formatAcceptanceCriteriaProgress(task)` 时未传宽度（`task-viewer-with-search.ts:1552`），恒走宽格路径，故窄屏下详情页不会退到 3 格——需把详情页内宽传进去并在 resize 时重绘；这是「还考虑了窄屏幕」的落地重点~~——**后续修正（2026-09-20，用户实测后定案）**：该处不是补宽度而是**移除条形本身**，详情页不再绘制进度条（宽度管线一并还原），「窄屏幕」只落在 board 行。 **已落地（2026-09-20）**。 |

---

## TUI-10：BACK-674 Sort the TUI list view through the shared task ID comparator

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | `TaskIdentityIndex.getTasks` 改用 `compareTaskIds` 而非 `localeCompare`，使 TASK-1.10 排到 TASK-1.2 之后（层级数字排序一致）。 |
| **变更内容摘要** | `src/core/task-identity-index.ts:236-239` 的 groups 排序由 `left.id.localeCompare(right.id)` 改为 `compareTaskIds(left.id, right.id)`，并 `import { compareTaskIds } from "../utils/task-sorting.ts"`；新增测试 `subtask-ordering-consistency.test.ts`。 |
| **与当前定制代码的交集风险** | 低。fork 的 `getTasks`（`task-identity-index.ts:240-242`）确为 `groups.sort((left, right) => left.id.localeCompare(right.id))`——**存在同样的层级排序 bug**。fork 已有 `compareTaskIds`（`task-sorting.ts:44`）且多处使用，仅需替换这一处。 |
| **适合迁移的内容** | `getTasks` 内 groups 排序改用 `compareTaskIds` + 补 import。 |
| **需要排除/调整的内容** | 无排除清单冲突（核心排序工具，非日期/里程碑/统计/编辑语义字段）。 |
| **迁移优先级** | 初判 AB → 深度分析 A类（必须合入）。fork 确认有该 bug（缺陷代码 `task-identity-index.ts:242`），改动为 1 行 + import，风险极低。 |
| **迁移建议** | ①直接复用：将 `task-identity-index.ts:242` 改为 `compareTaskIds(left.id, right.id)` 并 import `compareTaskIds`（上游补丁几乎原样适用）。 |

---

## TUI-11：BACK-675 Fix Windows TUI keyboard input after Tab view switch

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 Windows 下 Tab 切换视图后键盘输入失灵：销毁最后一个 program 会暂停 stdin，Bun on Windows 无法可靠恢复；故统一视图保留一个空闲 program 到会话结束。 |
| **变更内容摘要** | 新增 `src/ui/tui.ts` 的 `keepTuiInputAlive()`（用 `createProgram` 建一个空闲 program 并挂 `process.once("exit", release)`）；`src/ui/unified-view.ts` 的 `runUnifiedView` 开头 `const releaseTuiInput = keepTuiInputAlive();` 并在 `finally` 调 `releaseTuiInput()`；`neo-neo-bblessed.d.ts` 的 `ProgramInterface` 增 `destroy(): void`。 |
| **与当前定制代码的交集风险** | 低（已确认 fork 已等价解决，详见下）。fork 在 `src/ui/tui.ts:94-180` 的 `createScreen` 中**已自研更彻底的方案**：进程级复用单一 `sharedProgram`（`:102`），并**中和** `createProgram.prototype.destroy`（`tui.ts:174` 临时置空、`:178` 还原）以阻止 screen.destroy 拆掉共享 program，同时清理遗留 key 监听器避免崩溃。unified-view 经 `board.ts`/`task-viewer-with-search.ts` 调用此 `createScreen` → 该修复已对全 TUI 生效。 |
| **适合迁移的内容** | 无（fork 已有等价且更完整的机制）。 |
| **需要排除/调整的内容** | 排除上游 `keepTuiInputAlive` 与 `unified-view.ts` 的接入：fork 用单一 `sharedProgram` 模型，再叠加一个空闲 program 会与现有单 program 管理冲突（双 program 抢 stdin）。不触发排除清单各节（属 TUI 输入生命周期，非日期/里程碑/统计/编辑语义）。 |
| **迁移优先级** | 初判 A → 深度分析 C类（跳过）。fork 已通过 `createScreen` 的 `sharedProgram`+`prototype.destroy` 中和等价解决 Windows 键盘失灵，合入上游会与现有单 program 模型冲突。 |
| **迁移建议** | ③忽略：保留 fork 现有 `createScreen`（`tui.ts:94-180`）方案；仅建议补测 Windows Tab 切换后输入（验证 `sharedProgram` 在 PowerShell/ConPTY 下仍稳定）。 |

---

## TUI-12：BACK-24.02 CLI TUI: Add milestone swimlanes to interactive board view

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 TUI 交互看板增加里程碑泳道（按 milestone 分组、可折叠），对齐 web 看板里程碑视图行为。 |
| **变更内容摘要** | upstream commit `502bd15e9` 仅在 `backlog/tasks/back-24.02 - ...md` 中将 `status: To Do` → `Done`，Implementation Notes 明确「maintainer decision: close as Done without implementation」，Final Summary「No code changes were requested or made」。本范围**无上游代码**（`code_files: []`）。 |
| **与当前定制代码的交集风险** | 低（无上游代码可冲突）。fork web 看板已自研泳道（`swimlane`，见基线）；fork TUI 看板（`board.ts` `renderBoardTui`）当前**无**里程碑泳道——但上游同样未实现，故 TUI 侧缺位属双向空白，而非回退风险。 |
| **适合迁移的内容** | 无上游代码可迁移。 |
| **需要排除/调整的内容** | 排除清单 §1（里程碑时间字段增强）不直接相关——本任务无代码；若 fork 日后自研 TUI 里程碑泳道，应保持 `updateMilestone` 与 actual 字段（§1）及 web 泳道共存。 |
| **迁移优先级** | C类（跳过）。本范围无上游代码（上游按 maintainer 决定关闭未实现）；fork TUI 缺里程碑泳道为真实产品空白，但本轮无参考实现可摘樱桃。 |
| **迁移建议** | ③忽略（本轮）。如 fork 需要 TUI 里程碑泳道，应作为全新特性自研，可借鉴 fork web `swimlane` 的分组/折叠思路，而非从上游迁移。 |

---

## TUI-13：BACK-683 Render TUI acceptance-criteria progress as a pie glyph

> draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 将 TUI 的 AC 完成度渲染为饼图形状（pie glyph）以更紧凑地表达比例。 |
| **变更内容摘要** | 本范围 `commits: []`，无上游代码（上游饼图实现不在 v1.50.1..v1.52.0 本次范围或尚未合入）；`kind: C` 记录类条目。 |
| **与当前定制代码的交集风险** | 低。fork 已在任务弹窗详情自研 AC 进度环（`task-viewer-with-search.ts:1551-1556` 的 `formatAcceptanceCriteriaProgress` 行 + 详情区 checklist），与饼图装饰性增强无冲突。 |
| **适合迁移的内容** | 无（无上游代码）。 |
| **需要排除/调整的内容** | 属 C 类记录，不导入；不触发排除清单各节。 |
| **迁移优先级** | C类（跳过）。`commits` 为空、kind=C，本范围无上游代码；饼图属可选装饰增强，fork 已有 AC 进度环定制，可后续独立评估。 |
| **迁移建议** | ③忽略（draft 不导入）。如未来需要，作为独立装饰增强设计，复用 fork 现有 `acceptance-criteria-progress` 数据来源。 |

*draft 不导入，C 类。*

---

# 三、Web

## WEB-1：BACK-222.1 Show parent and subtask hierarchy in the web task details modal

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在任务弹窗内以面包屑 + 可点击列表展示父任务与子任务层级，并带嵌套进度文案。 |
| **变更内容摘要** | `src/web/components/TaskDetailsModal.tsx`（2c45f85d3/0c58afd9f/6286bf972/487576256）：新增父任务 `<nav data-task-hierarchy>` 面包屑、`Subtasks` 区块、`HierarchyStatusBadge`/`HierarchyChevron`；`src/utils/task-subtasks.ts` 新增 `summarizeSubtaskProgress`；`Modal.tsx` sticky 头改为 `flex-wrap`。 |
| **与当前定制代码的交集风险** | 低 — fork 已在 `src/web/components/TaskDetailsModal.tsx:6` 引入自研 `TaskHierarchySection`，并在 `:1218-1220` 渲染 `<TaskHierarchySection task={task} availableTasks={availableTasks} onTaskClick={handleTaskClick} />`。上游是把同一能力内联回 TaskDetailsModal，与 fork 的组件化解法重复。 |
| **适合迁移的内容** | 仅 `summarizeSubtaskProgress` 的嵌套进度语义可选择性并入 fork 的 `task-subtasks.ts`（fork 现仅有 `attachSubtaskSummaries`，TaskDetailsModal.tsx 未引用上游 helper）。 |
| **需要排除/调整的内容** | 排除上游在 TaskDetailsModal 内联的父/子任务块（会与 `TaskHierarchySection` 重复并回退自研布局）；排除 `Modal.tsx` 的 `flex-wrap` 头改（fork Modal 已自定义）。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 C：能力已存在，上游内联实现会与 fork 自研 `TaskHierarchySection` 冲突，无净增量。 |
| **迁移建议** | ③忽略。如需增强，仅在 `TaskHierarchySection.tsx` 内吸收上游的 `HierarchyStatusBadge` 视觉与嵌套进度文案，不搬上游内联块。 |

---

## WEB-2：BACK-419 Add Web UI demote-to-draft action

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Web 任务弹窗提供「降级为草稿」操作，经新端点 `/api/tasks/:id/demote` 调 Core 降级，并防陈旧弹窗续作。 |
| **变更内容摘要** | `src/server/index.ts`（5ba37fca1）：新增 `POST /api/tasks/:id/demote` 与 `handleDemoteTask`，含 `demotionState` 的 409/500 处理；`TaskDetailsModal.tsx` 新增 `handleDemote` + `demotionIdentityRef`/`activeDemotionRequest` 防重入守卫、`canDemote` 计算；`api.ts` 新增 `ApiError`/`NetworkError`；`Modal.tsx` 头 `flex-wrap`。 |
| **与当前定制代码的交集风险** | 中 — fork 已完整实现降级：TaskDetailsModal.tsx `:526`/`:1062-1066`/`:1146-1150` 的 `handleDemote` 与 `canDemote`，DraftsList.tsx `:103` 的 `promoteDraft`，core/backlog.ts `:2476` `demoteTaskWithUpdates`，server/index.ts `:470-471` 路由，api.ts `:311` `demoteTask`。上游额外加了请求守卫/网络错误分支，fork 版本更简。 |
| **适合迁移的内容** | 上游的 `demotionIdentityRef`+`activeDemotionRequest` 防陈旧续作守卫、`NetworkError`/`ApiError` 失败时提示、以及 Modal 响应式头改。 |
| **需要排除/调整的内容** | 排除对 `canDemote` 判定逻辑的覆盖（fork 的 `isLocalEditableTask`+`isOpenDraft`+`source!=="completed"` 判定已覆盖且更贴合 fork）；不要替换 fork 已有的 `handleDemote` 整体，仅补守卫。 |
| **迁移优先级** | B类（评估合入）— 初判 A → 深度分析 B：核心功能 fork 已有，仅请求健壮性守卫值得增量回植。 |
| **迁移建议** | ②参考重写：在 fork 现有 `handleDemote`（TaskDetailsModal.tsx:1062）上叠加上游的 `activeDemotionRequest`/`demotionIdentityRef` 与 `NetworkError` 提示，不整体替换。 |

---

## WEB-3：BACK-424 Support multiple status filters in Web task lists

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | Web 任务列表支持多选状态过滤，URL 用重复 `status=` 参数持久化。 |
| **变更内容摘要** | `src/web/components/TaskList.tsx`（8a669d9eb）：`statusFilter` 由 `string` 改为 `string[]`，新增 `getStatusFilters`/`normalizeStatusFilters`/`areEqualStringArrays`，`syncUrl` 用 `params.append("status", ...)` 多值。 |
| **与当前定制代码的交集风险** | 低 — fork 早已支持多选：`TaskList.tsx:110` `const [statusFilter, setStatusFilter] = useState<string[]>(initialStatusParams)`，`StatusFilterDropdown` 以 `selectedStatuses={statusFilter}`（`:647`）多选，`syncUrl`（`:437`）多值写回。 |
| **适合迁移的内容** | 上游的 `normalizeStatusFilters`（大小写归一、去重）可作为稳健性改进并入 fork 的 `initialStatusParams` 解析，但非必需。 |
| **需要排除/调整的内容** | 排除整段上游 TaskList 状态过滤重写（会与 fork 的 `StatusFilterDropdown`/`LabelFilterDropdown`/`StatusExcludeDropdown` 自研过滤体系冲突并回退）。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 C：多选状态过滤 fork 已实现，无净增量。 |
| **迁移建议** | ③忽略（如需更稳健的大小写归一，可在 fork `initialStatusParams` 处参考上游 `normalizeStatusFilters` 小改）。 |

---

## WEB-4：BACK-552 Show acceptance criteria progress on browser task summaries

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在 Web 任务卡与任务列表上展示验收标准进度（checked/total）。 |
| **变更内容摘要** | `src/web/components/AcceptanceCriteriaProgress.tsx`（bd5108d70）：新增 `getAcceptanceCriteriaProgressCounts` 与 SVG 组件；`TaskCard.tsx`、`TaskList.tsx` 引用。 |
| **与当前定制代码的交集风险** | 低 — fork 已有自研 `AcceptanceCriteriaProgress`（variant cells/bar），且在 `TaskCard.tsx:251` 与 `TaskList.tsx:856`（**均已是 `variant="bar"`**）均已展示进度。能力覆盖。**实测补齐（2026-09-19）**：列表侧原先的 `cells={10}` 已由 [BACK-645](/task/645) 的定宽条重构改为 bar。 |
| **适合迁移的内容** | 上游的 `getAcceptanceCriteriaProgressCounts` 纯函数（仅 In Progress 且含 criteria 才计数）语义可对照；fork 现用内联 `checked/total` 计算。 |
| **需要排除/调整的内容** | 排除上游组件整体替换（fork 用 `variant` API，上游用 `density` API；fork 两处调用点均为 `bar`，上游改用 SVG ring，见 WEB-10 定案）。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 C：AC 进度已在卡片与列表展示，无净增量。 |
| **迁移建议** | ③忽略（视觉升级见 WEB-10，已定案不做）。 |

---

## WEB-5：BACK-630 Filter the web dependency picker to locally-resolvable tasks

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 依赖选择器自动补全只建议本地可解析任务，服务端把缺失依赖的 CLI 提示改写为 Web 友好文案。 |
| **变更内容摘要** | 上游 `2eb7d5e82`（closes #927）：`DependencyInput.tsx` 新增 `suggestableTasks?` prop 与 `const suggestionSource = suggestableTasks ?? availableTasks`，只作用于补全过滤（chip 仍走全量 `availableTasks`）；`TaskDetailsModal.tsx` 以 `useMemo` 从 `availableTasks.filter(isLocalEditableTask)` 得本地列表，再经 `buildTaskIdIndex`/`resolveTaskReference` 剔掉「规范 ID 已被别的文件认领」的候选；`server/index.ts` 新增 `WEB_TASK_LOOKUP_HINT` 与 `formatErrorForWeb`，把既有常量 `LOCAL_TASK_LOOKUP_HINT`（上游 `src/utils/task-path.ts:42`）换成本地口径，套在 create 与 update 两个 handler 上。**注：上游 commit 自述里写的 `apiClient.fetchTasks({ crossBranch: false })` 与其实际 diff 不符 —— 真实实现走客户端过滤、并未调用 `fetchTasks`（以 `git show 2eb7d5e82` 为准）。** |
| **与当前定制代码的交集风险** | 中 → 已消解。**实测补齐（2026-09-19）**：本行原记「fork 未区分本地/跨分支，跨分支任务被建议后保存可能因校验失败而报错（与上游修复前缺陷同源）」——该症状在 fork 不存在：校验语料是 `core.queryTasks()`（`src/utils/task-builders.ts:83-88`），`includeCrossBranch` 默认 `true`（`src/core/backlog.ts:723`），仅显式传 `false` 时 `filterLocalEditableTasks` 才生效（`:735-737`），故跨分支目标是**合法**依赖；web 侧 `availableTasks` 与校验同源（`src/web/App.tsx:1011`），「建议了却存不下」这条链断在校验一侧。探针 `tmp/probe-web5.ts`（仓库外工程造一条只存在于另一分支的任务）：`queryTasks()` → `TASK-9:local-branch`，`queryTasks({includeCrossBranch:false})` → 空，`createTaskFromInput(deps: ['TASK-9'])` → ACCEPTED，`deps: ['TASK-404']` → 仍拒。**口径校正（2026-09-19，依赖选择专项核查）**：该探针工程用的是默认前缀 `task`；本仓库 `task_prefix: "back"`，而 `src/core/task-loader.ts:51-56` 的 `extractConfiguredTaskId` 漏传该前缀（落回默认 `task`）→ `back-*.md` 分支索引恒空且不告警，实测 `queryTasks()` 352 条**全部** `source=local`、0 条跨分支（`tmp/probe-sources.ts`）；另有 `remote_operations: false` 跳过全部 `origin/*`（`src/core/task-loader.ts:491`）。故上一句「跨分支目标是合法依赖」是**设计层**口径（由 `includeCrossBranch` 默认 `true` 保证），与「本仓库当前是否看得到跨分支记录」是两件事：本仓库依赖选择器的候选集实际只有本地工作副本 + 草稿 + 已完成，WEB-5 的错配链在 picker 侧与校验侧都**没有对象**。前缀缺陷修复并开启远程后结论不变（语料与校验仍同源）；也正因此，上游那层 `isLocalEditableTask` 过滤现在照搬近乎空操作、待前缀修复后便开始误剔，仍不应照搬。 |
| **适合迁移的内容** | 已满足，无需迁移。①「picker 只建议可保存的目标」在 fork 由校验与语料同源天然成立（见上一行实测）；②服务端改写 Web 文案**无对象** —— fork 全仓没有 `LOCAL_TASK_LOOKUP_HINT`/`formatErrorForWeb`，缺依赖文案本就是纯事实陈述「The following dependencies do not exist: … Please create these tasks first or verify the IDs.」（`src/core/backlog.ts:1538`、`:1908`、`:1922`），不含 `backlog browser`（该短语在 fork 只出现在服务端绑定/端口提示 `src/server/index.ts:698`/`:725`、CLI 帮助文案与 `src/guidelines/**` 文档里）。 |
| **需要排除/调整的内容** | 两处**不能照搬**：①不可移植上游的 `availableTasks.filter(isLocalEditableTask)` —— fork 的 `isLocalEditableTask`（`src/types/index.ts:104-106`）把 `local-branch`/`remote` 判为「非本地可编辑」，照抄会把**实际能保存**的跨分支目标从建议里剔掉，反向制造上游缺陷的镜像；②上游那套客户端去歧义在 fork 不生效 —— 它靠 `indexByCanonicalId`（上游同名，fork 对应 `src/web/utils/task-id-links.ts:51-66`）在**同一规范 ID 出现两次**时删除该条目来 fail-closed，而 fork 的 web 语料已被 `queryTasks()` 把同一身份坍缩成一条记录，索引永远看不到那次碰撞，过滤后仍会留下那条注定存不下的建议。另：`DependencyInput` 的 chip 解析路径（BACK-662 已完成候选、BACK-663 只读下钻、BACK-664/665 的共享 `CompletedBadge`）不得被本次覆盖。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 B → **核查改判 C（已满足）**：缺陷链在 fork 不成立，且「有意不照搬上游过滤」是正确选择而非欠账。 |
| **迁移建议** | ③忽略；**不建立迁移任务**（原拟由 DRAFT#159 承接，该草稿已删除、未升级）。唯一真残余属边缘、且非本条目可解：`backlog/tasks/` 内两份文件同身份（只有 `backlog doctor` 能修的损坏态）时语料只回一行，picker 会照常建议该 ID、保存被 BACK-664 第二道闸 fail-closed 成 `AmbiguousTaskIdError`（`src/test/dependency.test.ts:460`，探针实测提示 `Run 'backlog doctor' to preview a safe repair.`）；要挡住它需把 `/api/tasks/duplicate-ids` 的信息接进 picker 或改服务端语料，不宜伪造一层「本地可解析」过滤。 |

---

## WEB-6：BACK-633 Show and edit modified files in the web task modal

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在任务弹窗展示并编辑该任务修改过的文件列表（`modifiedFiles`）。 |
| **变更内容摘要** | `src/web/components/TaskDetailsModal.tsx`（d0d41ccfb）：新增 `modifiedFiles` 区块（只读展示 + 编辑），含测试 `web-task-details-modal-modified-files.test.tsx`。 |
| **与当前定制代码的交集风险** | 低 → **已落地（2026-09-19，[BACK-666](/task/666)）**：fork 原无 `modifiedFiles` 区块，属真空白；本次按 fork 自己的布局落地（三页签面板，见「迁移建议」行），未照搬上游的独立第三节。 |
| **适合迁移的内容** | 整个 `modifiedFiles` 的展示与编辑能力（列表、新增、删除、经既有 update 接口回写）。**实测补齐（2026-09-19）**：能力整体落地，界面形态改为三页签面板；回写沿用 fork 的 `handleInlineMetaUpdate`。 |
| **需要排除/调整的内容** | **实测补齐（2026-09-19）**：`Task` 类型与 web 语料都已带 `modifiedFiles`（`src/types/index.ts`），原「可能要先补类型」的顾虑不成立。上游那节有三处**不照搬**：①独立第三节 → fork 与 References/Documentation 合并为页签面板；②硬编码英文字串 → fork 走 i18n（新增 `section.modifiedFiles`/`noModifiedFiles`/`removeModifiedFile`/`metadataTabsLabel`，en/zh-CN/zh-TW/ja 四语言同加）；③`max-h-64` 列表上限 → fork 的 References 列表本就不设上限，只给 Modified 加会让同一面板内两个列表行为不一致，故未采纳（真要加应三个列表同加）。另：上游把 `modifiedFiles` 排除在保存载荷之外，fork 与 `references`/`documentation` 一致地随保存提交，否则创建态新增的路径会丢。 |
| **迁移优先级** | B类 → **已落地（2026-09-19，[BACK-666](/task/666)）**：字段在 fork 早已定义且已进入 web 语料，原「字段可能未定义」的顾虑不成立；能力自包含，无回退风险。 |
| **迁移建议** | ②参考重写，**实现方式按 fork 自定（2026-09-19）**：`modifiedFiles` 不做独立小节，而与 References/Documentation 合成一个页签面板（标题栏即页签条，只有当前页签的内容在 DOM 里）；Modified 的行渲染复用 References 的路径 chip（点击开文件预览）但去掉 URL 分支，输入复用 `PathAutocomplete` 且提交时拒绝 `scheme://`；默认页签随状态（`To Do` → References，其余状态在列表非空时 → Modified），点击可覆盖。 |

---

## WEB-7：BACK-634 Fix web UI draft editing

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 Web 草稿编辑完全不可用：GET/PUT `/api/tasks/:id` 只解析任务库，导致保存草稿 404/400。 |
| **变更内容摘要** | `src/core/backlog.ts`（583f928df）：`editTaskOrDraft` 增加 `options`，非草稿分支改调 `updateTaskFromInput`；`server/index.ts`：新增 `isDraftId`，`handleGetTask`/`handleUpdateTask` 对 `DRAFT-` 前缀路由到草稿库（update 走 `editTaskOrDraft`）；`App.tsx` 刷新时广播 `drafts-updated`；`TaskDetailsModal.tsx` 草稿状态禁用 Select 并显示真实状态。 |
| **与当前定制代码的交集风险** | 高 — **缺陷在 fork 同样存在**：fork `api.ts:updateTask` 对 `DRAFT-xxx` 直接 `PUT /api/tasks/${id}`（无前缀路由）；fork `server/index.ts:1301` `handleUpdateTask` 调 `updateTaskFromInput(taskId)`（非 `editTaskOrDraft`），草稿保存会「Task not found」。fork 虽已有 `core/editTaskOrDraft`（backlog.ts:2391）与 `updateDraftFromInput`（:2369），但服务端 update 路径未路由。 |
| **适合迁移的内容** | ① 服务端 `isDraftId` 判定 + `handleGetTask`/`handleUpdateTask` 对 `DRAFT-` 路由到 `editTaskOrDraft`；② 复用 fork 已有 `editTaskOrDraft`（backlog.ts:2391）。 |
| **需要排除/调整的内容** | 排除 `StatusSelect` 显示真实状态的写法覆盖（fork Select 已自定义）；保留 fork 通过 `fetchDraft`（api.ts:825）取草稿的既有 GET 路径，仅修 PUT 路由。 |
| **迁移优先级** | A类（必须合入）— 初判 A → 深度分析 A：缺陷确认存在，且 fork 已具备 `editTaskOrDraft` 基建，改动小、价值高。 |
| **迁移建议** | ②参考重写：在 fork `server/index.ts` 的 `handleGetTask`/`handleUpdateTask` 加 `isDraftId` 分支（update 调 `editTaskOrDraft`），对齐上游但不破坏 fork 现有草稿 GET/promote 端点。 |

---

## TUI-14（原 WEB-8）：BACK-644 Keep the board task popup in sync with live task state

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 让看板任务弹窗随实时任务状态刷新/关闭（外部或 agent 编辑驱动）。 |
| **变更内容摘要** | `src/ui/board.ts`（11836ada8，TUI 看板）：`openPopup`/`syncOpenPopup`/`restoreColumnFocus` 由 watcher 漏斗驱动重建/关闭；`src/utils/task-watcher.ts` 新增 `taskContentSignature`；测试 `board-popup-sync.test.ts`。 |
| **与当前定制代码的交集风险** | **中（2026-09-23 域修正：原判「低」是按 Web 面核的）** — 上游代码确实全在 **TUI** `src/ui/board.ts`（终端看板弹窗）与 `src/utils/task-watcher.ts`，fork 的 **Web** 看板是自研 `src/web/components/Board.tsx`（React）也确实不共享；但原判漏掉了 fork 自己就有一块**同样架构的 TUI 看板**（同一个 `src/ui/board.ts`，已被 BACK-681 多选移动 / BACK-684 弹窗 backdrop / BACK-693 草稿创建窗口连续改过），缺陷可在 fork 复现，落地必须并入这些自研结构。 |
| **适合迁移的内容** | **三条行为 AC 在 fork 均未满足（2026-09-23 实测）**：① 弹窗内容在打开时快照（`board.ts:1544-1563` 捕获 `task`，`task-viewer-with-search.ts:1694` 的 `generateDetailContent(task)` 只跑一次），弹窗内 E 编辑或 watcher 抓到的进程外 CLI 编辑之后仍显示旧标题 / 旧正文；② 弹窗所指向的任务被外部完成 / 归档 / 删除后，弹窗既不关闭也不提示，确认类操作会打到已消失的记录上；③ 弹窗刷新没走 `updateBoard` 漏斗（`board.ts:1258-1285` 只重绘列、无弹窗分支），旧实现里 `openTaskEditor`（`:1485-1529`）也只回写 `currentTasks` 而不重建弹窗。可一并借鉴：把 `taskSignature` 导出为 `taskContentSignature` 让看板与 watcher 共用一份「内容是否变化」判据（fork `task-watcher.ts:39` 语义已一致、仅未导出），并用该签名吞掉 watcher 回声。 |
| **需要排除/调整的内容** | ① 仍不要把 TUI `board.ts` 的改动套到 fork Web `Board.tsx`（架构不同，会回退自研泳道）；② 落地须与 fork 自研弹窗合并 —— BACK-684 的 backdrop `applyLayout` / `onResize`、BACK-693 的草稿会话（`entityNoun` / `draftSession`），不能按上游那 127 行原样打；③ 上游两条 review follow-up 属真实缺陷，应一并带上：确认框打开期间延后同步（否则弹窗重建会抢走对话框焦点），以及 `restoreColumnFocus` 的列索引 clamp（`hideEmptyColumns` 下列消失时焦点会静默丢失）。 |
| **迁移优先级** | **B类（评估合入）— 2026-09-23 域修正：原判「C类（跳过）」不成立。** 原结论的前提（「实为 TUI 特性、与 fork 无交集」）把 fork 的 TUI 看板整个漏掉了：fork 的 `src/ui/board.ts` 就是同一文件、同一弹窗，缺陷在 fork 可复现（探针 `tmp/probe-board-popup-stale.ts`：外部编辑后仍显示旧标题旧正文；任务被移除后弹窗不关也不提示）。初判 A → 深度分析 C → 域修正回 B，条目改列 TUI-14。 |
| **迁移建议** | **已落地（2026-09-23，[BACK-694](/task/694)，依赖 BACK-684 / BACK-693）**：照上游思路在 fork `src/ui/board.ts` 落成 `openTaskPopup(task)` 可重建 + `syncOpenPopup()` 由 `updateBoard` 漏斗驱动 + `taskContentSignature` 由 `src/utils/task-watcher.ts` 导出共用，E 路径结果改走 `updateBoard`；补了确认框期间延后同步与关窗后焦点回落到有效列两条守卫，新增 6 条用例（含「进程外改写任务文件、真 watcher 驱动刷新」的端到端一条），回退矩阵 3 变体 x 6 用例逐条钉住各子句。原 ③忽略 作废。②参考重写：照上游 `11836ada8` 的思路在 fork `src/ui/board.ts` 落「`openTaskPopup(task)` 可重建 + `syncOpenPopup()` 由 `updateBoard` 漏斗驱动 + 用已导出的 `taskContentSignature` 吞回声」，E 路径经 `updateBoard` 回灌而不是本地改 `currentTasks`。补充核实（结论不变）：`0c7d04f8a`（"fix(web): stop the task modal spinning on default empty props"，将 `availableStatuses/availableTasks` 默认提为模块级 `EMPTY_STATUSES`/`EMPTY_TASKS` 常量防无限重渲染）**不属于 BACK-644**，它属于 BACK-222.1 层级切片触发的 Web 弹窗修复，作者/时间均与 BACK-644 不同；该 fix 是否需单独迁移视 fork `TaskDetailsModal.tsx` 是否仍有默认 `= []` 引起的重渲染风险而定（fork 默认参数在 `:179` 附近，建议另行评估，不在本 19 条任务内）。 |

---

## WEB-9：BACK-645 Move multiple selected tasks between statuses in one action

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | Web 看板支持 Ctrl/Cmd 点击多选、Shift 范围选、拖拽/工具条批量改状态（服务端 `POST /api/tasks/move` + `Core.moveTasksToStatus`）。 |
| **变更内容摘要** | `src/web/components/Board.tsx`（8ad6cc6）：`selectedTaskIds`/`selectionAnchorId`/`toggleTaskSelection`/`selectTaskRange`/`handleBatchMove`；`TaskCard.tsx` 加选中态 props；`TaskColumn.tsx` 范围选；`api.ts` 加 `moveTasks`；`server/index.ts` 加 `POST /api/tasks/move`；`core/backlog.ts` 加 `moveTasksToStatus`（322 行）。注意 worklist 仅列记录 commit（bf5106cf2/327dc9ca9），真实实现为 8ad6cc6（#945）。 |
| **与当前定制代码的交集风险** | 高 — fork 完全缺失该能力：`TaskCard.tsx` 无 `selected`/选区（grep 无命中），`server/index.ts` 无 `/api/tasks/move`，`core/backlog.ts` 无 `moveTasksToStatus`，`api.ts` 无 `moveTasks`；且 fork 看板是**自研泳道**，多选/拖拽须与 `Board.tsx`/`TaskColumn.tsx` 自研结构对接。好消息：fork `lanes.ts:205` 已有 `sortTasksForStatus`，可复用。 **已落地（2026-09-21，[BACK-680](/task/680)）**：fork 侧补齐 `Core.moveTasksToStatus`（共享 `reorderTask` 的解析/跨分支守卫）与 `POST /api/tasks/move`；看板加多选（Ctrl/Cmd + Shift 范围）、选区工具条与批量拖拽。TUI 多选按维护者判定拆为后续任务，TUI 仍是单任务 mover（仅保留一条双击 Enter 守卫）。 |
| **适合迁移的内容** | ① 服务端 `POST /api/tasks/move` + `Core.moveTasksToStatus`（批量尾部追加、按任务返回失败项）；② `api.ts` `moveTasks`；③ `lanes.ts:205` 已存在 `sortTasksForStatus` 直接复用；④ 选区交互逻辑（参考而非照搬，需接入 fork `Board`/`TaskColumn`）。 **已落地（2026-09-21，[BACK-680](/task/680)）**：`sortTasksForStatus` 复用成立；批量请求按**看板顺序**构造（非点击顺序），跨分支卡片只参与排序、从不写入本地，同一身份被多条记录认领时 fail-closed 记为该任务的失败项。 |
| **需要排除/调整的内容** | 排除直接覆盖 fork `Board.tsx`/`TaskCard.tsx`/`TaskColumn.tsx`（自研泳道+卡片头部）；CLI 批量 `task edit ID1 ID2 -s`（8ad6cc6 的 CLI 部分）涉及 `--ref/--doc/--dep` 语义，须对照排除清单 §5 的 set/add/remove 语义，勿改 fork 现状。 **已落地（2026-09-21，[BACK-680](/task/680)）**：CLI 批量编辑按 fork 语义落地——多 ID 只接共享字段 flag，per-task-only flag（`-t`/`--plan`/`--notes`/`--comment`/`--ordinal`/`--modified-file`/清单索引/`--clear-final-summary` 等）在批量下报错拒绝；`--ref/--doc/--dep` 的 set/add/remove 语义未改。 |
| **迁移优先级** | B类（必须合入）— 初判 A → 深度分析 A：净真空白能力，但集成成本高，须参考重写接入自研看板。 （口径校正：多选批量改状态是新交互能力，由 A 类归入 B 类评估。） **已落地（2026-09-21，[BACK-680](/task/680)）**：75 用例通过（CLI 15 / 看板 31 / core+server 29），回退矩阵 A-F 逐项变红验证每条行为都有测试守护，真机 CDP 拖拽验到「两张卡一次请求、原地释放零请求」。 |
| **迁移建议** | ②参考重写：先落地服务端 `moveTasksToStatus`+`/api/tasks/move`+`api.moveTasks`（与 fork 无关，安全）；再在 fork `Board`/`TaskColumn`/`TaskCard` 上加选区态与批量拖拽/工具条，复用 `lanes.ts` 的 `sortTasksForStatus`。 **落地说明（2026-09-21，[BACK-680](/task/680)）**：分层与初判一致（core 共享原语 → server endpoint → web 视图）；原地释放的 no-op 由 TaskColumn 的 `dropPosition='self'` 映射回卡片当前位置、再触发既有 `isOrderUnchanged` 守卫实现；批量拖拽期间不渲染插入指示器（批量不兑现卡片级位置承诺）。 |

---

## WEB-10：BACK-652 Replace the ASCII progress bar on web task summaries with a web-native indicator

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 用 SVG 进度环替换任务摘要上的 ASCII 风格 `[██░░]` 进度条。 |
| **变更内容摘要** | `AcceptanceCriteriaProgress.tsx`（2c23d1c91）：`density` prop，SVG ring 替代 `cells` 文本条；`TaskCard.tsx`/`TaskList.tsx` 改用 `density`。 |
| **与当前定制代码的交集风险** | 低 — fork 组件已是自研实现（`variant` 取 `cells` 或 `bar`，非上游 `density`），且**两处调用点都已是 web 原生 bar**：`TaskCard.tsx:251`、`TaskList.tsx:856`（列表侧自 [BACK-645](/task/645) 的定宽条重构起）。ASCII `cells` 变体只剩组件默认值与单测覆盖，UI 已无调用点。**实测补齐（2026-09-19）**：上游 SVG ring 相对 fork 现有 bar 仅剩形状差异，无功能/信息缺口 —— 两者都带 x/y 分数文本、`role="progressbar"` 与 `data-acceptance-criteria-progress` 钩子。 |
| **适合迁移的内容** | 无净增量。上游 SVG ring 的几何与调色板（2px 描边、track 圆 + 由 checked/total 推出的 `strokeDasharray` 圆弧）可作视觉参考，但 fork 的 `bar` 变体已在卡片与列表统一呈现同一信息，替换属纯视觉偏好。 |
| **需要排除/调整的内容** | 不要整体替换 fork `AcceptanceCriteriaProgress`（API 不同：fork 用 `variant`/`cells`，上游用 `density`）；不得改动 `data-acceptance-criteria-progress`、`role`/`aria-*` 与 `title` 文案，也不得改动 `TaskCard.tsx:251`、`TaskList.tsx:856` 两处调用点的变体选择。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 B → **定案 C（不升级）**：AC 进度在卡片与列表已是 web 原生渲染（自研 `bar`，[BACK-645](/task/645)），上游 SVG ring 只剩形状差异；**用户定案不做视觉升级（2026-09-19）**。 |
| **迁移建议** | ③忽略；**不建立迁移任务**（原拟由 DRAFT#163 承接，该草稿已删除、未升级）。若日后要换 ring，只需在 fork 组件内加一个 ring 变体并改两处调用点，不必移植上游 `density` API 与整组件重写。 |

---

## WEB-11：BACK-653 Update web views in place instead of full reload on data changes

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 收到 `tasks-updated` 广播时改为原地增量刷新（仅 `/api/search`  reconcile），不再每播全量 `loadAllData()` 6 请求突袭。 |
| **变更内容摘要** | `server/index.ts`（4c04760fa）：`broadcastTasksUpdated` 泛化为 `broadcastDataUpdated(scope)`，任务走 `tasks-updated`、里程碑走 `milestones-updated`；`App.tsx`（191 行）新增 `refreshTasksData` 增量路径；新增 `src/web/utils/reconcile.ts`（`reconcileById`/`deepEqual` 保对象/数组 identity）；`web-in-place-refresh.test.tsx`。 |
| **与当前定制代码的交集风险** | 高 — **fork 仍有该性能缺陷**：`App.tsx:709` 收到 `event.data === "tasks-updated"` 后直接 `loadAllData()`（`:713`），每次广播全量重拉。**该缺陷已消除（2026-09-23，[BACK-698](/task/698)）**：fork 的 `tasks-updated` 改走增量 `refreshTasksData`，全量只作回退。fork 还有甘特图、`/overview`+`statistics-updated` WebSocket 等额外表面，重构刷新链路须保全这些。 |
| **适合迁移的内容** | ① 新增 `src/web/utils/reconcile.ts`（fork 缺失，直接加）；② `refreshTasksData` 增量刷新模式；③ 服务端 `broadcastDataUpdated(scope)`+`milestones-updated`。 |
| **需要排除/调整的内容** | 排除清单 §4：保留 fork `/overview` 统计缓存与 `statistics-updated` 推送，勿用上游里程碑广播覆盖；保留 fork 甘特图刷新；全量 `loadAllData` 仍须保留于初始加载、`config-updated`、跨分支索引完成、socket 重连（fork 已有跨分支索引逻辑）。 |
| **迁移优先级** | B类（必须合入）— 初判 A → 深度分析 A：真实性能问题 fork 仍存在，价值高；但须参考重写接入 fork 自研 App。 （口径校正：原地更新属性能优化，未达「严重性能瓶颈」，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写：引入 `reconcile.ts`，在 fork `App.tsx:709` 的 `tasks-updated` 处理中改为增量 `refreshTasksData`（reconcile 后写 store），保留全量回退分支与甘特/统计刷新钩子。**落地（2026-09-23，[BACK-698](/task/698)）**：新增 `src/web/utils/reconcile.ts`、`refreshTasksData` / `refreshMilestoneData` 两个增量入口（`refreshData` 发草稿事件），服务端 `broadcastTasksUpdated` 泛化为 `broadcastDataUpdated(scope)` 并补齐里程碑 create 的广播；顺带修掉同一广播路径上的两处自研噪音（`TaskDetailsModal` 依赖选择器预载只在弹窗打开时发、全量载入成功清错误状态）。甘特与统计钩子未动。 |

---

## WEB-12：BACK-654 Polish the cross-branch indexing loading indicator in the web UI

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 跨分支索引加载时在头部显示精致状态指示（chip + 底部扫光条），延迟出现/淡出。 |
| **变更内容摘要** | 新增 `src/web/components/BranchIndexingIndicator.tsx`（f52b190c6）；`App.tsx` 引入并用 `<BranchIndexingIndicator message={loadingMessage} />`；`Navigation.tsx`/`SideNavigation.tsx`/`Layout.tsx`/`source.css` 透传 `loadingMessage` 与扫光动画。 |
| **与当前定制代码的交集风险** | 低 → **已落地（2026-09-20，[BACK-668](/task/668)）**：fork 无 `BranchIndexingIndicator.tsx`（真空白），但已有等效 `loadingMessage` 管道；**真机实测**（源码服务 + headless Chrome，冷启动）确认进度帧在首次建 store 期间到达（页头显示「正在索引 3 个其他本地分支...」，宽 195px 未截断、未溢出页头），加载完成后指示器自动卸载、页面文本不再含该句；亮/暗两套配色与扫光动画均已在真机核过。 |
| **适合迁移的内容** | 新增 `BranchIndexingIndicator.tsx` 组件（自包含）+ `source.css` 的 `indexing-sweep` 动画；挂到 fork 现有 `loadingMessage`。**实测补齐（2026-09-20）**：两部分均整体落地——`source.css` 追加块与上游**字节一致**（blob 同为 `207bdc42f`，无 fork 分歧）；组件唯一分歧在可见文案（见下一行）。 |
| **需要排除/调整的内容** | 未覆盖 fork `Navigation`/`SideNavigation`/`Layout` 结构，只在 fork 已有透传点接线：`Layout.tsx` 下传 `loadingMessage` 给 `Navigation.tsx`，`SideNavigation.tsx` 移除该 prop 与其 3 处句子占位（改为纯骨架）。两处**不照搬上游**：①上游 chip 的可见标签是硬编码英文短标签 "Indexing branches"、真实进度句仅作 `title` + `sr-only` → fork 改为 **chip 直接显示 `translateLoadingMessage` 后的真实进度句**（复用既有 `loadingPhrases`，语言包零改动；长句 `max-w-[16rem] truncate`），保住 fork 原有「加载时看得见分支加载情况」的可读性；②`App.tsx` 的 `isLoading(true)` 门控——服务端进度帧目前只在初始建 store 时广播（`content-store.ts:604-612` 带 progressCallback，刷新路径 `:752` 不带），故 `hasLoadedDataRef` 属防御性守卫，由伪造帧的单测覆盖。 |
| **迁移优先级** | B类（评估合入）— 初判 A → 深度分析 B → **已落地（2026-09-20，[BACK-668](/task/668)）**：fork 已有 `loadingMessage` 管道，新增指示组件为增量增强，低风险。 |
| **迁移建议** | ①直接复用 / ②参考重写，**实现按 fork 自定（2026-09-20）**：新增 `BranchIndexingIndicator.tsx` 并接入 fork `App.tsx` 的 `loadingMessage`，不改现有结构；chip 文案走 `translateLoadingMessage` 显示真实进度句，延迟出现/淡出参数保留为 props（默认 250ms/200ms）。 |

---

## WEB-13：BACK-655 Open task details in place from sidebar dependency chips

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 任务弹窗内依赖 chip 点击原地打开对应任务详情。 |
| **变更内容摘要** | `DependencyInput.tsx`（2bfee3701）：chip 加 `onClick` 调 `onNavigateToTask`，带 `data-dependency-id`。 |
| **与当前定制代码的交集风险** | 低 — fork 已具备该能力：`DependencyInput.tsx:134` `onClick={onTaskClick ? (e)=>{e.preventDefault(); onTaskClick(dependency.id);} : undefined}`，且 `TaskDetailsModal.tsx:1768` 传 `onTaskClick={(taskId)=>{...}}`（接 `handleTaskClick`，:364，导航打开弹窗）。 |
| **适合迁移的内容** | 上游的 `data-dependency-id` 属性可作可访问性补充。 |
| **需要排除/调整的内容** | 排除对 `DependencyInput` chip 点击逻辑的覆盖（fork 用 `onTaskClick` 已实现同等行为），避免重复绑定。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 C：依赖 chip 原地跳转 fork 已实现。 |
| **迁移建议** | ③忽略（可选：给 fork chip 加 `data-dependency-id` 便于测试，无行为变化）。 |

---

## WEB-14：BACK-665 Polish the web UI initial loading state

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 看板首屏加载用骨架占位（ghost 列），避免内容跳动。 |
| **变更内容摘要** | 新增 `src/web/components/BoardLoadingSkeleton.tsx`（65e9371c5；bd1be48ab 再按配置状态数定列）：按配置状态数渲染 ghost 列 + 居中圆环；`Board.tsx` 首屏改用骨架；`App.tsx` 初始化前屏幕换成共享 `LoadingSpinner` 圆环；`LoadingSpinner.tsx` 补 `motion-reduce:animate-none`。 |
| **与当前定制代码的交集风险** | 低 → **已落地（2026-09-20，[BACK-669](/task/669)）**：fork 首屏分支为自绘灰面板（dead `rounded-full` 方块 spinner + 3 个 `h-24` 灰块，与真实列几何不符），无 `BoardLoadingSkeleton`；**真机实测**（源码服务 + headless Chrome 冷启动，`/api/status`+`/api/search` 用 Fetch 域扣住以逐态抓取）：加载路径 0 处 `rounded-full`、圆环 `border-radius: 9999px`、ghost 列自 x=336 起、宽 333、高 96（= 真实空列 `min-h-24` 地板），未触碰自研泳道网格分支。 |
| **适合迁移的内容** | 新增 `BoardLoadingSkeleton.tsx` 并把 fork `Board.tsx` 的 `isLoading` 分支换成骨架；`App.tsx` 初始化前屏幕用共享 `LoadingSpinner`；`LoadingSpinner.tsx` 加 `motion-reduce:animate-none`。**实测补齐（2026-09-20）**：三处均落地；ghost 列类名与 fork 默认（无泳道）列布局逐字一致（`overflow-x-auto > flex flex-row flex-nowrap gap-4` + 每列 `flex-1 min-w-[16rem]`，卡片 `rounded-lg p-4 min-h-24`）。 |
| **需要排除/调整的内容** | 排除对 fork 列布局（泳道网格分支）的覆盖，仅替换 `isLoading` 渲染内容；`columnCount` 用 fork 配置状态数（`statuses.length`），状态未知时 3 列兜底。**fork 分歧（2026-09-20）**：骨架不带 `message`、不渲染进度句——BACK-668 起页头 chip 已是唯一进度句来源，避免同屏重复；`aria-label`/`sr-only` 走 i18n `t.board.loading`、初始化前屏幕用 `t.nav.projectLoading`（上游为硬编码英文）；顺带删掉 BACK-668 遗留的 `loadingMessage` 死 prop（Board/BoardPage）与 `translateLoadingMessage`/`locale` 残留。 |
| **迁移优先级** | B类（评估合入）— 初判 A → 深度分析 B → **已落地（2026-09-20，[BACK-669](/task/669)）**：首屏骨架为体验增强，低风险、自包含。 |
| **迁移建议** | ①直接复用 / ②参考重写，**实现按 fork 自定（2026-09-20）**：新增 `BoardLoadingSkeleton.tsx` 并把 fork `Board.tsx` 首屏分支换成骨架（列数走 fork 配置状态数），`App.tsx` 初始化前屏幕换共享圆环；6 条新用例 + BoardPage/深链用例更新，7 项回退探针全红，亮/暗两色真机截图通过。**后续修正（2026-09-20）**：[BACK-670](/task/670) 移除本条目引入的 `motion-reduce` 抑制，reduce 主机（RDP/VM）上圆环/骨架/扫光恢复动效。 |

---

## WEB-15：BACK-677 Show local time in the web UI with the UTC value on hover

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | Web 日期以本地时区显示，悬停（title）展示存储的 UTC 值。 |
| **变更内容摘要** | `date-display.ts`（bbcc5bc0f）：`getStoredDateDisplay` 返回 `{text, title}`，text 本地渲染、title 为规范 UTC；新增 `StoredDate.tsx` 组件；多个组件（CleanupModal/DecisionDetail/DocumentationDetail/DraftsList/MilestonesPage/Statistics/TaskCard/TaskDetailsModal/TaskList）改用 `StoredDate`。 |
| **与当前定制代码的交集风险** | 低 — 排除清单 §2 规定 fork「存储 UTC、展示本地时区」，方向一致。**fork 已自行实现本地显示**：`date-display.ts` 的 `formatStoredUtcDateForDisplay` 用 `parseStoredUtcDate` 后 `toLocaleString`（date-time）/`toLocaleDateString`（date-only），即本地时区渲染。fork 仅**缺少悬停 UTC 的 `title`** 与 `StoredDate.tsx` 封装。 |
| **适合迁移的内容** | ① 在 fork 各日期展示处补 `title={utcValue}`（悬停显示 UTC）；② 可选新增 `StoredDate` 封装组件统一行为。 |
| **需要排除/调整的内容** | 排除清单 §2：不要替换 fork `date-display.ts`（其另有 `formatStoredUtcDateForCompactDisplay`/`storedUtcToDateTimeLocal` 等被 fork 多处使用），也不要改回 UTC 显示；保留 fork 的 `date-utc.ts`（`parseStoredUtcDate`/`localDateTimeToStoredUtc`）工具链。 |
| **迁移优先级** | B类（评估合入）— 初判 A → 深度分析 B：本地显示核心已覆盖，仅悬停 UTC 为增量，须复用 fork 现有工具不回退。 |
| **迁移建议** | ②参考重写：在 fork 现有 `formatStoredUtcDateForDisplay` 返回处追加 UTC `title`，或新增薄 `StoredDate` 包装；复用 fork `parseStoredUtcDate`，不引入上游新 `date-display.ts` 逻辑。 |

---

## WEB-16：BACK-684 Move the acceptance-criteria ring into the web card header

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 把卡片上的 AC 进度环移入卡片头部行，缩短卡片高度。 |
| **变更内容摘要** | `TaskCard.tsx`（97c45b75c）：`priorityBadge` 提前；头部右侧 `flex shrink-0 items-center gap-2` 渲染 `AcceptanceCriteriaProgress density="card"` + 优先级徽章；删除标题下的独立进度行；引用 `ProjectBadge project={task.project}`。 |
| **与当前定制代码的交集风险** | 低 — fork **已在卡片头部渲染 AC 进度**：`TaskCard.tsx:242-246` 头部行含 `<AcceptanceCriteriaProgress task={task} variant="bar" className="flex-1 min-w-[2.5rem]" />`（同排还有计划日期与优先级徽章）。上游目标已达成。注意上游引用 `task.project`/`ProjectBadge`，fork **无 `project` 属性**（基线缺失），该部分不可移植。 |
| **适合迁移的内容** | 上游的「无进度且无优先级时不渲染右侧组」的空态优化可参考；fork 头部已含计划日期，结构更丰富。 |
| **需要排除/调整的内容** | 排除 `ProjectBadge project={task.project}` 相关（fork 无 project 字段，排除清单未列但属字段缺失，勿强行引入）；排除替换 fork 卡片头部布局（fork 自研且已含 AC 进度）。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 C：AC 进度已在卡片头部，能力已实现；`task.project` 部分 fork 无对应字段。 |
| **迁移建议** | ③忽略（可选：吸收上游空态优化，去掉 fork 无进度时的空占位）。 |

---

## WEB-17：BACK-668 Replace dead rounded-full classes across the web UI

> draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 全站把失效的 Tailwind `rounded-full` 类替换为 `rounded-circle`（上游自定义别名）。 |
| **变更内容摘要** | 本范围无上游代码提交（worklist `commits: []` 为空，仅为任务记录）。上游实现是把 `rounded-full` 批量改为 `rounded-circle`，属纯 CSS 类名重命名，无功能变化（上游组件如 `BranchIndexingIndicator` 已用 `rounded-circle`）。 |
| **与当前定制代码的交集风险** | 低 — 纯样式类名；fork 若用 `rounded-full` 仍由 Tailwind 默认生效，无行为影响。 |
| **适合迁移的内容** | 无代码可摘樱桃；如后续统一风格可批量替换，但非必需。 |
| **需要排除/调整的内容** | 无上游代码可迁移；若执行，仅限类名替换，不触碰逻辑。 |
| **迁移优先级** | C类（跳过）— 记录类无代码，纯 cosmetic。 |
| **迁移建议** | ③忽略（后续若做样式统一，可单独批量 rename，不属本轮迁移）。 |

*draft 不导入，C 类。*

---

## WEB-18：BACK-681 Show due dates on the surfaces that omit them

> draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在遗漏 due date 的界面上补显示任务截止日期。 |
| **变更内容摘要** | 本范围无上游代码提交（worklist `commits: []` 为空，仅为任务记录）。上游实现是在若干组件补 `dueDate` 展示，涉及日期字段体系。 |
| **与当前定制代码的交集风险** | 中 — fork 已有自研日期体系：date-only `dueDate`、UTC `actualStart/actualEnd`，且卡片头部已显示计划日期（`TaskCard.tsx:250` `formatPlannedRange`）。若补 due date 须对齐排除清单 §2 的 date-only 语义与空串清除，避免回退。 |
| **适合迁移的内容** | 无直接代码可摘樱桃；若后续实现，应在 fork 已遗漏 due date 的表面补 `dueDate` 展示，复用 fork `date-display.ts`。 |
| **需要排除/调整的内容** | 排除清单 §2：不得改日期存储/显示语义；若实现须沿用 fork `formatStoredUtcDateForDisplay` 与空串 `""` 清除约定，不引入上游 UTC 显示。 |
| **迁移优先级** | B类（评估）— 记录类无代码，但方向可取；须在 fork 日期体系内参考重写，勿回退。 |
| **迁移建议** | ③忽略本轮（无代码）；如后续做，按排除清单 §2 在 fork 遗漏面补 `dueDate`，参考重写而非复用上游实现。 |

---

## 重分类与关键发现汇总

- 初判 → 深度分析重分类：WEB-1 A→C、WEB-2 A→B、WEB-3 A→C、WEB-4 A→C、WEB-5 A→B→已满足、WEB-6 A→B→已落地（[BACK-666](/task/666)）、WEB-7 A→A（确认缺陷存在）、TUI-1 A→B（与 TUI-7/TUI-9 合并为 [BACK-675](/task/675)）、WEB-8 A→C→B（2026-09-23 域修正：实为 TUI 项，改列 TUI-14，已建 [BACK-694](/task/694)）、WEB-10 A→B→C（定案不升级）、WEB-11 A→A→已落地（[BACK-698](/task/698)）、WEB-12 A→B→已落地（[BACK-668](/task/668)）、WEB-13 A→C、WEB-14 A→B→已落地（[BACK-669](/task/669)）、WEB-15 A→B、WEB-16 A→C、WEB-19 A→C。
- 最关键的冲突/空白：WEB-7 草稿保存缺陷 fork 确实存在（`api.ts:updateTask` 直 PUT `/api/tasks/DRAFT-x` 未路由，server `handleUpdateTask` 调 `updateTaskFromInput` 而非 `editTaskOrDraft`），但 fork 已具备 `core/editTaskOrDraft`（backlog.ts:2391），改动小；WEB-9 多选批量移动是净真空白（fork 无选区/无 `/api/tasks/move`/无 `moveTasksToStatus`，但 `lanes.ts:205` 已有 `sortTasksForStatus` 可复用）；WEB-11 增量刷新是真实性能债（fork `App.tsx:709-713` 仍全量 `loadAllData`）。
- 已被 fork 覆盖（C 类）：WEB-1（自研 TaskHierarchySection）、WEB-3（多选状态 string[] + StatusFilterDropdown）、WEB-4（AC 进度已展示）、WEB-10（卡片与列表均已是自研 bar，定案不升级）、WEB-13（onTaskClick chip 导航）、WEB-16（AC 进度已在卡片头部）、WEB-19（自研 SearchDialog 无 score 截断）。
- BACK-677（WEB-15）：**已被 fork 覆盖核心**——`date-display.ts` 的 `formatStoredUtcDateForDisplay` 已用 `toLocaleString`/`toLocaleDateString` 做本地时区渲染（排除清单 §2 方向一致），仅缺悬停 UTC 的 `title` 与 `StoredDate` 封装，故降为 B 类增量。
- 0c7d04f8a 核实：**不属于 BACK-644**——它是 BACK-222.1 层级切片导致的 Web 弹窗无限重渲染修复（提模块级 `EMPTY_STATUSES`/`EMPTY_TASKS`），与 TUI 看板弹窗同步（BACK-644 实指 `src/ui/board.ts`）无关，建议另行评估而非并入 WEB-8。**域修正（2026-09-23）**：WEB-8 本身也确认为 TUI 项（fork 同文件同缺陷，探针 `tmp/probe-board-popup-stale.ts` 复现），已由 C 回 B 并改列 TUI-14。
- WEB-17/WEB-18 为记录类（无上游代码），分别判 C（纯样式）/ B（方向可取但需参考重写，受排除清单 §2 约束）。

*draft 不导入，C 类。*

---

## WEB-19：Sidebar quick search hides real matches on larger projects

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 ⌘K 侧栏快捷搜索在大项目中因客户端 `score <= 0.45` 硬截断而隐藏真实匹配。 |
| **变更内容摘要** | `src/web/components/SideNavigation.tsx`（ea3ff204c）：删除 `result.score <= 0.45` 过滤，仅保留 `sort`+`slice(0,5)`（服务端 Fuse `threshold:0.35` 已是相关性闸门）。 |
| **与当前定制代码的交集风险** | 低 — **fork 无该缺陷**：fork `SideNavigation.tsx` 无 `score <= 0.45` 过滤（grep 仅命中无关 `slice`），搜索走自研 `src/web/components/search/SearchDialog.tsx` + `src/web/utils/search-results.ts`，后者只过滤高亮 match range（`search-results.ts:114`），无绝对分数截断。 |
| **适合迁移的内容** | 无（fork 搜索架构不同，且已无该截断）。 |
| **需要排除/调整的内容** | 排除把上游 `SideNavigation.tsx` 片段套用到 fork（fork 用 `SearchDialog`，不在此处做 score 过滤）；勿在 fork `search-results.ts` 引入绝对截断。 |
| **迁移优先级** | C类（跳过）— 初判 A → 深度分析 C：缺陷在 fork 自研搜索中不存在。 |
| **迁移建议** | ③忽略。 |

---

# 四、Server / MCP / 输出格式

## SRV-1：BACK-622 Return acceptance criteria progress in task JSON outputs

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在规范化任务 JSON 摘要（list / search / view）中补充 AC 完成度计数 `acceptanceCriteriaCompleted` / `acceptanceCriteriaCount`，无 AC 时两者为 0/0。 |
| **变更内容摘要** | 上游 `923e34900` 仅改 3 个文件：`src/formatters/json-output.ts`（类型 `TaskSummaryJson` 新增两字段，行 14-15；`toTaskSummaryJson` 取 `task.acceptanceCriteriaItems` 并 `.filter(c => c.checked).length` 计数，行 95、107-108）、`src/test/cli-json-output.test.ts`（新增断言与完整/部分/空三态用例）、`CLI-INSTRUCTIONS.md`（契约文档）。 |
| **与当前定制代码的交集风险** | 低 — fork 的 `src/formatters/json-output.ts:16-17` 已声明 `acceptanceCriteriaCompleted: number` / `acceptanceCriteriaCount: number`，`:107-108` 已用 `task.acceptanceCriteriaItems.filter((c) => c.checked).length` 计算，与上游逐字一致；fork 的 AC 字段名正是 `acceptanceCriteriaItems`（与上游相同），JSON 键无需重命名映射。 |
| **适合迁移的内容** | 无增量代码：fork 已实现全部逻辑。如需对齐契约，可同步 `CLI-INSTRUCTIONS.md`（视 fork 是否维护该文档）。 |
| **需要排除/调整的内容** | 无排除；如需补测，参考上游 `cli-json-output.test.ts` 的完整/部分/空三态断言（fork 测试文件可能缺此覆盖）。 |
| **迁移优先级** | 初判 AB → 深度分析 C类（fork 已含该实现，本轮净零增量；draft 不导入）。 |
| **迁移建议** | ③忽略 — 代码已存在，无需改动；仅核对 fork 测试是否覆盖完整/部分/空三态。 |

---

## SRV-2：BACK-642 Show acceptance criteria progress in MCP and plain task lists

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 在剩余两个列表界面（MCP `task_list` 摘要行、`task list --plain`）补上 ` (ac: checked/total)` 后缀，与已上线的 JSON 输出对齐。 |
| **变更内容摘要** | 上游 `5d727d61b`：`src/ui/acceptance-criteria-progress.ts` 新增导出 `formatAcceptanceCriteriaSummarySuffix`（有 AC 返回 ` (ac: n/total)`，否则空串）；`src/cli.ts` 的 `formatPlainTaskListRow` 追加该后缀；`src/mcp/tools/tasks/handlers.ts` 的 `formatTaskSummaryLine` 追加该后缀。共享提交 `060aafdc6` 仅新增 backlog 任务记录（文档，不迁移）。 |
| **与当前定制代码的交集风险** | 中 — fork 已有 `src/ui/acceptance-criteria-progress.ts`（含 `formatAcceptanceCriteriaProgress`，行 13）但**无** `formatAcceptanceCriteriaSummarySuffix`；fork 的 MCP `formatTaskSummaryLine` 在 `src/mcp/tools/tasks/handlers.ts:92-97`（无 `projectIndicator`、无 AC 后缀）；fork 的 `task list --plain` 不走 `formatPlainTaskListRow`，而是 `src/cli.ts:2596` 与 `:2628` 两处内联行构建器（亦无 AC 后缀、无 `typeIndicator` / `dueDate`）。 |
| **适合迁移的内容** | ① 将 `formatAcceptanceCriteriaSummarySuffix` 原样加入 fork `src/ui/acceptance-criteria-progress.ts`；② 在 `handlers.ts:96` 返回串插入 `${acceptanceCriteria}`；③ 在 `cli.ts:2596` 与 `:2628` 两处行构建器插入 `${acceptanceCriteria}`。 |
| **需要排除/调整的内容** | 排除上游 MCP 改动中的 `projectIndicator` 一行（`[${task.project}]`）— 基线明确 fork 缺失 `task.project` 属性；fork `formatTaskSummaryLine` 无该行，故仅加 AC 后缀、切勿引入 `project`。CLI 部分因 fork 无 `formatPlainTaskListRow` 也无 `dueDate` 渲染，须**参考重写**到 `cli.ts:2596` / `:2628`，不可用上游 diff 直贴。 |
| **迁移优先级** | B类（必须合入）— 与初判 AB 一致；fork 当前 MCP / `--plain` 列表隐藏 AC 完成度，与已上线的 JSON 输出（SRV-1）不一致，应闭合该缺口。 （口径校正：AC 完成度展示属输出增强，由 A 类归入 B 类评估。） |
| **迁移建议** | ②参考重写 — 共享 helper 直接复用，两处集成点按 fork 实际行构建器改写（排除 project）。 |

---

## SRV-3：BACK-641 Add `backlog task dependencies` command with TUI and plain graph views

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 新增独立命令 `backlog task dependencies`（含交互 TUI 与 `--plain` / `--json` 视图），复用 BACK-548 的 `dependencyGraph` 派生图。 |
| **变更内容摘要** | 上游 `a44cec83f`（主，+766/−65）改 `src/cli.ts`、`src/formatters/dependency-graph-text.ts`、`src/formatters/json-output.ts`（新增 `toDependencyGraphJson` 与 `taskDependenciesJson`）、`src/formatters/task-plain-text.ts`、`src/mcp/tools/tasks/{handlers,index,schemas}.ts`、`src/ui/dependencies-tui.ts`（新 220 行）、`src/ui/task-viewer-with-search.ts`、`src/test/cli-task-dependencies.test.ts`（新 302 行）及多份 guidelines；`389657cb3` / `2439bb0bb` 仅改 backlog 任务文档状态。 |
| **与当前定制代码的交集风险** | 低（净零）— fork 既无 `src/ui/dependencies-tui.ts`、无 `src/formatters/dependency-graph-text.ts`（`ls` 确认），`src/cli.ts` 与 `src/mcp/tools/tasks/` 中亦无 `dependencies` / `dependencyGraph` 命令或属性（grep 无命中）；基线确认 fork 缺失 `dependencyGraph`。该命令依赖的 `task.dependencyGraph` 在 fork 不存在，无法直贴。 |
| **适合迁移的内容** | 无 — 功能与依赖图基础设施均不在 fork，本轮不应引入。 |
| **需要排除/调整的内容** | 整条排除。注意 `a44cec83f` 在 `json-output.ts` 新增的 `toDependencyGraphJson` 属 BACK-548 共享图工具，但 fork 无 `DependencyGraph` 类型与 `task.dependencyGraph`，故连带不可用；不应为迁移本命令而在 fork 补建 dependencyGraph 基础设施。 |
| **迁移优先级** | 初判 C → 深度分析 C类（draft 不导入，与 SRV-4 互相抵消，净零）。 |
| **迁移建议** | ③忽略 — 见 SRV-4 净零说明。 |

*draft 不导入，C 类。*

---

## SRV-4：BACK-670 Remove the standalone task dependencies command and its TUI

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 撤销 BACK-641 的独立 `task dependencies` 命令与 TUI；依赖图仍由各 surface（`task view` / `--plain` / `--json` / web / MCP `task_view`）渲染。 |
| **变更内容摘要** | 上游 `b2616cabc`（−654/+99）：删除 `src/ui/dependencies-tui.ts`、`taskDependenciesJson`（`json-output.ts`）、`formatTaskDependenciesPlainText`（`task-plain-text.ts`）、`task_dependencies` MCP 工具（handlers/index/schemas）、cli 命令与 help schema、4 处 guidelines、`cli-task-dependencies.test.ts`；保留 `toDependencyGraphJson`（仍被 `task view` 详情使用，属 BACK-548）。`207e38ac7` 仅改文档状态。 |
| **与当前定制代码的交集风险** | 低（净零）— fork 从未拥有该命令 / 文件（无 `dependencies-tui.ts`、无 `task_dependencies`、无 `taskDependenciesJson`），撤销目标在 fork 不存在；`json-output.ts` 的 `toDependencyGraphJson` 在 fork 同样不存在（fork 无 `dependencyGraph`）。 |
| **适合迁移的内容** | 无。 |
| **需要排除/调整的内容** | 整条排除。已核实 BACK-670 对 `json-output.ts` 仅删除 `taskDependenciesJson`（−9 行），而 BACK-641 加入的 `toDependencyGraphJson`（+6 行）被**有意保留**（属 BACK-548 共享图工具，仍服务 `task view` 详情），故撤销对「独立命令」完整且自洽，无残留需升级判定。 |
| **迁移优先级** | 初判 C → 深度分析 C类（draft 不导入）；与 SRV-3 净零成立。 |
| **迁移建议** | ③忽略 — BACK-641 / BACK-670 在本范围内净零，fork 本来就无此命令，两条均跳过。 |

*draft 不导入，C 类。*

---

# 五、Infra / CI / 测试

## INF-1：BACK-667 Fix the flaky browser corpus loading-progress test

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | 修复 `src/test/server-loading-progress.test.ts` 中「distinct failure and retries shared initialization」用例的竞态飘移（socket 与 fetch 抢占共享初始化，偶发 500 变 200）。 |
| **变更内容摘要** | 上游 `3672be65f` 仅改测试文件：在 flaky 用例中加入 `firstLoadStarted` / `heldFailure` 两个门控 Promise，使 fetch 成为唯一初始化触发、等待 `firstLoadStarted` 后再开 socket、确认收到初始 loading 态后释放失败；另更新 backlog 任务文档。 |
| **与当前定制代码的交集风险** | 中 — fork 确有 `src/test/server-loading-progress.test.ts`（99 行，Aug 28），且 `src/server/index.ts:179` / `:203` / `:660` 仍存在 `servicesReadyPromise` / `ensureServicesReady`（WebSocket open 调用），即上游所述竞态结构在 fork 服务端保留；但 fork 测试文件**不含**被修复的那个用例（仅有 `sends a loading state then a loaded state` 与 `retains the latest loading state for a late connection` 两个用例，无 failure/retry 用例）。 |
| **适合迁移的内容** | 若 fork 后续补回 failure/retry 用例，应连同此门控修复一起移植；否则本轮无直接代码可贴。 |
| **需要排除/调整的内容** | 上游 patch 针对的 `it("publishes a distinct failure and retries...")` 在 fork 测试文件中不存在（已逐行确认仅 99 行）。直贴 patch 会失败；须先确认 fork 是否需要该用例。 |
| **迁移优先级** | 初判 AB → 深度分析 C类（目标用例在 fork 缺失，无适用代码；draft 不导入）。 |
| **迁移建议** | ③忽略（本轮）— 提示：fork 服务端竞态结构仍在，若补等价用例须带此修复，避免重蹈飘移。 |

---

## INF-2：Add biome check to CI and fix task-composer formatting drift

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | CI 全量 profile 由 `bun run lint` 改为 `bun run check`（同时做 biome lint + format，杜绝格式漂移静默合入）；顺带修正 `task-composer.ts` 一处换行格式漂移。 |
| **变更内容摘要** | 上游 `38eabc1f6` 改两文件：`.github/workflows/ci.yml`（行 52-55，`full` profile 下 `bun run lint` → `bun run check`）；`src/ui/components/task-composer.ts`（行 211-217，将 5 行竖式算术折叠为 1 行）。 |
| **与当前定制代码的交集风险** | 中 — fork `.github/workflows/ci.yml:37` 仍为 `bun run lint`（无上游的 `matrix.test_profile == 'full'` 门控，fork 该步无条件执行）；fork `src/ui/components/task-composer.ts` 确有 `getTaskComposerLayout`（:108）但签名 / 实现已定制，grep 无 `expandedContentHeight` / `TEXT_INPUT_HEIGHT` 等上游变量，即格式漂移块在 fork 不存在。 |
| **适合迁移的内容** | CI 部分适用：将 fork `ci.yml:37` 的 `bun run lint` 改为 `bun run check`（fork `package.json:59` 已有 `check: "biome check ."`，可直接替换）。 |
| **需要排除/调整的内容** | ① `task-composer.ts` 的格式漂移修复在 fork 不适用（fork 该函数已重写，无对应 5 行块），跳过；② CI 改动须适配 fork 结构 — 上游在 `if: matrix.test_profile == 'full'` 块内，fork 该步无 profile 门控，应直接改 `:37` 这一行，而非照抄上游 diff 上下文。 |
| **迁移优先级** | 初判 AB → 深度分析 B类（评估合入）— CI 步骤建议合入，task-composer 部分跳过。 |
| **迁移建议** | ②参考重写 — CI 行直接改 `lint` → `check`；task-composer 不迁移（fork 已自定）。 |

---

## INF-3：Refresh stale hardcoded dates and MCP test teardown

draft 不导入，C 类

| 分析维度 | 内容 |
|----------|------|
| **任务核心目的** | `6c6f1843d` 将 `core.test.ts` 中过期硬编码提交日期（2026-07-30T18:0xZ，超出 30 天 activeBranchDays 窗口）改为相对当前运行时间；`af42e9e46` 在 MCP `task_search` 的 cross-branch tripwire 前先 `disposeContentStore()`，避免 macOS fs-watcher 重命名调和在窗口内误触 spy（飘移）。 |
| **变更内容摘要** | 上游 `6c6f1843d` 改 `src/test/core.test.ts`（新增 `recentCommitDate(minutesAgo)` helper，6 处绝对日期改相对）；`af42e9e46` 改 `src/test/mcp-tasks.test.ts`（在 `installCrossBranchTripwires` 前加 `mcpServer.disposeContentStore()`）。 |
| **与当前定制代码的交集风险** | 低（无适用代码）— fork `src/test/core.test.ts`（Sep 8，25049 字节）与 `src/test/mcp-tasks.test.ts`（Sep 8，36282 字节）均**不含**上游目标代码：grep 在 `core.test.ts` 无 `2026-07-30` / `recentCommitDate` / `activeBranchDays` / `GIT_AUTHOR_DATE`；在 `mcp-tasks.test.ts` 无 `installCrossBranchTripwires` / `disposeContentStore` / `ContentStore`。fork 测试套件已显著分叉。 |
| **适合迁移的内容** | 无 — 目标测试逻辑在 fork 不存在，无补丁可贴。 |
| **需要排除/调整的内容** | 整条排除。附：因 fork `core.test.ts` 未使用绝对日期（grep 无 `2026-` 字面量），故不存在上游式的「过期日期致测试确定性失败」风险；fork 无需为此改动。 |
| **迁移优先级** | 初判 C → 深度分析 C类（draft 不导入；fork 测试结构不适用，无过期日期风险）。 |
| **迁移建议** | ③忽略 — 本轮无适用代码。 |

*draft 不导入，C 类。*

---
