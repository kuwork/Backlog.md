---
id: doc-9
title: Upstream v1.49.3 to v1.50.1 Migration Diff Classification
type: guide
created_date: '2026-08-14'
updated_date: '2026-08-14'
---
# 上游变更差异分类（v1.49.3 .. v1.50.1）

## 概述

- **上游分支**：`upstream/main`
- **范围**：`v1.49.3 .. v1.50.1`（87 commits，44 个任务组）
- **上游仓库**：`MrLesk/Backlog.md`
- **当前工作分支**：`1.49`（fork 版本 `1.48.0-CN`；上游 `v1.50.0 / v1.50.1` 尚未合入）
- **分析依据**：上游 `v1.50.0 / v1.50.1` Release Notes + `git log --oneline v1.49.3..v1.50.1` + 当前分支排除清单 `references/current-branch-migration-exclusions.md` + 代码库现状勘察（预筛阶段核对 fork 工作树）
- **覆盖范围**：本表涵盖范围内出现的全部任务，按 commit 记录逐一登记。范围语义：`v1.49.3`（不含）至 `v1.50.1`（含），含 v1.50.0 功能版与 v1.50.1 性能 hotfix。
- **组织方式**：按**领域分组**（CLI/Core、TUI、Web、Server、Infra/CI），每组内按最终优先级（A→B→C）排序；编号沿用初筛编号（A1–A2、B1–B26、C1–C7）便于追溯。

## 分类说明

| 分类 | 含义 | 处理建议 |
|------|------|----------|
| **A类** | 必须合入 | 安全漏洞、关键 bug 修复、与当前 fork 共用核心路径的性能回归修复 |
| **B类** | 评估合入 | 新功能、非核心优化，需用户确认是否与当前 fork 定制冲突 |
| **C类** | 跳过 | 与当前 fork 演进方向冲突、上游特有方向、纯跟踪/无代码、或当前 fork 已覆盖 |

> ⚠️ 深度分析已执行（2026-08-14）：A 类 + 全部 B 类条目逐一完成（4 个领域并行分析，证据为上游 merge commit 与 fork 工作树 file:line 对照）。**优先级重分类**：A1/A2 维持 A；**B1/B3/B7/B9/B10/B12/B13/B17/B18/B19/B22/B25/B26 升 A**（真实数据正确性/交互缺陷或 fork 同根 bug）；**B16 的 BACK-624 降 C**（超大重构与 fork BACK-568 移植重叠冲突）；**B21 降 C 大部分**（fork 无 defaultAssignee 应用基线，仅 edit 清空小修留 B）；**B24 降 C**（fork 无上游根因前提）。最终 **15 A / 11 B / 7 C**。最终分类以 `doc-10` 分析报告为准，本表「分析报告」列链接到对应章节。

---

## 一、CLI / Core（命令行与核心数据）

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| A1 | **BACK-575 并发编辑 fail-fast** | `updateTaskFromInput` 无锁读改写导致并发编辑静默丢写；filesystem 级锁 + 竞争时 fail-fast（CLI 非零退出、web 409、MCP operation error），无等待/合并/重试。 | 数据丢失预防，与 fork 共用 backlog.ts 编辑路径；fork 仅 create 有锁（operations.ts:246），edit 无冲突检测 | 中：锁语义与 fork create-lock/stale-recovery 共存 | A | ①直接复用 | [DRAFT#94](/draft/94) | [doc-10 CLI-1](/documentation/10:34-51) |
| B1 | **BACK-583 实现 defaultAssignee** | `defaultAssignee` config 在 task create 时应用，CLI/TUI/web/MCP 一致。 | fork 有 config 字段（types:331）但 create 未应用；类型 string→string[] 需升级 | 低 | **A**（升） | ②参考重写 | [DRAFT#100](/draft/100) | [doc-10 CLI-2](/documentation/10:55-74) |
| B2 | **BACK-582 decision list 命令** | 新增 `backlog decision list`，复用既有决策序列/格式化。 | fork 只有 `decision create`（cli.ts:4150） | 低 | B | ①直接复用 | [DRAFT#99](/draft/99) | [doc-10 CLI-3](/documentation/10:78-94) |
| B3 | **BACK-572/586/618 clear deps/refs/docs + 空值清除** | `task edit --dep ""`/`--ref ""`/`--doc ""` 清除列表，`--clear-*` 补齐；create 时空值仍拒绝。 | fork 只有 --clear-milestone/dates/ac/final-summary；`--ref ""` 假成功同上游 bug | 低 | **A**（升） | ①直接复用 | [DRAFT#92](/draft/92) [DRAFT#103](/draft/103) [DRAFT#120](/draft/120) | [doc-10 CLI-4](/documentation/10:98-116) |
| B4 | **BACK-597 增量引用标志** | `task edit --add-ref/--remove-ref` 增量修改 references。 | fork 无此功能；模型层已支持（task-edit-builder） | 低 | B | ①直接复用 | [DRAFT#105](/draft/105) | [doc-10 CLI-5](/documentation/10:120-137) |
| B5 | **BACK-606/610 config fail-fast** | 畸形/错类型 config 值启动即报错，不再静默应用默认值。 | fork 无 "invalid value" 校验；default_assignee 类型差异需适配 | 低 | B | ②参考重写 | [DRAFT#111](/draft/111) [DRAFT#114](/draft/114) | [doc-10 CLI-6](/documentation/10:141-157) |
| B6 | **BACK-612 决策 ID 去重 + 移除动态 import** | 去重 generateNextDecisionId，移除 core→CLI 动态 import。 | fork backlog.ts:2674-2676 正是同款动态 import | 低 | B | ①直接复用 | [DRAFT#115](/draft/115) | [doc-10 CLI-7](/documentation/10:161-178) |
| B14 | **BACK-622 JSON 输出 AC 进度** | `task list/view --json` 增加 acceptanceCriteriaCompleted/Count。 | fork 已有 AC 进度工具；字段名用 acceptanceCriteriaItems | 低 | B | ①直接复用 | [DRAFT#123](/draft/123) | [doc-10 CLI-8](/documentation/10:182-198) |
| B15 | **BACK-598 Dependabot 修复** | mermaid 11.16.0→11.16.1 等依赖升级。 | fork mermaid 11.15.0，安全升级 | 低 | B | ①直接复用 | [DRAFT#106](/draft/106) | [doc-10 CLI-9](/documentation/10:202-216) |
| B16 | **BACK-623 CLI 跨分支本地优先** | CLI 命令避免跨分支工作（本地优先读取）；BACK-624 增量缓存加载为超大重构。 | fork 已本地优先+30 天窗口 fallback（关键决策保留）；`queryTasks` 每次 list 仍扫跨分支 | **高**（架构决策） | B（623）；**C**（624 降） | ②参考重写（部分） | [DRAFT#124](/draft/124) [DRAFT#125](/draft/125) | [doc-10 CLI-10](/documentation/10:220-242) |
| B22 | **BACK-603 create/draft 标志与 edit 对齐** | `task create`/`draft create` 重复 `-l` 丢值、`--dep`/`--depends-on` 合并、`\|` quirk 对齐 edit。 | fork create 同款 bug（cli.ts:1658/1742） | 低 | **A**（升） | ①直接复用 | [DRAFT#108](/draft/108) | [doc-10 CLI-11](/documentation/10:246-264) |
| B23 | **BACK-608 gray-matter 缓存投毒** | 共享 no-cache parse 包装，移除缓存投毒类陈旧数据。 | fork 6 处直接 matter()（含 fork 特有 wiki-install.ts） | 低 | B | ①直接复用 | [DRAFT#112](/draft/112) | [doc-10 CLI-12](/documentation/10:268-284) |
| B26 | **BACK-576/574 create 多 assignee + 清空 defaultEditor** | task create 多 assignee（-a "@a,@b" 存字面值是数据 bug）；允许清空 defaultEditor。 | fork 三处 `[String(options.assignee)]`；defaultEditor 空值被拒 | 低 | **A**（升） | ①直接复用 | [DRAFT#95](/draft/95) [DRAFT#93](/draft/93) | [doc-10 CLI-13](/documentation/10:288-308) |

---

## 二、TUI

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B8 | **BACK-546 依赖就绪指引** | TUI/browser 显示任务是否被阻塞/可接手，歧义 ID fail-closed。 | fork 无 readiness 指示；前置件齐备（dependencies/listCompletedTasks/task-path） | 低 | B | ②参考重写 | [DRAFT#90](/draft/90) | [doc-10 TUI-1](/documentation/10:310-329) |
| B9 | **BACK-565 TUI composer UX 修复** | 方向键导航、caret-aware 删除、固定状态选择器。 | fork composer 主体已自研；仍有 3 处缺口（picker.select 确认错项等） | 低 | **A**（升） | ①直接复用 | [DRAFT#91](/draft/91) | [doc-10 TUI-2](/documentation/10:333-351) |
| B11 | **BACK-577 TUI 窗口标题含项目名** | TUI 窗口标题显示项目名，退出时恢复（含 tmux）。 | fork 无窗口标题代码（board.ts:271 硬编码） | 低 | B | ②参考重写 | [DRAFT#96](/draft/96) | [doc-10 TUI-3](/documentation/10:355-371) |
| B12 | **BACK-584/616 vim 键边界 + filter popup vi 导航** | j/k 在列表边界内停留；filter popup 也支持 vi 导航。 | fork generic-list.ts:294 已有 vim 键循环导航；k 到顶跳出搜索框违背直觉 | 低 | **A**（升） | ②参考重写 | [DRAFT#101](/draft/101) [DRAFT#118](/draft/118) | [doc-10 TUI-4](/documentation/10:375-391) |
| B13 | **BACK-615 TUI hideEmptyColumns** | hideEmptyColumns 设置驱动 TUI 看板，Shift+H 快捷切换持久化。 | fork 仅 web 有；配置/web 已就绪，TUI 缺位 | 低 | **A**（升） | ①直接复用 | [DRAFT#117](/draft/117) | [doc-10 TUI-5](/documentation/10:395-411) |
| B18 | **BACK-609 CLI/TUI 打磨缺陷** | doc create --plain、doc list legacy、tmux 标题恢复、piped board 项目名。 | fork 4 处缺陷全部存在（doc create 拒绝 --plain、doc list 打开空内容） | 低 | **A**（升） | ②参考重写 | [DRAFT#113](/draft/113) | [doc-10 TUI-6](/documentation/10:415-433) |
| B20 | **BACK-620 页脚过滤提示对齐** | TUI kanban 与 task list 页脚过滤提示按键一致（大写指示约定）。 | fork 看板大写/列表小写不一致与上游修前相同；无 Type 键需适配 | 低 | B | ②参考重写 | [DRAFT#121](/draft/121) | [doc-10 TUI-7](/documentation/10:437-453) |
| B25 | **BACK-581/605 BACKLOG_CWD + TUI runtime cwd** | init 尊重 BACKLOG_CWD；TUI 操作经共享 core 用 runtime cwd。 | fork 已有 resolveRuntimeCwd；init 仍用 process.cwd()（bug）；11 处裸 new Core(process.cwd()) | 中 | **A**（升） | ②参考重写 | [DRAFT#98](/draft/98) [DRAFT#110](/draft/110) | [doc-10 TUI-8](/documentation/10:457-477) |

---

## 三、Web

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| A2 | **BACK-617 web Board DnD + hideEmptyColumns** | dragstart 内同步 reveal 空列导致 Chromium abort 原生拖拽；改为延迟一个 macrotask reveal。 | fork Board.tsx:658 正是同步 reveal bug 模式（与上游 before 逐行同构） | 低：单组件小改 | A | ①直接复用 | [DRAFT#119](/draft/119) | [doc-10 WEB-1](/documentation/10:479-498) |
| B7 | **BACK-593 web markdown 任务 ID 深链** | web markdown 中任务 ID 自动链接到任务深链；fail-closed canonical 索引。 | fork 有 MermaidMarkdown 但无 task-id-links；身份工具已齐备（task-path.ts） | 低：路由单数 /task/ 需适配 | **A**（升） | ②参考重写 | [DRAFT#104](/draft/104) | [doc-10 WEB-2](/documentation/10:502-524) |
| B19 | **BACK-621 web 列表去横向滚动** | 内容自适应列宽、页边距修剪、主题滚动条、modal 边框。 | fork TaskList 与上游 before 逐行同构（8 列无 Ordinal 需重算） | 中：fork 8 列/过滤控件差异 | **A**（升） | ②参考重写 | [DRAFT#122](/draft/122) | [doc-10 WEB-3](/documentation/10:528-547) |
| B21 | **BACK-614/604 web/CLI 显式 unassign** | web create 表单可表达显式 unassign；defaultAssignee 存在时 CLI/TUI 允许显式空。 | fork 无 defaultAssignee 应用基线；仅 edit 清空 assignee 小修可独立迁移 | 低 | B（局部）；web 预填降 C | ②参考重写（仅 edit 清空） | [DRAFT#109](/draft/109) | [doc-10 WEB-4](/documentation/10:551-577) |

---

## 四、Server / 核心身份

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B10 | **BACK-580/602 文档/决策身份 fail-closed** | 文档/决策身份歧义 fail-closed + doctor 诊断；frontmatter 身份统一。 | fork 有 AmbiguousTaskIdError（任务侧），doc/decision 侧只有 content-store 歧义提示；loadDecision 仍 filename-prefix 匹配 | 中 | **A**（升） | ①直接复用（新模块）+ ②参考重写（集成层） | [DRAFT#97](/draft/97) [DRAFT#107](/draft/107) | [doc-10 SVR-1](/documentation/10:579-609) |
| B17 | **BACK-613 content-store 文档 watcher 重试/重命名** | doc-1 风格文件名不再无限重试；零填充 ID 重命名对账。 | fork 同根缺陷实证（content-store.ts:594/604/833）——事件静默丢失 | 低 | **A**（升） | ②参考重写（按 fork retryRead 架构） | [DRAFT#116](/draft/116) | [doc-10 SVR-2](/documentation/10:613-638) |

---

## 五、Infra / CI

| # | 标题 | 描述摘要 | 理由 | 潜在冲突 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|----------|--------|----------|----------|----------|
| B24 | **BACK-585 ubuntu CI epoll 抖动** | ubuntu-latest test-runner epoll_ctl flake 诊断与修复。 | fork 无 preload/run-ci-tests 两个前提，机制上不受困 | 低 | **C**（降） | ③忽略 | [DRAFT#102](/draft/102) | [doc-10 CI-1](/documentation/10:640-660) |

---

## 六、跳过项（C 类）

| # | 标题 | 描述摘要 | 理由 | 优先级 | 迁移建议 | 原始/迁移任务 | 分析报告 |
|---|------|----------|------|--------|----------|----------|----------|
| C1 | **BACK-579 多行 flag 文档** | 每个多行 Markdown flag 记录真实换行处理。 | fork 已在 CLI/skill 实现 processCliEscapes | C | ③忽略 | 不适用 | [doc-10 C1](/documentation/10:662-664) |
| C2 | **BACK-578 Rosetta stderr 泄漏** | macOS 专属 sysctl 探测泄漏。 | macOS 专属，fork 无 rosetta 代码 | C | ③忽略 | 不适用 | [doc-10 C2](/documentation/10:666-668) |
| C3 | **BACK-619 README 示例修复** | 自定义 backlog 目录示例修正 + 配置键引用。 | 纯文档 | C | ③忽略 | 不适用 | [doc-10 C3](/documentation/10:670-672) |
| C4 | **BACK-573 浏览器初始化错误清 loading** | 终端浏览器初始化错误后清除共享 loading 所有权。 | fork 已有 browser-loading-state.ts（BACK-566 定制） | C | ③忽略 | 不适用 | [doc-10 C4](/documentation/10:674-676) |
| C5 | **BACK-611 删死 TUI 文件** | 移除死视图文件与重复助手。 | fork 视图结构已自行裁剪 | C | ③忽略 | 不适用 | [doc-10 C5](/documentation/10:678-680) |
| C6 | **BACK-599/600 身份对齐（跟踪）** | web task-link 身份对齐、frontmatter 身份写入。 | 代码已并入 593/580 PR，纯跟踪 commit | C | ③忽略 | 不适用 | [doc-10 C6](/documentation/10:682-684) |
| C7 | **BACK-594/595/596/601/625-632 跟踪** | MCP 现代化、Agent Plugin 打包、readiness deferral、follow-up 任务。 | 无代码（纯 backlog 跟踪） | C | ③忽略 | 不适用 | [doc-10 C7](/documentation/10:686-688) |

---

## 交叉依赖与建议迁移顺序

- **第一波（独立、零依赖、A 类）**：A1（575 并发编辑锁）→ A2（617 Board DnD）——两者互相独立，可并行。
- **第二波（CLI 小功能，独立）**：B2（582 decision list）→ B6（612 动态 import 清理）→ B23（608 gray-matter 包装）→ B5（606/610 config fail-fast，排 CLI-2 之后）。
- **第三波（CLI 数据正确性，共享 validateTaskListFlags 体系）**：B22（603 create 标志）→ B3（572/586/618 clear 系列）→ B4（597 add-ref）合并实施（三者共享验证器）。
- **第四波（依赖 defaultAssignee string[] 升级）**：B1（583）先落地 → B21（604/614 显式 unassign）依赖它；B26（576/574 多 assignee + defaultEditor）与 B1 协同。
- **第五波（TUI 系列，避免并行踩踏 src/ui 与 board.ts）**：B9（565 composer 3 处补丁）→ B12（584/616 vim 键）→ B13（615 TUI hideEmptyColumns）→ B11+B18（577/609 窗口标题 + 打磨，同文件同区域合并）→ B25（581/605 cwd，board.ts 7 处与 TUI-3/5/6 重叠）→ B20（620 footer 提示）。
- **第六波（Server 身份域，单独排期）**：B17（613 content-store watcher，SVR-2 先）→ B10（580/602 身份 fail-closed，SVR-1 依赖 store 层等价 ID 处理）——同批或紧邻实施。
- **独立大阶段**：B16（623 跨分支性能：`queryTasks` 快速路径可独立先行；CLI fail-closed 行为变更需用户决策；624 整体忽略）。
- **可选**：B19（621 web 布局）、B7（593 深链）、B8（546 readiness）、B21 的 edit 清空小修（可随 B1 批次）。

---

## 迁移任务状态

| 迁移任务 | 对应条目 | 状态 |
|----------|----------|------|
| （暂无） | | 待用户确认迁移批次 |
