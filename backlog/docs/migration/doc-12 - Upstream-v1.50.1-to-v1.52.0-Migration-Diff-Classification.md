---
id: doc-12
title: Upstream v1.50.1 to v1.52.0 Migration Diff Classification
type: guide
created_date: '2026-09-15 05:13'
updated_date: '2026-09-24 00:27'
---
# 上游变更差异分类（v1.50.1 .. v1.52.0）

## 概述

- **上游分支**：`upstream/main`
- **范围**：`v1.50.1 .. v1.52.0`（131 commits，80 组候选条目）
- **上游仓库**：`MrLesk/Backlog.md`
- **当前工作分支**：`1.52-fixed`（fork 版本 `1.50.2-CN`；上游 `v1.51.0 / v1.52.0` 尚未合入）
- **分析依据**：上游 `v1.51.0 / v1.52.0` Release Notes + `git log --oneline v1.50.1..v1.52.0` + 当前分支排除清单 `references/current-branch-migration-exclusions.md` + fork 能力探针（工作树现状核对）
- **覆盖范围**：候选口径为**双源并集**（范围内 commit 编号 ∪ 范围内任务文件增改），逐条核验归属后登记。范围语义：`v1.50.1`（不含）至 `v1.52.0`（含），涵盖 v1.51.0 功能版与 v1.52.0 小版本。
- **组织方式**：按**领域分组**（CLI/Core、TUI、Web、Server、Infra/CI），每组内按最终优先级（A→B→C）排序；编号沿用初筛编号（CORE-n / TUI-n / WEB-n / SRV-n / INF-n）便于追溯。

## 分类说明

| 分类 | 含义 | 处理建议 |
|------|------|----------|
| **A类** | 必须合入 | 安全漏洞、关键 bug 修复、数据丢失或内容损坏修复、与当前 fork 共用核心路径的回归修复 |
| **B类** | 评估合入 | 新功能、非核心优化，需确认是否与当前 fork 定制冲突 |
| **C类** | 跳过 | 上游特有方向、纯跟踪/无代码、本范围未实现、或当前 fork 已覆盖 |

> ⚠️ **深度分析已执行**（2026-09-15）：下表 A/B/C 为深度分析的**最终分类**，逐条以上游 merge commit 与当前 fork 工作树的 file:line 对照为依据；凡与初筛不同，在本列以 **（升）** / **（降）** 标注。
> **分类口径**：A 类仅限安全漏洞、严重性能瓶颈、与当前 fork 共用模块的关键缺陷（数据丢失 / 内容损坏 / 核心路径不可用）；新增能力、展示优化、内部清理即便当前 fork 净空白也归 B 类评估。
> **重分类摘要**：初筛 A / B / C = 7 / 54 / 19 → 深度分析 **7 / 43 / 30**；升 A 4 条（CORE-19（B→A）、CORE-24（B→A）、TUI-5（B→A）、TUI-10（B→A）），降 C 14 条（CORE-1（B→C）、CORE-4（A→B）、CORE-5（A→B）、CORE-26（A→B）、TUI-11（A→C）、TUI-12（B→C）、WEB-1（B→C）、WEB-3（B→C）、WEB-4（B→C）、WEB-13（B→C）、WEB-16（B→C）、WEB-19（B→C）、SRV-1（B→C）、INF-1（B→C））。**域修正（2026-09-23）**：原 WEB-8 的上游改动全在 TUI（`src/ui/board.ts` 的看板弹窗 + `src/utils/task-watcher.ts` 的签名导出），按 Web 弹窗归类有误；fork 同文件同缺陷可复现，故由 C 回 B 并改列 **TUI-14**（见二、TUI 表）。
> **「原始/迁移任务」列**：上游任务文件已按技能「原始任务文件导入规范」导入为 draft —— A / B 类 49 条填 `[DRAFT#N](/draft/N)`（编号 DRAFT#121..DRAFT#169），③忽略的 C 类留空。升级为当前 fork 任务后替换为 `[BACK-XXX](/task/XXX)`。**「分析报告」列**指向 doc-13 的对应小节。

## 清单口径与数据质量备注

1. **任务编号按创建顺序、合入按 PR 顺序**：`BACK-589 / 590 / 592 / 588 / 401 / 419 / 424 / 551 / 552` 的任务文件早在 `v1.50.1` 之前即存在，代码却在本范围才合入。仅按「范围内新增任务文件」建清单会整批漏掉这批，因此候选取双源并集。
2. **BACK-641 与 BACK-670 互相抵消**：#983 新增 `backlog task dependencies` 命令与 TUI，#993 又将其整体删除。两条合看净零；各自单看会误判为「新增功能」与「删除功能」各需迁移。
3. **无编号 commit 29 条**，其中仅 1 条含真实代码且上游无任务记录（PR #955 侧栏快捷搜索，登记为 WEB-19）；INF-2 / INF-3 亦无任务记录。其余为重构、测试调整或提交信息缺编号。
4. **任务记录状态落后于实现**：`BACK-222` 记录仍为 To Do（实现由 `BACK-222.1` 承接，见 WEB-1）、`BACK-636` 记录为 In Progress（代码已合入）。判断一律以代码足迹为准。
5. **本轮未发现 commit 前缀误标**；所有归属均以 `git show --numstat` 的文件足迹核对，未仅凭 `--grep BACK-XXX`。
6. **表内两类 `BACK-nnn` 含义不同**：「标题」列的是上游任务，「原始/迁移任务」列的 `[BACK-nnn](/task/nnn)` 是 fork 迁移任务。fork 任务号按 fork 自己的创建顺序分配，与上游编号体系无关联，可能同号不同事（例如 fork 的 `BACK-642` 对应 CORE-7，而上游的 `BACK-642` 是 SRV-2）。判断以链接指向为准。

---

## 一、CLI / Core（命令行与核心数据）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| CORE-1 | **BACK-401 Add dueDate support for tasks and milestones across CLI, TUI, Web, and MCP** | 为任务与里程碑引入 dueDate，打通 CLI / TUI / Web / MCP 全链路 | 数据模型与展示链路变更；与排除清单 §2 的日期字段体系正面重叠，必须核对是否回退 actualStart / actualEnd 的 UTC date-time 语义 | 高 | **C**（降） | ③忽略 |  | [doc-13 CORE-1](/documentation/13:32-42) |
| CORE-2 | **BACK-548 Expose bidirectional dependency graphs in task details** | 任务详情暴露双向依赖图，上游同时覆盖 Web 弹窗与 MCP 输出 | 新功能；依赖图在任务详情内一次算好、各界面只负责渲染，fork 无等价能力 | 中 | B | ①直接复用 | [DRAFT#121](/draft/121) | [doc-13 CORE-2](/documentation/13:46-56) |
| CORE-3 | **BACK-626 Make task archive, complete, and demote local-first like view and edit** | archive / complete / promote / demote 由远端优先改为本地工作副本优先 | 行为变更，直接影响 fork 的 CLI 生命周期命令；与 CORE-32 归档清理同域；与 CORE-32 合并为 [BACK-691](/task/691) 落地（2026-09-22，草稿已删） | 中 | B | ②参考重写 | [BACK-691](/task/691) | [doc-13 CORE-3](/documentation/13:60-70) |
| CORE-4 | **BACK-627 Prevent forced allocation refresh from joining an in-flight stale fetch** | 强制刷新任务分配时不再并入在途的陈旧 fetch | 真实数据正确性修复；fork 有 cross-branch 索引管线，属同源风险 | 中 | **B**（降） | ②参考重写 | [BACK-660](/task/660) | [doc-13 CORE-4](/documentation/13:74-84) |
| CORE-5 | **BACK-628 Stop findIdentity rename fallback from publishing freshness without installing the corpus** | findIdentity 改名回退不再在未装载语料时发布 freshness | 真实数据正确性修复（索引新鲜度被错误发布）；fork 同源管线；**落地（2026-09-24，[BACK-699](/task/699)）**：fork 的 rename 回退（`src/core/content-store.ts:1089`）与 Core loader 闭包（`src/core/backlog.ts:358`）原本与上游改前同形，故按 1:1 接入 —— 新增 `TaskLoaderOptions { publish?: boolean }` 贯穿构造参数 → `loadTasksWithLoader` → `taskLoader` 调用，回退改 `{ publish: false }`，末行改 `publishSharedState: options?.publish ?? true` 让两个安装方仍默认发布。复现要点（首版用例竟为绿）见 doc-13 | 中 | **B**（降） | ②参考重写 | [BACK-699](/task/699) | [doc-13 CORE-5](/documentation/13:88-98) |
| CORE-6 | **BACK-635 Reserve draft, doc, and decision prefixes at init** | init 预留 draft / doc / decision 前缀，避免与任务前缀相撞 | 纯增量防线，无回退风险 | 低 | B | ②参考重写 | [BACK-647](/task/647) | [doc-13 CORE-6](/documentation/13:102-112) |
| CORE-7 | **BACK-636 Fail closed on ambiguous draft identities** | 草稿身份歧义时 fail-closed（4 个 commit 的完整收敛） | 数据正确性；与 fork 任务侧已具备的 AmbiguousTaskIdError 方向一致 | 中 | A | ②参考重写 | [BACK-642](/task/642) | [doc-13 CORE-7](/documentation/13:116-126) |
| CORE-8 | **BACK-637 Preserve consecutive blank lines inside fenced code blocks in notes (issue 930)** | notes 中围栏代码块内的连续空行不再被吞（issue 930） | 内容完整性缺陷：解析吞行会损坏用户笔记；fork 有 processCliEscapes 同源处理 | 中 | A | ②参考重写 | [BACK-643](/task/643) | [doc-13 CORE-8](/documentation/13:130-140) |
| CORE-9 | **BACK-638 Allow task list --status to accept several statuses** | task list --status 支持多值（重复传入或逗号分隔）；fork 的 CLI 累加已具备，迁移补共享 status-filter 并打通交互视图 | CLI 筛选能力增强，无冲突 | 低 | B | ②参考重写 | [BACK-652](/task/652) | [doc-13 CORE-9](/documentation/13:144-154) |
| CORE-10 | **BACK-639 Make drafts editable from the CLI and TUI** | 草稿可从 CLI 与 TUI 编辑（10 个 commit，改动面大） | 净空白：fork 的 draft 命令集只有 list/create/archive/promote/view，无 draft 编辑能力；**已落地（2026-09-22，[BACK-683](/task/683)）**：CLI 侧把 `task edit` 的字段选项链与「选项 → editArgs」映射抽成共享 helper 后新增 `draft edit`（状态只接受 Draft、其余指向 `draft promote`，一次一个 id），TUI 侧在 `Core.editTaskInTui` 加草稿兜底并复用任务编辑路径（`resolveDraftFilePath` fail-closed、失败原因增 `ambiguous`），即**草稿编辑按任务的实现走**——任务可降级为草稿，降级后的草稿与任务同路径可编辑，草稿不进 `contentStore` | 中 | B | ②参考重写 | [BACK-683](/task/683) | [doc-13 CORE-10](/documentation/13:158-168) |
| CORE-12 | **BACK-643 Add a project task attribute for monorepo backlogs** | 新增任务 project 属性支撑 monorepo 场景，跨 CLI / MCP / TUI / Web / Server 共 58 个文件 | fork 完全缺失该属性，属纯增量；改动面极大 | 低 | B | ②参考重写 | [DRAFT#130](/draft/130) | [doc-13 CORE-12](/documentation/13:190-200) |
| CORE-19 | **BACK-648 Fall back to a placeholder filename for punctuation-only titles** | 纯符号标题回退为占位文件名，不再创建失败 | 边界修复，无冲突 | 低 | **A**（升） | ②参考重写 | [BACK-650](/task/650) | [doc-13 CORE-19](/documentation/13:319-329) |
| CORE-20 | **BACK-649 Single-source task search config and filters in core** | 搜索配置与过滤器收敛为 core 单一来源 | fork 已有 src/utils/task-search.ts，需与之对齐；**重分析实测补齐（2026-09-21）**：上游缺陷在 fork 全量复现——同一 label/assignee 查询本地索引命中、SearchService 空（bodyText 构建缺 labels/assignee：search-service.ts:592-622 vs task-search.ts:148-149），labels 过滤六处分歧（CLI all / Core any / MCP all+大小写敏感 / SearchService any / TUI 可配 / web 里程碑页无），过滤实现共五份；落地以 23403d5b 首版为基准（窗口内 BACK-643 给共享匹配器加 project 谓词，CORE-12 未迁移须剔除），保留 fork 文件名搜索键（fileName）与 applySharedTaskFilters 消费者；并保留 wiki 搜索语料——上游 BACK-649 后搜索集合仍不含 wiki（v1.52.0 search-service.ts grep 0 命中），wiki 实体 + fileName 权重为 fork BACK-481 自研，照搬共享配置会一并回退（2026-09-22 实测补齐） | 中 | B | ②参考重写 | [BACK-685](/task/685) | [doc-13 CORE-20](/documentation/13:333-343) |
| CORE-21 | **BACK-650 Route TUI and milestone-page task search through the shared core search** | TUI 与里程碑页搜索改走 core 共享搜索（承接 BACK-649） | 依赖 CORE-20 先落地；与 fork 自研搜索入口需合并；**重分析实测补齐（2026-09-21）**：fork TUI 双路径与手写 post-filter 原样在（task-viewer-with-search.ts:206-243,640-695），web 里程碑页私有 Fuse 仅 id/title 与全库不一致；其 exact-id/substring 预匹配路由后消失，去留待定；readiness 保留 fork 引擎（与 fork 已落地的「readiness 只做 JSON 发布、不收敛 core」决策一致） | 中 | B | ②参考重写 | [BACK-686](/task/686) | [doc-13 CORE-21](/documentation/13:347-357) |
| CORE-22 | **BACK-651 Remove the temp-file roundtrip in README board export** | README board 导出去掉临时文件中转；分析报告另提的 board.ts 排序非变异经核实不可观测，不纳入 | 内部实现清理，无行为变更 | 低 | B | ①直接复用 | [BACK-653](/task/653) | [doc-13 CORE-22](/documentation/13:361-371) |
| CORE-23 | **BACK-656 Reject self-referential and cyclic task dependencies** | create / edit 拒绝自依赖与循环依赖，并打印循环路径 | fork 有依赖字段但无环检测；纯增量校验 | 中 | B | ②参考重写 | [DRAFT#135](/draft/135) | [doc-13 CORE-23](/documentation/13:375-385) |
| CORE-24 | **BACK-658 Resolve dependency targets in completed and archived tasks** | 已完成与归档记录中的依赖目标可解析，不再靠猜测 | 依赖解析正确性；fork 归档会释放 ID，归档记录不可作依赖目标（有意排除） | 低 | **A**（升） | ②参考重写 | [BACK-664](/task/664) | [doc-13 CORE-24](/documentation/13:389-399) |
| CORE-25 | **BACK-659 Include grandchild subtasks in board export grouping** | board 导出分组纳入孙级子任务；分析报告另提的 milestone 分组板经核实为平铺输出、不受影响，仅补测试固化 | 导出逻辑补全，无冲突 | 低 | B | ①直接复用 | [BACK-654](/task/654) | [doc-13 CORE-25](/documentation/13:403-413) |
| CORE-26 | **BACK-660 Reject nested section markers in notes and fix append truncation** | task edit -d 传入文本已含分节标记时不再嵌套（曾致 AC / notes 被藏进描述并截断追加） | 内容完整性缺陷：会把 AC / notes 藏进描述并截断追加内容。实测补齐：上游 9 例 marker 套件在 fork 上 8 红；同一文件的 fence 扫描器弱于上游（24 例套件 7 红，其中 2 例真丢内容），本次一并升级、取代 BACK-643 的简化实现 | 中 | **B**（降） | ②参考重写 | [BACK-655](/task/655) | [doc-13 CORE-26](/documentation/13:417-427) |
| CORE-27 | **BACK-662 Add references and modifiedFiles to task list --json** | task list --json 增加 references 与 modifiedFiles 字段 | JSON 契约扩展，纯增量 | 低 | B | ①直接复用 | [BACK-697](/task/697) | [doc-13 CORE-27](/documentation/13:431-441) |
| CORE-28 | **BACK-663 Dependency graph follow-ups from BACK-548 review** | 依赖图 follow-up：缺失引用 / 歧义 ID / 环按原样呈现 | 承接 CORE-2，需与之一并评估 | 中 | B | ②参考重写 | [DRAFT#140](/draft/140) | [doc-13 CORE-28](/documentation/13:445-455) |
| CORE-29 | **BACK-664 Read the Backlog overview once per conversation instead of per request** | CLI agent nudge 改为每会话读一次 overview，而非每请求（报告原记作 MCP 指南，实为 cli-agent-nudge.md） | 纯指令文档；fork 有对应指令文档需同步 | 低 | B | ②参考重写 | [BACK-656](/task/656) | [doc-13 CORE-29](/documentation/13:459-469) |
| CORE-30 | **BACK-669 Close residual self-dependency gaps from the BACK-656 review** | 补齐 BACK-656 评审遗留的自依赖缺口 | 承接 CORE-23，同域小补丁 | 中 | B | ②参考重写 | [DRAFT#142](/draft/142) | [doc-13 CORE-30](/documentation/13:473-483)；注：该 `BACK-669` 号属**上游**，fork 的 [BACK-669](/task/669) 是 WEB-14 迁移任务，两者撞号勿混 |
| CORE-31 | **BACK-672 Compute task readiness once in core and carry isReady on task lists** | readiness 计算收敛到 core，并随任务列表带出 isReady | 与 fork 自研 src/utils/readiness.ts（BACK-615）同能力对撞；fork 侧只缺「发布」这一层（引擎与 4 个调用方都在），故只做 JSON 发布、不收敛到 core；注：该 `BACK-672` 号属**上游**，fork 的 [BACK-672](/task/672) 是 web 侧栏 wiki 树排序（标题 / 文件名），两者撞号勿混 | 高 | B | ②参考重写 | [BACK-658](/task/658) | [doc-13 CORE-31](/documentation/13:487-497) |
| CORE-32 | **BACK-673 Clean dependency references when archiving or demoting a task** | 归档 / 降级任务时清理其他任务对它的引用 | 数据完整性（消除悬空依赖）；与 fork 归档降级逻辑强耦合；与 CORE-3 合并为 [BACK-691](/task/691) 落地（2026-09-22，草稿已删；返回值未改 {success, cleanedTaskIds}，按本表建议保留布尔/string 返回并以回调上报） | 高 | B | ②参考重写 | [BACK-691](/task/691) | [doc-13 CORE-32](/documentation/13:501-511) |
| CORE-33 | **BACK-676 Make agent task descriptions carry the why** | agent 任务描述要求写出「为什么」。实测补齐：CLI / MCP 两份 task-creation 指南的示例均为 outcome-only 或缺失，project-manager 示例同属该缺陷 | 纯指令文档；注：该 `BACK-676` 号属**上游**，fork 的 [BACK-676](/task/676) 是 TUI-6「emoji 双宽」迁移任务，两者撞号勿混 | 低 | B | ②参考重写 | [BACK-656](/task/656) | [doc-13 CORE-33](/documentation/13:515-525) |
| CORE-34 | **BACK-678 Make due date a date-only string everywhere** | due date 全线改为 date-only 字符串（涉及 32 个文件） | 与排除清单 §2 部分重叠：fork 的 dueDate 已是 date-only，风险在于该改动是否波及 actualStart / actualEnd 的 UTC date-time 语义；注：该 `BACK-678` 号属**上游**，fork 的 [BACK-678](/task/678) 是 TUI-3「composer 极端终端尺寸可用性」迁移任务，两者撞号勿混；核心 fork 已满足（存储 / CLI / Web / TUI viewer 全线 date-only，actualStart/actualEnd 的 UTC 语义未波及），仅 overview「Due By」date-only 显示偏移一处残留，已由 [BACK-690](/task/690) 修复落地（2026-09-22，草稿已删） | 高 | B | ②参考重写 | [BACK-690](/task/690) | [doc-13 CORE-34](/documentation/13:529-539) |
| CORE-38 | **BACK-686 Watch task lists with the existing JSON output** | task list --json --watch 增量流式快照 | fork 完全缺失 watch 能力，纯增量；上游改的文档锚点与 CI 清单在本仓不存在，改写落在 `CLI-INSTRUCTIONS.md` 与 shipped overview；Windows 下「子进程 cwd + kill」会锁死工程目录，测试改用 `BACKLOG_CWD` 指向工程根 | 低 | B | ②参考重写 | [BACK-657](/task/657) | [doc-13 CORE-38](/documentation/13:597-607) |

---

## 二、TUI

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| TUI-1 | **BACK-551 Show acceptance criteria completion on TUI task summaries** | TUI 任务摘要显示 AC 完成度 | **实测补齐（2026-09-20）**：详情页的 AC **计数**（「验收标准 (6/6)」）是既有能力、可追溯至 `c13a14d14`（2025-09-07），与进度条**并存**而非同一件事；fork 早已自行落地同能力（BACK-569），`src/ui/acceptance-criteria-progress.ts` 与上游逐字等价（此前仅 `WIDE_PROGRESS_MIN_WIDTH` 差异：fork 32 / 上游 40），`board.ts:122-140` 卡片行已显示实时进度；~~fork 详情页摘要区亦有进度行（`task-viewer-with-search.ts:1551-1556`），故两侧插入点恰好相反——上游只有列表行有（`formatTaskViewerListItem`）、详情页的 AC 段无 `progressLine`，fork 反之，各覆盖一半、属两种形态而非缺失~~——**后续修正（2026-09-20，用户实测后定案）**：详情页不绘制进度条，该行已随 [BACK-675](/task/675) 移除（连同为其传入宽度的管线一并还原），条形只落在 board 行，两侧形态一致；另 **v1.52.0 的实际形态是 `[####-] 4/5`（5/3 格 ASCII + 彩色），非首版 10/5 格方块**（该文件被 BACK-657 / BACK-666 / BACK-642 三次后续提交覆盖）；且上游 AC #8「CLI 与 MCP 输出不变」与 fork 现状相反（fork 已让 CLI / MCP 列表输出 `(ac: x/y)`，见 `src/cli.ts:2597`、`src/mcp/tools/tasks/handlers.ts:99`），照上游重写会与之对撞；**定案修正（2026-09-20）**：该条与 TUI-7 / TUI-9 同属一个文件的连续演进，三者已合并为一个任务 [BACK-675](/task/675)，直接落到上游最终形态（ASCII `#`/`-` + 彩色 + 5/3 格 + clamp，阈值一并对齐为上游 40） | 低 | B | ②参考重写 | ~~DRAFT#148~~（草稿已删） | [doc-13 TUI-1](/documentation/13:694-704) |
| TUI-2 | **BACK-588 Make the TUI help popup robust to resize and wrapped lines** | 帮助弹窗对终端尺寸变化与换行鲁棒 | fork 帮助弹窗确为自研（四套快捷键 + 底部文案 + `escape/q/Q/?`），按「对齐而非照搬」处理；**实测补齐（2026-09-20）**：上游 `faba7359` 的两条在 fork 都缺——弹窗用 `top: "center"` 由 blessed 在绘制时才解析（resize 后弹窗自己会重新居中），而 `createPopupChrome` 的灰底是绝对坐标、停在原处，窗口由 24 行缩到 12 行时灰底比弹窗多出 7 行；弹窗高度也只在按下 `?` 时算一次；落地形态 = 接上 `createPopupChrome` 早已返回、task-composer 一直在用的 `reflow`，新增 `applyLayout` / `getMaxScrollOffset` / `onResize` 并在关闭时移除监听；号属 fork，与上游 BACK-677「Show local time in the web UI with the UTC value on hover」撞号 | 低 | B | ②参考重写 | [BACK-677](/task/677) | [doc-13 TUI-2](/documentation/13:708-718) |
| TUI-3 | **BACK-589 Improve composer usability at extreme terminal sizes** | 极端终端尺寸下的 composer 可用性 | fork composer 确为自研，属体验补丁；**实测补齐（2026-09-20）**：上游 `3af4056e` 的两条缺陷 fork 都复现——`popupHeight` 只按 `screenHeight - 2` 算，80x8 时表单视口仅 1 行（3 行带框文本输入只画出顶边框，没有编辑行与可见光标）；非 compact 下两个选择器各占表单 30%，80 列时状态选择器 20 格装不下 `Status: In Progress ▼` 的 21 格；compact 判定只看 `screenWidth < 64 \|\| screenHeight < 20` 两个固定阈值、与内容无关。落地形态 = 高度改为「弹窗 chrome + 一个完整带框输入」、宽度改为 `Bun.stringWidth` 量最长选项推导、compact 改为按内容约束判定；上游的 `stackSelectors` 字段未移植（fork 无 type 选择器，且 compact 本来就已把两个选择器各自铺满一行，该字段恒为死状态）；号属 fork，与上游 BACK-678「Make due date a date-only string everywhere」撞号 | 低 | B | ②参考重写 | [BACK-678](/task/678) | [doc-13 TUI-3](/documentation/13:722-732) |
| TUI-4 | **BACK-590 Support mouse clicks in the TUI task composer** | TUI composer 支持鼠标点击 | fork composer 确为自研（Title / Description 走 `readInput`、Status / Priority 是自研选择器），属新交互能力；**实测补齐（2026-09-20）**：上游 `b2fecd1d` 的能力在 fork 只接了一半——两个文本框根本没绑 `click`（`inputOnFocus: false`），选择器的 `click` 既不先走 `focusField` 也不返回值，于是 blessed 祖先链 `element click` 把同一 widget 二次聚焦，而 `screen.focused` setter 的 `_focus(el, old)` **无条件** `old.emit("blur")` → 自 blur → `readInput` 刚建立的读态立刻被 `_done` 翻回 false（同一时刻 `__listener` 尚未挂上，随后按 Escape 落到 `done(null, null)` 抛 `TypeError: done is not a function`）；真机 100x30 复现为「点描述后 `screen.focused` 确是 description，但 `_reading=undefined`、边框仍灰、Title 仍黄，输入落不进去」。落地形态 = 四类字段的 `click` 统一汇入既有 `focusField`（文本复用 `readInput`、选择器调 `openPicker`），handler `return false` 阻断冒泡；上游遍历里的 type 选择器不在 fork surface（fork 无 Type 选择器）；号属 fork，与上游 BACK-679「Quote assignee and reporter under every frontmatter key spelling」撞号 | 低 | B | ②参考重写 | [BACK-679](/task/679) | [doc-13 TUI-4](/documentation/13:736-746) |
| TUI-5 | **BACK-592 Make TUI text field insertion Unicode-safe** | 文本框插入 Unicode 安全 | 输入正确性补丁，与 fork 中文环境强相关 | 低 | **A**（升） | ②参考重写 | [BACK-648](/task/648) | [doc-13 TUI-5](/documentation/13:750-760) |
| TUI-6 | **BACK-646 Count emoji as double-width in the TUI** | emoji 按双宽计算，含 emoji 的行不再错位 | 渲染正确性；fork 中文 / emoji 场景常见；号属 fork，与上游 BACK-676「Make agent task descriptions carry the why」撞号 | 低 | B | ①直接复用 | [BACK-676](/task/676) | [doc-13 TUI-6](/documentation/13:764-774) |
| TUI-7 | **BACK-657 Make the TUI acceptance-criteria bar degrade gracefully without Block Element glyphs** | 缺少 Block Element 字形时 AC 进度条优雅降级为 ASCII | 兼容性补丁，Windows 终端尤为需要 | 低 | B | ②参考重写 | [BACK-675](/task/675) | [doc-13 TUI-7](/documentation/13:778-788) |
| TUI-8 | **BACK-661 TUI multi-select move with shift-arrow recruitment** | TUI 多选移动（M 标记 + Shift+方向键扩选） | 新交互能力，无冲突；**已落地（2026-09-21，[BACK-681](/task/681)）**：落地形态是把招募**并入 fork 既有的 `m` 移动流程**、而非另开并行模式——`MoveOperation` 增 `selectedIds` / `highlightTaskId`，`Shift+↑↓` 沿目标列的招募面（含 ghost 行）走高亮，被拖任务的位置与板序不变，`M` / `Shift+M` 经 `updateMoveSelection` 招募并借 `mapInsertionIndex` 重锚 `targetIndex` 让 ghost 视觉不动，招募项沿用原 `►`、留在原位；招募后的第一次普通方向键收起高亮，预览整块按板面顺序落位，再按方向键在块内换序，下界为 `column.tasks.length - getPreviewMovingIds(...).length`；确认先 snapshot 预览再 await，非空 `selectedIds` 落 `performSetMove` 调 `core.moveTasksToStatus(..., orderedTaskIds)`（BACK-680 的原语）、空则仍走单任务 `reorderTask`，写期间 `movePending` 冻结方向键与招募；`closeBoard` 改为 first-request-wins 并 await 新增的 `pendingMoveWrite`（顺带补掉单任务 mover 的同一处旧洞）；footer 提示与帮助弹窗同步更新。**fork 适配**：`buildRenderedTaskListItems` 收 `ReadonlySet<string>`（fork 签名无 `dateFormat` / `configuredProjects`）、`getFormattedItems` 保留 `columnCount` 入参、移动阻断判定仍用本地 `hasMoveBlockingFilters`；**主动分歧**：ghost 上的普通方向键恒被消费（上游把 `collapseHighlight()` 放在 `if (movePending) return;` 之后），这是招募集合能用普通方向键换序的前提。上游那条 `board-tui-multi-move-pty` 用例与其 `run-tui-interactive-tests.sh` 接线有意未移植（本机无法驱动真 pty，raw `ESC[1;2B` 也无从验证），改由新增的 `src/test/board-tui-move.test.ts` 键盘 harness 21 例按全名覆盖同一批按键。 | 低 | B | ②参考重写 | [BACK-681](/task/681) | [doc-13 TUI-8](/documentation/13:792-802) |
| TUI-9 | **BACK-666 Compact colored acceptance-criteria bar in the TUI** | 紧凑彩色 AC 进度条 | 展示优化 | 低 | B | ②参考重写 | [BACK-675](/task/675) | [doc-13 TUI-9](/documentation/13:806-816) |
| TUI-10 | **BACK-674 Sort the TUI list view through the shared task ID comparator** | TUI 列表排序统一走共享任务 ID 比较器（修 1.10 排在 1.2 之前） | 排序正确性；共享比较器需与 fork 对齐 | 低 | **A**（升） | ①直接复用 | [BACK-649](/task/649) | [doc-13 TUI-10](/documentation/13:820-830) |
| TUI-14 | **BACK-644 Keep the board task popup in sync with live task state** | TUI 看板任务弹窗随实时任务状态刷新 / 关闭（外部或 agent 编辑驱动） | **域修正（2026-09-23）**：上游改动全在 TUI —— `src/ui/board.ts`（弹窗 `openTaskPopup` 可重建 + `syncOpenPopup` 由看板更新漏斗驱动 + `restoreColumnFocus` 列索引 clamp）与 `src/utils/task-watcher.ts`（`taskSignature` 导出为 `taskContentSignature` 复用给看板），原登记在 Web 域（WEB-8）且理由按 Web 弹窗写，属域误判；**实测补齐（2026-09-23）**：fork 同文件同缺陷 —— 弹窗内容在打开时快照（`board.ts:1544-1563` 捕获 `task`，`task-viewer-with-search.ts:1694` 的 `generateDetailContent(task)` 只跑一次），`updateBoard` 漏斗（`board.ts:1258-1285`）只重绘列、无弹窗分支，E 路径 `openTaskEditor`（`board.ts:1485-1529`）也只回写 `currentTasks` 不重建弹窗；fork `task-watcher.ts:39` 的 `taskSignature` 语义与上游 `taskContentSignature` 一致但未导出；探针 `tmp/probe-board-popup-stale.ts` 实测「外部编辑后弹窗仍是旧标题旧正文」「任务被移除后弹窗不关也不提示」，上游 AC #1 / #2 / #3 均未满足；**无草稿**（C 类未导入），落地直接参考上游 `11836ada8`（127 行，须并入 fork 自研弹窗的 backdrop 与草稿会话） | 中 | **B**（域修正） | ②参考重写 | [BACK-694](/task/694) | [doc-13 WEB-8](/documentation/13:980-990) |
| TUI-11 | **BACK-675 Fix Windows TUI keyboard input after Tab view switch** | 修复 Windows 下 Tab 切换视图后键盘输入失灵 | 交互缺陷，直接命中 fork 主力运行环境（Windows）；注：该 `BACK-675` 号属**上游**，fork 的 [BACK-675](/task/675) 是 TUI-1+TUI-7+TUI-9 三合一迁移任务，两者撞号勿混 | 低 | **C**（降） | ③忽略 |  | [doc-13 TUI-11](/documentation/13:834-844) |
| TUI-12 | **BACK-24.02 CLI TUI: Add milestone swimlanes to interactive board view** | 交互看板增加里程碑泳道 | fork 的 web 看板已有自研泳道，TUI 侧缺位，需先核对实现差异 | 中 | **C**（降） | ③忽略 |  | [doc-13 TUI-12](/documentation/13:848-858) |

---

## 三、Web

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| WEB-1 | **BACK-222.1 Show parent and subtask hierarchy in the web task details modal** | web 任务弹窗展示父子 / 子任务层级（8 个 commit） | 弹窗为 fork 深度定制区域（AC 进度环等），需参考重写 | 中 | **C**（降） | ③忽略 |  | [doc-13 WEB-1](/documentation/13:882-892) |
| WEB-2 | **BACK-419 Add Web UI demote-to-draft action** | web 增加「降级为草稿」操作 | 与 fork web 任务操作区耦合 | 中 | B | ②参考重写 | [BACK-646](/task/646) | [doc-13 WEB-2](/documentation/13:896-906) |
| WEB-3 | **BACK-424 Support multiple status filters in Web task lists** | web 任务列表支持多状态筛选 | 纯增量筛选能力 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-3](/documentation/13:910-920) |
| WEB-4 | **BACK-552 Show acceptance criteria progress on browser task summaries** | 浏览器任务摘要显示 AC 进度 | 展示增强；与 WEB-16 同域 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-4](/documentation/13:924-934) |
| WEB-5 | **BACK-630 Filter the web dependency picker to locally-resolvable tasks** | 依赖选择器只列出本地可解析的任务 | 依赖解析范围与排除清单 §2 相关；**实测补齐（2026-09-19）**：fork 校验取含跨分支的 `queryTasks()`（设计层：跨分支目标属合法依赖；本仓库因前缀缺陷 + `remote_operations: false` 当前无跨分支候选，候选集仅本地/草稿/已完成），「建议了却存不下」不成立，且上游客户端过滤在 fork 不生效 | 低 | **C**（降） | ③忽略 | ~~DRAFT#159~~（草稿已删） | [doc-13 WEB-5](/documentation/13:938-948) |
| WEB-6 | **BACK-633 Show and edit modified files in the web task modal** | web 弹窗展示并可编辑 modified files | 弹窗定制区新增字段，需评估落位；**实测补齐（2026-09-19）**：字段在 fork 早已存在且已进入 web 语料，落地形态为 References/Documentation/Modified Files 三页签面板（非上游的独立第三节） | 低 | B | ②参考重写 | [BACK-666](/task/666) | [doc-13 WEB-6](/documentation/13:952-962) |
| WEB-7 | **BACK-634 Fix web UI draft editing** | 修复 web 草稿编辑完全不可用 | 功能完全不可用的缺陷修复 | 中 | A | ①直接复用 | [BACK-644](/task/644) | [doc-13 WEB-7](/documentation/13:966-976) |
| WEB-9 | **BACK-645 Move multiple selected tasks between statuses in one action** | 看板拖拽多选批量改状态（对应 commit 无 BACK 前缀，issue #945） | 新交互能力；上游该改动未挂任务编号，归属靠代码足迹核对；**落地（2026-09-21，[BACK-680](/task/680)）**：fork 在自研泳道看板上落地多选（Ctrl/Cmd 点击 + Shift 范围）、选区工具条与批量拖拽（整块选区走一次 `POST /api/tasks/move`），并一并落地 CLI 批量编辑（多 ID 只接共享字段 flag；per-task-only flag 在批量下报错拒绝）；原地释放由 `dropPosition='self'` 触发既有 `isOrderUnchanged` 守卫成为纯 no-op。TUI 多选按维护者判定拆为后续任务，fork 的 TUI 仍是单任务 mover | 中 | B | ①直接复用 | [BACK-680](/task/680) | [doc-13 WEB-9](/documentation/13:994-1004) |
| WEB-10 | **BACK-652 Replace the ASCII progress bar on web task summaries with a web-native indicator** | web 任务摘要的 ASCII 进度条改为 web 原生指示器 | 展示优化；与 WEB-16 同域；**实测补齐（2026-09-19）**：fork 卡片与列表均已改用自研 `variant="bar"`（`TaskCard.tsx:251`、`TaskList.tsx:856`，列表侧由 [BACK-645](/task/645) 引入），`cells` 变体已无 UI 调用点，上游 SVG ring 仅剩形状差异；**定案（2026-09-19）**：不做视觉升级 | 低 | **C**（降） | ③忽略 | ~~DRAFT#163~~（草稿已删） | [doc-13 WEB-10](/documentation/13:1008-1018) |
| WEB-11 | **BACK-653 Update web views in place instead of full reload on data changes** | web 视图原地更新，不再整体重载（保住筛选 / 滚动 / 弹窗） | 影响面广的前端状态改造，fork 前端已深度定制；**落地（2026-09-23，[BACK-698](/task/698)）**：fork 深度定制的刷新链路按增量口径重写 —— 新增 `src/web/utils/reconcile.ts`（`deepEqual`/`reconcileById`，未变记录保对象、未变列表保数组）、`refreshTasksData`（只取 `/api/search`，里程碑作用域另取里程碑实体）、服务端 `broadcastDataUpdated(scope)` 发 `milestones-updated`（create 端点此前不广播，现也广播）；全量 `loadAllData` 保留在首载 / 配置变更 / 重连 / 失败回退；真机实测一次外部改文件从 13 请求 / 10 端点降到 **1 请求 / 1 端点** | 中 | B | ①直接复用 | [BACK-698](/task/698) | [doc-13 WEB-11](/documentation/13:1022-1032) |
| WEB-12 | **BACK-654 Polish the cross-branch indexing loading indicator in the web UI** | cross-branch 索引进度指示器打磨 | 与 fork cross-branch 管线同域；**实测补齐（2026-09-20）**：fork `App.tsx` 已有 `loadingMessage` 管道与 4 处可见消费点（Board 载入面板 + SideNavigation 3 处），确为「形态不同」而非缺失；落地形态 = 页头 chip 显示**本地化后的真实进度句**（fork 分歧，上游为硬编码短标签 + `title`/`sr-only`）；号属 fork，与上游 BACK-668「清理 rounded-full」撞号 | 中 | B | ①直接复用 | [BACK-668](/task/668) | [doc-13 WEB-12](/documentation/13:1036-1046) |
| WEB-13 | **BACK-655 Open task details in place from sidebar dependency chips** | 侧栏依赖 chip 原地打开任务详情 | 依赖 CORE-2（依赖图）先落地 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-13](/documentation/13:1050-1060) |
| WEB-14 | **BACK-665 Polish the web UI initial loading state** | web 初始加载状态统一（两种主题一致） | 展示打磨；**实测补齐（2026-09-20）**：fork 首屏为自绘灰面板（dead `rounded-full` 方块 spinner + 3 灰块），确为「形态不同」而非缺失；落地形态 = ghost 列骨架（列数走 fork 配置状态数，超时 3 列兜底）+ 紧凑圆环，**不带文案**（fork 分歧：进度句归页头 chip，BACK-668 起已是唯一来源）；号属 fork，与上游 BACK-669「补自依赖缺口」撞号；载入动效的 `motion-reduce` 抑制按 fork 实测移除（[BACK-670](/task/670)） | 低 | B | ①直接复用 | [BACK-669](/task/669) | [doc-13 WEB-14](/documentation/13:1064-1074) |
| WEB-15 | **BACK-677 Show local time in the web UI with the UTC value on hover** | web 显示本地时间、悬停显示 UTC | 与排除清单 §2「存储 UTC、展示本地时区」方向一致，非冲突项；需核对 fork 是否已自行实现；注：该 `BACK-677` 号属**上游**，fork 的 [BACK-677](/task/677) 是 TUI-2「帮助弹窗 resize 鲁棒」迁移任务，两者撞号勿混 | 中 | B | ①直接复用 | [BACK-673](/task/673) | [doc-13 WEB-15](/documentation/13:1078-1088) |
| WEB-16 | **BACK-684 Move the acceptance-criteria ring into the web card header** | AC 进度环移入看板卡片头部，去掉标题下多余一行 | 与 fork 已定制的卡片头部布局相关 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-16](/documentation/13:1092-1102) |
| WEB-19 | **Sidebar quick search hides real matches on larger projects** | 侧栏快捷搜索在较大项目上隐藏真实匹配 | 上游无任务记录，仅一个 commit；属可用性缺陷 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-19](/documentation/13:1153-1163) |

---

## 四、Server / MCP / 输出格式

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| SRV-1 | **BACK-622 Return acceptance criteria progress in task JSON outputs** | JSON 输出返回 AC 完成度（含 CLI-INSTRUCTIONS） | JSON 契约扩展；fork 字段名为 acceptanceCriteriaItems，需做映射 | 低 | **C**（降） | ③忽略 |  | [doc-13 SRV-1](/documentation/13:1169-1179) |
| SRV-2 | **BACK-642 Show acceptance criteria progress in MCP and plain task lists** | MCP 与 --plain 列表显示 AC 完成度 | 与 SRV-1 同域，建议一并实施 | 低 | B | ②参考重写 | [BACK-659](/task/659) | [doc-13 SRV-2](/documentation/13:1183-1193) |

---

## 五、Infra / CI / 测试 / 文档

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| INF-1 | **BACK-667 Fix the flaky browser corpus loading-progress test** | 修复 flaky 的浏览器语料加载进度测试 | fork 有 cross-branch 语料管线，存在同源 flaky 风险 | 低 | **C**（降） | ③忽略 |  | [doc-13 INF-1](/documentation/13:1235-1245) |
| INF-2 | **Add biome check to CI and fix task-composer formatting drift** | CI 流程加入 biome check，并修正 task-composer 格式漂移 | 上游无任务记录；属构建健康度维护 | 低 | B | ①直接复用 | [DRAFT#169](/draft/169) | [doc-13 INF-2](/documentation/13:1249-1259) |

---

## 六、跳过项（C 类）

本节为**初筛即判 C** 的 19 条。深度分析另有 13 条由 A / B 降为 C（含后续定案的 WEB-5「已满足」、WEB-10「不升级」；原记此列的 WEB-8 已于 2026-09-23 核实为 TUI 项并回 B 类，改列 TUI-14），仍列于各领域表中并以 **（降）** 标注，其分析报告链接同样有效。

| # | 标题 | 描述摘要 | 理由 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|--------|----------|----------|----------|
| CORE-11 | **BACK-640 Use one identity lookup for tasks, documents, decisions, and drafts** | 统一任务 / 文档 / 决策 / 草稿的身份查找 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-11](/documentation/13:172-186) |
| CORE-13 | **BACK-643.1 Core: Add project field to task domain model and persistence** | 领域模型与持久化层增加 project 字段 | BACK-643 的子任务记录，实现包含在父任务单次合入内；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-13](/documentation/13:204-218) |
| CORE-14 | **BACK-643.2 CLI: Add --project flag to task create/edit, config get, and completions** | CLI 增加 --project 标志与补全 | 同上（CLI 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-14](/documentation/13:222-236) |
| CORE-15 | **BACK-643.3 MCP: Add project parameter to task_create and task_edit tools** | MCP 增加 project 参数 | 同上（MCP 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-15](/documentation/13:240-254) |
| CORE-16 | **BACK-643.4 Add project-based filtering to task list, search, and server API** | 按 project 过滤 list / search / server API | 同上（Server 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-16](/documentation/13:258-272) |
| CORE-17 | **BACK-643.5 TUI: Display and filter task project in board and detail views** | TUI 展示与过滤 project | 同上（TUI 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-17](/documentation/13:276-290) |
| CORE-18 | **BACK-643.6 Web UI: Display and edit task project** | Web UI 展示与编辑 project | 同上（Web 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-18](/documentation/13:294-315) |
| CORE-35 | **BACK-679 Quote assignee and reporter under every frontmatter key spelling** | 各 frontmatter 键拼写下均引用 assignee 与 reporter | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用；注：该 `BACK-679` 号属**上游**，fork 的 [BACK-679](/task/679) 是 TUI-4「composer 鼠标点击」迁移任务，两者撞号勿混 | C | ③忽略 |  | [doc-13 CORE-35](/documentation/13:543-557) |
| CORE-36 | **BACK-680 Stop one bad draft from hiding every draft** | 单个坏草稿不再隐藏全部草稿 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用；注：该 `BACK-680` 号属**上游**，fork 的 [BACK-680](/task/680) 是 WEB-9「看板多选批量改状态」迁移任务，两者撞号勿混 | C | ③忽略 |  | [doc-13 CORE-36](/documentation/13:561-575) |
| CORE-37 | **BACK-682 Make frontmatter preprocessing robust to valid YAML shapes** | frontmatter 预处理兼容合法 YAML 形态 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-37](/documentation/13:579-593) |
| CORE-39 | **BACK-671 Add a dependency-ordered graph layout to task list** | task list 增加依赖序图布局 | 上游本范围只做任务重塑（reshape），未合入代码；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-39](/documentation/13:611-625) |
| CORE-40 | **BACK-222 Improve parent and subtask presentation in the Web UI** | web 父子任务呈现改进 | 记录仍为 To Do，实际实现由 BACK-222.1 承接，见 WEB-1；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-40](/documentation/13:629-643) |
| CORE-41 | **BACK-601 Readiness follow-ups: draft dependencies, board filter carry, cross-branch graph** | readiness follow-up：草稿依赖、看板过滤携带、跨分支图 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-41](/documentation/13:647-688) |
| TUI-13 | **BACK-683 Render TUI acceptance-criteria progress as a pie glyph** | TUI AC 进度渲染为饼图字形 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 TUI-13](/documentation/13:862-876) |
| WEB-17 | **BACK-668 Replace dead rounded-full classes across the web UI** | 清理 web UI 中失效的 rounded-full 类 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用；注：该 `BACK-668` 号属**上游**，fork 的 [BACK-668](/task/668) 是 WEB-12 迁移任务，两者撞号勿混 | C | ③忽略 |  | [doc-13 WEB-17](/documentation/13:1106-1120) |
| WEB-18 | **BACK-681 Show due dates on the surfaces that omit them** | 在遗漏 due date 的界面上补齐展示 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 WEB-18](/documentation/13:1124-1149) |
| SRV-3 | **BACK-641 Add `backlog task dependencies` command with TUI and plain graph views** | 新增 backlog task dependencies 命令及 TUI / plain 图视图 | 同一版本窗口内被 BACK-670 撤销，两条合看净零；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 SRV-3](/documentation/13:1197-1211) |
| SRV-4 | **BACK-670 Remove the standalone task dependencies command and its TUI** | 撤销独立的 task dependencies 命令及其 TUI | 承接 BACK-641，净零；无迁移价值；原始/迁移任务不适用；注：该 `BACK-670` 号属**上游**，fork 的 [BACK-670](/task/670) 是 reduced-motion 载入动效修复，两者撞号勿混 | C | ③忽略 |  | [doc-13 SRV-4](/documentation/13:1215-1229) |
| INF-3 | **Refresh stale hardcoded dates and MCP test teardown** | 测试内过期硬编码日期与 MCP 测试 teardown 调整 | fork 测试结构已不同，无迁移价值；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 INF-3](/documentation/13:1263-1277) |

---

## 交叉依赖与建议迁移顺序

按深度分析的**最终分类**排期；C 类不进队列。同一波次内条目互不依赖，可并行。已完成条目以删除线标记，对应迁移任务见文末「迁移任务状态」。

- **第一波（A 类，独立零依赖）**：~~CORE-7~~ → ~~CORE-8~~（草稿身份 fail-closed 与 notes 围栏空行，同属身份/内容正确性路径）；~~TUI-5~~ → ~~TUI-10~~（Unicode 输入安全与列表排序，均为 `src/ui` 内单点修复）；~~CORE-19~~ → ~~CORE-24~~（标点标题占位文件名与已完成任务依赖解析，已由 [BACK-664](/task/664) 落地；归档按设计排除）；~~WEB-7~~（草稿编辑不可用，服务端路由修复）。
- **第二波（跨分支索引正确性，可并行）**：~~CORE-4~~（强制刷新不再并入陈旧 fetch，已由 [BACK-660](/task/660) 落地）→ ~~CORE-5~~（findIdentity 改名回退的 freshness 发布，已由 [BACK-699](/task/699) 落地），与 fork 的 cross-branch 管线同源。
- **第三波（依赖图能力链，须先落基座）**：`dependency-graph` 模块在 fork 完全缺失，CORE-2（依赖图）→ CORE-28（评审 follow-up）需串行；CORE-23（环检测）→ CORE-30（自依赖缺口）共享同一校验器，合并实施。
- **第四波（搜索收敛链）**：~~CORE-20~~（core 单一来源，已由 [BACK-685](/task/685) 落地）→ ~~CORE-21~~（TUI 与里程碑页接入，已由 [BACK-686](/task/686) 落地，预匹配短路保留），须与 fork 自研 `src/utils/task-search.ts` 合并而非替换。
- **第五波（对撞项，须单独核对排除清单）**：~~CORE-34~~（due date 全线 date-only，已完成；已核实不波及 `actualStart`/`actualEnd`，残留显示偏移由 [BACK-690](/task/690) 修复）与 ~~CORE-31~~（readiness 发布，已完成；与 fork `src/utils/readiness.ts` 同能力对撞）同批；~~CORE-3~~ 与 ~~CORE-32~~（本地优先 + 归档清理引用，同文件同域）合并实施（已由 [BACK-691](/task/691) 落地）。
- **第六波（改动面大，单独立项）**：CORE-12（project 属性，58 文件）与 ~~CORE-10~~（draft 可编辑，已由 [BACK-683](/task/683) 落地）分别立项；~~WEB-11~~（前端原地更新，已由 [BACK-698](/task/698) 落地）与 ~~WEB-9~~（多选移动，已由 [BACK-680](/task/680) 落地）同属看板状态层，建议同一人连做；~~CORE-27~~ 与 ~~SRV-2~~（输出契约）原计划合并实施，SRV-2 已由 BACK-659 先行独立完成，CORE-27 已由 [BACK-697](/task/697) 落地。
- **第七波（TUI 系列，避免并行踩踏 `src/ui`）**：~~[BACK-675](/task/675)（TUI-1 + TUI-7 + TUI-9 三合一：ASCII 字形降级 + 紧凑彩色 + 5/3 格与窄屏，已落地）~~ / ~~TUI-6（emoji 双宽，已落地为 [BACK-676](/task/676)）~~ → ~~TUI-2~~（帮助弹窗 resize 贴合，已由 [BACK-677](/task/677) 落地）→ ~~TUI-3~~（composer 极端尺寸可用性，已由 [BACK-678](/task/678) 落地）→ ~~TUI-4~~（composer 鼠标点击，已由 [BACK-679](/task/679) 落地）→ ~~TUI-8~~（多选移动，已由 [BACK-681](/task/681) 落地）→ ~~TUI-14~~（看板弹窗随实时任务状态刷新 / 关闭，已由 [BACK-694](/task/694) 落地，依赖 BACK-684 / BACK-693）。
- **第八波（Web 展示与基础设施）**：~~WEB-2~~ / ~~WEB-5~~（已满足，不迁移） / ~~WEB-6~~（已由 [BACK-666](/task/666) 落地） / ~~WEB-10~~（定案不升级） / ~~WEB-12~~（已由 [BACK-668](/task/668) 落地） / ~~WEB-14~~（已由 [BACK-669](/task/669) 落地） / ~~WEB-15~~；INF-2（CI biome check）可随时插入。
- **低风险纯增量（可随手带上）**：~~CORE-6~~、~~CORE-9~~、~~CORE-22~~、~~CORE-25~~、~~CORE-26~~、~~CORE-29~~、~~CORE-33~~、~~CORE-38~~。

---

## 迁移任务状态

第一波迁移已启动。迁移任务由上游 draft 升级而来，原 draft 已删除。CORE-29 与 CORE-33 合并为同一任务 BACK-656（两份草稿合为一处改动）。SRV-2 由 draft-168 升级为 BACK-659，是输出契约域先行落地的一条。CORE-4 由 draft-123 升级为 BACK-660，属于第二波的首条。此外，`src/test/core-task-corpus-regressions.test.ts` 里依赖远程跟踪 ref 的既有分配用例在当前沙箱环境下无法通过（工作区内无法创建 `refs/remotes/origin/*`，退回实现后同样复现 TASK-2），BACK-660 的新用例因此把工程建在检出目录之外，同一限制对既有那条用例仍成立。CORE-24 由 draft-136 升级为 BACK-664：fork 的 ID 分配器只数 active ∪ completed（归档释放 ID），故语料只扩到 completed、归档记录有意排除；上游那道 `loadTaskById` 歧义检查保留，用于 `backlog/tasks/` 内两份文件同身份时的 fail-closed。TUI-2 由 draft-149 升级为 BACK-677、TUI-3 由 draft-150 升级为 BACK-678：两条同属 `src/ui` 的几何修正（弹窗 resize 贴合与 composer 极端尺寸），分别按上游 `faba7359` / `3af4056e` 的缺陷逐条对齐，上游在 fork 恒为死状态的字段（TUI-3 的 `stackSelectors`）未移植。TUI-8 由 draft-155 升级为 BACK-681：多选招募并入 `src/ui/board.ts` 既有的 `m` 移动流程（`MoveOperation` 扩 `selectedIds` / `highlightTaskId`，`closeBoard` 改为幂等并 await 进行中的写），确认路径复用 BACK-680 的原语 `core.moveTasksToStatus(..., orderedTaskIds)`；上游的 pty 用例未移植，由 `src/test/board-tui-move.test.ts` 的键盘 harness 覆盖。TUI-14 于 2026-09-23 经域修正（原登记为 WEB-8，实为 TUI 项）后登记为 [BACK-694](/task/694)，状态 Done、依赖 BACK-684 / BACK-693（该号 694 系复用：原先占用它的退役临时任务记录已移入 `backlog/archive/tasks/`，不再计入分配器的 active∪completed 语料）。

| 迁移任务 | 对应条目 | 状态 |
|----------|----------|------|
| [BACK-642](/task/642) | CORE-7 | Done |
| [BACK-643](/task/643) | CORE-8 | Done |
| [BACK-644](/task/644) | WEB-7 | Done |
| [BACK-646](/task/646) | WEB-2 | Done |
| [BACK-647](/task/647) | CORE-6 | Done |
| [BACK-648](/task/648) | TUI-5 | Done |
| [BACK-649](/task/649) | TUI-10 | Done |
| [BACK-650](/task/650) | CORE-19 | Done |
| [BACK-652](/task/652) | CORE-9 | Done |
| [BACK-653](/task/653) | CORE-22 | Done |
| [BACK-654](/task/654) | CORE-25 | Done |
| [BACK-655](/task/655) | CORE-26 | Done |
| [BACK-656](/task/656) | CORE-29 + CORE-33 | Done |
| [BACK-658](/task/658) | CORE-31 | Done |
| [BACK-657](/task/657) | CORE-38 | Done |
| [BACK-659](/task/659) | SRV-2 | Done |
| [BACK-660](/task/660) | CORE-4 | Done |
| [BACK-664](/task/664) | CORE-24 | Done |
| [BACK-666](/task/666) | WEB-6 | Done |
| [BACK-668](/task/668) | WEB-12 | Done |
| [BACK-669](/task/669) | WEB-14 | Done |
| [BACK-673](/task/673) | WEB-15 | Done |
| [BACK-675](/task/675) | TUI-1 + TUI-7 + TUI-9 | Done |
| [BACK-676](/task/676) | TUI-6 | Done |
| [BACK-677](/task/677) | TUI-2 | Done |
| [BACK-678](/task/678) | TUI-3 | Done |
| [BACK-679](/task/679) | TUI-4 | Done |
| [BACK-680](/task/680) | WEB-9 | Done |
| [BACK-681](/task/681) | TUI-8 | Done |
| [BACK-683](/task/683) | CORE-10 | Done |
| [BACK-685](/task/685) | CORE-20 | Done |
| [BACK-686](/task/686) | CORE-21 | Done |
| [BACK-690](/task/690) | CORE-34 | Done |
| [BACK-691](/task/691) | CORE-3 + CORE-32 | Done |
| [BACK-694](/task/694) | TUI-14 | Done |
| [BACK-697](/task/697) | CORE-27 | Done |
| [BACK-698](/task/698) | WEB-11 | Done |
| [BACK-699](/task/699) | CORE-5 | Done |
