---
id: doc-12
title: Upstream v1.50.1 to v1.52.0 Migration Diff Classification
type: guide
created_date: '2026-09-15 05:13'
updated_date: '2026-09-15 06:20'
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
> **重分类摘要**：初筛 A / B / C = 7 / 54 / 19 → 深度分析 **7 / 42 / 31**；升 A 4 条（CORE-19（B→A）、CORE-24（B→A）、TUI-5（B→A）、TUI-10（B→A）），降 C 15 条（CORE-1（B→C）、CORE-4（A→B）、CORE-5（A→B）、CORE-26（A→B）、TUI-11（A→C）、TUI-12（B→C）、WEB-1（B→C）、WEB-3（B→C）、WEB-4（B→C）、WEB-8（B→C）、WEB-13（B→C）、WEB-16（B→C）、WEB-19（B→C）、SRV-1（B→C）、INF-1（B→C））。
> **「原始/迁移任务」列**：上游任务文件已按技能「原始任务文件导入规范」导入为 draft —— A / B 类 49 条填 `[DRAFT#N](/draft/N)`（编号 DRAFT#121..DRAFT#169），③忽略的 C 类留空。升级为当前 fork 任务后替换为 `[BACK-XXX](/task/XXX)`。**「分析报告」列**指向 doc-13 的对应小节。

## 清单口径与数据质量备注

1. **任务编号按创建顺序、合入按 PR 顺序**：`BACK-589 / 590 / 592 / 588 / 401 / 419 / 424 / 551 / 552` 的任务文件早在 `v1.50.1` 之前即存在，代码却在本范围才合入。仅按「范围内新增任务文件」建清单会整批漏掉这批，因此候选取双源并集。
2. **BACK-641 与 BACK-670 互相抵消**：#983 新增 `backlog task dependencies` 命令与 TUI，#993 又将其整体删除。两条合看净零；各自单看会误判为「新增功能」与「删除功能」各需迁移。
3. **无编号 commit 29 条**，其中仅 1 条含真实代码且上游无任务记录（PR #955 侧栏快捷搜索，登记为 WEB-19）；INF-2 / INF-3 亦无任务记录。其余为重构、测试调整或提交信息缺编号。
4. **任务记录状态落后于实现**：`BACK-222` 记录仍为 To Do（实现由 `BACK-222.1` 承接，见 WEB-1）、`BACK-636` 记录为 In Progress（代码已合入）。判断一律以代码足迹为准。
5. **本轮未发现 commit 前缀误标**；所有归属均以 `git show --numstat` 的文件足迹核对，未仅凭 `--grep BACK-XXX`。

---

## 一、CLI / Core（命令行与核心数据）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| CORE-1 | **BACK-401 Add dueDate support for tasks and milestones across CLI, TUI, Web, and MCP** | 为任务与里程碑引入 dueDate，打通 CLI / TUI / Web / MCP 全链路 | 数据模型与展示链路变更；与排除清单 §2 的日期字段体系正面重叠，必须核对是否回退 actualStart / actualEnd 的 UTC date-time 语义 | 高 | **C**（降） | ③忽略 |  | [doc-13 CORE-1](/documentation/13:32-42) |
| CORE-2 | **BACK-548 Expose bidirectional dependency graphs in task details** | 任务详情暴露双向依赖图，上游同时覆盖 Web 弹窗与 MCP 输出 | 新功能；依赖图在任务详情内一次算好、各界面只负责渲染，fork 无等价能力 | 中 | B | ①直接复用 | [DRAFT#121](/draft/121) | [doc-13 CORE-2](/documentation/13:46-56) |
| CORE-3 | **BACK-626 Make task archive, complete, and demote local-first like view and edit** | archive / complete / promote / demote 由远端优先改为本地工作副本优先 | 行为变更，直接影响 fork 的 CLI 生命周期命令；与 CORE-32 归档清理同域 | 中 | B | ②参考重写 | [DRAFT#122](/draft/122) | [doc-13 CORE-3](/documentation/13:60-70) |
| CORE-4 | **BACK-627 Prevent forced allocation refresh from joining an in-flight stale fetch** | 强制刷新任务分配时不再并入在途的陈旧 fetch | 真实数据正确性修复；fork 有 cross-branch 索引管线，属同源风险 | 中 | **B**（降） | ②参考重写 | [DRAFT#123](/draft/123) | [doc-13 CORE-4](/documentation/13:74-84) |
| CORE-5 | **BACK-628 Stop findIdentity rename fallback from publishing freshness without installing the corpus** | findIdentity 改名回退不再在未装载语料时发布 freshness | 真实数据正确性修复（索引新鲜度被错误发布）；fork 同源管线 | 中 | **B**（降） | ②参考重写 | [DRAFT#124](/draft/124) | [doc-13 CORE-5](/documentation/13:88-98) |
| CORE-6 | **BACK-635 Reserve draft, doc, and decision prefixes at init** | init 预留 draft / doc / decision 前缀，避免与任务前缀相撞 | 纯增量防线，无回退风险 | 低 | B | ②参考重写 | [DRAFT#125](/draft/125) | [doc-13 CORE-6](/documentation/13:102-112) |
| CORE-7 | **BACK-636 Fail closed on ambiguous draft identities** | 草稿身份歧义时 fail-closed（4 个 commit 的完整收敛） | 数据正确性；与 fork 任务侧已具备的 AmbiguousTaskIdError 方向一致 | 中 | A | ②参考重写 | [DRAFT#126](/draft/126) | [doc-13 CORE-7](/documentation/13:116-126) |
| CORE-8 | **BACK-637 Preserve consecutive blank lines inside fenced code blocks in notes (issue 930)** | notes 中围栏代码块内的连续空行不再被吞（issue 930） | 内容完整性缺陷：解析吞行会损坏用户笔记；fork 有 processCliEscapes 同源处理 | 中 | A | ②参考重写 | [DRAFT#127](/draft/127) | [doc-13 CORE-8](/documentation/13:130-140) |
| CORE-9 | **BACK-638 Allow task list --status to accept several statuses** | task list --status 支持多值（重复传入或逗号分隔） | CLI 筛选能力增强，无冲突 | 低 | B | ②参考重写 | [DRAFT#128](/draft/128) | [doc-13 CORE-9](/documentation/13:144-154) |
| CORE-10 | **BACK-639 Make drafts editable from the CLI and TUI** | 草稿可从 CLI 与 TUI 编辑（10 个 commit，改动面大） | 新功能；与 fork 既有 draft 命令集需整合 | 中 | B | ②参考重写 | [DRAFT#129](/draft/129) | [doc-13 CORE-10](/documentation/13:158-168) |
| CORE-12 | **BACK-643 Add a project task attribute for monorepo backlogs** | 新增任务 project 属性支撑 monorepo 场景，跨 CLI / MCP / TUI / Web / Server 共 58 个文件 | fork 完全缺失该属性，属纯增量；改动面极大 | 低 | B | ②参考重写 | [DRAFT#130](/draft/130) | [doc-13 CORE-12](/documentation/13:190-200) |
| CORE-19 | **BACK-648 Fall back to a placeholder filename for punctuation-only titles** | 纯符号标题回退为占位文件名，不再创建失败 | 边界修复，无冲突 | 低 | **A**（升） | ②参考重写 | [DRAFT#131](/draft/131) | [doc-13 CORE-19](/documentation/13:319-329) |
| CORE-20 | **BACK-649 Single-source task search config and filters in core** | 搜索配置与过滤器收敛为 core 单一来源 | fork 已有 src/utils/task-search.ts，需与之对齐 | 中 | B | ②参考重写 | [DRAFT#132](/draft/132) | [doc-13 CORE-20](/documentation/13:333-343) |
| CORE-21 | **BACK-650 Route TUI and milestone-page task search through the shared core search** | TUI 与里程碑页搜索改走 core 共享搜索（承接 BACK-649） | 依赖 CORE-20 先落地；与 fork 自研搜索入口需合并 | 中 | B | ②参考重写 | [DRAFT#133](/draft/133) | [doc-13 CORE-21](/documentation/13:347-357) |
| CORE-22 | **BACK-651 Remove the temp-file roundtrip in README board export** | README board 导出去掉临时文件中转 | 内部实现清理，无行为变更 | 低 | B | ①直接复用 | [DRAFT#134](/draft/134) | [doc-13 CORE-22](/documentation/13:361-371) |
| CORE-23 | **BACK-656 Reject self-referential and cyclic task dependencies** | create / edit 拒绝自依赖与循环依赖，并打印循环路径 | fork 有依赖字段但无环检测；纯增量校验 | 中 | B | ②参考重写 | [DRAFT#135](/draft/135) | [doc-13 CORE-23](/documentation/13:375-385) |
| CORE-24 | **BACK-658 Resolve dependency targets in completed and archived tasks** | 已完成 / 已归档任务中的依赖目标可解析，不再靠猜测 | 依赖解析正确性；fork 归档目录结构已定制 | 低 | **A**（升） | ②参考重写 | [DRAFT#136](/draft/136) | [doc-13 CORE-24](/documentation/13:389-399) |
| CORE-25 | **BACK-659 Include grandchild subtasks in board export grouping** | board 导出分组纳入孙级子任务 | 导出逻辑补全，无冲突 | 低 | B | ①直接复用 | [DRAFT#137](/draft/137) | [doc-13 CORE-25](/documentation/13:403-413) |
| CORE-26 | **BACK-660 Reject nested section markers in notes and fix append truncation** | task edit -d 传入文本已含分节标记时不再嵌套（曾致 AC / notes 被藏进描述并截断追加） | 内容完整性缺陷：会把 AC / notes 藏进描述并截断追加内容 | 中 | **B**（降） | ②参考重写 | [DRAFT#138](/draft/138) | [doc-13 CORE-26](/documentation/13:417-427) |
| CORE-27 | **BACK-662 Add references and modifiedFiles to task list --json** | task list --json 增加 references 与 modifiedFiles 字段 | JSON 契约扩展，纯增量 | 低 | B | ①直接复用 | [DRAFT#139](/draft/139) | [doc-13 CORE-27](/documentation/13:431-441) |
| CORE-28 | **BACK-663 Dependency graph follow-ups from BACK-548 review** | 依赖图 follow-up：缺失引用 / 歧义 ID / 环按原样呈现 | 承接 CORE-2，需与之一并评估 | 中 | B | ②参考重写 | [DRAFT#140](/draft/140) | [doc-13 CORE-28](/documentation/13:445-455) |
| CORE-29 | **BACK-664 Read the Backlog overview once per conversation instead of per request** | MCP 指南改为每会话读一次 overview，而非每请求 | 纯指令文档；fork 有对应指令文档需同步 | 低 | B | ②参考重写 | [DRAFT#141](/draft/141) | [doc-13 CORE-29](/documentation/13:459-469) |
| CORE-30 | **BACK-669 Close residual self-dependency gaps from the BACK-656 review** | 补齐 BACK-656 评审遗留的自依赖缺口 | 承接 CORE-23，同域小补丁 | 中 | B | ②参考重写 | [DRAFT#142](/draft/142) | [doc-13 CORE-30](/documentation/13:473-483) |
| CORE-31 | **BACK-672 Compute task readiness once in core and carry isReady on task lists** | readiness 计算收敛到 core，并随任务列表带出 isReady | 与 fork 自研 src/utils/readiness.ts（BACK-615）能力对撞，属同能力不同实现 | 高 | B | ②参考重写 | [DRAFT#143](/draft/143) | [doc-13 CORE-31](/documentation/13:487-497) |
| CORE-32 | **BACK-673 Clean dependency references when archiving or demoting a task** | 归档 / 降级任务时清理其他任务对它的引用 | 数据完整性（消除悬空依赖）；与 fork 归档降级逻辑强耦合 | 高 | B | ②参考重写 | [DRAFT#144](/draft/144) | [doc-13 CORE-32](/documentation/13:501-511) |
| CORE-33 | **BACK-676 Make agent task descriptions carry the why** | agent 任务描述要求写出「为什么」 | 纯指令文档 | 低 | B | ②参考重写 | [DRAFT#145](/draft/145) | [doc-13 CORE-33](/documentation/13:515-525) |
| CORE-34 | **BACK-678 Make due date a date-only string everywhere** | due date 全线改为 date-only 字符串（涉及 32 个文件） | 与排除清单 §2 部分重叠：fork 的 dueDate 已是 date-only，风险在于该改动是否波及 actualStart / actualEnd 的 UTC date-time 语义 | 高 | B | ②参考重写 | [DRAFT#146](/draft/146) | [doc-13 CORE-34](/documentation/13:529-539) |
| CORE-38 | **BACK-686 Watch task lists with the existing JSON output** | task list --json --watch 增量流式快照 | fork 完全缺失 watch 能力，纯增量 | 低 | B | ②参考重写 | [DRAFT#147](/draft/147) | [doc-13 CORE-38](/documentation/13:597-607) |

---

## 二、TUI

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| TUI-1 | **BACK-551 Show acceptance criteria completion on TUI task summaries** | TUI 任务摘要显示 AC 完成度 | 轻量展示增强，前置件齐备 | 低 | B | ②参考重写 | [DRAFT#148](/draft/148) | [doc-13 TUI-1](/documentation/13:694-704) |
| TUI-2 | **BACK-588 Make the TUI help popup robust to resize and wrapped lines** | 帮助弹窗对终端尺寸变化与换行鲁棒 | fork 帮助弹窗为自研实现，需对齐而非照搬 | 低 | B | ②参考重写 | [DRAFT#149](/draft/149) | [doc-13 TUI-2](/documentation/13:708-718) |
| TUI-3 | **BACK-589 Improve composer usability at extreme terminal sizes** | 极端终端尺寸下的 composer 可用性 | fork composer 已自研，属体验补丁 | 低 | B | ②参考重写 | [DRAFT#150](/draft/150) | [doc-13 TUI-3](/documentation/13:722-732) |
| TUI-4 | **BACK-590 Support mouse clicks in the TUI task composer** | TUI composer 支持鼠标点击 | 新交互能力，无冲突 | 低 | B | ②参考重写 | [DRAFT#151](/draft/151) | [doc-13 TUI-4](/documentation/13:736-746) |
| TUI-5 | **BACK-592 Make TUI text field insertion Unicode-safe** | 文本框插入 Unicode 安全 | 输入正确性补丁，与 fork 中文环境强相关 | 低 | **A**（升） | ②参考重写 | [DRAFT#152](/draft/152) | [doc-13 TUI-5](/documentation/13:750-760) |
| TUI-6 | **BACK-646 Count emoji as double-width in the TUI** | emoji 按双宽计算，含 emoji 的行不再错位 | 渲染正确性；fork 中文 / emoji 场景常见 | 低 | B | ①直接复用 | [DRAFT#153](/draft/153) | [doc-13 TUI-6](/documentation/13:764-774) |
| TUI-7 | **BACK-657 Make the TUI acceptance-criteria bar degrade gracefully without Block Element glyphs** | 缺少 Block Element 字形时 AC 进度条优雅降级为 ASCII | 兼容性补丁，Windows 终端尤为需要 | 低 | B | ②参考重写 | [DRAFT#154](/draft/154) | [doc-13 TUI-7](/documentation/13:778-788) |
| TUI-8 | **BACK-661 TUI multi-select move with shift-arrow recruitment** | TUI 多选移动（M 标记 + Shift+方向键扩选） | 新交互能力，无冲突 | 低 | B | ②参考重写 | [DRAFT#155](/draft/155) | [doc-13 TUI-8](/documentation/13:792-802) |
| TUI-9 | **BACK-666 Compact colored acceptance-criteria bar in the TUI** | 紧凑彩色 AC 进度条 | 展示优化 | 低 | B | ②参考重写 | [DRAFT#156](/draft/156) | [doc-13 TUI-9](/documentation/13:806-816) |
| TUI-10 | **BACK-674 Sort the TUI list view through the shared task ID comparator** | TUI 列表排序统一走共享任务 ID 比较器（修 1.10 排在 1.2 之前） | 排序正确性；共享比较器需与 fork 对齐 | 低 | **A**（升） | ①直接复用 | [DRAFT#157](/draft/157) | [doc-13 TUI-10](/documentation/13:820-830) |
| TUI-11 | **BACK-675 Fix Windows TUI keyboard input after Tab view switch** | 修复 Windows 下 Tab 切换视图后键盘输入失灵 | 交互缺陷，直接命中 fork 主力运行环境（Windows） | 低 | **C**（降） | ③忽略 |  | [doc-13 TUI-11](/documentation/13:834-844) |
| TUI-12 | **BACK-24.02 CLI TUI: Add milestone swimlanes to interactive board view** | 交互看板增加里程碑泳道 | fork 的 web 看板已有自研泳道，TUI 侧缺位，需先核对实现差异 | 中 | **C**（降） | ③忽略 |  | [doc-13 TUI-12](/documentation/13:848-858) |

---

## 三、Web

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| WEB-1 | **BACK-222.1 Show parent and subtask hierarchy in the web task details modal** | web 任务弹窗展示父子 / 子任务层级（8 个 commit） | 弹窗为 fork 深度定制区域（AC 进度环等），需参考重写 | 中 | **C**（降） | ③忽略 |  | [doc-13 WEB-1](/documentation/13:882-892) |
| WEB-2 | **BACK-419 Add Web UI demote-to-draft action** | web 增加「降级为草稿」操作 | 与 fork web 任务操作区耦合 | 中 | B | ②参考重写 | [DRAFT#158](/draft/158) | [doc-13 WEB-2](/documentation/13:896-906) |
| WEB-3 | **BACK-424 Support multiple status filters in Web task lists** | web 任务列表支持多状态筛选 | 纯增量筛选能力 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-3](/documentation/13:910-920) |
| WEB-4 | **BACK-552 Show acceptance criteria progress on browser task summaries** | 浏览器任务摘要显示 AC 进度 | 展示增强；与 WEB-16 同域 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-4](/documentation/13:924-934) |
| WEB-5 | **BACK-630 Filter the web dependency picker to locally-resolvable tasks** | 依赖选择器只列出本地可解析的任务 | 依赖解析范围与排除清单 §2 相关，需核对 fork 解析口径 | 低 | B | ①直接复用 | [DRAFT#159](/draft/159) | [doc-13 WEB-5](/documentation/13:938-948) |
| WEB-6 | **BACK-633 Show and edit modified files in the web task modal** | web 弹窗展示并可编辑 modified files | 弹窗定制区新增字段，需评估落位 | 低 | B | ②参考重写 | [DRAFT#160](/draft/160) | [doc-13 WEB-6](/documentation/13:952-962) |
| WEB-7 | **BACK-634 Fix web UI draft editing** | 修复 web 草稿编辑完全不可用 | 功能完全不可用的缺陷修复 | 中 | A | ①直接复用 | [DRAFT#161](/draft/161) | [doc-13 WEB-7](/documentation/13:966-976) |
| WEB-8 | **BACK-644 Keep the board task popup in sync with live task state** | 看板任务弹窗跟随任务实时状态 | 与 fork 看板弹窗的状态管理耦合 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-8](/documentation/13:980-990) |
| WEB-9 | **BACK-645 Move multiple selected tasks between statuses in one action** | 看板拖拽多选批量改状态（对应 commit 无 BACK 前缀，issue #945） | 新交互能力；上游该改动未挂任务编号，归属靠代码足迹核对 | 中 | B | ①直接复用 | [DRAFT#162](/draft/162) | [doc-13 WEB-9](/documentation/13:994-1004) |
| WEB-10 | **BACK-652 Replace the ASCII progress bar on web task summaries with a web-native indicator** | web 任务摘要的 ASCII 进度条改为 web 原生指示器 | 展示优化；与 WEB-16 同域 | 低 | B | ②参考重写 | [DRAFT#163](/draft/163) | [doc-13 WEB-10](/documentation/13:1008-1018) |
| WEB-11 | **BACK-653 Update web views in place instead of full reload on data changes** | web 视图原地更新，不再整体重载（保住筛选 / 滚动 / 弹窗） | 影响面广的前端状态改造，fork 前端已深度定制 | 中 | B | ①直接复用 | [DRAFT#164](/draft/164) | [doc-13 WEB-11](/documentation/13:1022-1032) |
| WEB-12 | **BACK-654 Polish the cross-branch indexing loading indicator in the web UI** | cross-branch 索引进度指示器打磨 | 与 fork cross-branch 管线同域 | 中 | B | ①直接复用 | [DRAFT#165](/draft/165) | [doc-13 WEB-12](/documentation/13:1036-1046) |
| WEB-13 | **BACK-655 Open task details in place from sidebar dependency chips** | 侧栏依赖 chip 原地打开任务详情 | 依赖 CORE-2（依赖图）先落地 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-13](/documentation/13:1050-1060) |
| WEB-14 | **BACK-665 Polish the web UI initial loading state** | web 初始加载状态统一（两种主题一致） | 展示打磨 | 低 | B | ①直接复用 | [DRAFT#166](/draft/166) | [doc-13 WEB-14](/documentation/13:1064-1074) |
| WEB-15 | **BACK-677 Show local time in the web UI with the UTC value on hover** | web 显示本地时间、悬停显示 UTC | 与排除清单 §2「存储 UTC、展示本地时区」方向一致，非冲突项；需核对 fork 是否已自行实现 | 中 | B | ①直接复用 | [DRAFT#167](/draft/167) | [doc-13 WEB-15](/documentation/13:1078-1088) |
| WEB-16 | **BACK-684 Move the acceptance-criteria ring into the web card header** | AC 进度环移入看板卡片头部，去掉标题下多余一行 | 与 fork 已定制的卡片头部布局相关 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-16](/documentation/13:1092-1102) |
| WEB-19 | **Sidebar quick search hides real matches on larger projects** | 侧栏快捷搜索在较大项目上隐藏真实匹配 | 上游无任务记录，仅一个 commit；属可用性缺陷 | 低 | **C**（降） | ③忽略 |  | [doc-13 WEB-19](/documentation/13:1153-1163) |

---

## 四、Server / MCP / 输出格式

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| SRV-1 | **BACK-622 Return acceptance criteria progress in task JSON outputs** | JSON 输出返回 AC 完成度（含 CLI-INSTRUCTIONS） | JSON 契约扩展；fork 字段名为 acceptanceCriteriaItems，需做映射 | 低 | **C**（降） | ③忽略 |  | [doc-13 SRV-1](/documentation/13:1169-1179) |
| SRV-2 | **BACK-642 Show acceptance criteria progress in MCP and plain task lists** | MCP 与 --plain 列表显示 AC 完成度 | 与 SRV-1 同域，建议一并实施 | 低 | B | ①直接复用 | [DRAFT#168](/draft/168) | [doc-13 SRV-2](/documentation/13:1183-1193) |

---

## 五、Infra / CI / 测试 / 文档

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| INF-1 | **BACK-667 Fix the flaky browser corpus loading-progress test** | 修复 flaky 的浏览器语料加载进度测试 | fork 有 cross-branch 语料管线，存在同源 flaky 风险 | 低 | **C**（降） | ③忽略 |  | [doc-13 INF-1](/documentation/13:1235-1245) |
| INF-2 | **Add biome check to CI and fix task-composer formatting drift** | CI 流程加入 biome check，并修正 task-composer 格式漂移 | 上游无任务记录；属构建健康度维护 | 低 | B | ①直接复用 | [DRAFT#169](/draft/169) | [doc-13 INF-2](/documentation/13:1249-1259) |

---

## 六、跳过项（C 类）

本节为**初筛即判 C** 的 19 条。深度分析另有 12 条由 A / B 降为 C，仍列于各领域表中并以 **（降）** 标注，其分析报告链接同样有效。

| # | 标题 | 描述摘要 | 理由 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|--------|----------|----------|----------|
| CORE-11 | **BACK-640 Use one identity lookup for tasks, documents, decisions, and drafts** | 统一任务 / 文档 / 决策 / 草稿的身份查找 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-11](/documentation/13:172-186) |
| CORE-13 | **BACK-643.1 Core: Add project field to task domain model and persistence** | 领域模型与持久化层增加 project 字段 | BACK-643 的子任务记录，实现包含在父任务单次合入内；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-13](/documentation/13:204-218) |
| CORE-14 | **BACK-643.2 CLI: Add --project flag to task create/edit, config get, and completions** | CLI 增加 --project 标志与补全 | 同上（CLI 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-14](/documentation/13:222-236) |
| CORE-15 | **BACK-643.3 MCP: Add project parameter to task_create and task_edit tools** | MCP 增加 project 参数 | 同上（MCP 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-15](/documentation/13:240-254) |
| CORE-16 | **BACK-643.4 Add project-based filtering to task list, search, and server API** | 按 project 过滤 list / search / server API | 同上（Server 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-16](/documentation/13:258-272) |
| CORE-17 | **BACK-643.5 TUI: Display and filter task project in board and detail views** | TUI 展示与过滤 project | 同上（TUI 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-17](/documentation/13:276-290) |
| CORE-18 | **BACK-643.6 Web UI: Display and edit task project** | Web UI 展示与编辑 project | 同上（Web 侧子任务）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-18](/documentation/13:294-315) |
| CORE-35 | **BACK-679 Quote assignee and reporter under every frontmatter key spelling** | 各 frontmatter 键拼写下均引用 assignee 与 reporter | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-35](/documentation/13:543-557) |
| CORE-36 | **BACK-680 Stop one bad draft from hiding every draft** | 单个坏草稿不再隐藏全部草稿 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-36](/documentation/13:561-575) |
| CORE-37 | **BACK-682 Make frontmatter preprocessing robust to valid YAML shapes** | frontmatter 预处理兼容合法 YAML 形态 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-37](/documentation/13:579-593) |
| CORE-39 | **BACK-671 Add a dependency-ordered graph layout to task list** | task list 增加依赖序图布局 | 上游本范围只做任务重塑（reshape），未合入代码；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-39](/documentation/13:611-625) |
| CORE-40 | **BACK-222 Improve parent and subtask presentation in the Web UI** | web 父子任务呈现改进 | 记录仍为 To Do，实际实现由 BACK-222.1 承接，见 WEB-1；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-40](/documentation/13:629-643) |
| CORE-41 | **BACK-601 Readiness follow-ups: draft dependencies, board filter carry, cross-branch graph** | readiness follow-up：草稿依赖、看板过滤携带、跨分支图 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 CORE-41](/documentation/13:647-688) |
| TUI-13 | **BACK-683 Render TUI acceptance-criteria progress as a pie glyph** | TUI AC 进度渲染为饼图字形 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 TUI-13](/documentation/13:862-876) |
| WEB-17 | **BACK-668 Replace dead rounded-full classes across the web UI** | 清理 web UI 中失效的 rounded-full 类 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 WEB-17](/documentation/13:1106-1120) |
| WEB-18 | **BACK-681 Show due dates on the surfaces that omit them** | 在遗漏 due date 的界面上补齐展示 | 仅任务记录，本范围未实现（To Do）；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 WEB-18](/documentation/13:1124-1149) |
| SRV-3 | **BACK-641 Add `backlog task dependencies` command with TUI and plain graph views** | 新增 backlog task dependencies 命令及 TUI / plain 图视图 | 同一版本窗口内被 BACK-670 撤销，两条合看净零；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 SRV-3](/documentation/13:1197-1211) |
| SRV-4 | **BACK-670 Remove the standalone task dependencies command and its TUI** | 撤销独立的 task dependencies 命令及其 TUI | 承接 BACK-641，净零；无迁移价值；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 SRV-4](/documentation/13:1215-1229) |
| INF-3 | **Refresh stale hardcoded dates and MCP test teardown** | 测试内过期硬编码日期与 MCP 测试 teardown 调整 | fork 测试结构已不同，无迁移价值；原始/迁移任务不适用 | C | ③忽略 |  | [doc-13 INF-3](/documentation/13:1263-1277) |

---

## 交叉依赖与建议迁移顺序

按深度分析的**最终分类**排期；C 类不进队列。同一波次内条目互不依赖，可并行。

- **第一波（A 类，独立零依赖）**：CORE-7 → CORE-8（草稿身份 fail-closed 与 notes 围栏空行，同属身份/内容正确性路径）；TUI-5 → TUI-10（Unicode 输入安全与列表排序，均为 `src/ui` 内单点修复）；CORE-19 → CORE-24（标点标题占位文件名与归档任务依赖解析）；WEB-7（草稿编辑不可用，服务端路由修复）。
- **第二波（跨分支索引正确性，可并行）**：CORE-4 → CORE-5（强制刷新不再并入陈旧 fetch、findIdentity 改名回退的 freshness 发布），与 fork 的 cross-branch 管线同源。
- **第三波（依赖图能力链，须先落基座）**：`dependency-graph` 模块在 fork 完全缺失，CORE-2（依赖图）→ CORE-28（评审 follow-up）需串行；CORE-23（环检测）→ CORE-30（自依赖缺口）共享同一校验器，合并实施。
- **第四波（搜索收敛链）**：CORE-20（core 单一来源）→ CORE-21（TUI 与里程碑页接入），须与 fork 自研 `src/utils/task-search.ts` 合并而非替换。
- **第五波（对撞项，须单独核对排除清单）**：CORE-34（due date 全线 date-only，已核实不波及 `actualStart`/`actualEnd`）与 CORE-31（readiness 收敛，与 fork `src/utils/readiness.ts` 同能力对撞）同批；CORE-3 与 CORE-32（本地优先 + 归档清理引用，同文件同域）合并实施。
- **第六波（改动面大，单独立项）**：CORE-12（project 属性，58 文件）与 CORE-10（draft 可编辑）分别立项；WEB-11（前端原地更新）与 WEB-9（多选移动）同属看板状态层，建议同一人连做；CORE-27 与 SRV-2（输出契约）合并实施。
- **第七波（TUI 系列，避免并行踩踏 `src/ui`）**：TUI-1 / TUI-6 / TUI-7（进度展示与字形降级）→ TUI-2 / TUI-3 / TUI-4（弹窗与 composer）→ TUI-8 / TUI-9（多选与紧凑进度条）。
- **第八波（Web 展示与基础设施）**：WEB-2 / WEB-5 / WEB-6 / WEB-10 / WEB-12 / WEB-14 / WEB-15；INF-2（CI biome check）可随时插入。
- **低风险纯增量（可随手带上）**：CORE-6、CORE-9、CORE-22、CORE-25、CORE-26、CORE-29、CORE-33、CORE-38。

---

## 迁移任务状态

本阶段尚未创建迁移任务。深度分析完成、迁移范围经确认后，在本节按「迁移任务 / 对应条目 / 状态」登记。
