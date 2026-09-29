---
id: doc-18
title: 差异化管理机制横向差距分析：七层模型与五个缺口（完整版）
type: other
created_date: '2026-09-28 04:59'
---

# 差异化管理机制横向差距分析：以 Backlog.md 为主视角

> 本文由根目录 `differentiation-management-report.html`（生成于 2026-09-27）**全文转换**而来，用于指导差异化 / 定制化相关 PRD 的编写。
>
> 同一套工具要服务软件开发、科研课题、合规采购、内容写作等性质迥异的项目，"差异"到底嵌在哪一层？
> 本报告将各产品的定制化能力抽象为七层机制模型，横向对比 9 款同类与传统基线产品，定位 Backlog.md 的机制缺口并给出可落地建议。
>
> 数据来源：本地仓库 `README.md` / `CLI-INSTRUCTIONS.md` / `ADVANCED-CONFIG.md` / `src/types/index.ts` / `backlog/config.yml` 实读，
> 外部产品机制经公开文档与社区资料交叉核对。覆盖度评分为本报告基于七层模型的定性评估，非官方基准。

## 目录

1. [核心结论](<#01 核心结论>)
2. [分析框架：差异化管理的七层模型](<#02 分析框架：差异化管理的七层模型>)
3. [Backlog.md 现状：差异嵌在哪](<#03 Backlog.md 现状：差异嵌在哪>)
4. [横评：9 款产品的机制矩阵](<#04 横评：9 款产品的机制矩阵>)
5. [各家的"招牌差异化机制"](<#05 各家的招牌差异化机制>)
6. [差距分析：五个结构性缺口](<#06 差距分析：五个结构性缺口>)
7. [建议清单：P0 / P1 / P2](<#07 建议清单：P0 / P1 / P2>)
8. [配方：五类性质项目的配置模板](<#08 配方：五类性质项目的配置模板>)
9. [一页速查表](<#09 一页速查表>)

---

## 01 核心结论

> **一句话判断**
>
> Backlog.md 的差异化停留在**「配置层」**——通过改看板列、改完成定义、改 ID 前缀来适配不同项目；
> 而头部同类产品已经下沉到**「模型层」**——用工单类型系统、状态类别语义、工作流公式来表达差异。
> 前者改的是*外观与默认值*，后者改的是*数据模型与执行语义*。

| | 判断 |
|---|---|
| **优势** · 最轻的落地成本 | 一个 `backlog/config.yml` 就能把工具从"软件看板"改造成"课题评审流水线"，无需 schema 迁移、无需数据库。`--no-git` 更让它能覆盖纯文档/非代码项目。 |
| **缺口** · 没有工单类型系统 | Task 数据模型中**不存在 type 字段**。分类职责完全压在 `labels` 上——而 label 是自由文本，无约束、无行为绑定、无法驱动不同字段或不同流程。 |
| **缺口** · 状态列没有语义 | `statuses` 只定义"列叫什么"，不定义"这列算不算在做、算不算完结"。导致 `ready` 筛选、WIP 限制、自动化触发都只能靠约定而非机制。 |

> **最值得抄的三件事（低成本、高收益）**
>
> ① **状态类别注解**（抄 Beads，但要补上起止两类）：给每列加 `:initial / :active / :wip / :blocked / :done / :dropped` 后缀，
> 一行配置解锁"可开工筛选"与"终态判定"；
> ② **工单类型 + 类型默认 DoD**（抄 Beads/Jira）：按类型注入不同的完成定义检查项；
> ③ **工作流配方**（抄 Beads Formulas / spec-kit）：把"立项→评审→执行→归档"固化成可复用流程模板，而不是让每个项目从零手搓列。

---

## 02 分析框架：差异化管理的七层模型

不同产品"把差异嵌在哪里"并非随机。观察 9 款产品后，可以把所有定制化能力归到七个层次——越靠下，差异表达力越强，但改造成本也越高。

### L7 沉淀 · 知识沉淀层 —— 做完之后留下什么

已完成工作是否自动转化为可检索的项目记忆：归档目录、Wiki、Delta 回写主文档。

> Backlog.md: completed/ + archive/ + LLM Wiki · Beans: archive 作为项目记忆 · OpenSpec: archive 合并回 specs/

### L6 流程 · 工作流编排层 —— 事情怎么一步步走

是否存在可复用的流程模板/命令族：斜杠命令、公式、阶段门禁与审批点。

> spec-kit: /speckit.\* 命令族 · Beads: bd formula / mol pour · OpenSpec: proposal→apply→archive

### L5 角色 · 角色与代理层 —— 谁来做

是否内建角色模型：人格化代理、职责边界、按角色切换上下文与权限。

> BMAD: 21+ 人格代理（Mary/Winston/Quinn）· Backlog.md: 仅 assignee 字符串数组

### L4 规范 · 规范底座层 —— 什么是不可协商的

全局约束规则的载体：项目宪法、完成定义、质量门禁，以及它是否*约束 AI 行为*而非仅作提醒。

> spec-kit: constitution.md（强宪法）· Backlog.md: definition_of_done（完成卫生）· OpenSpec: spec 即行为契约

### L3 字段 · 字段与属性层 —— 每条记录长什么样

可扩展的结构化属性：自定义字段、优先级、估算、时间窗、依赖与父子层级。

> Jira: custom fields + screens per type · Backlog.md: priority / 4 个时间字段 / dependencies / parent

### L2 状态 · 状态机层 —— 从生到死经过哪些站

状态的**集合**与**语义类别**，以及转换是否受约束。仅有列名 ≠ 有状态机。

> Beads: status.custom + 类别（队列可见性，非流程语义）· Jira: workflow scheme（转换+条件+验证器）

### L1 类型 · 类型系统层 —— 这是"什么性质的东西"

工作项的种类划分：bug / feature / epic / chore / gate…。类型决定后续所有层如何对它生效。

> Beads: types.custom · Beans: milestone/epic/feature/task/bug · Jira: issue type scheme · Backlog.md: **缺失**

> **怎么用这个模型**
>
> 判断一个工具"能不能适配不同性质的项目"，就看它在**哪几层**开放了定制。开放层数越多、越靠下，表达力越强。
> 本报告第 4 节的矩阵和第 6 节的差距分析，都以此为统一标尺。

---

## 03 Backlog.md 现状：差异嵌在哪

先盘家底。Backlog.md 并非没有差异化机制，而是把宝押在了「配置 + 目录结构 + AI 指令注入」三处。

### 3.1 已有的差异化载体

| 机制 | 载体 | 如何承载差异 | 层次 |
|---|---|---|---|
| **自定义看板列** | `statuses: [...]` | 项目性质的最直接表达。科研课题可用 `待评审/评审中/已立项/已结题`，软件可用 `To Do/In Progress/Done` | L2 |
| **项目级完成定义** | `definition_of_done: [...]` | 每个新任务自动注入检查清单；可用 `--dod` 追加、`--no-dod-defaults` 单任务跳过。等价于"项目级质量基线" | L4 |
| **标签与配色** | `labels / label_colors` | 事实上承担了分类职责（如 `cli / docs / web-ui`），可配色区分。但自由文本、无校验、不驱动行为 | L1 替代 |
| **ID 前缀与补零** | `task_prefix / zeroPaddedIds` | 多项目并存时区分来源（`back-` vs 其他），支持子任务编号 `back-217.02` | L0 |
| **非代码项目模式** | `backlog init --no-git`<br>`filesystem_only` | 强制关闭 `checkActiveBranches / remoteOperations / autoCommit`，让纯文档项目（采购、评审、写作）可用——**这是它跨出软件领域的关键开关** | 跨层 |
| **状态变更回调** | `onStatusChange` | 全局或**任务级**覆盖；可用 `$TASK_ID $OLD_STATUS $NEW_STATUS $TASK_TITLE` 拼 shell 命令，把状态流转接到外部系统/唤醒 Agent | L6 弱 |
| **领域目录分层** | `tasks/ docs/ decisions/ drafts/ milestones/ wiki/ archive/ completed/` | 用目录而非字段区分信息性质：规划层(docs) → 执行层(tasks) → 记忆层(wiki)。文档支持 `type` + `tags` | L7 |
| **AI 工作流注入** | MCP `backlog://workflow/*`<br>AGENTS.md 标记块 | 把"何时建任务、如何验收"作为*资源*下发给 AI；init 时向 CLAUDE/AGENTS/GEMINI/copilot 五种文件注入带标记的指引段 | L4/L6 |

### 3.2 一份"科研课题管理"改造样例

不改一行代码，仅靠配置即可把 Backlog.md 从软件看板改造成课题评审流水线：

```yaml
# backlog/config.yml — 课题制项目管理
project_name: "2026 野外站开放基金"
task_prefix: "fund"
statuses: ["待受理", "形式审查", "专家评议", "已立项", "中期检查", "已结题", "未通过"]
default_status: "待受理"
definition_of_done:
  - "评审意见已按申请人逐项展开"
  - "风险点已拆分至各自课题"
  - "无分数呈现、无括号追加解释"
label_colors: {"气候变化": "blue", "地灾预警": "orange", "生态监测": "green"}
filesystem_only: false
onStatusChange: 'if [ "$NEW_STATUS" = "专家评议" ]; then echo "$TASK_ID 进入评议" >> review.log; fi'
```

> **这说明什么**
>
> Backlog.md 的差异化能力**足以覆盖"流程形状"的差异**（有哪些阶段、每阶段完成标准是什么），
> 而且在非代码项目上比 Beads/Beans 更友好——因为它们深度绑定 Git 仓库语义。
> 但它**无法表达"工作项种类"的差异**：同一个看板里，"一个 bug 修复"和"一份评审报告"在数据结构上完全同构。

---

## 04 横评：9 款产品的机制矩阵

按七层模型逐层打分。**●** 原生支持且可定制 · **◐** 部分/弱支持 · **○** 缺失 · **—** 不适用。

| 产品 | L1 类型 | L2 状态机 | L3 字段 | L4 规范底座 | L5 角色 | L6 工作流 | L7 沉淀 |
|---|---|---|---|---|---|---|---|
| **Backlog.md**（本次主视角） | ○ 无 type | ◐ 仅列名 | ● 时间/依赖 | ◐ DoD 默认 | ◐ assignee | ◐ 回调+指引 | ● Wiki+归档 |
| **Beads**（steveyegge） | ● types.custom | ● 类别注解 | ● 依赖图 | ◐ 弱 | ○ | ● Formulas | ● 语义压缩 |
| **Beans**（hmans） | ● 5 种固定 | ◐ 5 态固定 | ◐ 优先/父子 | ○ | ○ | ◐ prime 注入 | ● archive=记忆 |
| **TaskMaster**（eyaltoledano） | ○ 无 type | ◐ 固定状态 | ● 复杂度/子任务 | ◐ rules 注入 | ○ | ◐ PRD→tasks | ◐ docs/ reports/ |
| **spec-kit**（GitHub） | ○ | ○ | ◐ 模板内字段 | ● constitution | ○ | ● 6 段命令族 | ◐ spec 留档 |
| **OpenSpec**（Fission AI） | ○ | ◐ 三段状态机 | ◐ delta 标记 | ● spec=契约 | ○ | ● proposal→archive | ● delta 回写 |
| **cc-sdd**（Kiro 风格） | ○ | ◐ 阶段递进 | ○ | ◐ TDD 内置 | ○ | ● 5 段+TDD | ◐ 设计文档 |
| **BMAD-METHOD** | ◐ 文档类型 | ◐ 故事状态 | ◐ 故事字段 | ● agent 规约 | ● 21+ 人格 | ● 34+ 工作流 | ● 文档分片 |
| **Jira**（传统基线） | ● issue type scheme | ● workflow scheme | ● custom fields | ◐ 权限方案 | ● 角色方案 | ● 转换条件 | ◐ |
| **Linear**（传统基线） | ◐ 模板 | ◐ 团队工作流 | ● estimate/cycle | ○ | ○ | ◐ 模板+项目 | ◐ |
| **GitHub Issues**（传统基线） | ◐ Bug/Feature/Task | ○ open/closed | ● Projects 自定义字段 | ○ | ○ | ◐ issue forms | ◐ |

### 4.1 机制覆盖度

覆盖度 = 七层中"原生可定制"计 1 分、"部分支持"计 0.5 分。

| 产品 | 覆盖度 |
|---|---|
| Beads | 5.5 |
| Jira | 5.5 |
| BMAD-METHOD | 5.0 |
| Backlog.md | 4.0 |
| Beans | 3.5 |
| spec-kit | 3.0 |

> Beads 与 Jira 并列最高，但二者的机制重心完全不同：Beads 在 L1/L2/L6（面向 Agent 可执行性），Jira 在 L1/L2/L3/L5（面向组织治理）。

---

## 05 各家的招牌差异化机制

每款产品都有一种"别人没有、或做得更狠"的差异化打法。这一节是它们的辨识特征，也是第 7 节建议的灵感来源。

**Beads · 状态类别注解 · 一行配置解锁语义**

自定义状态时用 `名称:类别` 语法，控制该状态是否出现在 `bd ready` 与默认 `bd list` 中。**这是"配置即语义"的典范。**

```bash
bd config set status.custom \
  "in_review:active,qa_testing:wip,on_hold:frozen"
```

> ⚠ 四个类别是**队列可见性**语义，不是流程图语义：`done` 与 `frozen` 行为完全相同（都不入队、都不默认显示）；
> 起点由内置 `open` 隐式承担，`blocked` 被并入 `wip`。若要表达流程图，需补 `initial` 起点并把 `blocked` 独立出来。

**Beads · 工作流公式 · 流程可实例化**

`bd formula list` 列出预置流程，`bd mol pour bigfeature --vars "feature_name=auth"` 把一条流程模板"浇筑"成一组带依赖的任务。差异不只是字段，而是**整条流水线可复用**。

**spec-kit · Constitution · 宪法式行为约束**

`.specify/memory/constitution.md` 写死"每个功能必须是独立库""状态管理必须 Redux""覆盖率不低于 85%"。AI 生成前必须校验——**规范不是文档，是硬闸**。Backlog.md 的 DoD 是"完成卫生检查"，力度弱一档。

**OpenSpec · Delta 规格 · 差异本身就是一等公民**

`openspec/specs/` 存当前真相，`changes/` 存变更提案并用 `## ADDED/MODIFIED/REMOVED` 只写增量，archive 时回写合并。
**把"改了什么"而非"现在是什么"作为管理单元**，天生适配存量演进。

**BMAD · 人格化代理 · 差异由角色承载**

Mary(BA)、Preston(PM)、Winston(架构师)、Sally(PO)、Devon(开发)、Quinn(QA)——21+ 代理各有规约、职责边界与产物格式。项目性质差异被翻译成**"该派谁上场"**。代价：21+ 代理的学习曲线与交接成本。

**TaskMaster · Tag 分轨 · 一套工具多条上下文线**

`.taskmaster/state.json` 的 `currentTag` 让同一项目并行维护多套任务上下文（`master` / `backlog` / 分支特性轨），`move --from-tag --to-tag` 跨轨搬家。**多轨并行**是它最独特的差异化。

**Beans · 归档即记忆 · L7 的极简解法**

已完成的 bean 归档后不是死数据，而是**可被 Agent 查询的项目记忆**；配合 `beans prime` 在会话开始/上下文压缩时注入，解决"失忆"问题。Backlog.md 的 Wiki 是同类思路但更重（需 LLM 维护）。

**Jira · Scheme 三件套 · 差异按项目隔离**

issue type scheme（有哪些类型）+ workflow scheme（状态与转换条件）+ field configuration/screen（每类型显示哪些字段），三者按项目绑定。**企业级差异化的标杆**，代价是配置复杂度极高。

---

## 06 差距分析：五个结构性缺口

把 Backlog.md 与矩阵中其他产品对齐后，缺口集中在五处。按"影响面 × 改造成本"排序。

### GAP 1 · 没有工单类型系统：分类职责错配给 labels · 影响 高 · 成本 中

**事实**：Task 数据模型中不存在 `type` 字段。字段清单为 id/title/status/assignee/reporter/labels/milestone/dependencies/priority/parentTaskId/subtasks/时间字段等，**无类型位**。

**后果**：分类只能靠 `labels`（如 `enhancement`、`developer-experience`）。但 label 是自由文本，带来四个连锁问题：

- 无受控词表 —— 同一个人可以写 `bug` / `Bug` / `缺陷`，检索与统计失真；
- 无行为绑定 —— 类型无法决定"该显示哪些字段""该走哪条流程"；
- 无默认注入 —— 无法像 Jira 那样"bug 类型自动带复现步骤字段、feature 类型自动带验收标准"；
- 与状态列耦合 —— 想表达"评审类任务 vs 开发类任务走不同列"，只能拆成两个项目。

**对照**：Beads `types.custom "agent,molecule,event"`；Beans 内建 milestone/epic/feature/task/bug 并强制 `--type`；Jira 有完整的 issue type scheme。**这是与同类最大的单点差距。**

### GAP 2 · 状态列无类别语义：只有名字，没有行为 · 影响 高 · 成本 低

**事实**：`statuses: ["待受理","专家评议","已立项",...]` 只定义显示顺序与列名，不携带任何语义。系统不知道哪一列算"可开工"、哪一列算"终态"。

**后果**：

- MCP 的 `ready: true` 筛选只能按"无未完依赖"判断，无法叠加"且状态属于可开工类"；
- "未通过""已结题"这类终态列与"专家评议"在看板上无区别，统计口径靠人工约定；
- 无法做 WIP 限制、无法自动识别挂起项。

**对照**：Beads 的 `名称:类别` 语法让 `bd ready` 天然正确；Jira 的 workflow scheme 精确到"从 A 到 B 需要满足条件 C、触发动作 D"。

**好消息**：这是**成本最低**的一个缺口——只需给 `statuses` 增加可选的语法解析，向后兼容纯字符串。

### GAP 3 · 无工作流模板：每次换项目都要从零手搓 · 影响 中 · 成本 中高

**事实**：Backlog.md 有"工作流指引"（MCP `backlog://workflow/*` 资源 + AGENTS.md 注入），但那是**给 AI 读的说明文本**，不是**可实例化的流程定义**。换一个项目，仍要手工重设 statuses、DoD、目录约定。

**对照**：Beads `bd mol pour <formula> --vars` 一条命令生成整组带依赖的任务；spec-kit `/speckit.constitution → specify → plan → tasks → implement` 六段命令族；OpenSpec `proposal→apply→archive` 三段状态机。

**已有资产可复用**：`onStatusChange` 回调（含任务级覆盖）+ AGENTS.md 标记块注入，二者组合已经能拼出"半自动流程"。缺的是把这层封装成可分发、可命名的**配方**。

### GAP 4 · 规范底座是"完成卫生"而非"行为约束" · 影响 中 · 成本 低

**事实**：MCP 文档明确写着 *"DoD is not acceptance criteria: acceptance criteria define scope/behavior, while DoD tracks completion hygiene"*。DoD 的定位是**交付前的清洁度检查**（测试通过、文档更新），而非**贯穿全程的行为硬约束**。

**后果**：像"评审意见不得出现分数""采购文档不得展开预算明细""不使用括号追加解释"这类**过程性规范**，没有天然落点——只能塞进 DoD 清单（事后检查）或写进 docs/（仅供参考）。

**对照**：spec-kit 的 `constitution.md` 是 AI 生成前的强制校验闸；OpenSpec 把 spec 当作行为契约，`openspec validate --strict` 能检出缺失的 GIVEN/WHEN/THEN 场景。

**折中方案**：不强求演进成宪法，可先增加"项目级规范文件"约定（如 `backlog/docs/project-constitution.md`），在 workflow 资源中要求 AI 建任务/写计划前先读它。

### GAP 5 · 角色模型缺失：assignee 只是字符串 · 影响 低中 · 成本 高

**事实**：`assignee` 是 `string[]`，`defaultAssignee` 也只是名字列表。没有角色、没有职责边界、没有"谁能改哪个字段"。

**对照**：BMAD 用 21+ 人格代理承载角色差异；Jira 有完整的角色方案与权限方案。

**不建议跟进**：角色编排（BMAD 式）与 Backlog.md"轻量 Markdown + 本地优先"的定位冲突，且实测中 BMAD 的交接开销显著。**建议标记为"有意识的不做"。** 若确需，用 `defaultAssignee` + 标签约定 + docs/ 中的角色说明文档轻量覆盖即可。

> **同时，Backlog.md 有三项别人没有的优势，别在补缺口时丢掉**
>
> ① **`--no-git` 文件系统模式**——Beads/Beans 深度绑定 Git 语义，纯文档项目（采购、评审、写作）用起来别扭，Backlog.md 可强制关闭 Git 相关能力，是唯一能干净覆盖非代码项目的；
> ② **甘特图计划/实际双层时间字段**（`plannedStart/End` + `actualStart/End`）——同类产品普遍只有简单 due date，这是它在"有排期项目"上的独占优势；
> ③ **五种 Agent 指令文件统一注入 + 标记块幂等更新**——比 Beans 要求手工改 `.claude/settings.json` 更省事。

---

## 07 建议清单：P0 / P1 / P2

按优先级排列。P0 = 低成本高收益、应最先做；P1 = 需要一定开发投入；P2 = 可暂缓或用约定替代。

### P0 · 给 statuses 增加类别注解（借鉴 Beads）

允许 `statuses: ["待受理:initial", "待审查:active", "专家评议:wip", "挂起:blocked", "已结题:done", "未通过:dropped"]`。

> 注意 `initial` 与 `active` 都要有：前者是入口（只能出不能进、新建默认），后者是待办队列（可转入、AI 的 ready 入口）。
> 若中间状态一律标 `wip` 而省掉 `active`，ready 队列里就只剩新建任务，AI 查不到"流转中且已就绪"的工作。

六类 = 起点 / 可开工 / 进行中 / 挂起 / 成功终态 / 否定终态。

> ⚠ 不要直接照搬 Beads 的 `active/wip/done/frozen`：那是**队列可见性**语义（`done` 与 `frozen` 在 `bd ready`/`bd list` 上行为完全相同），
> 缺**起点**且把 `blocked` 并入 `wip`。流程图需要显式的起止节点，且终点应能区分"做成了"与"没做成"。

解析时向后兼容纯字符串（默认视为 `active`）。**收益**：`ready` 筛选立刻变准确、多个语义相反的终态可共存、起点不可倒流、统计口径不再靠约定。
**成本**：仅需改动配置解析 + 一处筛选逻辑，无数据迁移。

### P0 · 引入受控 labels（可选词表 + 配色）（借鉴 Beads types.custom / Linear labels）

不改数据模型，先给 `labels` 加一层"受控词表"配置：`label_vocabulary: [bug, feature, chore, 评审, 采购]`，
配合已有的 `label_colors` 做视觉区分，CLI/UI 创建时对不在词表内的标签给出提示（而非硬拦）。
**收益**：以最小代价先解决 GAP 1 中"词表失控"这一半问题，为真正的 type 字段铺路。

### P0 · 定义项目级规范文件约定（借鉴 spec-kit constitution）

约定 `backlog/docs/project-constitution.md`（或配置项 `constitution_path`），
在 `backlog://workflow/task-creation` 与 `task-execution` 中要求 AI 先读该文件再动手。
**收益**：把"评审报告不出现分数""采购文档不展开预算明细"这类过程性规范，从口头约定变成 AI 每次必经的输入。成本几乎为零（只是指引文本 + 一个约定路径）。

### P1 · 类型默认完成定义（DoD by label/type）（借鉴 Jira field configuration）

把 `definition_of_done` 从字符串数组升级为支持"按分类覆盖"：

```yaml
definition_of_done:
  default: ["Tests pass", "Docs updated"]
  by_label:
    评审: ["按申请人逐项展开", "风险点拆分至课题"]
    采购: ["术语边界已核对", "仅保留顶层总额"]
```

**收益**：同一个项目里不同性质的工作项拿到不同的完成标准——这正是"差异化管理"最核心的诉求，且复用已有的 P0 标签词表。

### P1 · 工作流配方（recipes）（借鉴 Beads Formulas / spec-kit 命令族）

内置若干可命名配方（软件开发 / 课题评审 / 内容写作 / 采购合规），
`backlog init --recipe grant-review` 一次性写入对应的 statuses、DoD、目录约定与 Agent 指引段。
**收益**：把第 8 节的"配方"从人工文档变成一条命令，直接消灭 GAP 3 的大部分痛点。已有 `onStatusChange` + AGENTS.md 注入可作为实现基础。

### P2 · 真正的 type 字段（借鉴 Beads / Beans / Jira）

在 Task frontmatter 增加可选 `type:`，配 `types: [...]` 受控词表与 `default_type`。
**为什么排 P2**：涉及数据模型、所有创建面（CLI/向导/TUI/Web/MCP）、过滤器与导出，改动面广。建议先用 P0 的受控标签验证真实需求强度，再决定是否升格为一等字段。

### P2 · 角色与权限模型（借鉴 BMAD / Jira）

**建议有意识地不做**。角色编排与本地优先、轻量 Markdown 的定位冲突，BMAD 的实测交接成本已证明其代价。
需要时用 `defaultAssignee` + 标签 + docs/ 中的角色说明文档覆盖即可。

---

## 08 配方：五类性质项目的配置模板

回到最初的问题——Backlog.md 能不能服务不同性质的项目？答案是"能，但要靠配方"。以下是五套可直接落地的配置骨架。

| 项目性质 | statuses（看板列） | definition_of_done | 关键补充配置 |
|---|---|---|---|
| **软件开发**（默认形态） | `To Do / In Progress / In Review / Done` | `tsc 通过 · lint 通过 · 测试通过` | 保持 Git 模式；用 `onStatusChange` 在进 In Progress 时唤醒 Agent；时间字段做甘特图排期 |
| **科研课题 / 基金评审**（跨性质） | `待受理 / 形式审查 / 专家评议 / 已立项 / 中期检查 / 已结题 / 未通过` | `按申请人逐项展开 · 风险拆分至各自课题 · 无分数与括号追加解释` | `task_prefix: fund`；labels 作学科分类（气候变化/地灾预警/生态监测）；decisions/ 存评议结论、docs/ 存评审细则 |
| **采购与合规文档**（跨性质） | `需求确认 / 方式论证 / 文档编制 / 内部复核 / 已定稿` | `术语边界已核对 · 依据条款已引用 · 仅保留顶层总额` | `docs/` 存依据文件（管理办法条款）；把"不展开预算明细"写进 constitution 文档；阶段留痕靠 comments 而非改正文 |
| **内容写作 / 研究笔记**（非代码） | `选题 / 素材 / 初稿 / 修订 / 已发布` | `事实已核查 · 引用已标注 · 结论先行` | `--no-git` 或 filesystem_only；drafts/ 做素材池、wiki/ 做知识沉淀；`documentation:` 字段关联素材文档 |
| **AI/算法实验**（非代码） | `假设 / 数据准备 / 实验 / 评估 / 结论` | `指标已记录 · 可复现（种子/环境已记） · 负结果已归档` | `implementationNotes` 记超参；wiki/ 沉淀实验结论；`completed/` 保留失败实验供检索 |

> **配方的共同结构**
>
> 五套配方的差异**全部落在三个配置项上**：`statuses`（流程形状）、`definition_of_done`（质量标准）、`labels + label_colors`（内容分类）。
> 这恰恰印证了第 1 节的判断——Backlog.md 的差异化是配置层的：它足够灵活，但差异的"表达力上限"被这三个字段锁死了。
> 补上 P0 的类别注解与受控标签，等于把这三个旋钮的精度提一档。

---

## 09 一页速查表

| 如果你想要… | 最该看的产品 | 它的机制 / 一句话做法 |
|---|---|---|
| 让"哪些任务能开工"自动算准 | **Beads** | `status.custom "名称:类别"`，类别 active/wip/done/frozen 控制入队与默认视图；**若要流程图语义需补 initial 起点与独立 blocked** |
| 给工作项分种类 | **Beads / Beans / Jira** | `types.custom`（Beads）· 内建 milestone/epic/feature/task/bug（Beans）· issue type scheme（Jira） |
| 一条命令搭出整套流程 | **Beads / spec-kit** | `bd mol pour <formula> --vars` · `/speckit.constitution → specify → plan → tasks` |
| 规范硬约束 AI 不越界 | **spec-kit / OpenSpec** | `constitution.md` 生成前强校验 · `openspec validate --strict` 检出场景缺失 |
| 存量系统迭代（只管增量） | **OpenSpec** | `## ADDED / MODIFIED / REMOVED` delta 规格，archive 时回写主文档 |
| 多角色分工协作 | **BMAD / Jira** | 21+ 人格代理（Mary/Winston/Quinn…）· 角色方案 + 权限方案 |
| 一套工具并行多条线 | **TaskMaster** | tag 分轨 `currentTag` + `move --from-tag --to-tag` |
| AI 不失忆 | **Beans / Backlog.md** | `beans prime` 会话起始注入 · Backlog.md 的 LLM Wiki（更重但更全） |
| 非代码/纯文档项目 | **Backlog.md** | `backlog init --no-git`，强制关闭 Git 相关能力——**同类中唯一干净覆盖** |
| 带排期、要对比计划 vs 实际 | **Backlog.md** | `plannedStart/End` + `actualStart/End` 双层甘特图——**同类普遍没有** |

> **最后一句**
>
> Backlog.md 不需要变成 Beads，也不需要变成 spec-kit。它的差异化路线应该是**"保持配置层的轻，补上语义层的准"**——
> 不引入数据库、不引入角色编排、不牺牲非代码项目能力，只做两件小事：**让状态带语义、让分类受控**。
> 这两件事做完，"不同性质的项目管理"就从"能凑合用"变成"真的适配"。

---

## 附：与 doc-17 的分工

| 文档 | 主题 | 关系 |
|---|---|---|
| **doc-18**（本文） | 差异化管理的**面**：七层模型 × 9 款产品横评 × 5 个缺口 × P0/P1/P2 建议 | 给出"该补哪一层"的全景判断 |
| **doc-17** | 差异化的**点**：L2 状态机层的语义缺失诊断与完整方案（六类 category、转换定义、AI 权限、引擎选型） | 把本文 GAP 2（状态列无语义）与 P0-1（类别注解）展开为可直接写进 PRD 的规格 |

写 PRD 时：**先用 doc-18 定位层次与优先级，再用 doc-17 取该层的具体规格**。
