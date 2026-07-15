---
title: 任务生命周期
labels: [concept]
created_date: '2026-05-06 00:00'
updated_date: '2026-07-14 11:20'
---

# 任务生命周期

Backlog.md 中任务从创建到完结的完整流程。

## 状态流转

```
Draft（草稿） → To Do → In Progress → Done → Archived / Completed
```

- **Draft**：`backlog draft create` 或 `backlog task create --draft`。草稿使用独立 ID 空间（如 `draft-1`），可随时 `backlog draft promote <id>` 提升为正式任务。
- **To Do**：新建任务的默认状态。
- **In Progress**：开始工作时手动或通过 AI 代理标记。
- **Done**：完成时标记。可留在任务列表或执行 `backlog cleanup` 移入 `completed/` 文件夹。
- **Archived**：`backlog task archive <id>` 移入 `archive/tasks/`。归档任务的 ID 可被新任务复用（软删除）。

## 任务结构（Markdown 文件）

每个任务文件包含 YAML frontmatter：

```yaml
---
id: back-10
title: "任务标题"
status: "In Progress"
assignee: ["@user"]
reporter: "@user"
created_date: "2026-05-06"
updated_date: "2026-05-06"
completed_date: "2026-05-06"
labels: ["feature", "backend"]
priority: high
milestone: "M1 - CLI"
dependencies: ["back-1", "back-2"]
references: ["https://docs.example.com", "src/api.ts"]
docs: ["doc-1"]
ordinal: 1000
type: feature
dueDate: "2026-05-20"
plannedStart: "2026-05-10"
plannedEnd: "2026-05-18"
actual_start: "2026-05-10 09:00"
actual_end: "2026-05-15 18:30"
---
```

## 核心字段说明

| 字段 | 说明 |
|---|---|
| `id` | 任务唯一标识，支持自定义前缀 |
| `status` | 当前状态，必须在 `config.statuses` 列表中 |
| `assignee` | 负责人列表（@username） |
| `priority` | high / medium / low |
| `milestone` | 所属里程碑 |
| `dependencies` | 依赖的其他任务 ID |
| `ordinal` | 自定义排序权重 |
| `type` | bug / feature / enhancement / docs / refactor / test |
| `dueDate` | 截止日期（可选，date-only） |
| `plannedStart` | 计划开始日期（可选，date-only） |
| `plannedEnd` | 计划结束日期（可选，date-only） |
| `actual_start` | 实际开始时间（可选，datetime UTC） |
| `actual_end` | 实际结束时间（可选，datetime UTC） |

## 创建任务

- 创建前先搜索：使用 `backlog search`、`backlog task list` 等确认工作是否已跟踪。
- 评估范围：判断是单个原子任务还是需要子任务/依赖的多任务结构。
- 任务应写得让未来代理无需对话上下文即可执行：包含清晰标题、描述、验收标准、references/documentation、依赖。
- **创建任务时不包含 Implementation Plan**（[[sources/back-521.14|BACK-521.14]]）。计划由执行代理后续补充并经用户批准后写入任务。
- AC 应定义行为/结果，而非实现步骤；必要时包含测试与文档期望。
- DoD 默认使用项目级默认值，仅在需要时才添加任务级覆盖。

## 执行任务

- 非平凡工作编码前：阅读任务 → 标记为进行中并分配给自己 → 检查 AC/依赖/参考资料 → 草拟计划 → 向用户展示并等待批准 → 将计划写入任务。
- 在 CLI 中使用 `backlog task edit`；在 MCP 中使用 `task_edit`。
- 使用短循环工作：实现片段 → 运行测试/检查 → 追加 notes → 检查 AC → 添加评论。
- 发现超出当前 AC 的工作时，停止并询问用户是扩展当前任务还是创建后续任务。
- 每个子任务应有独立计划、notes、checked AC 与 final summary。

## 完结任务

- 验证所有 AC 已满足。
- 通过 `backlog task edit --final-summary` 或 MCP `finalSummary` 写入 PR 风格总结。
- 将任务移至配置的终态（不一定是硬编码 `Done`）；需要归档/清理时使用 `backlog task complete` 或 `backlog cleanup`。
- 完结前读取 CLI `backlog instructions task-finalization` 或 MCP `backlog://workflow/task-finalization`。

## 实际时间自动填充

- 状态变更为**进行中**且 `actualStart` 为空 → 自动设为当前日期时间
- 状态变更为**终态/Done**且 `actualEnd` 为空 → 自动设为当前日期时间
- 创建时直接指定进行中/终态也会触发（[[sources/actual-dates-auto-create-task|BACK-498]]）
- 仅字段为空时填充，尊重手动覆盖

## 子任务

使用小数编号：`back-4.1`、`back-4.2`。通过 `--parent` 参数创建：`backlog task create -p 4 "子任务标题"`。

在 Web UI 中，按 ID 排序时子任务自动归组到父任务下方（[[sources/subtask-grouping-fix|BACK-496]]）。

## 禁止直接编辑任务文件

所有任务操作必须通过 Backlog.md CLI 或 MCP 工具完成。直接编辑 markdown 会破坏元数据同步、Git 跟踪和任务关系。

## Related Concepts

- [[concepts/date-fields]] — 日期字段详细语义
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/web-ui-features]] — Web UI 任务编辑与看板

## Related Sources

- [[sources/actual-start-end-fields-task]] — BACK-492 actual 字段实现
- [[sources/actual-dates-auto-create-task]] — BACK-498 创建时自动填充
- [[sources/subtask-grouping-fix]] — BACK-496 子任务归组修复
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
