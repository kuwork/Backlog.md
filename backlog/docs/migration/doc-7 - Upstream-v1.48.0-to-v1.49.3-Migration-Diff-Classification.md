---
id: doc-7
title: Upstream v1.48.0 to v1.49.3 Migration Diff Classification
type: guide
created_date: '2026-08-10'
updated_date: '2026-08-15'
---
# 上游变更差异分类（v1.48.0 .. v1.49.3）

## 概述

- **上游分支**：`upstream/main`
- **范围**：`v1.48.0 .. v1.49.3`（139 commits，33 个任务组）
- **上游仓库**：`MrLesk/Backlog.md`
- **当前工作分支**：`1.49`（fork 版本 `1.48.0-CN`；上游 `v1.49.0` 尚未合入）
- **分析依据**：上游 `v1.49.0 / v1.49.1 / v1.49.2 / v1.49.3` Release Notes + `git log --oneline v1.48.0..v1.49.3` + 当前分支排除清单 `references/current-branch-migration-exclusions.md` + 代码库现状勘察（6 个并行分析，逐条比对上游 merge commit diff 与 fork 工作树）
- **覆盖范围**：本表涵盖范围内出现的全部任务，包括未出现在 Release Notes 的条目（按 commit 记录逐一登记，标注代码是否实际在本范围合入）。范围语义：用户原写 `1.48.0..1.59.3`，本地最高 tag 为 `v1.50.1`，按紧随 fork 版本 `1.48.0-CN` 的完整发布段取 `v1.48.0..v1.49.3`。
- **组织方式**：按**领域分组**（CLI/Core、TUI、Web、Server、Infra/CI、Nix），每组内按最终优先级（A→B→C）排序，便于按实施批次排期；编号沿用初筛编号（A1、B1–B28、C1–C2）便于追溯。

## 分类说明

| 分类 | 含义 | 处理建议 |
|------|------|----------|
| **A类** | 必须合入 | 安全漏洞、关键 bug 修复、当前 fork 已规划但尚未实现的核心功能 |
| **B类** | 评估合入 | 新功能、非核心优化，需用户确认是否与当前 fork 定制冲突 |
| **C类** | 跳过 | 与当前 fork 演进方向冲突、上游特有方向、上游未实现、或当前 fork 无关的改动 |

> 深度分析（2026-08-10）对 A 类 + 全部 B 类条目逐一完成。**优先级重分类**：原 B 类 12 项提升为 **A**（B1/B3/B5/B6/B7/B8/B11/B12/B13/B14/B15/B16），4 项降为 **C**（B9/B10/B18/B19，机制 fork 不存在或无代码），另有 4 项因上游未实现降为 **C**（B22/B23/B24/B28）。最终 13 A / 5 B / 10 C。迁移指令（`backlog task create` 命令 + 实施计划草案）已单独整理，未写入本文档。

---

## 一、CLI / Core（命令行与核心数据）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B1 | **BACK-545 为 read 命令添加稳定 JSON 输出** | 为 `task list / view / 简写 / search` 新增 `--json` 版本化输出（`json-output.ts` 本范围新增），与 `--plain`/TUI 并存；JSON 只写 stdout、冲突模式报错。 | fork 只读命令仅有 `--plain`（`src/cli.ts:1850-1851, 2232-2233, 3058-3059`）；稳定机器契约对 agent/自动化价值高；改动纯增量 | 中：需删 `task.type` 键（fork 无）、补 wiki 分支（fork SearchResult 含 wiki）、增补 fork 日期键；删 fork 不存在的 `printDuplicateIntegrityWarning` 分支 | A | ②参考重写（契约框架可复用） | [DRAFT#82](/draft/82) | [doc-8 CLI-1](/documentation/8:32-50) |
| B3 | **BACK-557 同路径跨分支任务版本统一身份** | 相同规范化 ID + 逻辑路径的跨分支记录视为同一任务的多版本：工作副本权威、歧义 fail-closed、身份索引统一驱动加载/生命周期/ID 占用。 | 1.49 身份基石（B4 及后续建立其上）；修复「相同时间戳下扫描顺序可能释放 live ID」竞态（对应 fork `backlog.ts:915-980`） | 高：fork 身份合并为 ID-keyed Map + resolveTaskConflict（`backlog.ts:2975-3163`）；依赖 `task-id.ts` 前置；UTC 日期须用 fork `getStoredUtcTimestamp`；保留 fork `cross-branch-tasks.ts`/recentBranchesOnly 语义 | A | ②参考重写（大架构替换，独立大阶段） | [DRAFT#83](/draft/83) | [doc-8 CLI-2](/documentation/8:54-72) |
| B5 | **BACK-563 将 autoCommit 精确限定到写入文件** | autoCommit 仅暂存本次写入触碰的文件（新建+移动旧路径），不整目录暂存、不清空共享 index。 | 直接补齐 fork 8 处 stageBacklogDirectory 整目录暂存（`backlog.ts:2023/2064/2121/2461/2473/2485/2614/2675`）；删除 resetIndex/commitStagedChanges 顺带修复「提交清空用户暂存区」 | 中：与 fork per-file autoCommit（`git/operations.ts:310-330`）同向；CAS 管线依赖 BACK-430 | A | ①直接复用（核心）/②参考重写（git 层） | [DRAFT#85](/draft/85) | [doc-8 CLI-3](/documentation/8:76-93) |
| B6 | **BACK-564 里程碑过滤按里程碑 ID 匹配** | 里程碑过滤按 ID（数字/规范 m-N/大小写变体/标题）解析，修复带标点标题无法往返（issue #819）；CLI/交互/MCP 一致。 | fork 对应代码与上游 pre-B6 逐字同源，最安全移植项；修复 fork 现存「数字 ID/大小写不一致」 | 低：仅补 `unified-view.ts:214/:382` 传 archived 里程碑 | A | ①直接复用 | [DRAFT#86](/draft/86) | [doc-8 CLI-4](/documentation/8:97-114) |
| B15 | **BACK-550 为 task edit 添加 append-plan 选项** | 新增可重复 `--append-plan`，复用既有 appendImplementationPlan 管线。 | fork 下游管线 100% 就绪（`backlog.ts:1577/1653-1655`、`task-edit-builder.ts:125-127`、`types/index.ts:159`），仅 5 处 cli.ts 约 15 行接线 | 低：零冲突，append 值不转义与 fork notesAppend 一致 | A | ①直接复用 | [BACK-556](/task/556) | [doc-8 CLI-5](/documentation/8:118-132) |
| B2 | **BACK-355 为任务添加 type 字段** | 为 `Task` 新增语义 `type`（bug/feature/...，config `types`），端到端覆盖类型/解析/CLI/过滤/UI。 | fork Task 无 type（`types/index.ts:41-78`）；属数据模型扩展，价值中等 | 中：搜索 `--task-type` 命名必须保留（fork `--type` 已占用为实体类型过滤 `cli.ts:1833`）；过滤链路须按 fork search-service 重写 | B | ②参考重写 | [DRAFT#80](/draft/80) | [doc-8 CLI-6](/documentation/8:136-150) |
| B17 | **BACK-410 完善共享 AGENTS.md init 行为** | 清理 `.cursorrules` 死分支、删 CURSOR_GUIDELINES 导出、help 文案更新。 | fork 已实现 cursor→AGENTS.md（`cli.ts:633,650`）；上游为收尾清理 | 低-中：仅 agent-instructions.ts:42-47 + guidelines/index.ts:8；不搬上游 Web 卡片与测试 | B | ②参考重写（仅清理） | [DRAFT#95](/draft/95) | [doc-8 CLI-7](/documentation/8:154-172) |
| B19 | **BACK-561 归一化 Done 任务 AC 元数据** | 显式授权下勾选既有 Done 任务遗留未勾 AC，纯 markdown 维护。 | 无 src 代码改动，fork 无关 | 无 | C | ③忽略 | 不适用 | [doc-8 MISC-2](/documentation/8:598-612) |
| B28 | **BACK-555 任务创建 handoff 检查指引** | task-creation 指导加入上下文无关交接检查（冷读/报告确认/非阻塞）。 | 上游 To Do 无实现（2026-08-10 仍 To Do）；fork 有自己的指导体系 | 低：若重视交接质量可②参考重写到自己指导文档 | C | ③忽略 | 不适用 | [doc-8 MISC-3](/documentation/8:616-630) |

---

## 二、TUI

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B8 | **BACK-547 TUI 实时刷新对原子写入稳健** | task-watcher 重构为对账式（世代/重试/内容签名/目录快照确认缺失），单回调管线发布统一任务状态。 | fork 的 task-watcher.ts（74 行）与上游 pre-B8 几乎逐行同源，干净替换面；直接受益 fork per-file autoCommit 原子写；为 B7 composer 创建后刷新铺路（建议最先迁） | 低-中：补 `task-path.ts:91` extractTaskIdFromFilename export；保留 fork milestoneMode 接线 | A | ①直接复用（小调整） | [BACK-555](/task/555) | [doc-8 TUI-1](/documentation/8:174-188) |
| B7 | **BACK-430 意图优先的 TUI 任务创建 composer** | TUI `N` 键 + 任务创建 composer（标题/描述/状态/优先级/Draft），失败可回滚/重试，创建后刷新看板聚焦可见任务，空看板可打开。 | TUI 创建入口核心能力，与 fork Draft/sequences/日期体系配合度高；上游 v1.49.1 曾临时隐藏（BACK-566）、BACK-565 修复，建议直接采用成熟版（38d6afa） | 高：fork `createTaskFromInput`（backlog.ts:1043-1160）深度定制（日期自动填充/DoD/lock）；git 临时 index 与 fork per-file autoCommit 冲突；裁 type + priority 本地化 | A | ②参考重写（随 B27 一并） | [DRAFT#87](/draft/87) | [doc-8 TUI-2](/documentation/8:192-206) |
| B27 | **BACK-565 修复 TUI composer UX 与导航** | BACK-430 composer 的成熟版：紧凑层级布局、方向键导航、caret-aware 删除、inert Tab。 | 全部构建在 B7 之上；直接以 38d6afa 为蓝本可避免 77800fe 初版二次重构 | 高（同 B7，依赖 B7 先落地） | A（B7 组成部分） | ②参考重写（随 B7 一并处理） | [DRAFT#87](/draft/87) | [doc-8 TUI-2](/documentation/8:192-206) |
| B21 | **BACK-469 TUI 主题自适应渲染** | 移除硬编码 ANSI 色，inverse+bold 选中态；滚动键/滚动条。 | fork 已自主实现同一方向核心（board.ts:514-522 inverse/bold）；剩余为滚动能力 + 少量颜色清理 | 中-低：fork 移动态 cyan 高亮（board.ts:516-517）为有意定制，勿中性化 | B | ②参考重写（只补滚动缺口） | 不适用 | [doc-8 TUI-4](/documentation/8:228-242) |
| B25(T) | **BACK-551 TUI 任务摘要显示 AC 进度** | TUI 看板卡片/详情显示 AC 完成度 x/y。 | fork 详情已渲染 AC 清单（task-viewer-with-search.ts:1471-1482）但无摘要；上游实现晚于 v1.49.3 未合入 | 中：组件结构分化；进度函数可参考重写 | B | ②参考重写（等上游稳定或先做工具函数） | [DRAFT#96](/draft/96) | [doc-8 TUI-5](/documentation/8:246-260) |
| B24(T) | **BACK-549 改进父子任务 TUI 展示** | 改进 TUI 列表/看板/详情对父子任务关系的呈现：区分父/子、父任务按 terminal-status 汇总子任务进度。 | 上游未实现（仅计划文档 611d6aa，To Do）；fork 已有 attachSubtaskSummaries（task-subtasks.ts:5-19）部分覆盖 | 低：不覆盖 fork sequences/甘特既有呈现；不引入新父子语义 | C | ③忽略（fork 自主演进，可②按 AC 自研） | 不适用 | [doc-8 MISC-1](/documentation/8:580-594) |
| C2 | **BACK-566 临时隐藏 TUI 任务创建入口** | 上游对 unstable composer 的应急响应。 | fork 无 composer（task-composer.ts 不存在），无可隐藏对象；上游已由 BACK-565 修复 | 低 | C | ③忽略 | 不适用 | [doc-8 TUI-6](/documentation/8:264-282) |

---

## 三、Web

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B14 | **BACK-558 阻止浏览器快捷键拦截内联字段** | 任务详情弹窗预览态快捷键（e/c/d/p）在编辑 input/textarea/select/contenteditable 时不触发。 | fork 真实 bug（TaskDetailsModal.tsx:440-468 无守卫，且支持内联编辑）；单文件守卫 | 低：守卫插 L449/450 之间；不迁 editor.ts DI 夹带 | A | ①直接复用 | [BACK-557](/task/557) | [doc-8 WEB-1](/documentation/8:284-298) |
| B12 | **BACK-570 浏览器任务加载异步化** | shell 先行渲染、共享语料后台一次性初始化；服务器 bind-first + servicesReadyPromise 去重；消除空闲发布与重复全量扫描。 | 消除 fork「服务器绑定前阻塞、浏览器长时间白屏」（index.ts:405-407）；性能收益明确 | 中：server 启动为 fork 定制区（/gantt /overview /sequences 路由）；App.tsx 数据流差异大；filterKanbanTasks 现阶段不需要（留 BACK-260） | A | ②参考重写（与 B13 合并实施） | [DRAFT#90](/draft/90) | [doc-8 WEB-2](/documentation/8:302-316) |
| B13 | **BACK-571 浏览器真实加载指示** | WebSocket 推送 loading/loaded/error 三态，Board 骨架屏 + 错误重试面板，侧边栏保持挂载。 | 与 B12 配套，真实解决加载可见性；`browser-loading-state.ts` 可复制 | 中：Board/SideNavigation/Layout 均为 fork 定制 UI，逐个适配；不得覆盖 /gantt /overview /sequences 与 statistics-updated | A | ②参考重写 | [DRAFT#91](/draft/91) | [doc-8 WEB-3](/documentation/8:320-334) |
| B25(W) | **BACK-552 浏览器任务摘要显示 AC 进度** | 浏览器 TaskCard/TaskList 显示 AC 完成度。 | fork 有 AcceptanceCriteriaEditor 但 TaskCard/TaskList 无进度；上游实现未合入 | 中：挂点按 fork 组件适配 | B | ②参考重写 | [DRAFT#97](/draft/97) | [doc-8 WEB-4](/documentation/8:338-352) |
| B26 | **BACK-260 在 All Tasks 中纳入已完成记录** | All Tasks 提供 Include completed 源过滤，URL 持久化，看板仍排除。 | fork 前置条件最好：`loadTasks({includeCompleted})` 与 `source: "completed"`（backlog.ts:2998-3016、types/index.ts:78）已就位 | 低-中：建议「按需合并」路线（端点加参），避免动 Board | B | ③忽略（上游未实现；fork 可自研②参考重写） | 不适用 | [doc-8 WEB-5](/documentation/8:356-370) |
| B9 | **BACK-567 停止空闲浏览器刷新循环** | 修复重复任务预览触发空闲刷新死循环。 | fork 无 refreshLocalTaskCorpus/读时刷新，预览直接读文件系统不发布——bug 在 fork 不存在 | 低 | C | ③忽略（仅借鉴回归测试思路） | 不适用 | [doc-8 WEB-6](/documentation/8:374-388) |
| B10 | **BACK-568 保留真实任务发布** | 重复预览刷新时保留真实任务发布（相等比较忽略 lastModified/source）。 | 同 B9，机制不存在（fork 用 mergeTasks 版本捕获） | 低 | C | ③忽略（仅记录「相等比较忽略元数据」原则） | 不适用 | [doc-8 WEB-7](/documentation/8:392-406) |
| B22 | **BACK-548 任务详情双向依赖图** | 详情展示传递依赖 + 反向依赖（dependents）。 | 上游 To Do 无代码；**且 fork 已挪用该 ID 做 exclude-status 过滤**，需先解 ID 冲突 | 中：fork 已有 Gantt 箭头/onDrillDown 依赖导航基础 | C | ③忽略（可自研②） | 不适用 | [doc-8 WEB-8](/documentation/8:410-424) |
| B23 | **BACK-553 可导航 Web 任务依赖图** | 浏览器可平移/缩放依赖图，派生 Sequence 边界圈出可开工任务。 | 上游 To Do 无代码；与 fork 持久 sequences 语义须区分（上游明确非恢复 sequence） | 中：fork 保留 sequences + Gantt 箭头 | C | ③忽略（可结合 Gantt 经验自研） | 不适用 | [doc-8 WEB-9](/documentation/8:428-446) |
| B24(W) | **BACK-222 改进父子任务 Web 展示** | 优化 Web 父子任务层级展示。 | 上游未实现（仅计划文档）；fork 已有 attachSubtaskSummaries 部分覆盖 | 低 | C | ③忽略（fork 自主演进） | 不适用 | [doc-8 MISC-1](/documentation/8:580-594) |

---

## 四、Server

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| A1 | **BACK-560 浏览器服务仅绑定 loopback** | `Bun.serve` 由默认 `0.0.0.0` 改为仅绑定 `127.0.0.1`。 | **安全修复**：fork 只传 `port`（index.ts:407-408）默认 0.0.0.0 网络暴露；改动 <10 行 | 低：仅加 `BROWSER_HOST` + hostname + URL 统一；不迁上游 isPortAvailable（fork 用 get-port@7.2.0，其探测已含 0.0.0.0，无 macOS 假空闲回归） | A | ①直接复用（核心）/②参考重写（测试） | [BACK-558](/task/558) | [doc-8 SERVER-1](/documentation/8:448-462) |
| B16 | **BACK-562 支持 BROWSER 环境变量** | 打开 Web UI 时 honor 非空 BROWSER（devcontainer），防注入、引号剥离，保留平台 fallback。 | fork 两处重复实现（cli.ts:177-195、index.ts:723-745）都不读 BROWSER；替换无行为冲突 | 低：保留 fork try/catch 手动打开指引；测试需先补 test-utils listenOnEphemeralPort | A | ①直接复用 | [BACK-559](/task/559) | [doc-8 SERVER-2](/documentation/8:466-480) |
| B4 | **BACK-559 让 Core 成为浏览器唯一边界** | 浏览器任务读写统一经 Core + 单一语料快照，消除重复全量扫描（Update x5 1612ms→349ms）。 | 依赖 B3 的 identityIndex；server/web 表层增量（删 fs.loadTask 双读、reorder changedTasks、75ms 广播防抖）可与 B3 解耦先行 | 高：fork ContentStore 深度重写（无 publication-owner 体系），语料快照部分待 B3 落地 | B | ②参考重写（content-store）/①直接复用（server 表层） | [DRAFT#84](/draft/84) | [doc-8 SERVER-3](/documentation/8:484-502) |

---

## 五、Infra / CI / 测试

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B11 | **BACK-569 将 Windows CI 测试降到三分钟以下** | CI 分片（Ubuntu 全量、Windows/macOS 平台契约子集）、CLI 预构建（BACKLOG_TEST_CLI_BUNDLE）、有界并发、测试基建助手。 | fork 即 Windows、三 OS 跑全量，痛点直接对症；run-ci-tests.ts/test-cli.ts/test-preload.ts 可复用 | 高：37 平台契约清单须按 fork 173 文件测试集重建；implementation-notes-append.test.ts 不能照删；bun 1.3.14/checkout@v7/cache@v6 配套升级 | A | ②参考重写为主（机制①直接复用） | [DRAFT#89](/draft/89) | [doc-8 INFRA-1](/documentation/8:504-518) |
| B20 | **BACK-535 测试套件可靠性审计** | 删除 status-callback 测试 4 处固定等待；board.test.ts 改名归类。 | fork status-callback.test.ts:143/183/215/305 有完全相同的 4 处等待，可直接删除 | 低：board.test.ts 改名不适用（fork 该文件是不同套件） | B | ①直接复用 | [DRAFT#61](/draft/61) | [doc-8 INFRA-2](/documentation/8:522-536) |
| B18 | **BACK-541 归档一周前完成的任务** | 上游一次性仓库维护（151 文件 R100 移入 completed），无功能代码。 | fork cleanup（cli.ts:4729-4827）+ getTerminalStatusTasksByAge 已是超集 | 低 | C | ③忽略 | 不适用 | [doc-8 INFRA-3](/documentation/8:540-558) |

---

## 六、Nix / 打包

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| C1 | **BACK-554 用 bun2nix v2 打包** | Nix 打包升级到 bun2nix v2。 | fork 明确锁 V1（`scripts/update-nix.sh:13-16` 注明 V2 与 mkBunDerivation 不兼容）；升级属重构而非修复 | 高：直接冲突于既有 Nix 方案 | C | ③忽略 | 不适用 | [doc-8 NIX-1](/documentation/8:560-578) |

---

## 交叉依赖与建议迁移顺序

- **第一波（独立、零依赖、A 类）**：B8（TUI watcher，最先）→ B15（append-plan）→ B14（浏览器快捷键）→ A1（loopback）→ B16（BROWSER）→ B6（里程碑过滤）→ B5（autoCommit）。
- **第二波（CLI/基建）**：B1（JSON 输出）→ B11（CI 分片，与 B16/B20 共享 test-utils 改动，建议打包为测试基建批次）→ B20。
- **第三波（TUI composer，依赖 B8）**：B7+B27（直接以 BACK-565 最终版为蓝本）→ B21（主题滚动，可选）。
- **第四波（Web 异步，依赖 server）**：B12+B13（合并实施）→ B17（AGENTS.md 清理）。
- **独立大阶段（1.49 身份基石，依赖 task-id.ts 前置）**：B3 → B4（server 表层可先做）→ B2（task type）。
- **可选自研（fork 自主）**：B25（AC 进度）、B26（include completed，fork 前置条件最好）、B24（父子任务展示，fork 已有 attachSubtaskSummaries 基础）。

## 建议

- **优先处理 A 类**：尤其 B8（TUI 刷新竞态，最先）、A1（loopback 安全）、B15（append-plan，管线就绪零冲突）、B6（里程碑过滤，逐字同源）。
- **B3 为独立大阶段**：1.49 身份基石，工作量最大（12 文件 +1312/-503），依赖 `task-id.ts` 前置，建议单独立项，排在 B5/B6 之后。
- **B7/B27 采用成熟版 composer**：不要按 77800fe 初版迁移，直接以 BACK-565（38d6afa）最终布局为蓝本，避免二次重构；C2（BACK-566 隐藏入口）随之自然不适用。
- **B12/B13 合并实施**：先 shell 后数据 + 真实加载指示，直接消除 fork「服务器绑定前阻塞、浏览器长时间白屏」问题；实施时不得覆盖 `/gantt`、`/overview`、`/sequences` 路由与 `statistics-updated` 推送（排除清单第 3/4/5 条）。
- **C 类中 B22 需谨慎**：fork 已挪用 `BACK-548` 这个 ID 做 exclude-status 过滤，若未来合入上游 BACK-548（双向依赖图）必须先解决 ID 冲突。
- **标签约定**：skill 规范要求迁移任务带 `migration`(+`upstream`) 标签，但本 fork 最近决策为「NO `migration`/`upstream` labels on tasks」（例：task 553 仅用 `build`）；现有迁移任务 538/533/537 用了 `migration`。创建迁移任务前请确认采用哪种约定。
- 迁移实施时，若涉及 CLI 文档行为变更（如 B1 `--json`、B15 `--append-plan`），应参考 `backlog instructions documents` 并同步更新 `src/guidelines/` 指南与排除清单。

---

## 备注

- **「代码范围」**：初筛表（已并入上述领域表）标注了任务是否在 `v1.48.0..v1.49.3` 内实际改动 `src/`；若干任务（B2/B18/B19/B21-B28）仅 task-doc commit，代码 pre-range 已合入或未合入。
- **Release Notes 与 commit 记录存在出入**：v1.49.0 notes 列出 BACK-541/355/545，但 BACK-355（task type）代码在 v1.48.0 树已存在、BACK-541（archive）的 `getTerminalStatusTasksByAge` 亦 pre-range 已有；仅 BACK-545（json-output）确为本范围新增。分类以代码足迹为准。
- **上游 commit 前缀编号混乱（BACK-555）**：范围内有 3 个 commit 标着 `BACK-555` 前缀但实现的是其他任务——`ac43fb7`/`f2537ba`（里程碑过滤功能）实为 **BACK-564** PR #820 的早期 commit；`30cd29a`（BROWSER 功能）实为 **BACK-562** PR #817 的早期 commit（均已用 `merge-base --is-ancestor` 验证属对应主线）。真正的 BACK-555 是 handoff 检查指引任务（`7b19db0` 创建，仅任务文档、To Do、无代码，对应本表 B28）。**迁移 BACK-562/BACK-564 时，`git log --grep BACK-555` 会误命中这 3 个 commit，请勿将其归入 BACK-555 工作流。**
