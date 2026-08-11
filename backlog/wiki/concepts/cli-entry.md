---
title: CLI 入口与命令体系
labels: [concept]
created_date: '2026-05-10 00:00'
updated_date: '2026-08-09 00:00'
---

# CLI 入口与命令体系

`src/cli.ts` 是 Backlog.md 的 CLI 入口（~3919 行），基于 Commander.js 构建。它既是命令解析器，也是交互式向导（wizard）的编排器。

## 架构特点

### 单文件大入口

所有命令定义集中在 `cli.ts` 中，通过 `Commander.Command` 链式注册。主要命令包括：

| 命令 | 功能 |
|---|---|
| `init [projectName]` | 项目初始化，含交互式配置向导 |
| `task add [title]` | 创建任务，支持 `--plain` 非交互模式 |
| `task edit <id>` | 编辑任务 |
| `task show <id>` | 查看任务详情 |
| `task list` | 列表，支持多维过滤 |
| `task search <query>` | Fuse.js 模糊搜索 |
| `task complete <id>` | 完成任务 |
| `task archive <id>` | 归档任务 |
| `task delete <id>` | 删除任务 |
| `task reorder <id>` | 调整任务顺序 |
| `task sequences` | 查看依赖序列 |
| `draft add [title]` | 创建草稿 |
| `draft promote <id>` | 草稿提升为任务 |
| `doc add <title>` | 创建文档 |
| `decision add <title>` | 创建决策记录 |
| `milestone add <title>` | 创建里程碑 |
| `milestone edit <id>` | 编辑里程碑 |
| `milestone list` | 列出里程碑 |
| `milestone remove <id>` | 移除里程碑 |
| `milestone archive <id>` | 归档里程碑 |
| `browser` | 启动 Web UI 服务器 |
| `board` | 生成看板 |
| `mcp start` | 启动 MCP 服务器 |
| `instructions [guide]` | 查看工作流指南 |
| `wiki install <agent>` | 安装 LLM wiki skill |
| `config get/set/list` | 配置管理 |
| `overview` | 项目级统计概览 |
| `completion install` | Shell 补全安装 |

### 交互式 vs 非交互式

- **TTY 检测**：`process.stdout.isTTY && process.stdin.isTTY`
- **自动 plain 回退**：非 TTY 时自动使用 `--plain` 模式
- **Splash 屏幕**：裸运行时显示欢迎界面

### 全局配置迁移

CLI 启动时（除 `init`/`--help`/`--version` 外）自动运行配置迁移。

### AI 集成模式选择

`init` 命令引导用户选择 AI 集成方式：
- **CLI instructions**（默认推荐）：生成短 nudge 到 `AGENTS.md` 等文件，代理通过 `backlog instructions` 读取指南。
- **MCP connector**：AI 直接调用 MCP 工具。
- **Skip**：不配置 AI 集成。

## 指令指南命令

`backlog instructions` 是 CLI 优先的本地工作流指南入口（[[concepts/cli-instructions]]）：

```bash
backlog instructions                  # 列出指南
backlog instructions overview         # 工作流概览
backlog instructions task-creation    # 任务创建指南
backlog instructions task-execution   # 任务执行指南
backlog instructions task-finalization # 任务完结指南
backlog instructions milestones       # 里程碑指南
backlog instructions init-required    # 未初始化回退指南
```

裸 `backlog` 输出现在指向本地指令命令而非旧在线文档。

## 日期字段 CLI 支持

### 计划字段（Date-only）

```bash
backlog task add "API 文档" --due-date 2026-06-01 --planned-start 2026-05-25 --planned-end 2026-05-30
backlog task edit back-10 --clear-due-date --clear-planned-start
backlog milestone edit M1 --due-date 2026-06-01 --description "第一阶段"
```

### 实际字段（Date-time）

```bash
backlog task add "紧急修复" --status "In Progress" --actual-start "2026-05-29 10:00"
backlog task edit back-10 --actual-end "2026-05-30 18:00" --clear-actual-start --clear-actual-end
backlog milestone edit M1 --actual-start "2026-05-25 09:00" --clear-actual-end
```

- 实际字段格式为 `YYYY-MM-DD HH:MM`
- 交互式向导（`task-wizard.ts`）在 TTY 模式下会提示输入日期
- `task view --plain` 显示 Due / Planned / Actual 全部日期字段
- **local→UTC 转换**：核心层在 `createTask` / `updateTask` 中通过 `localDateTimeToStoredUtc` 将 CLI 本地时间统一转为 UTC 存储，确保与 Web UI 输入等价（[[sources/back-506-cli-utc-conversion-fix|BACK-506]]）

### description 与多行字段转义处理

`--description` / `--desc`、`--plan`、`--notes`、`--final-summary` 值支持跨平台一致的换行输入：

- **追加选项**：`task edit` 支持 `--append-description`/`--append-desc`，将文本追加到现有描述末尾（复用 `appendBlock`），与 `--append-notes`、`--append-final-summary` 对齐（[[sources/back-530-append-description|BACK-530]]）
- **doc update 多行与追加**：`doc update --content` 应用 `processCliEscapes`；新增可重复的 `--append-content`，追加块以空行分隔，MCP `document_update` 对应 `appendContent`（[[sources/back-529-doc-update-multiline-append|BACK-529]]）
- **避免 bash ANSI-C 引号**：指南明确警告不要用 `$'...'` 包装多行值，改用 CLI 在普通双引号内的转义处理（[[sources/back-547-avoid-bash-ansi-c-quoting|BACK-547]]）

- Windows 上先模拟 bash 双引号转义层（`\\` → `\`），再统一应用 C-style 转义（`\n` → 换行，`\\` → 字面反斜杠）
- 非 Windows 直接应用 C-style 转义
- 覆盖 `task create/edit`、`draft create`、`milestone create/edit` 五个入口（[[sources/back-508-cli-description-escapes|BACK-508]]）
- `--plan`、`--notes`、`--final-summary` 在 `task create/edit` 中同样应用 `processCliEscapes`，实现多行计划、备注与总结（[[sources/back-527-cli-escape-sequences-for-plan-notes-summary|BACK-527]]）

## 任务列表过滤

`backlog task list` 支持多维过滤：

- **多状态与排除**：`--status` 支持重复/逗号分隔多值（case-insensitive），新增 `--exclude-status`；均经 `normalizeCliStatusList` 校验（无效输入 exitCode 1）（[[sources/back-548-status-exclude-filtering|BACK-548]]）
- **未指派过滤**：`--unassigned` 单独列出没有 assignee 的任务，与 `--assignee` 互斥（冲突时报错 exit 1）（[[sources/back-551-unassigned-task-filtering|BACK-551]]）
- **默认序号排序**：task list 默认按 ordinal 排序，保留 `--sort ordinal`（[[sources/back-542-ordinal-task-list-sort|BACK-542]]）
- **数字 ID 查找**：非默认前缀下，`task edit` 移除 `normalizeTaskId` 预归一化，直接让核心层探测配置前缀（依赖 BACK-364）（[[sources/back-545-cli-task-edit-numeric-id|BACK-545]]）

## doc view plain 输出

`backlog doc view` 支持 `--plain` 直接输出原始文档内容到 stdout；stdout 非 TTY 时自动 plain（[[sources/back-552-doc-view-plain|BACK-552]]）。

## doctor 命令

`backlog doctor` 是人类优先、CLI 权威的重复任务 ID 检测与修复工具：
- 列出冲突组、确切文件路径、计划的重命名及需人工审查的引用
- `--commit` 丢弃 .bak 备份并最终化；`--rollback` 恢复 .bak 备份
- 原则：fail-closed、确定性、内容保留、原子性、不猜测引用、可回滚（[[sources/back-538-duplicate-task-id-recovery|BACK-538]]）

## config 命令

`config get/set/list` 通过共享的 `CONFIG_AVAILABLE_KEYS` 常量显示一致的可用键列表；列表键（statuses/labels）指引改为 `config get` + 编辑 config.yml，而非不存在的 `list-<key>` 命令（[[sources/back-533-config-block-yaml-lists|BACK-533]]）。

## overview 命令

```bash
backlog overview         # 交互式彩色 TUI
backlog overview --plain # 纯文本输出
```

输出维度：总任务数、完成百分比、草稿数、按状态/优先级分布、最近活动、项目健康度（临期/逾期/停滞/阻塞）。

## Wiki Install 命令

`backlog wiki install <agent>` 将内置 `llm-wiki-for-backlog` skill 安装到指定 Agent：
- 支持 `claude`、`codex`、`agents` 别名
- Windows 上符号链接失败时回退到直接复制
- `--force` 覆盖现有 skill，`--dry-run` 预览操作

## Related Concepts

- [[concepts/cli-instructions]] — CLI 指令表面
- [[concepts/date-fields]] — 日期字段语义与格式
- [[concepts/mcp-server]] — MCP 服务器实现
- [[concepts/web-server]] — Web Server HTTP API
- [[concepts/milestones]] — 里程碑管理

## Related Sources

- [[sources/back-521]] — BACK-521 CLI-first agent workflow refactor
- [[sources/back-521.1]] — BACK-521.1 Shared workflow instruction registry and CLI access
- [[sources/back-521.2]] — BACK-521.2 Short agent nudge and init default migration
- [[sources/back-521.14]] — BACK-521.14 Update CLI/MCP instruction guides with missing agent guidance
- [[sources/due-date-fields-task]] — BACK-401 日期字段
- [[sources/actual-start-end-fields-task]] — BACK-492 actual 字段
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actual 字段
- [[sources/back-506-cli-utc-conversion-fix]] — BACK-506 CLI UTC 转换修复
- [[sources/back-508-cli-description-escapes]] — BACK-508 CLI description 转义修复
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — BACK-527 plan/notes/finalSummary 转义支持
- [[sources/back-529-doc-update-multiline-append]] — BACK-529 doc update 多行与追加
- [[sources/back-530-append-description]] — BACK-530 task edit 追加描述
- [[sources/back-533-config-block-yaml-lists]] — BACK-533 config 块状 YAML 列表
- [[sources/back-538-duplicate-task-id-recovery]] — BACK-538 doctor 重复 ID 修复
- [[sources/back-542-ordinal-task-list-sort]] — BACK-542 序号排序
- [[sources/back-545-cli-task-edit-numeric-id]] — BACK-545 数字 ID 查找
- [[sources/back-547-avoid-bash-ansi-c-quoting]] — BACK-547 避免 ANSI-C 引号
- [[sources/back-548-status-exclude-filtering]] — BACK-548 状态排除过滤
- [[sources/back-551-unassigned-task-filtering]] — BACK-551 未指派过滤
- [[sources/back-552-doc-view-plain]] — BACK-552 doc view plain
