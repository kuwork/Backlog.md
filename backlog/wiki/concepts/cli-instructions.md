---
title: CLI 指令表面
labels: [concept, cli, agent-guidance]
created_date: '2026-07-14 11:20'
updated_date: '2026-07-14 11:20'
---

# CLI 指令表面

Backlog.md 通过 `backlog instructions` 命令向人类和 AI 代理暴露本地工作流指南，作为 CLI 优先的代理集成路径。该表面与 MCP 工作流资源使用同一注册表（[[sources/back-521.1|BACK-521.1]]），但输出 CLI 专用的 markdown 内容。

## 命令入口

| 命令 | 作用 |
|---|---|
| `backlog instructions` | 列出所有可用指南（纯文本索引） |
| `backlog instructions --list` | 同上 |
| `backlog instructions overview` | 工作流概览：何时创建任务、先搜索再行动 |
| `backlog instructions task-creation` | 任务创建指南：搜索、范围评估、创建、验收标准 |
| `backlog instructions task-execution` | 任务执行指南：规划、字段编辑、进度记录、范围控制 |
| `backlog instructions task-finalization` | 任务完结指南：验证、总结、收尾 |
| `backlog instructions milestones` | 里程碑管理指南 |
| `backlog instructions drafts` | 草稿工作流指南：草稿 vs 任务取舍、`draft create` 与 `task create --draft` 差异、promote/demote 后 ID 变化与继续编辑（BACK-532） |
| `backlog instructions init-required` | 未初始化目录的回退指南 |

序列命令也已通过 `backlog instructions overview` 的 Sequences Quick Reference 暴露给 AI 代理，说明 `backlog sequence list --plain` 与从依赖派生的并行序列（[[sources/back-554-document-sequences-command-in-cli-instructions|BACK-554]]）。

裸 `backlog` 命令默认输出纯文本地帮助入口，指向 `backlog instructions` 与具体命令帮助（[[sources/back-521.6|BACK-521.6]]）。

## 核心原则

- **CLI 优先**：`backlog init` 默认推荐 CLI instructions 作为 AI 集成路径；MCP 作为可选连接器保留（[[sources/back-521.2|BACK-521.2]]）。
- **使用 CLI 操作 Backlog**：不要直接编辑任务、草稿、文档、决策或里程碑的 markdown 文件。所有变更通过 `backlog` 命令完成，以保持元数据、ID、文件名、关系和历史一致。
- **先搜索再创建**：创建任务前使用 `backlog search`、`backlog task list --status ...` 等确认工作是否已跟踪。
- **先阅读再执行**：创建/执行/完结任务或管理里程碑前，先读取对应指南。

## 目录布局

- 任务：`backlog/tasks/`；草稿：`backlog/drafts/`
- 文档：`backlog/docs/`；决策：`backlog/decisions/`
- 资源：`backlog/assets/`
- 里程碑：`backlog/milestones/`
- 已完成：`backlog/completed/`；归档：`backlog/archive/`
- LLM wiki：`backlog/wiki/`（不要手动编辑）
- wiki 产物：`backlog/wiki_output/`

## 黄金法则

> 如果想修改任务中的任何内容，使用 `backlog task edit`。
> 用 CLI 读取任务；在例外情况下可以直接读取任务文件，但**永远不要写入**任务文件。

## 任务创建要点

- 创建任务时不包含 Implementation Plan；计划由执行代理后续补充并经用户批准后写入。
- 任务应包含清晰标题、结果描述、可测试的验收标准、必要的 references/documentation、依赖关系。
- 使用子任务还是独立任务：同一组件/目标用子任务；跨组件/可独立交付用依赖任务。

## 任务执行要点

- 非平凡工作编码前：阅读任务 → 标记为进行中并分配给自己 → 检查 AC/依赖/参考资料 → 草拟计划 → 向用户展示并等待批准 → 将计划写入任务。
- 使用短循环工作：实现片段 → 运行测试/检查 → 追加 notes → 检查 AC → 添加评论。
- 发现超出当前 AC 的工作时，停止并询问用户是扩展当前任务还是创建后续任务。
- 任务字段编辑速查集中在 `task-execution` 指南中（标题、状态、负责人、标签、日期、AC/DoD、plan/notes/comment/final-summary 等）。
- **避免 bash ANSI-C 引号**：不要用 `$'...'` 包装多行 CLI 字段（`--plan`、`--notes`、`--comment`、`--final-summary`、`--append-notes`、`--append-final-summary`），否则 shell 会把 `\n` 提前解析为真实换行，CLI 只取到第一行。改用 CLI 在普通双引号内的转义处理（[[sources/back-547-avoid-bash-ansi-c-quoting|BACK-547]]）。

## 任务资源（图片）

- 图片放到 `backlog/assets/`（如 `backlog/assets/images/screenshot.png`）。
- 任务中引用路径使用 `assets/<relative-path>`，不要包含 `backlog/` 目录名。
- 支持格式：png、jpg、jpeg、gif、svg、webp、avif。

## 搜索速查

```bash
backlog search "auth" --plain
backlog search "login" --type task --plain
backlog search --modified-file src/server/api.ts --plain
```

- 模糊匹配；搜索标题、描述、`modified_files`。
- AI 可读输出使用 `--plain`。

## 文档引用路径

任务的 `references` 与 `documentation` 字段应指向实际位置，而不是裸 doc ID：

```bash
backlog task create "Feature" \
  --doc "backlog/docs/doc-001 - Testing-Style-Guide.md" \
  --ref "src/server/api.ts" \
  --ref "https://github.com/org/repo/issues/123"
```

## 常见问题

| 问题 | 解决 |
|---|---|
| 找不到任务 | `backlog task list --plain` 确认 ID |
| AC 无法勾选 | `backlog task view 42 --plain` 查看 AC 编号 |
| 更改未保存 | 确认使用 CLI 而非直接编辑文件 |
| 元数据不同步 | 用 `backlog task edit 42 -s <current-status>` 重新编辑 |
| 文档引用损坏 | 使用项目根相对路径或 URL，而非裸 doc ID |

## 与 MCP 工作流的关系

CLI instructions 与 MCP workflow guides 共享 `src/mcp/workflow-guides.ts` 注册表，但内容分别存放在：

- CLI：`src/guidelines/cli-instructions/*.md`
- MCP：`src/guidelines/mcp/*.md`

MCP 客户端通过 `get_backlog_instructions` 工具或 `backlog://workflow/...` 资源读取 MCP 版本；CLI 代理通过 `backlog instructions` 读取 CLI 版本。两者内容保持语义一致，但命令/工具示例分别使用 CLI 命令或 MCP 工具字段。

## Related Concepts

- [[concepts/mcp-workflow]] — MCP 工作流与 AI 集成
- [[concepts/task-lifecycle]] — 任务生命周期
- [[concepts/cli-entry]] — CLI 入口与命令体系
- [[concepts/milestones]] — 里程碑管理

## Related Entities

- [[entities/ai-agents]] — AI 代理与集成
- [[entities/backlog-cli]] — Backlog.md CLI 工具

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.1]] — Shared workflow instruction registry and CLI access
- [[sources/back-521.2]] — Short agent nudge and init default migration
- [[sources/back-521.6]] — Root command local instruction hub
- [[sources/back-521.14]] — Update CLI/MCP instruction guides with missing agent guidance
- [[sources/back-410-cursor-agents-md-cleanup]] — Cursor AGENTS.md init cleanup
- [[sources/back-554-document-sequences-command-in-cli-instructions]] — Sequences Quick Reference
- [[sources/back-556-task-edit-append-plan]] — task edit --append-plan
- [[sources/back-558-browser-server-loopback-only]] — browser loopback binding
- [[sources/back-559-browser-launch-honor-browser-env]] — BROWSER launch
