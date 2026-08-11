---
title: 里程碑管理
labels: [concept, milestones, cli, mcp]
created_date: '2026-07-14 11:20'
updated_date: '2026-07-14 11:20'
---

# 里程碑管理

里程碑按迭代、版本或发布周期对任务进行分组，以 Markdown 文件形式存储在 `backlog/milestones/` 中，与 `tasks/` 中的具体工作项相区别。

## 重要区别

给任务指定 `--milestone` 只会在任务文件中记录里程碑名称，**不会创建里程碑文件**。要创建带 ID 和元数据的里程碑，必须显式使用 `milestone add`（或 MCP `milestone_add`），然后再将任务分配给它。

## CLI 用法

```bash
# 创建里程碑
backlog milestone add "Release 2.0" -d "Ship the v2.0 release"

# 编辑里程碑
backlog milestone edit "Release 2.0" -t "Release 2.1" -d "Updated scope"
backlog milestone edit "Release 2.0" --due-date 2026-06-15
backlog milestone edit "Release 2.0" --planned-start 2026-06-01 --planned-end 2026-06-10
backlog milestone edit "Release 2.0" --clear-due-date --clear-planned-start --clear-planned-end

# 列出里程碑
backlog milestone list
backlog milestone list --show-completed
backlog milestone list --plain

# 移除里程碑并处理其任务
backlog milestone remove "Release 2.0"
backlog milestone remove "Release 2.0" --task-handling keep
backlog milestone remove "Release 2.0" --task-handling reassign --reassign-to "Release 3.0"

# 归档里程碑
backlog milestone archive "Release 2.0"

# 看板按里程碑分组
backlog board --milestones
```

## MCP 工具

- `milestone_add` — 创建里程碑，支持标题、描述、actualStart、actualEnd
- `milestone_edit` — 重命名里程碑并更新日期字段
- `milestone_remove` — 移除活动里程碑并可选清空/保留/重新分配任务
- `milestone_archive` — 归档里程碑（移动到 `backlog/archive/milestones`）
- `milestone_list` — 列出活动与已归档里程碑

## 任务分配

CLI：

```bash
backlog task create "Feature X" -m "Release 2.0"
backlog task edit 7 --milestone "Release 2.0"
backlog task edit 7 --clear-milestone
```

MCP：

```
task_create: { title: "Feature X", milestone: "Release 2.0" }
task_edit: { id: "BACK-7", milestone: "Release 2.0" }
```

`-m` / `--milestone` 支持按标题、ID（如 `m-2`）或数字别名（如 `2`）模糊匹配。

## 关键规则

- 里程碑文件位于 `backlog/milestones/`；归档后移动到 `backlog/archive/milestones/`。
- 里程碑 ID 格式为 `m-N`，创建时自动分配。
- 归档会解除任务绑定但不删除任务；任务回到未分配池。
- 优先使用 CLI 或 MCP API 而非临时文件写入，以保证 frontmatter 和元数据有效。
- 里程碑支持 `actualStart` 与 `actualEnd` 字段（datetime UTC），与任务日期字段行为一致（参见 [[concepts/date-fields]]）。

## Web 里程碑卡片任务表

Web 里程碑卡片内的任务表与 All Tasks 对齐（[[sources/back-543-milestone-cards-created-column|BACK-543]]）：
- 默认按序号（ordinal）排序，新增 Created 列（显示 createdDate）
- 表头三击循环：升序 → 降序 → 清除并恢复默认序号排序
- 里程碑卡片本身顺序保持不变

## Related Concepts

- [[concepts/date-fields]] — 日期字段语义与格式
- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/task-lifecycle]] — 任务生命周期

## Related Sources

- [[sources/back-521.7]] — BACK-521.7 Milestone CLI parity with MCP operations
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actualStart/actualEnd 支持
- [[sources/back-543-milestone-cards-created-column]] — BACK-543 里程碑 Created 列
