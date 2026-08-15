---
id: doc-8
title: v1.48.0 至 v1.49.3 上游任务迁移分析报告（按领域）
type: guide
created_date: '2026-08-11 23:30'
updated_date: '2026-08-11 23:30'
---
# 上游任务迁移分析报告（v1.48.0 .. v1.49.3，按领域）

本报告对应 `doc-7` 中全部 A 类与 B 类条目，逐项分析上游任务核心目的、变更内容、与当前 fork 的交集风险、适合迁移的部分、需要调整/排除的部分、迁移优先级与建议。原始任务文件已作为 draft 导入 `backlog/drafts/`，通过 `DRAFT#N` 链接可查看（`/draft/N` 在 Web UI 直接打开预览）。

> 分析前提：当前 fork 已演进的能力以 `references/current-branch-migration-exclusions.md` 为准；分析以当前工作分支 `1.49`（fork 版本 `1.48.0-CN`）代码状态为基线。上游 commit 引用 `v1.48.0..v1.49.3` 范围内的 merge commit。

## 分析方法说明

每项按以下维度给出结论：

| 维度 | 说明 |
|------|------|
| 任务核心目的 | 上游任务要解决的问题/提供的功能（一句话） |
| 变更内容摘要 | 上游 merge commit 实际改动的文件与逻辑 |
| 与当前定制代码的交集风险 | 高 / 中 / 低 + 理由 |
| 适合迁移的内容 | 可复用的具体逻辑/修复 |
| 需要排除/调整的内容 | 不应照搬的部分（含排除清单条目） |
| 迁移优先级 | A（必须合入）/ B（评估合入）/ C（跳过） |
| 迁移建议 | ①直接复用 / ②参考重写 / ③忽略 |

---

# 一、CLI / Core

## CLI-1：BACK-545 为只读命令添加稳定 JSON 输出（draft-82）

**任务核心目的**：为 `task list / view / 简写 / search` 提供版本化稳定 `--json` 输出，与 `--plain`/TUI 并存，JSON 只写 stdout、错误写 stderr、冲突模式报错。

**变更内容摘要**（merge `22a091b`，8 文件 +749/-33）：
- 新增 `src/formatters/json-output.ts`（202 行）：`{ schemaVersion: 1, kind }` 契约、`TaskSummaryJson`/`TaskDetailsJson`/`DocumentSummaryJson`/`DecisionSummaryJson`、`nullable()`（undefined→null）、`normalizePublicDate()`（ISO 规范化）、`toProjectRelativePath()`、`printJson()`。
- 新增 `src/utils/read-output-mode.ts`（16 行）：`resolveReadOutputMode(options, hasInteractiveTTY)` → json/plain/interactive，冲突抛错。
- `src/cli.ts` +111：search/list/view/简写四处接入；`preSubcommand` 钩子拒绝非 list/view 子命令用 `--json`；view/简写未找到任务时 exit code 1。
- 测试 `cli-json-output.test.ts`（311 行）+ `read-output-mode.test.ts`；文档 CLI-INSTRUCTIONS/README/agent-guidelines。

**与当前定制代码的交集风险：中**。主改动在 fork 既有读取路径（fork `hasInteractiveTTY`/`shouldAutoPlain`/`isPlainRequested` 与上游同构）；但 fork 无 `printDuplicateIntegrityWarning`、`SearchResult` 含 wiki 类型、Task 无 `type` 字段且多出 fork 日期字段，三处需改写。`normalizePublicDate` 输出 ISO Z 与 fork「存储 UTC」策略一致，不违反排除清单第 2 条（JSON 是存储层机器契约）。

**适合迁移的内容**：`read-output-mode.ts` 整体；`json-output.ts` 契约骨架（nullable/toProjectRelativePath/normalizePublicDate/printJson 可逐字复制）；cli.ts 的 `getReadOutputMode()` 分支模式；测试思路。

**需要排除/调整的内容**：删 `hasDuplicateIds` 分支（fork 无该函数）；删 `task.type` 键（fork Task 无 type）；补 wiki 搜索分支（fork SearchResult 联合含 wiki）；增补 fork 日期键（dueDate/plannedStart/plannedEnd/actualStart/actualEnd）。

**迁移优先级：A**。agent/自动化价值高、改动纯增量、冲突点明确且少。

**迁移建议：②参考重写**（契约框架①直接复用，序列化函数与四处 action 按 fork 改写）。

---

## CLI-2：BACK-557 同路径跨分支任务版本统一身份（draft-83）

**任务核心目的**：相同规范化 ID + 归一化逻辑路径的跨分支记录视为同一任务的多版本：工作副本权威、歧义 fail-closed、身份索引统一驱动加载/生命周期/ID 占用。

**变更内容摘要**（merge `928d85c`，12 文件 +1312/-503）：
- 新增 `src/core/task-identity-index.ts`（232 行）：`TaskIdentityIndex`，canonicalTaskId + normalizeRecordPath 分组；确定性选择（工作副本优先→most_recent/most_progressed）；歧义 fail-closed；getTasks/getOccupiedIds/resolve。
- `task-loader.ts` +206：logicalTaskPath/chooseIdentityHydrationCandidates 按「ID+逻辑路径」挑选 hydration 赢家。
- `backlog.ts` +455：删除 buildLatestStateMap/filterTasksByStateSnapshots 等；getTask 走 identityIndex.resolve；loadLocalTaskForMutation 拒绝分支任务；activeBranchFingerprint 刷新。
- server `handleGetTask` 收敛为 core.getTask，歧义 409。

**与当前定制代码的交集风险：高**。fork 身份合并为 ID-keyed Map + resolveTaskConflict（backlog.ts:2975-3163）+ buildLatestStateMap，且 fork 独有 `cross-branch-tasks.ts:28 getLatestTaskStatesForIds`（仅近 30 天分支）驱动 TUI 看板过滤；依赖 `task-id.ts`（canonicalTaskId）前置；UTC 日期解析须用 fork `getStoredUtcTimestamp` 而非 `new Date()`。

**适合迁移的内容**：task-loader 身份化增量（fork 与上游 pre-B3 结构同构）；TaskIdentityIndex 类设计（参考重写）；getOccupiedIds 修复「相同时间戳扫描顺序释放 live ID」竞态；loadLocalTaskForMutation 语义（与 fork 跨分支只读一致）；歧义 409。

**需要排除/调整的内容**：不得删 fork `getLatestTaskStatesForIds`/`filterTasksByLatestState`（board-loading.test.ts 等断言依赖）；保留 recentBranchesOnly/activeBranchDays 语义；lastModified 用 fork 解析器；server handleGetTask 双写逻辑按 B3 后形态重写。

**迁移优先级：A**（1.49 身份基石，B4 及后续建立其上；工作量大，独立大阶段，排 B5/B6 之后）。

**迁移建议：②参考重写**（保留 fork cross-branch-tasks.ts 数据流，用 TaskIdentityIndex 思路替换 ID-keyed 合并）。

---

## CLI-3：BACK-563 将 autoCommit 精确限定到写入文件（draft-85）

**任务核心目的**：autoCommit 仅暂存每次写入触碰的文件（新建+被替换/移动的旧路径），不 stageBacklogDirectory 整目录暂存、不清空共享 index，保留用户无关的 staged/unstaged/untracked 工作。

**变更内容摘要**（merge `048ce6f`，15 文件 +859/-116）：
- `file-system/operations.ts`：archiveDraft 返回 {sourcePath,targetPath}；demoteTask 加 onMoved；saveDecision/saveDocument 返回 {filepath, removedFilepaths}。
- `backlog.ts` +120：updateTask 返回 filePath；updateTasksBulk 收集路径；archiveTask/completeTask 用 commitFiles([from,to])；新增 commitWrittenFile(message, previousPaths, newPath)；删除全部 stageBacklogDirectory 调用。
- `git/operations.ts` +69：commitFiles 多仓库拆分 + 临时 index CAS 管线（GIT_INDEX_FILE + commit-tree + update-ref + hooks + restoreIndexEntriesIfMatches）；删除 resetIndex/commitStagedChanges。

**与当前定制代码的交集风险：中**。fork 的 git/operations.ts:310-330 `addAndCommitTaskFile` 用 resetIndex（上游要消灭的缺陷）；fork 现无 getIndexEntries/hashFile/populateTemporaryIndex 等 CAS 管线函数（依赖 BACK-430）；fork 现有 8 处 stageBacklogDirectory（backlog.ts:2023/2064/2121/2461/2473/2485/2614/2675）正是缺口。

**适合迁移的内容**：commitWrittenFile 模式 + 8 处调用替换；fs 层返回 moved/removed 路径；updateTasksBulk 精确路径；agent-instructions 的 commitFiles(paths)；删除 resetIndex 顺带修复「提交清空用户暂存区」。

**需要排除/调整的内容**：CAS 管线依赖 BACK-430 前置移植；若不入范围，保留 fork commitFiles 的 `git commit -- <paths>` 语义，只替换 resetIndex；非 ASCII 文件名处理对照 fork getRelativePathForRepo 验证；milestone archive/rename 自动提交一并核对。

**迁移优先级：A**（独立性强、不依赖 B3/B4、直接消除整目录暂存污染用户工作区）。

**迁移建议：①直接复用（backlog/fs/agent-instructions 模式）+ ②参考重写（git 层视 BACK-430 范围）**。

---

## CLI-4：BACK-564 里程碑过滤按里程碑 ID 匹配（draft-86）

**任务核心目的**：任务列表里程碑过滤统一按 ID 查询解析（数字 ID、规范 m-N、大小写变体、标题），修复交互式带标点标题无法往返（issue #819）；CLI/交互/MCP 行为一致。

**变更内容摘要**（merge `2dcc901`，12 文件 +539/-108）：
- `milestone-filter.ts` +114：MilestoneFilterValueResolver（resolveExactId/resolveExactTitle/resolveId）+ createMilestoneFilterMatcher；normalize 字符类改 `\p{L}\p{N}`。
- `backlog.ts:429-436` applyTaskFilters 用 matcher，候选值取全量 tasks；task-search.ts 加 milestoneCandidates 参数。
- board.ts 删内联 map；task-viewer-with-search.ts 删重复 resolver；cli.ts 删预置块；MCP handlers Draft 路径同 matcher。

**与当前定制代码的交集风险：低**。fork 对应代码（milestone-filter.ts 全文件、applyTaskFilters、task-search、board.ts:273-292、task-viewer:51-80、cli.ts:2553-2562、mcp:179-184）与上游 pre-B6 逐字一致；fork 里程碑有 actual 字段但过滤仅用 id/title，无冲突。唯一适配点：fork `unified-view.ts:214/:382` 调用 buildTaskViewerMilestoneFilterModel 时只传 active 里程碑，需补 listArchivedMilestones。

**适合迁移的内容**：全部 12 文件核心改动可直接复用；applyTaskFilters 签名升级为 MilestoneFilterValueResolver。

**需要排除/调整的内容**：unified-view.ts 两处调用改传 `[active, ...archived]`；fork 无 --json，cli 预置块删除后 plain 行为由 matcher 统一保证，跑 cli-milestone-filter 验证；milestone-storage.ts 不动。

**迁移优先级：A**（小而完整、零外部依赖、直接修复 fork 现存问题）。

**迁移建议：①直接复用**。

---

## CLI-5：BACK-550 为 task edit 添加 --append-plan 选项（draft-93）

**任务核心目的**：为 `task edit` 增加可重复 `--append-plan <text>`，在 `--plan` 替换后追加实现计划，复用既有 appendImplementationPlan 管线。

**变更内容摘要**（merge `79daac5`，5 文件 +~280）：cli.ts 5 处（hasEditFieldFlags、addHelpSchema、.option、planAppendValues、editArgs.planAppend）+ 文档 task-execution.md + 测试 append-implementation-plan.test.ts（267 行）。

**与当前定制代码的交集风险：低**。fork 下游管线 100% 就绪：backlog.ts:1577（sanitizeAppendInput）/1653-1655（appendImplementationPlan）；task-edit-builder.ts:125-127（sanitizeAppend(args.planAppend)）；types/index.ts:159（appendImplementationPlan?）；cli.ts 已有同模式 `--append-notes`（:2678-2682）。

**适合迁移的内容**：上游 5 处 cli.ts hunk 逐字照搬（插入点按 fork 行号对齐）；文档片段；测试改写。

**需要排除/调整的内容**：append 值不经过 processCliEscapes（与 fork notesAppend 一致），勿加转义。

**迁移优先级：A**（管线就绪、零冲突、15 行接线闭环）。

**迁移建议：①直接复用**。

---

## CLI-6：BACK-355 为任务添加 type 字段（draft-80，pre-range 代码）

**任务核心目的**：为 Task 新增语义 `type`（bug/feature/enhancement/task/chore/docs/spike，config `types` 可配），端到端覆盖类型层/解析/CLI/过滤/UI。

**变更内容摘要**（代码已在 v1.48.0 树，非本范围合入；draft-80 及子任务 22-27 完整描述）：types/index.ts:68 Task.type + :304 BacklogConfig.types；constants DEFAULT_TASK_TYPES；utils/task-type-config.ts（91 行）；serializer.ts:68 frontmatter；backlog.ts:157/:419/:1499 过滤；search-service/task-search `--task-type`；cli create/edit/list `--type`。

**与当前定制代码的交集风险：中**。fork Task 无 type（types/index.ts:41-78）、无 DEFAULT_TASK_TYPES、无 task-type-config.ts；**CLI 命名冲突**：fork `search --type` 已用于实体类型过滤（cli.ts:1833），上游用 `--task-type` 区分，移植必须保留该命名。fork 搜索架构（search-service/queryTasks）结构不同，过滤链路须重写。

**适合迁移的内容**：task-type-config.ts 整套；DEFAULT_TASK_TYPES；类型层增量键；serializer frontmatter 片段；CLI 帮助/示例；task-plain-text.ts Type 行。

**需要排除/调整的内容**：搜索过滤链路不可直接搬（按 fork 架构适配）；保留 `--task-type` 命名；不照搬 fork priority 的收紧模式（type 用宽松字符串+配置校验）；与 B1 有耦合（json-output 的 type 键依赖本任务）。

**迁移优先级：B**（完整功能移植，改动面大，价值中等；排 B1 之后或捆绑）。

**迁移建议：②参考重写**。

---

## CLI-7：BACK-410 完善共享 AGENTS.md init 行为（draft-95）

**任务核心目的**：收尾共享 AGENTS.md init：Cursor 映射到 AGENTS.md、删除过时 .cursorrules 分支与 CURSOR_GUIDELINES 导出、保留用户自有 .cursor/rules、重复 init 保持单一 marker 块。

**变更内容摘要**（merge `b421d75`，7 文件）：agent-instructions.ts 删 fileName 参数的 .cursorrules 特判（-58 行）；guidelines/index.ts 删 CURSOR_GUIDELINES；cli.ts:686/:702 help 文案；InitializationScreen.tsx:400 描述；新增 3 个测试。

**与当前定制代码的交集风险：中（偏低）**。fork 已实现 cursor→AGENTS.md（cli.ts:633,650,1064-1075 nameMap）；残留删除对象：agent-instructions.ts:42-43 .cursorrules 死分支、guidelines/index.ts:8 CURSOR_GUIDELINES 导出；fork Web init 是复选框式（InitializationScreen.tsx:396-414），无命名 agent 卡片，上游 Web 改动不适用。

**适合迁移的内容**：.cursorrules 分支清理（agent-instructions.ts:42-47）；删 CURSOR_GUIDELINES（先确认无引用）；cli.ts help 文案更新。

**需要排除/调整的内容**：上游 3 个测试不照搬（fork 结构不同）；Web 卡片改动不适用。

**迁移优先级：B**（死代码清理，非关键）。

**迁移建议：②参考重写（只做清理）**。

---

# 二、TUI

## TUI-1：BACK-547 TUI 实时刷新对原子写入稳健（draft-88）

**任务核心目的**：修复 TUI 实时刷新竞态：原子写入（CLI 一次性落盘）的单个 fs 事件可能在文件可读前被 watcher 消费，看板停留陈旧状态、读失败被误判为删除。通过事件对账（重试直至内容稳定或确认缺失）发布统一任务状态。

**变更内容摘要**（merge `9c29c4c`，7 文件 +925/-86）：task-watcher.ts 重写为 231 行对账式（TaskReconciliation 世代/待处理状态机、TASK_READ_ATTEMPTS=8、taskSignature、readTaskFileSnapshot 目录快照、watchTasks initialTasks 参数）；unified-view.ts 引入 UnifiedTaskUpdate/applyUnifiedTaskUpdate 单回调管线；task-viewer-with-search.ts 加 subscribeUpdates 选项；新增 task-watcher.test.ts（348 行）。

**与当前定制代码的交集风险：中低**。fork 的 task-watcher.ts（74 行）与上游 pre-B8 几乎逐行一致（干净替换面）；unified-view.ts:256-292 内联回调同源；task-path.ts 助手齐备，唯一缺口 `extractTaskIdFromFilename`（task-path.ts:91）未导出需补 export；fork task-viewer-with-search.ts 变量集齐全。

**适合迁移的内容**：task-watcher.ts 整文件替换；unified-view 的 applyUnifiedTaskUpdate/createUnifiedTaskUpdateCallbacks 重构；subscribeUpdates 选项（21 行）；补 export；测试主体。

**需要排除/调整的内容**：fork 保留 milestoneMode/milestoneEntities 看板接线（unified-view.ts:419-420）；tui-interactive-editor-handoff.test.ts 按 fork editor 流程适配；若 B7 未迁，createTaskFromBoard 的 onTaskAdded 命名先调和。

**迁移优先级：A**（缺陷修复、代码量小、替换面干净、为 B7 铺路，建议最先迁）。

**迁移建议：①直接复用（小调整）**。

---

## TUI-2：BACK-430 意图优先的 TUI 任务创建 composer（draft-87）

**任务核心目的**：TUI 增加可发现的 `N` 快捷键 + Blessed 任务创建器（标题/描述/状态/类型/优先级），规范路径持久化普通任务与 Draft，失败可回滚/重试并保留 Git index，创建后刷新看板聚焦可见任务，空看板可打开。

**变更内容摘要**（merge `77800fe`，13 文件 +2473/-91）：新增 task-composer.ts（551 行）；board.ts +157（N 键、upsertBoardTask、renderView(preferredTaskId?)、updateBoard 守卫、footer [N] New）；unified-view.ts +28（getEmptyUnifiedViewMessage/createTaskFromBoard）；core/backlog.ts +138（CreatedTaskWrite 快照 + rollbackCreatedTask）；git/operations.ts +369（commitStagedChanges 重写为 GIT_INDEX_FILE 临时索引 + 钩子 + 重试）；filter-popup reflow；测试 tui-task-composer.test.ts（1109 行）。

**与当前定制代码的交集风险：高**。fork createTaskFromInput（backlog.ts:1043-1160）深度定制（actualStart/actualEnd 自动填充 1135-1145、DoD、withCreateLock）；git/operations.ts:310-330 per-file autoCommit 与上游临时索引重写语义冲突；fork Task 无 type、无 task-type-config.ts/priority-config.ts（composer 依赖须裁/本地化）；board.ts 定制深（1460 行，sequences/移动态 cyan 高亮）；filter-popup.ts createPopupChrome（49 行）无 reflow 需补齐。

**适合迁移的内容**：task-composer.ts 整体（裁 type、priority 本地化）；board.ts N 键/upsertBoardTask/getCreatedTaskBoardOutcome/renderView 防重入/updateBoard 守卫/showTransientFooter 第三参；unified-view 空看板逻辑；filter-popup reflow；d.ts textarea/unkey；help-popup N 条目。

**需要排除/调整的内容**：type 字段选择器整体排除；task-type-config/priority-config 依赖本地化；rollback 机械回滚若与 writePreparedTask/finalizeCreatedTask 冲突可先做无回滚版；git 临时索引与 fork 逐文件 autoCommit 协调；footer 文案用 fork 按键体系。

**迁移优先级：A**（TUI 创建入口核心能力，配合 Draft/sequences/日期体系；建议直接采用 BACK-565 成熟版 38d6afa 避免二次重构）。

**迁移建议：②参考重写**（先 B8 再 B7）。

---

## TUI-3：BACK-565 修复 TUI composer UX 与导航（pre-range，随 B7 一并）

**任务核心目的**：修复 BACK-430 composer 的 UX：紧凑响应式 Title/Description/Details/Actions 层级、方向键空间导航、caret-aware 删除、Tab/Shift+Tab 不再抢焦点。

**变更内容摘要**（merge `38d6afa`，晚于 v1.49.3 不在范围）：task-composer.ts 489 行改动（布局重构+方向键导航）；filter-popup.ts +54、help-popup.ts +35、board.ts +62；测试 +672。

**与当前定制代码的交集风险：中（与 B7 绑定）**。fork 无 composer，无直接冲突面；全部构建在 B7 之上，未迁 B7 前无法落地。

**适合迁移的内容**：38d6afa 最终版 composer 形态；popup-chrome 测试；配套微调。

**需要排除/调整的内容**：type 字段依赖排除（同 B7）；方向键导航与 fork sequences/看板移动键不冲突；依赖 B7 先落地。

**迁移优先级：A（作为 B7 组成部分）/B（单独）**——建议随 B7 直接采用成熟版。

**迁移建议：②参考重写（随 B7 一并处理）**。

---

## TUI-4：BACK-469 TUI 主题自适应渲染（pre-range 代码）

**任务核心目的**：移除 TUI 硬编码 ANSI 颜色，反显（inverse）+bold 高亮选中态，任何终端主题可读；附带滚动改进（PGUP/PGDN/Home/End、滚动条指示器、addScrollKeys 助手）。

**变更内容摘要**（主提交 `5b7850f` 已落 v1.48.0 但不在 fork 历史；3dbfb6a 文档收尾）：tui.ts +59（addScrollKeys/滚动条）；board.ts/generic-list.ts/filter-header/filter-popup/loading/status-icon 颜色中性化；tools/tui-screenshot-compare.sh。

**与当前定制代码的交集风险：中低**。fork 已自主实现同方向核心：board.ts:514-522 inverse/bold、filter-header.ts:443/537/555-563、generic-list.ts:152；缺口在 addScrollKeys/滚动条/滚动键与少量残留硬编码色（generic-list.ts:151 border blue、loading.ts:88 cyan、status-icon.ts:19-20）。fork overview-tui.ts 用 picocolors，不在上游范围。

**适合迁移的内容**：addScrollKeys 与 scrollableViewer 滚动条；generic-list/board 滚动键；残留硬编码色中性化；截图比对脚本（可选）。

**需要排除/调整的内容**：不重复替换 fork 已有 inverse/bold 体系；fork 移动态 cyan 高亮（board.ts:516-517）为有意定制勿中性化；status-icon 语义色按 fork 判定。

**迁移优先级：B**（核心已自研，剩余为滚动体验增量）。

**迁移建议：②参考重写（只补缺口）**。

---

## TUI-5：BACK-551 TUI 任务摘要显示 AC 进度（pre-range）

**任务核心目的**：TUI 看板卡片/详情显示 AC 完成度 x/y 进度。

**变更内容摘要**：实现提交 `c2b5391`（2026-08-10）晚于 v1.49.3，仅存在于未合并分支 upstream/tasks/back-551-tui-ac-progress；范围仅任务文档（2a4ef17）。新增 ui/acceptance-criteria-progress.ts（22 行）、board.ts +19、task-viewer-with-search.ts +47、测试 70 行。

**与当前定制代码的交集风险：中**。fork TUI 详情已渲染 AC 清单（task-viewer-with-search.ts:1471-1482 formatChecklistItem ✓/○）但无 x/y 摘要；board.ts 无 AC 指示；组件结构分化。

**适合迁移的内容**：acceptance-criteria-progress.ts 纯进度计算（参考重写复用 fork buildAcceptanceCriteriaItems）；TUI 详情摘要行挂点。

**需要排除/调整的内容**：上游测试重写；挂点按 fork 组件结构适配。

**迁移优先级：B**（可选增强，等上游合并稳定后评估或先做工具函数）。

**迁移建议：②参考重写**。

---

## TUI-6：BACK-566 临时隐藏 TUI 任务创建入口（draft 不导入，C 类）

**任务核心目的**：临时隐藏 TUI 任务创建入口（上游对 unstable composer 的应急响应）。

**变更内容摘要**（merge `eed1449`，6 文件）：board.ts/unified-view.ts/help-popup.ts 移除创建入口。

**与当前定制代码的交集风险：低**。fork 无该 composer（task-composer.ts 不存在），无可隐藏对象；上游亦在 BACK-565 修复。属上游临时回归。

**适合迁移的内容**：无。

**需要排除/调整的内容**：全部排除（fork 无 composer，且 B7 落地后不应隐藏）。

**迁移优先级：C**。

**迁移建议：③忽略**。

---

# 三、Web

## WEB-1：BACK-558 阻止浏览器快捷键拦截内联任务字段（draft-92）

**任务核心目的**：任务详情弹窗预览态快捷键（e/c/d/p）不应在编辑内联字段（input/textarea/select/contenteditable）时被触发。

**变更内容摘要**（merge `deedb4e`，9 文件）：TaskDetailsModal.tsx:69-73 新增 `isEditableKeyboardTarget`（closest 检测）；预览态快捷键前加守卫 `if (mode !== "preview" || isEditableKeyboardTarget(e.target)) return;`；附带同一 PR 的 editor.ts isEditorAvailable DI 重构（测试性夹带）；新增键盘快捷键回归测试。

**与当前定制代码的交集风险：低**。fork TaskDetailsModal.tsx:440-468 是同类无守卫实现（e/c/d/p 预览、Escape/Ctrl+S 编辑快捷键），且 fork 确实支持内联编辑（handleInlineMetaUpdate，:1600）——bug 真实存在，修复点完全对应。唯一注意：守卫须插在 L449 编辑态检查之后、L450 预览态检查之前，保证输入框内 Escape/Ctrl+S 仍可用。

**适合迁移的内容**：isEditableKeyboardTarget 函数体直接复制；守卫插 TaskDetailsModal.tsx:449/450 之间；回归测试参照上游重写（覆盖 input/textarea/select/contenteditable 内外行为）。

**需要排除/调整的内容**：editor.ts DI 重构与 wizard 传参（夹带内容，fork 无 BACK-569 测试需求可跳过）；未来其他快捷键防护应抽公共工具。

**迁移优先级：A**（真实 bug、改动极小、单文件）。

**迁移建议：①直接复用**。

---

## WEB-2：BACK-570 浏览器任务加载异步化、空闲稳定（draft-90）

**任务核心目的**：浏览器 shell 先行渲染、共享语料后台一次性初始化；Kanban 展示层过滤排除 completed/archived；消除空闲发布与重复全量扫描，保留真实文件系统更新。

**变更内容摘要**（merge `a972e40`，15 文件）：server servicesReadyPromise 去重 + initializeServices 后台执行（先 bind 后初始化）；core refreshTasksForTaskRead（active-branch 指纹缓存 + REMOTE_REF_REFRESH_INTERVAL_MS=60s 有界刷新）替换无条件 contentStore.refreshTasks()；web App.tsx shell 数据先行、search 延迟、requestId 竞态保护、loadError 状态；新增 web/utils/kanban-tasks.ts filterKanbanTasks；TaskDetailsModal 改传共享 availableTasks。

**与当前定制代码的交集风险：中**。① server 启动为 fork 定制区：start() `await ensureServicesReady()` 后才 Bun.serve（index.ts:405-407），routes 含 /gantt /overview /sequences；改后台初始化需逐一确认 handler await 就绪（统计走 getContentStoreInstance、sequences 直接 listActiveSequences，兼容但需回归）；② App.tsx loadAllData 无 requestId 保护、用 isFirstLoad/hasLoadedRef（App.tsx:323-388），多出 drafts/wikiTree/docsTree 与 /gantt /overview 路由；③ TaskDetailsModal 为 fork 定制（onDrillDown、availableDrafts）；④ filterKanbanTasks 现阶段不需要——fork 语料默认不含 completed（loadTasks 无 includeCompleted，backlog.ts:3015-3016）。

**适合迁移的内容**：server servicesReadyPromise 去重 + bind-first 后台初始化（针对 index.ts:405 阻塞点）；TaskDetailsModal 去掉每次打开 fetchTasks 改传 availableTasks；App.tsx requestId 竞态保护 + loadError；duplicate preview 移出主加载路径；kanban-tasks 过滤思想留给 BACK-260。

**需要排除/调整的内容**：task-identity-index 指纹改动（fork 无此文件）；refreshTasksForTaskRead/60s 远端刷新（fork 无读时刷新路径，watcher 已驱动广播，不建议引入）；SideNavigation taskCount 重构配合 B13；不引入第二份 active-only 语料。

**迁移优先级：A**（消除服务器绑定前阻塞、浏览器长时间白屏）。

**迁移建议：②参考重写（server 侧与 B13 合并实施；web 侧按 fork 数据流重写 shell 拆分）**。

---

## WEB-3：BACK-571 浏览器 board/sidebar 显示真实加载指示（draft-91）

**任务核心目的**：加载过程真实可见——WebSocket 推送 loading/loaded/error 三态（含进度消息），Board 骨架屏 + 错误重试面板，侧边栏保持挂载，加载完成自动刷新。

**变更内容摘要**（merge `dd85de5`，21 文件）：新增 utils/browser-loading-state.ts；server browserLoadingState 字段 + publishBrowserLoadingState 推 WS，ws open 先发当前状态、loading 触发 ensureServicesReady；core getContentStore(progressCallback)/ensureInitialized/loadTasksWithLoader 串接进度回调；App.tsx WS 三态解析 + protocolOnlyLoadingRef；Board.tsx 骨架屏 + loadError 面板；SideNavigation/Layout 透传 loadingMessage。

**与当前定制代码的交集风险：中**。server 启动/初始化改动触碰 fork 定制的 start() 与统计缓存/配置 watcher 时序（index.ts:224-249, 345-410）；fork loadTasks 已内置 progressCallback（backlog.ts:2998-2999）但 ContentStore taskLoader 闭包未接线（backlog.ts:275）；Board 现有 `isLoading && statuses.length === 0` 文本 loading（Board.tsx:449-455）、SideNavigation 用 SidebarSkeleton 整段隐藏（SideNavigation.tsx:1200-1203）、Layout error/onRetry props 是死代码（Layout.tsx:15-43）。

**适合迁移的内容**：browser-loading-state.ts 直接复制；publishBrowserLoadingState + ws open 推当前状态（与 B12 合并实施）；progressCallback 串接（getContentStore → ensureInitialized → taskLoader）；Board 骨架 + 错误重试面板；App.tsx WS 三态解析（App.tsx:634-646 onmessage 扩展）。

**需要排除/调整的内容**：不得覆盖 /gantt /overview /sequences 路由与 statistics-updated 推送（排除清单 3/4/5）；protocolOnlyLoadingRef 逻辑按 fork loadAllData 重写；侧边栏保持 isCollapsed 行为；不触碰「存储 UTC、展示本地时区」日期渲染。

**迁移优先级：A**（与 B12 配套）。

**迁移建议：②参考重写**。

---

## WEB-4：BACK-552 浏览器任务摘要显示 AC 进度（pre-range）

**任务核心目的**：浏览器 TaskCard/TaskList 显示 AC 完成度进度。

**变更内容摘要**：实现提交 `c33df07`（2026-08-10）晚于 v1.49.3，仅存在于 upstream/tasks/back-552-web-ac-progress 分支；范围仅任务文档（94964ec）。新增 web/components/AcceptanceCriteriaProgress.tsx（39 行）、TaskCard.tsx +3、TaskList.tsx +34、测试 150 行。

**与当前定制代码的交集风险：中**。fork 有 AcceptanceCriteriaEditor.tsx 但 TaskCard/TaskList 无 AC 进度；组件结构与上游分化（甘特/统计/序列定制、Task 无 type）。

**适合迁移的内容**：进度计算/展示组件参考重写；TaskList 摘要列/徽标挂点。

**需要排除/调整的内容**：上游测试重写；挂点按 fork 组件结构适配。

**迁移优先级：B**（可选增强）。

**迁移建议：②参考重写**。

---

## WEB-5：BACK-260 在 All Tasks 中纳入已完成记录（pre-range）

**任务核心目的**：All Tasks 默认隐藏 completed 目录记录，提供显式 Include completed 源过滤（区别于任务状态），URL 持久化、与既有过滤组合、搜索可达、看板默认排除。

**变更内容摘要**：上游仅文档更新（e0da5f6，AC 全未勾选，status: To Do，关联 issue #825），无实现代码。

**与当前定制代码的交集风险：低-中**。fork 前置条件最好：loadTasks 已内置 includeCompleted（backlog.ts:2998-3016，含状态快照过滤与 `source: "completed"` 标记 3066-3068）；Task.source 支持 "completed"（types/index.ts:78）、isLocalEditableTask 已视 completed 可编辑；但 web 全链路无 includeCompleted UI，/api/search 走 SearchService←ContentStore 快照（语料不含 completed）。

**适合迁移的内容**：无上游代码；可复用 fork 现成 loadTasks({includeCompleted}) 与 source 标记；建议「按需合并」路线（search/tasks 端点加参数 + URL includeCompleted 持久化），避免动 Board。

**需要排除/调整的内容**：若走共享语料路线必须同步引入看板层 `source !== "completed"` 过滤（对照 B12 filterKanbanTasks）；保持「completed ≠ 终态状态」语义；不引入 archive 记录。

**迁移优先级：B**（可选增强；fork 自研成本可控）。

**迁移建议：③忽略（上游未实现；fork 可②参考重写自研）**。

---

## WEB-6：BACK-567 停止空闲浏览器刷新对重复任务预览的循环（draft 不导入，C 类）

**任务核心目的**：修复「浏览器重载 → 请求重复任务修复预览 → 预览读取刷新本地语料并发布 → 广播 tasks-updated → 再次重载」的死循环。

**变更内容摘要**（merge `226eff4`，3 文件）：backlog.ts:267 refreshLocalTaskCorpus(false) 静默刷新；content-store.ts refreshLocalTaskCorpus 增加 publishChanges 参数。

**与当前定制代码的交集风险：低**。fork 无 refreshLocalTaskCorpus/读时刷新（getContentStore 读时不刷新，backlog.ts:272-277）；duplicate preview 直接 filesystem.listTasks()（duplicate-task-repair.ts:330-335）不经过 ContentStore、不产生发布——根因链路在 fork 不成立。

**适合迁移的内容**：无直接代码；可借鉴回归测试思路（为 /api/tasks/duplicate-ids 补「预览不得触发 tasks-updated 广播」测试）。

**需要排除/调整的内容**：refreshLocalTaskCorpus(publishChanges) 整套机制（移植等于引入上游读时刷新语义，与 fork 冲突）。

**迁移优先级：C**。

**迁移建议：③忽略**。

---

## WEB-7：BACK-568 重复预览刷新时保留真实任务发布（draft 不导入，C 类）

**任务核心目的**：纠正 B9 过度抑制——静默刷新可能吞掉真实编辑，改为「任务相等性比较忽略 lastModified/source 纯元数据」并串行化预览刷新。

**变更内容摘要**（merge `3c9dac8`，6 文件）：content-store.ts hasTaskCollectionChanged 剔除 lastModified/source；refreshLocalTaskCorpus 恢复默认发布 + enqueueRoot 串行化。

**与当前定制代码的交集风险：低**。同 B9，fork 无对应机制（fork 用 mergeTasks 版本捕获，content-store.ts:1039），不存在污染问题。

**适合迁移的内容**：仅原则层面——「变更检测的相等性应忽略纯元数据（lastModified/source），身份/状态变化必须发布」，写进实施计划供未来改 mergeTasks 参考。

**需要排除/调整的内容**：enqueueRoot 串行化（fork chainTail 已承担同类职责，无需第二套队列）。

**迁移优先级：C**。

**迁移建议：③忽略（仅记录原则）**。

---

## WEB-8：BACK-548 任务详情双向依赖图（pre-range，C 类）

**任务核心目的**：任务详情展示所选任务的传递依赖集与反向依赖集（dependents），确定性排序、环/菱形/缺失引用 fail-closed，CLI 为规范实现。

**变更内容摘要**：上游仅任务文档（8153d87，To Do 无代码），依赖 BACK-545。**注意：fork 已把 BACK-548 这个 ID 用于自身提交「BACK-548 - Add exclude-status filtering and multi-status selection」（fork 提交 4424288），与上游语义分叉，合并前必须先解 ID 冲突。**

**与当前定制代码的交集风险：中（特性层面）**。fork 已有依赖输入/导航（DependencyInput、onDrillDown TaskDetailsModal.tsx:353-359）、Gantt 依赖箭头（GanttView.tsx:509-515, 970-1033）；缺 dependents 反向索引与传递闭包/环处理。

**适合迁移的内容**：无现成代码；可先实现 dependents 反向索引 + 传递遍历（确定性排序、环检测），接入 TaskDetailsModal 与 Gantt 箭头。

**需要排除/调整的内容**：先解 fork/上游 BACK-548 ID 冲突（改名或合并记录）；不改动 fork 依赖输入/编辑模型。

**迁移优先级：C**。

**迁移建议：③忽略（上游 To Do；fork 可自研，前置条件已具备）**。

---

## WEB-9：BACK-553 可导航 Web 任务依赖图（pre-range，C 类）

**任务核心目的**：浏览器可平移/缩放/点选的只读任务依赖图，派生 Sequence 视觉边界圈出当前可开工任务；明确非恢复 sequence 命令（上游 BACK-520 已移除）。

**变更内容摘要**：上游仅任务文档（55b8718，To Do 无代码），依赖 BACK-546（同样未落地）。

**与当前定制代码的交集风险：中（特性层面）**。fork 保留 sequences（src/core/sequences.ts、/sequences 路由 index.ts:596-607）——上游明确「不是恢复 sequence」，fork 的 sequence 是持久化顺序模型，移植必须区分「只读派生边界」与 fork 持久 sequence；fork 已有 GanttView 依赖箭头基础。

**适合迁移的内容**：无现成代码；可复用 GanttView 依赖边计算/布局经验与 dependencies 数据模型；就绪判定 fork 无对应语义需新增。

**需要排除/调整的内容**：不得把上游「移除 sequence」前提带入 fork（排除清单第 1 类不可回退能力）；只读派生边界不得写回 fork sequences 数据；新增路由不得覆盖现有（排除清单第 3 条）。

**迁移优先级：C**。

**迁移建议：③忽略（上游未实现；fork 如需属新功能开发）**。

---

# 四、Server

## SERVER-1：BACK-560 浏览器服务仅绑定 loopback（draft-81）

**任务核心目的**：浏览器服务器由默认通配符接口（0.0.0.0，LAN/VPN 可达）显式绑定到回环地址 127.0.0.1，修复安全暴露（issue #810），不提供公共 host 覆盖。

**变更内容摘要**（merge `fef6e76`，10 文件）：src/server/index.ts 新增 `const BROWSER_HOST = "127.0.0.1"`；isPortAvailable 探测改绑 `srv.listen(port, BROWSER_HOST)`；Bun.serve serveOptions 加 `hostname: BROWSER_HOST`；URL `http://localhost:${finalPort}` → `http://${BROWSER_HOST}:${finalPort}`；src/cli.ts browser 命令 description 改为 "this machine only at 127.0.0.1"；新增 server-hostname.test.ts（93 行）；文档注明仅本机。

**与当前定制代码的交集风险：低**。fork 的 Bun.serve serveOptions 仅传 `port: bindPort`（src/server/index.ts:407-408），绑定 0.0.0.0 网络暴露，正是修复对象；仅新增 hostname 字段，不删除/改动任何现有路由（/gantt /sequences /assets /wiki /statistics /overview 均保持）。与排除清单无冲突。fork 探测用 get-port@7.2.0（L377），其 getLocalHosts() 对 0.0.0.0 亦做探测，改绑 127.0.0.1 后不会出现上游修复的 macOS 假空闲回归。**[INFERENCE] 行为变更点**：若用户依赖局域网访问 Web UI，改绑后不可达——但这正是上游既定意图，且 fork 无 --host 选项，无兼容负担。

**适合迁移的内容**：BROWSER_HOST 常量 + serveOptions hostname（L407-408）+ URL 统一（L639）+ CLI 描述（cli.ts:4948）。

**需要排除/调整的内容**：不迁移上游 isPortAvailable（fork 用 get-port）；不迁移 server-port.test.ts/test-utils.ts 探测绑定改动（fork 结构不同，listenOnEphemeralPort 已绑 127.0.0.1）；不引入公共 host/LAN 覆盖；文档迁移可选。

**迁移优先级：A**（真实安全漏洞，改动极小）。

**迁移建议：①直接复用（核心）+ ②参考重写（测试）**。

---

## SERVER-2：BACK-562 支持 BROWSER 环境变量启动浏览器（draft-94）

**任务核心目的**：打开 Web UI 时 honor 非空 BROWSER 环境变量（devcontainer 场景）：视为单个可执行路径（不 split、不 shell 求值、接受引号包裹，防注入与空格路径）；无覆盖时保留各平台 fallback。

**变更内容摘要**（merge `83fca84`，2 文件）：新增 src/utils/browser-launch.ts（28 行）resolveBrowserLaunchCommand(url, env, platform)（BROWSER trim+剥引号 → [executable,url]，否则 darwin→open、win32→cmd /c start、默认 xdg-open）；cli.ts -10 与 server/index.ts -17 内联 switch 改调用 launchBrowser；新增 server-browser-open.test.ts（109 行）。

**与当前定制代码的交集风险：低**。fork 有两处重复实现且都不读 BROWSER——cli.ts:177-195 openUrlInBrowser、server/index.ts:723-745 openBrowser，替换无行为冲突；与 fork Bun.serve 只传 port 无关。注意：上游 launchBrowser 不 catch，fork 两处 try/catch+手动打开指引需保留；fork test-utils 无 listenOnEphemeralPort/closeServer，移植测试需一并引入。

**适合迁移的内容**：browser-launch.ts 全文件（env 可注入便于单测）；两处调用替换（保留 fork 错误处理）；测试用例思路。

**需要排除/调整的内容**：上游测试整体搬入前先补 fork test-utils 基建；fork cli 侧 console.warn+手动打开 URL 指引不可被无 catch 版本覆盖。

**迁移优先级：A**。

**迁移建议：①直接复用**。

---

## SERVER-3：BACK-559 让 Core 成为浏览器任务的唯一边界（draft-84）

**任务核心目的**：浏览器 handler 不再直接操作 Core.filesystem 的任务读写，统一走 Core + ContentStore 单一任务语料快照（TaskCorpusSnapshot），消除重复全量扫描（Update x5 从 1612ms→349ms）；完整 reorder 原子应用并通过一次 WebSocket 广播协调。

**变更内容摘要**（merge `69b3649`，17 文件 +1316/-300）：content-store.ts +325（TaskCorpusSnapshot、activeTasks/completedTasks/taskIdentityIndex 缓存、resolveTaskForRead/ForMutation、batchTaskUpdates、transitionTask）；task-identity-index.ts +87（withWorkingCopyCorpus/withRecord/getFingerprint）；server/index.ts +106（handleGetTask 收敛为 isValidTaskId+core.getTask、歧义 409；reorder 返回 changedTasks；tasks-updated 75ms 防抖）；backlog.ts reorderTask 一次 applyReorder；web App.tsx applyReorderedTasks 原子合并、Board.tsx handleTaskReorder 用 changedTasks。

**与当前定制代码的交集风险：高**。fork 的 content-store.ts（1246 行）是深度重写版，无 PublicationOwner/contentItemVersions/batchTaskUpdates 体系（上游来自 in-range BACK-538 系列）；B4 的 ContentStore 改造建立在该体系之上，且依赖 B3 的 identityIndex，无法整块套用。表层（server/web）交集低：fork handleGetTask（index.ts:1077-1091）现为 fs.loadTask+store.upsertTask+findTaskByLooseId，handleReorderTask（:1956-1990）不返回 changedTasks，broadcastTasksUpdated（:270-274）无防抖——均与上游 pre-B4 一致；fork core.reorderTask 已返回 {updatedTask, changedTasks}（backlog.ts:2126-2246），只是 server/web 未暴露。

**适合迁移的内容**：server 表层收敛（handleGetTask/handleUpdateTask/handleCompleteTask/createTask 父解析走 core.*，删除重复 fs.loadTask+store 双读）；reorder 原子化（server 返回 changedTasks + Board onTasksUpdated + App applyReorderedTasks + api.ts 类型）；tasks-updated 75ms 防抖；duplicate-task-repair snapshot 参数化（可选）。

**需要排除/调整的内容**：ContentStore TaskCorpusSnapshot/taskIdentityIndex 集成依赖 B3 + fork ContentStore 先对齐 publication-owner 体系，不可直接复用（可先做轻量 activeTasks/completedTasks 缓存 + 桥接 resolve）；移除 watcher taskIdsEqual 断言需对照 fork 语义；isValidTaskId 依赖 task-id.ts；web 跨分支只读展示（依赖 store.getTasks 含 branch 任务）需确认不回归。

**迁移优先级：B**（依赖 B3 的 identityIndex；但 server/web 表层增量可与 B3 解耦先行）。

**迁移建议：②参考重写（content-store）+ ①直接复用（server/web 表层）**——分两步：先 server/web 增量（无 B3 依赖），待 B3 落地再做语料快照。

---

# 五、Infra / CI / 测试

## INFRA-1：BACK-569 将 Windows CI 测试降到三分钟以下（draft-89）

**任务核心目的**：Windows CI 测试从 16m22s 压到 3 分钟内：Ubuntu 独占完整行为套件，Windows/macOS 只跑平台契约子集（37 文件 373 测试）；CLI 只预构建一次（BACKLOG_TEST_CLI_BUNDLE）；非 Git fixtures 默认 filesystem-only；有界并发（full=2/platform=4）。

**变更内容摘要**（merge `4c480d0`，126 文件）：ci.yml 矩阵 test_profile+test_workers、bun 1.3.14、Bundle CLI 步骤；新增 scripts/run-ci-tests.ts（37 平台契约清单）、src/test/test-preload.ts（全局 Git 身份）+ bunfig preload、src/test/test-cli.ts（getTestCliPath 读 BACKLOG_TEST_CLI_BUNDLE）；test-utils.ts 增 initializeFilesystemTestProject/withTimeout/observeChildClose/listenOnEphemeralPort/closeServer；editor.ts:50-62 win32 where/unix which 改 Bun.which；scripts/cli.cjs 提取 isArchitectureSignal/getSignalExitCode；~90 测试文件 CLI_PATH 改 getTestCliPath()；删除 implementation-notes-append.test.ts 等重复覆盖。

**与当前定制代码的交集风险：高**。fork 是 Windows 平台、三 OS 跑全量套件，痛点直接对症；但 run-ci-tests.ts 的 37 文件清单按上游文件名硬编码（fork 测试集 173 文件构成不同，无 cli-init-create，有 sequences/statistics/server-task-dates 特有测试）；initializeFilesystemTestProject 依赖 core/init.ts:58 filesystemOnly（fork test-utils.ts:93-119 未暴露）；fork 测试 beforeEach 里 git init+git config（acceptance-criteria.test.ts:18-20）与 test-preload 方案需验证共存；implementation-notes-append.test.ts 在 fork 仍存在不能照删；fork 43 个测试文件硬编码 src/cli.ts；配套升级 bun 1.3.11→1.3.14、checkout@v6→v7、cache@v5→v6、新增 smoke-compiled-build.ts（fork 无）。

**适合迁移的内容**：run-ci-tests.ts 机制 + ci.yml test_profile 矩阵分片；test-cli.ts（BACKLOG_TEST_CLI_BUNDLE）；test-preload.ts + bunfig preload；editor.ts Bun.which；cli.cjs 信号退出码重构；test-utils 的 withTimeout/observeChildClose/listenOnEphemeralPort/closeServer。

**需要排除/调整的内容**：平台契约文件清单按 fork 测试集重建（只含 OS 敏感文件）；重复覆盖删除逐文件评估；bun2nix 校验按 fork scripts/update-nix.sh 适配；TUI 交互测试步骤 fork 已有保留。

**迁移优先级：A**（fork 即 Windows，直接受益）。

**迁移建议：②参考重写为主、机制①直接复用**。

---

## INFRA-2：BACK-535 测试套件可靠性审计（draft-61 已存在）

**任务核心目的**：测试套件可靠性审计收尾：board.test.ts 改名 board-core-view-integration.test.ts（如实归类）；删除 status-callback 测试 4 处冗余固定等待（任务变更 API 已 await 回调完成）；更新 Testing Style Guide。

**变更内容摘要**（merge `5f8c8ff`，4 文件）：board.test.ts→board-core-view-integration.test.ts（改名+describe 微调）；status-callback.test.ts -12 行删 4 处 setTimeout；doc-001 Testing-Style-Guide.md +2/-2。

**与当前定制代码的交集风险：低**。fork status-callback.test.ts:143/183/215/305 有完全相同 4 处固定等待，且 fork core/backlog.ts:1262 await this.executeStatusChangeCallback（2072-2086）条件一致，删除可直接应用；改名项不适用——fork board.test.ts 内容为 exportKanbanBoardToFile，与上游被改名的套件是不同文件。

**适合迁移的内容**：status-callback.test.ts 4 处等待删除（143/183/215/305）；可选同步 Testing-Style-Guide 矩阵描述（随 B11）。

**需要排除/调整的内容**：board.test.ts 改名忽略。

**迁移优先级：B**。

**迁移建议：①直接复用（仅 status-callback 等待删除）**。

---

## INFRA-3：BACK-541 归档一周前完成的 backlog 任务（draft 不导入，C 类）

**任务核心目的**：上游是一次性仓库维护——151 个 Done 任务文件 R100 移入 backlog/completed（零内容变更），无功能代码。

**变更内容摘要**：backlog/tasks→backlog/completed 151 个 R100 move + BACK-541 任务文档。

**与当前定制代码的交集风险：低（功能超集）**。fork 已有交互式 cleanup（cli.ts:4729-4827）+ getTerminalStatusTasksByAge（backlog.ts:2437-2455）+ /api/cleanup（server/index.ts:2011-2045），目标目录一致（completed/）。

**适合迁移的内容**：无代码可迁移；如需同类整理直接用 fork cleanup 命令。

**需要排除/调整的内容**：上游 151 个文件移动是上游仓库数据，全部排除。

**迁移优先级：C**。

**迁移建议：③忽略**。

---

# 六、Nix / 打包

## NIX-1：BACK-554 用 bun2nix v2 打包（draft 不导入，C 类）

**任务核心目的**：将 Nix 打包升级到 bun2nix v2。

**变更内容摘要**（merge `babd1d2` 等，1 src 文件 + Nix 文件）：bun2nix v2 函数式打包迁移。

**与当前定制代码的交集风险：高**。fork 明确锁定 bun2nix V1：scripts/update-nix.sh:13-16 注明 V2 的 function-based 格式与 fork 使用的 `mkBunDerivation` API 不兼容；升级需重写 flake.nix 并重新生成 bun.nix，属重构而非修复；fork 的 Nix 打包已可用（flake.nix:14-16, 28-37 用 mkBunDerivation）。

**适合迁移的内容**：无（除非 fork 决定现代化打包）。

**需要排除/调整的内容**：全部排除（直接冲突于排除清单与既有 Nix 方案）。

**迁移优先级：C**。

**迁移建议：③忽略**。

---

# 附：B 类剩余条目（父子任务展示、AC 进度已含于 TUI-5/WEB-4）

## MISC-1：BACK-549 / BACK-222 改进父子任务在 TUI / Web 的展示（pre-range，C 类）

**任务核心目的**：改进 TUI 列表/看板/详情与 Web 中对既有父子任务关系的呈现：清晰区分父/子任务、显示 ID/标题/状态、父任务用 terminal-status 语义汇总已完成子任务进度、父→子键盘导航可预期；不改动父子语义模型。

**变更内容摘要**：上游仅任务文档（611d6aa / 54adde6，To Do，AC 全未勾选），无实现代码在范围内落地；TUI 实现实际未完成，部分意图被 BACK-430 承接。

**与当前定制代码的交集风险：低（当前无上游代码可冲突）**。fork 已部分实现：task-subtasks.ts:5-19 attachSubtaskSummaries（task-viewer-with-search.ts:283 调用）、sequences（父子链）、甘特图箭头；缺口在看板列内父子标识、父任务完成进度汇总、列表父子缩进/导航。

**适合迁移的内容**：看板父子关系标识；父任务子任务进度汇总（复用 fork terminal-status.ts）；父子导航焦点返回一致性。

**需要排除/调整的内容**：不引入上游新父子语义（AC#5 明确模型不变）；不覆盖 fork sequences 与甘特箭头既有呈现；不破坏 attachSubtaskSummaries 现有富化。

**迁移优先级：C**（上游未实现；fork 自主演进项）。

**迁移建议：③忽略（可②按 AC 自主设计）**。

---

## MISC-2：BACK-561 归一化 Done 任务 AC 元数据（draft 不导入，C 类）

**任务核心目的**：显式授权下把既有 Done 任务 AC 元数据规范化（勾选 6 条遗留未勾 AC），不改非终态任务与代码行为，纯 markdown 维护。

**变更内容摘要**（merge `426d767`）：新增 back-561 任务文档 + 修改 remove-hardcoded-colors 文档 AC 勾选；无 src/ 代码改动。

**与当前定制代码的交集风险：无/极低**。fork 有独立 backlog/tasks 与 AC 管理（structured-sections.ts AcceptanceCriteriaManager）。

**适合迁移的内容**：无可迁移代码；可借鉴数据维护纪律（fork 可用自己统计核对 Done AC 完整性）。

**需要排除/调整的内容**：上游两个任务文档排除。

**迁移优先级：C**。

**迁移建议：③忽略**。

---

## MISC-3：BACK-555 任务创建 handoff 检查指引（draft 不导入，C 类）

**任务核心目的**：task-creation 指导加入上下文无关交接检查（创建后冷读任务、修正缺失上下文、报告确认交接），明确禁止语义评分/阻塞创建。

**变更内容摘要**：上游仅任务文档（7b19db0，To Do 至今），无实现。意图：清单要素、反例措辞、冷读步骤、报告确认、非阻塞。

**与当前定制代码的交集风险：低（纯指导文档演进）**。fork 有自己的指导体系（agent-guidelines.md、CLI/MCP 指令、addAgentInstructions 装载 CLI/MCP_AGENT_NUDGE）。

**适合迁移的内容**：若采纳，fork 的 CLI task-creation 指导与 MCP 对应文件加清单+冷读+报告确认句+一条防漂移断言测试（对应上游 AC#7）。

**需要排除/调整的内容**：上游任务文档本身；任何语义评分/阻塞创建设计（AC#8 禁止，不符 fork 非阻塞原则）。

**迁移优先级：C**。

**迁移建议：③忽略（上游未实现；若重视交接质量可②参考重写到自己指导文档）**。
