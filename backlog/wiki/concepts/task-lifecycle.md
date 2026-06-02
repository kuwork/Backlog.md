---
type: concept
title: 任务生命周期
updated: 2026-05-06
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
| `dueDate` | 截止日期（可选） |

## 子任务

使用小数编号：`back-4.1`、`back-4.2`。通过 `--parent` 参数创建：`backlog task create -p 4 "子任务标题"`。
