---
title: MCP 工作流
labels: [usermanual]
created_date: 2026-05-07 00:00
updated_date: '2026-10-09 23:30'
---


# MCP 工作流

Backlog.md 通过 Model Context Protocol（MCP）与 AI 编码助手深度集成。MCP 是一种标准化协议，允许 AI 代理直接调用 Backlog.md 的功能工具，无需用户手动输入 CLI 命令。借助 MCP，AI 可以像人类开发者一样阅读、创建和管理任务，实现真正的协作式项目管理。

## 什么是 MCP 集成

传统方式下，AI 助手只能通过阅读指令文件了解 Backlog.md 的 CLI 命令，然后自行执行 shell 命令。这种方式存在两个问题：

- AI 需要解析 shell 输出，容易出错
- 命令执行失败时 AI 难以准确判断原因

MCP 集成彻底改变了这一模式。AI 代理通过标准化协议直接调用 Backlog.md 的工具函数，参数和返回值均为结构化数据，可靠性大幅提升。Backlog.md 的 MCP 服务器运行在本地，通过 stdio 传输与 AI 客户端通信，不暴露任何网络端口。

## Spec-Driven 工作流

推荐采用 Spec-Driven 工作流与 AI 协作，将大需求拆分为小任务，逐步实施。整个流程分为四个步骤。

### 步骤一：描述想法

向 AI 代理描述你想构建的功能或解决的问题。AI 会协助你将想法拆分为多个小任务，每个任务包含清晰的描述和验收标准。任务要足够小，能够在单次对话中完成。

示例对话方式：

> 我想给项目添加用户认证功能，请帮我拆分成可执行的任务，每个任务都要包含验收标准。

### 步骤二：一次一个任务，一个任务一个 PR

每个代理会话只处理一个任务。这种约束带来三个好处：

- 上下文更聚焦，AI 理解更充分
- 每个任务对应一个独立的 Pull Request，便于代码审查
- 失败时只需重做单个任务，不会波及大范围代码

开始新任务前，让 AI 读取当前任务详情：

```bash
backlog task <id> --plain
```

### 步骤三：编码前写实现计划

在实施代码之前，让 AI 研究当前代码库，然后撰写实现计划（Implementation Plan），并通过 CLI 写入任务中：

```bash
backlog task edit <id> --plan "1. 研究现有代码结构
2. 设计接口
3. 实现核心逻辑
4. 添加测试"
```

实现计划确保了方案反映代码库的当前状态，避免 AI 基于过时的假设进行开发。写完计划后，建议先与团队成员确认，再开始编码。

### 步骤四：实施与验证

AI 代理按照实现计划编写代码。完成后，执行以下验证步骤：

- 审查 AI 生成的代码，确认符合项目规范
- 运行测试套件，确保没有破坏现有功能
- 执行 lint 检查，保持代码风格一致
- 逐项核对验收标准，确认全部满足
- 将任务状态更新为 Done

```bash
backlog task edit <id> --check-ac 1 --check-ac 2 --check-ac 3
backlog task edit <id> -s Done
```

## 不满意时的重启循环

如果 AI 的实施结果不符合预期，不要在同一会话中继续纠缠。正确的做法是：

1. 清除任务中的旧计划、备注和最终总结
2. 根据经验教训，细化任务描述和验收标准
3. 开启新的 AI 会话，重新运行整个流程

重启循环能避免上下文污染，让 AI 以更清晰的视角重新理解需求。

## MCP 工具能力清单

通过 MCP 连接后，AI 代理可调用 **27 个工具**，按域分类如下（必填参数以（必填）标注）。

### 任务（7 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `task_create` | 创建新任务 | `title`（必填）、`description`、`status`、`priority`、`assignee`、`labels`、`milestone`、`dependencies`、`acceptanceCriteria`、`parentTaskId`、`dueDate` / `plannedStart` / `plannedEnd` |
| `task_list` | 列出任务，多维过滤 | `status` / `statusExcluded`（单值或数组）、`assignee` / `unassigned`、`milestone`、`labels`、`search`、`ready`（仅可开工）、`completed`（含完成语料）、`offset` / `limit` |
| `task_search` | 按标题/描述搜索 | `query`、`status`、`priority`、`modifiedFiles`、`completed`、`offset` / `limit` |
| `task_view` | 查看任务详情 | `id`（必填） |
| `task_edit` | 编辑元数据、计划/备注/评论、依赖、验收标准、任务级 DoD | `id`（必填）、`status`、`planSet` / `planAppend` / `planClear`、`notesSet` / `notesAppend` / `notesClear`、`commentsAppend`、`finalSummary`、`acceptanceCriteriaCheck` / `acceptanceCriteriaUncheck`、`definitionOfDoneAdd` |
| `task_archive` | 归档任务（软删除，腾出 ID 自动清理引用） | `id`（必填） |
| `task_complete` | 完成清理：终态任务移入 completed/ | `id`（必填） |

### 文档（5 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `document_list` | 列出文档，支持子串过滤 | `search`、`offset` / `limit` |
| `document_view` | 查看文档元数据与正文 | `id`（必填） |
| `document_create` | 创建文档（可选 docs 子目录路径） | `title`、`content`（必填）、`type`、`path`、`tags` |
| `document_update` | 更新内容/标题/元数据 | `id`、`content`（必填）、`title`、`appendContent`、`type`、`path`、`tags` |
| `document_search` | 模糊搜索文档 | `query`（必填）、`offset` / `limit` |

### 里程碑（5 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `milestone_list` | 列出里程碑文件与任务上的里程碑值 | `offset` / `limit` |
| `milestone_add` | 新建里程碑 | `name`（必填）、`description`、`actualStart` / `actualEnd`、`documentation` |
| `milestone_edit` | 重命名/改日期/改描述 | `from`、`to`（必填）、`updateTasks`、`dueDate` / `plannedStart` / `plannedEnd` |
| `milestone_remove` | 移除里程碑，可选清理任务引用 | `name`（必填）、`taskHandling`（`clear` / `keep` / `reassign`）、`reassignTo` |
| `milestone_archive` | 归档里程碑 | `name`（必填） |

### 快速笔记（5 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `memo_list` | 列出备忘（最新在前） | `date`、`tags`、`offset` / `limit` |
| `memo_view` | 查看备忘全文 | `id`（必填） |
| `memo_create` | 创建备忘 | `content`（必填）、`tags` |
| `memo_update` | 替换（`content`）或追加（`append`）正文，二选一必填 | `id`（必填）、`content` / `append`、`tags` |
| `memo_delete` | 删除备忘 | `id`（必填） |

备忘工具与 CLI、Web 共享同一 ID 方案（`YYYYMMDD-N`）与文件格式，详见[快速笔记](../70-快速笔记/00-Memos简介.md)。

### 决策（2 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `decision_list` | 列出决策，支持状态/关键词过滤 | `status`（`proposed` / `accepted` / `rejected` / `superseded`）、`search`、`offset` / `limit` |
| `decision_update` | 更新决策状态或正文 | `id`（必填）、`content` / `appendContent`、`status` |

### 定义完成（2 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `definition_of_done_defaults_get` | 读取项目默认 DoD 清单 | 无参数 |
| `definition_of_done_defaults_upsert` | 整体替换项目默认 DoD 清单（新任务继承） | `items`（必填，不含逗号） |

### 工作流（1 个）

| 工具 | 能力 | 关键参数 |
|------|------|----------|
| `get_backlog_instructions` | 获取工作流指南（markdown），默认 overview；overview 末尾自动渲染当前项目的完整状态机：状态表、类别、迁移边、终态表（BACK-716） | `instruction`（`overview` / `task-creation` / `task-execution` / `task-finalization` / `milestones` / `documents` / `decisions` / `drafts` / `memos`） |

### 列表分页

所有 MCP 列表工具统一支持 `offset` + `limit` 分页（BACK-742），结构化结果通过统一信封返回：

```json
{ "items": [], "total": 128, "offset": 0, "limit": 50, "hasMore": true }
```

- `task_list`、`task_search`、`document_search`、`document_list`、`milestone_list`、`memo_list`、`decision_list` 均遵循该信封；文本输出附加 CLI 风格的 `Showing X-Y of N items` 提示
- `hasMore` / `total` 让代理能判断拿到的是否完整列表，并据此循环翻页——不再静默截断
- `task_list` 按状态桶的有序序列分页后再按桶重组渲染，桶顺序不变；`milestone_list` 的 unconfigured / archived 诊断段不参与分页，保证警告不丢失

## MCP 资源与提示

Backlog.md MCP 服务器向客户端注册以下工作流资源，AI 代理可在会话中主动读取：

| 资源 URI | 内容说明 |
|---------|---------|
| `backlog://workflow/overview` | 工作流概览：何时创建任务与基本流程；`get_backlog_instructions` 默认返回此册 |
| `backlog://workflow/task-creation` | 任务创建指南：如何搜索、界定范围、创建任务 |
| `backlog://workflow/task-execution` | 任务执行指南：如何计划、更新、推进任务 |
| `backlog://workflow/task-finalization` | 任务收尾指南：如何验证、总结、完结工作 |
| `backlog://workflow/milestones` | 里程碑指南：创建、编辑、移除、归档里程碑 |
| `backlog://workflow/documents` | 文档管理指南：创建、更新、列出、查看项目文档 |
| `backlog://workflow/decisions` | 决策指南：创建与列出决策，含输出模式与状态处理 |
| `backlog://workflow/drafts` | 草稿指南：创建、晋级、降级、归档草稿 |
| `backlog://workflow/memos` | 备忘指南：创建、列出、查看、更新、删除快速备忘 |
| `backlog://init-required` | 未初始化项目时的回退资源：如何在本目录初始化 Backlog.md |

AI 代理在首次连接或遇到不确定的场景时，会优先读取 `backlog://workflow/overview` 获取上下文指导。CLI 侧的 `backlog instructions <分册>` 与上述分册一一对应，详见[代理指令文件](02-代理指令文件.md)。

## 安全特性

Backlog.md 的 MCP 实现从设计层面保障安全性：

- **stdio-only 传输**：AI 客户端与 MCP 服务器之间仅通过标准输入输出通信，不监听任何网络端口，外部无法直接访问
- **localhost-only 运行时验证**：Web UI 等服务默认仅绑定本地地址
- **纯协议包装器**：MCP 层不包含任何业务逻辑，所有操作最终通过 Core 层统一处理，与 CLI 和 Web UI 共享同一套数据验证规则
- **roots 发现机制**：MCP 客户端发送 workspace 根目录列表，Backlog.md 自动在目录中查找有效项目。正常启动路径也会跟随客户端 workspace roots 变化（BACK-522），未找到时降级为最小功能模式，仅暴露 `init` 相关工具
- **固定项目根目录**：如需锁定到固定目录（例如全局 `~/.backlog`），使用 `--cwd` 或 `BACKLOG_CWD` 环境变量启动；此时服务器不会跟随客户端 workspace roots

## 常见问题

**Codex 无法连接 Backlog.md MCP 服务器**
- 现象：Codex 报告 MCP 服务器启动失败或超时
- 常见原因：本地 `backlog` 命令解析到了陈旧/损坏的 `dist/backlog` 二进制
- 解决：
  1. 重新构建项目（`bun run build`）
  2. 使用当前 Codex 命令格式：`codex mcp add backlog -- backlog mcp start`
  3. 单独测试 `backlog mcp start` 是否能正常启动

**共享 MCP 服务器写入错误项目**
- 现象：在用户级或共享服务器场景下，AI 创建的任务出现在错误目录
- 原因：旧版本服务器只在启动时解析一次 project root
- 解决：升级到已包含 BACK-522 的版本；如需固定目录，使用 `backlog mcp start --cwd <path>`
