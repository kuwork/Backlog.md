---
title: AI Agent 战略路线图
labels: [report, roadmap]
created_date: '2026-05-24 02:00'
updated_date: '2026-05-24 21:15'
---

# AI Agent 战略路线图

> 基于社区 Fork 分析背景，结合 AI agent 技术演进趋势，为 Backlog.md 制定面向未来的功能战略规划。
> 分析来源：`doc-4 - Community-Fork-Analysis.md`、`doc-6 - Community-Driven-Feature-Enhancement-Recommendations.md`

---

## 执行摘要

AI agent 正在从「工具调用者」向「任务执行者」演进。Backlog.md 的核心价值——**用 Markdown 文件管理任务生命周期**——恰好处于这一演进的关键路径上。

本报告提出：**Backlog.md 的战略定位应从「任务管理 CLI 工具」升级为「AI Agent 的任务操作系统」**。不是让 Backlog.md 变成操作系统，而是让它在 agent 生态中扮演类似操作系统的角色：管理 agent 的「进程」（任务）、提供「系统调用」（MCP 接口）、维护「文件系统」（Markdown 任务文件）、记录「日志」（Git 历史）。

| 演进阶段 | 时间范围 | 核心能力 | 标志性特征 |
|----------|----------|----------|------------|
| **Phase 1: Agent 感知** | 2026 Q2-Q3 | 上下文快照、执行追踪、工作流模板 | Agent 能「看见」项目全貌 |
| **Phase 2: Agent 协作** | 2026 Q3-Q4 | 多 Agent 协调、技能注册、评估循环 | 多个 Agent 能「共享」同一个项目 |
| **Phase 3: Agent 自主** | 2026 Q4-2027 Q1 | 目标分解、预测分析、智能推荐 | Agent 能「自主」规划和执行 |

---

## 一、战略定位：为什么是「任务操作系统」？

### 1.1 当前定位的局限性

Backlog.md 目前的自我定位是「基于 Markdown 的任务管理工具」。这个定位在 2025 年足够准确，但在 2026 年的 AI agent 生态中已经显得狭窄：

- **工具视角**：用户用 CLI/TUI/Web UI 手动管理任务
- **Agent 视角**：Agent 通过 MCP 调用工具，但仍然是「外部调用者」
- **缺失的视角**：Backlog.md 没有意识到自己是 agent 工作流的「基础设施层」

### 1.2 操作系统的隐喻

将 Backlog.md 想象为 agent 的任务操作系统：

| 操作系统概念 | Backlog.md 对应物 | 说明 |
|-------------|-------------------|------|
| **进程管理** | 任务生命周期管理 | 创建、执行、暂停、完成、归档 |
| **进程间通信** | 任务依赖关系 | `dependencies`、`parentTaskId` |
| **文件系统** | Markdown 任务文件 | 人类可读 + 机器可解析 |
| **系统调用** | MCP 工具接口 | `task_create`、`task_edit`、`task_search` |
| **系统日志** | Git 提交历史 | 谁在什么时候做了什么 |
| **用户空间** | Agent 指令文件 | AGENTS.md、CLAUDE.md、GEMINI.md |
| **内核空间** | Core API | `src/core/backlog.ts` |

**关键洞察：** 操作系统的价值不在于它本身做什么，而在于它为上层应用提供了什么基础设施。Backlog.md 的价值也应该从「我能管理任务」转变为「我能让 agent 更好地管理任务」。

### 1.3 为什么 Markdown 是理想格式

在 AI agent 生态中，数据格式需要同时满足两个矛盾的需求：

| 需求 | Markdown 优势 | 对比数据库/JSON |
|------|---------------|-----------------|
| **人类可读** | 原生支持，无需渲染 | 需要工具查看 |
| **机器可解析** | YAML frontmatter + 结构化 section | 需要 schema 定义 |
| **版本控制友好** | Git diff 直接可读 | 二进制/难以 diff |
| **冲突可解决** | 文本合并，人类可介入 | 需要专用合并工具 |
| **语义丰富** | 支持 Mermaid、表格、代码块 | 需要额外字段 |
| **零锁定** | 任何文本编辑器都能打开 | 需要专用客户端 |

**结论：** Backlog.md 的 Markdown 文件格式不是技术债，而是**核心战略资产**。它天然支持人机协作，这在 multi-agent 时代是稀缺能力。

---

## 二、AI Agent 演进趋势与 Backlog.md 的映射

### 2.1 趋势一：MCP 协议标准化（2024-2025，已发生）

**趋势描述：**
MCP（Model Context Protocol）正在成为 agent 与工具交互的事实标准。Claude Code、Cursor、Kimi 等主流 AI 编辑器都已支持 MCP。

**Backlog.md 现状：**
- ✅ 已实现 MCP 服务器（stdio 传输）
- ✅ 已注册 task/milestone/document/DoD 工具
- ✅ 已提供工作流资源（overview、task-creation、task-execution、task-finalization）
- ✅ 已发布 npm 包，支持 `backlog mcp start`

**社区 Fork 中的创新：**
- `cpu-once/study-Backlog.md`：Codex 插件原型（MCP + 插件架构）
- `mreferre/Backlog.md`：Kiro agent 显式支持
- `wagleanuj/kaseruka`：发布为 Agent Skill（无需 MCP 资源即可使用指令）

**战略建议：**
MCP 层已完成 MVP，但距离「生产级」还有差距。需要：
1. 支持 SSE 传输（不仅是 stdio），便于远程 agent 访问
2. 添加工具调用日志，便于调试和审计
3. 支持动态工具注册（agent 可注册自定义工具）

---

### 2.2 趋势二：Agent 技能市场（2025-2026，正在发生）

**趋势描述：**
Agent 不再从零开始配置工具，而是从「技能市场」下载预配置的工具包。例如：「Backlog 任务管理技能」、「Git 操作技能」、「AWS 部署技能」。

**Backlog.md 现状：**
- ⚠️ 有 MCP 工具，但没有封装为「技能」
- ⚠️ 有 AGENTS.md 指令，但没有标准化为可复用格式
- ⚠️ 安装方式仍是 `npm i -g backlog.md`，不是「一键技能安装」

**社区 Fork 中的创新：**
- `wagleanuj/kaseruka`：将 Backlog.md 发布为 Agent Skill（`backlog-technical-project-manager` skill 的雏形）
- `principal-forks/Backlog.md`：OTEL 仪器化 skill（领域特定）

**战略建议：**
将 Backlog.md 能力封装为标准化技能包：

```
backlog-skill/
├── skill.json          # 技能元数据（名称、版本、描述、作者）
├── mcp-config.json     # MCP 服务器配置（stdio 命令、环境变量）
├── instructions/       # Agent 指令文件
│   ├── overview.md     # 工作流概述
│   ├── task-creation.md
│   ├── task-execution.md
│   └── task-finalization.md
├── prompts/            # 预定义提示模板
│   ├── create-task.txt
│   ├── review-task.txt
│   └── summarize-sprint.txt
└── workflows/          # 预定义工作流
    ├── bug-fix.yaml    # 修复 bug 的标准工作流
    ├── feature-dev.yaml
    └── refactor.yaml
```

**关键价值：** 用户安装 Backlog.md 时，不仅安装了 CLI 工具，还安装了一套「agent 工作流最佳实践」。

---

### 2.3 趋势三：Multi-Agent 协作（2025-2026，正在发生）

**趋势描述：**
单个 agent 的能力有限，未来是多个 specialist agent 协作完成任务。例如：「架构师 agent」设计模块，「开发者 agent」实现代码，「测试 agent」编写测试，「项目经理 agent」追踪进度——它们都在同一个项目上工作。

**Backlog.md 现状：**
- ❌ 没有 agent 身份标识（不知道是谁在操作）
- ❌ 没有并发控制（多个 agent 同时编辑同一文件会冲突）
- ❌ 没有任务分配（不能指定某个任务由某个 agent 负责）
- ❌ 没有 agent 间通信机制

**社区 Fork 中的创新：**
- `MensNetwork/backlog.md`：部门级消息路由（收件箱系统，虽然安全模型有问题，但方向正确）
- `Myran/Backlog.md`：Claude PR Assistant 工作流（agent 自动化执行）
- `erdosxx/Backlog.md`：远程分支任务搜索（多分支协作的雏形）

**战略建议：**
多 agent 协作不是「添加一个功能」，而是需要重新设计三个层面：

**身份层：**
```yaml
# backlog/config.yml
agents:
  - id: "architect-agent"
    name: "架构师"
    role: "负责系统设计和技术决策"
    permissions: ["create-task", "edit-task", "create-decision"]
    default_assignee: true  # 该 agent 创建的任务默认分配给自己

  - id: "dev-agent"
    name: "开发者"
    role: "负责代码实现"
    permissions: ["edit-task", "complete-task"]
    parent_agent: "architect-agent"  # 向上级 agent 汇报
```

**协调层：**
```typescript
// 任务锁机制
interface TaskLock {
  taskId: string;
  agentId: string;
  acquiredAt: Date;
  expiresAt: Date;  // 自动释放，防止死锁
}

// Agent 操作日志
interface AgentAction {
  agentId: string;
  action: "create" | "edit" | "complete" | "archive";
  taskId: string;
  timestamp: Date;
  diff: string;  // Git diff 格式的变更描述
}
```

**通信层：**
不采用 MensNetwork 的「共享目录消息」模型（安全问题），而是采用「任务评论」模型：

```markdown
---
id: TASK-123
title: "实现用户认证模块"
status: "In Progress"
assignee: "dev-agent"
---

## Description
实现基于 JWT 的用户认证模块。

## Comments

### 2026-05-24 10:30 @architect-agent
建议将 token 过期时间从 24h 缩短到 1h，使用 refresh token 机制。

### 2026-05-24 11:00 @dev-agent
收到，已调整为 1h + refresh token。

### 2026-05-24 14:00 @qa-agent
测试用例已添加，发现边界条件问题（空密码）。
```

**关键洞察：** 任务的 Markdown 文件本身就是 agent 的「通信媒介」。不需要额外的消息系统，只需要在任务文件中添加一个「Comments」section。

---

### 2.4 趋势四：自主规划与执行（2026-2027，即将发生）

**趋势描述：**
Agent 从「被动执行人类指令」向「主动理解目标并自主规划」演进。人类只需要说「完成用户认证模块」，agent 会自动：
1. 分解为子任务（设计接口 → 实现逻辑 → 编写测试 → 部署）
2. 创建任务并分配给自己
3. 按优先级执行
4. 报告进度

**Backlog.md 现状：**
- ⚠️ Agent 可以创建任务，但不能「自主」分解目标
- ⚠️ 没有目标 → 任务的自动分解能力
- ⚠️ 没有任务依赖的自动排序能力
- ⚠️ 没有执行进度的自动追踪

**社区 Fork 中的创新：**
- `wagleanuj/kaseruka`：任务编号自动化（auto-increment IDs）
- `notorious-scrub/Backlog.md`：On Hold 状态（更灵活的状态机）
- `MensNetwork/backlog.md`：子任务层级（手动创建，非自动分解）

**战略建议：**
自主规划需要三个新能力：

**1. 目标分解引擎**
```typescript
interface GoalDecomposition {
  goal: string;  // "完成用户认证模块"
  strategy: "top-down" | "bottom-up" | "incremental";
  subtasks: Array<{
    title: string;
    description: string;
    estimatedEffort: "1h" | "2h" | "4h" | "1d" | "2d" | "1w";
    dependencies: string[];  // 依赖其他子任务的标题
    skills: string[];  // 需要的技能（用于分配给合适的 agent）
  }>;
}

// 使用方式
const decomposition = await core.decomposeGoal(
  "完成用户认证模块",
  { strategy: "top-down", context: await core.loadProjectContext() }
);
for (const subtask of decomposition.subtasks) {
  await core.createTask(subtask);
}
```

**2. 智能依赖排序**
基于任务描述自动推断依赖关系：
```typescript
// 输入
const tasks = [
  { title: "实现 JWT 签发逻辑" },
  { title: "实现 JWT 验证中间件" },
  { title: "编写登录接口" },
];

// 输出
const ordered = await core.inferDependencies(tasks);
// [
//   { title: "实现 JWT 签发逻辑", dependencies: [] },
//   { title: "实现 JWT 验证中间件", dependencies: ["TASK-001"] },
//   { title: "编写登录接口", dependencies: ["TASK-002"] },
// ]
```

**3. 执行状态机**
```
To Do → In Progress → Code Review → Testing → Done
   ↓         ↓              ↓            ↓
Blocked   On Hold        Changes      Failed
   ↓         ↓              ↓            ↓
[自动创建   [自动通知      [自动分配    [自动创建
  阻塞任务]   相关人员]     审查者]      修复任务]
```

**关键洞察：** 自主规划不是让 agent 取代人类，而是让 agent 成为「主动的项目管理助手」——它不会擅自行动，但会主动提出计划供人类批准。

---

### 2.5 趋势五：Agent 记忆与上下文管理（2025-2026，正在发生）

**趋势描述：**
Agent 的上下文窗口有限（通常 128K-1M tokens），但项目信息可能远超这个限制。Agent 需要「长期记忆」来记住项目的历史决策、技术选择、编码规范等。

**Backlog.md 现状：**
- ✅ 任务文件本身就是「短期记忆」（当前活跃任务）
- ✅ `decisions/` 目录是「中期记忆」（架构决策记录）
- ✅ `docs/` 目录是「长期记忆」（项目文档）
- ❌ 没有「记忆检索」能力（agent 不知道去哪些文件找信息）
- ❌ 没有「记忆摘要」能力（agent 无法快速了解项目全貌）

**社区 Fork 中的创新：**
- `lenucksi/Backlog.md`：归档文档、被取代决策、已完成任务侧边栏（信息组织优化）
- `principal-forks/Backlog.md`：OTEL canvas 事件（结构化项目记忆）

**战略建议：**
将 Backlog.md 打造为 agent 的「外部记忆系统」：

**1. 项目上下文快照**
```typescript
interface ProjectSnapshot {
  summary: string;  // "这是一个 Bun + React 的任务管理工具，核心逻辑在 src/core/..."
  activeTasks: Task[];  // 当前活跃的任务（按优先级排序）
  recentDecisions: Decision[];  // 最近的架构决策
  blockers: Task[];  // 被阻塞的任务及原因
  health: {
    taskCompletionRate: number;  // 近 7 天完成率
    avgTaskAge: number;  // 平均任务年龄（天）
    staleTasks: Task[];  // 超过 14 天未更新的任务
  };
}

// MCP 工具
const snapshot = await callTool("project_snapshot", { includeHealth: true });
// 返回结构化的项目摘要，agent 在每次会话开始时调用
```

**2. 语义记忆检索**
```typescript
// 不是简单的关键词搜索，而是语义搜索
const relevantDecisions = await core.searchMemory({
  query: "我们如何决定使用 Bun 而不是 Node.js？",
  sources: ["decisions", "docs", "completed-tasks"],
  limit: 5,
});
```

**3. 记忆衰减机制**
```typescript
// 旧任务的 details 会逐渐被「压缩」为摘要
// 类似于人类记忆——近期事件细节清晰，远期事件只有概要
interface TaskMemory {
  id: string;
  title: string;
  fullContent: string;  // 完整的 Markdown 内容（冷存储）
  summary: string;      // LLM 生成的摘要（热存储）
  lastAccessed: Date;   // 最近被 agent 访问的时间
  accessCount: number;  // 被访问的次数
}
```

---

## 三、战略路线图

### Phase 1: Agent 感知层（2026 Q2-Q3）

**目标：** 让 agent 能「看见」项目全貌，理解自己在项目中的位置。

**核心功能：**

| 功能 | 参考实现 | 与现有任务的关系 | 工作量 |
|------|----------|-------------------|--------|
| **项目上下文快照** | 新增 | 无现有任务 | 3-5 天 |
| **Agent 执行追踪** | 新增 | 无现有任务 | 2-3 天 |
| **Agent 身份标识** | 新增 | 无现有任务 | 1-2 天 |
| **任务评论系统** | MensNetwork（需重新设计） | 无现有任务 | 3-5 天 |
| **工作流模板** | wagleanuj（Agent Skill） | BACK-349 | 5-7 天 |

**Phase 1 验收标准：**
- [ ] Agent 每次会话开始时能获取项目快照（活跃任务、阻塞项、健康度）
- [ ] 任务文件中记录最后一次修改的 agent 身份
- [ ] 任务详情页显示操作历史（谁、什么时候、改了什么）
- [ ] 任务文件支持 Comments section（agent 间通信）
- [ ] 发布 `backlog-skill` 包（包含标准工作流模板）

---

### Phase 2: Agent 协作层（2026 Q3-Q4）

**目标：** 让多个 agent 能在同一个项目上协作，不冲突、不重复。

**核心功能：**

| 功能 | 参考实现 | 与现有任务的关系 | 工作量 |
|------|----------|-------------------|--------|
| **任务锁机制** | 新增 | 无现有任务 | 3-5 天 |
| **Agent 配置管理** | 新增 | 无现有任务 | 2-3 天 |
| **智能依赖推断** | 新增 | 无现有任务 | 5-7 天 |
| **目标分解引擎** | 新增 | 无现有任务 | 7-10 天 |
| **MCP SSE 传输** | 新增 | 无现有任务 | 3-5 天 |

**Phase 2 验收标准：**
- [ ] 多个 agent 同时工作时，任务锁防止编辑冲突
- [ ] Agent 配置文件中定义角色、权限、上级 agent
- [ ] Agent 输入高层目标后，自动分解为子任务并创建
- [ ] MCP 服务器支持 SSE 传输，远程 agent 可访问
- [ ] Agent 操作有完整的审计日志（可导出为报告）

---

### Phase 3: Agent 自主层（2026 Q4-2027 Q1）

**目标：** 让 agent 能「自主」规划和执行，人类只需审批和监督。

**核心功能：**

| 功能 | 参考实现 | 与现有任务的关系 | 工作量 |
|------|----------|-------------------|--------|
| **预测性分析** | eisbaw（统计概览） | doc-6 建议 #2 | 5-7 天 |
| **智能推荐** | 新增 | 无现有任务 | 7-10 天 |
| **记忆衰减管理** | 新增 | 无现有任务 | 5-7 天 |
| **执行状态机** | notorious-scrub（On Hold） | 无现有任务 | 3-5 天 |
| **甘特时间线** | andrewlongman07 | doc-6 建议 #1 | 5-7 天 |

**Phase 3 验收标准：**
- [ ] Agent 能预测任务完成时间（基于历史数据）
- [ ] Agent 能推荐下一步操作（基于当前上下文）
- [ ] 旧任务自动压缩为摘要，释放上下文窗口
- [ ] 任务状态变更自动触发后续操作（如「Code Review」→ 自动分配审查者）
- [ ] Web UI 显示甘特时间线，支持拖拽调整计划

---

## 四、与社区创新的融合策略

### 4.1 吸收策略

对于社区 Fork 中已经验证的功能，采用「分析 → 抽象 → 上游化」三步策略：

```
社区 Fork 功能
    ↓ 分析：提取核心逻辑，剥离定制化部分
    ↓ 抽象：提取通用模式，使其适用于所有用户
    ↓ 上游化：合并到主仓库，作为可选/可配置功能
```

| 功能 | 社区实现 | 上游化策略 |
|------|----------|------------|
| 甘特图 | andrewlongman07 | 直接上游化（零依赖，高度通用） |
| 子任务导航 | MensNetwork | 抽象后合并（去掉部门概念） |
| 统计概览 | eisbaw | 直接上游化（纯新增功能） |
| 任务类型 | jammus / erdosxx | 直接上游化（BACK-355 已规划） |
| Nix 支持 | cicero-im / eisbaw | 社区维护（非核心团队重点） |
| 收件箱 | MensNetwork | **不直接上游化**（需重新设计安全模型） |

### 4.2 协作策略

对于社区 Fork 中涌现的「实验性」功能，采用「观察 → 孵化 → 合并」策略：

1. **观察期**（1-2 个月）：监控 Fork 的活跃度和用户反馈
2. **孵化期**（2-3 个月）：在 `backlog/experiments/` 或独立分支中实现原型
3. **合并期**（1 个月）：如果原型验证成功，合并到主分支

**示例：**
- `principal-forks/Backlog.md` 的 OTEL 仪器化 → 观察期（受众窄，暂不投入）
- `lenucksi/Backlog.md` 的文档归档/删除 → 孵化期（有价值，但需评估 UI 复杂度）
- `kuwork/Backlog.md` 的本地文件预览 → 已合并（BACK-467 已完成）

---

## 五、风险与对策

### 5.1 技术风险

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| MCP 协议重大变更 | 高 | 中 | 保持 MCP SDK 版本隔离，升级时做兼容性测试 |
| Agent 幻觉导致错误任务创建 | 高 | 高 | 所有 agent 创建的任务需要人类审批（默认） |
| 多 agent 冲突导致数据丢失 | 极高 | 中 | 任务锁 + Git 版本控制作为最后防线 |
| 上下文窗口限制 | 中 | 高 | 项目快照 + 记忆衰减 + 语义检索 |

### 5.2 战略风险

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| 过度聚焦 agent 而忽视人类用户 | 高 | 中 | 所有 agent 功能都是「可选增强」，人类用户体验不降级 |
| 与专用项目管理工具竞争 | 中 | 高 | 不竞争功能广度，竞争「agent 原生」深度 |
| 社区分裂（Fork 过多） | 中 | 中 | 更快的上游化节奏，更开放的贡献流程 |

### 5.3 组织风险

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| 核心团队无法支撑路线图 | 高 | 中 | 将 Phase 2-3 功能设计为社区可贡献的模块 |
| Agent 功能测试困难 | 高 | 高 | 建立 agent 模拟测试框架（mock agent + 场景剧本） |

---

## 六、关键成功指标（KPIs）

### 6.1 Agent 采用指标

| 指标 | 当前基线 | 6 个月目标 | 12 个月目标 |
|------|----------|------------|-------------|
| MCP 连接数（周活） | ~100 | 500 | 2,000 |
| Agent 创建任务占比 | ~30% | 50% | 70% |
| Agent 自主完成任务占比 | ~5% | 20% | 40% |
| Multi-agent 项目数 | ~0 | 50 | 200 |

### 6.2 社区健康指标

| 指标 | 当前基线 | 6 个月目标 | 12 个月目标 |
|------|----------|------------|-------------|
| 活跃 Fork 数 | 168 | 200 | 300 |
| 功能上游化率 | ~10% | 25% | 40% |
| Agent Skill 下载量 | ~0 | 1,000 | 5,000 |
| 社区贡献者数 | ~15 | 30 | 50 |

### 6.3 用户体验指标

| 指标 | 当前基线 | 6 个月目标 | 12 个月目标 |
|------|----------|------------|-------------|
| 任务创建到完成时间 | ~7 天 | ~5 天 | ~3 天 |
| Agent 操作成功率 | ~85% | ~92% | ~95% |
| 用户满意度（NPS） | ~40 | ~50 | ~60 |

---

## 七、结语：从工具到基础设施

Backlog.md 的终极愿景不是成为「最好的任务管理工具」，而是成为**「AI agent 生态中不可或缺的基础设施」**——就像 Git 是代码协作的基础设施、Docker 是部署的基础设施一样。

这个转变意味着：

1. **用户不再「使用」Backlog.md，而是通过 agent「间接使用」Backlog.md**
   - 人类说："修复登录 bug"
   - Agent 说："我已经创建了 TASK-123，正在分析代码..."
   - Backlog.md 在后台默默记录一切

2. **Backlog.md 的价值不再来自功能列表，而来自「生态位」**
   - 不是功能最多的，而是 agent 最信任的
   - 不是 UI 最好看的，而是人机协作最无缝的
   - 不是性能最快的，而是上下文最完整的

3. **社区 Fork 不再是「分支」，而是「实验田」**
   - 每个 Fork 都是一个假设验证
   - 成功的假设被吸收进主干
   - 失败的假设被记录为决策（`backlog/decisions/`）

**Markdown 文件是人类和 AI 的共同语言。Backlog.md 的任务文件，就是这个共同语言的词典。**
