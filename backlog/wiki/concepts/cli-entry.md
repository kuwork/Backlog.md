---
title: CLI 入口与命令体系
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-07-14 07:14
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
| `browser` | 启动 Web UI 服务器 |
| `board` | 生成看板 |
| `mcp start` | 启动 MCP 服务器 |
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

`init` 命令引导用户选择 MCP connector、CLI commands 或 Skip。

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
- **local→UTC 转换**：核心层在 `createTask` / `updateTask` 中通过 `localDateTimeToStoredUtc` 将 CLI 本地时间统一转为 UTC 存储，确保与 Web UI 输入等价（BACK-506）

### description 转义处理

`--description` / `--desc` 值支持跨平台一致的换行输入：

- Windows 上先模拟 bash 双引号转义层（`\\` → `\`），再统一应用 C-style 转义（`\n` → 换行，`\\` → 字面反斜杠）
- 非 Windows 直接应用 C-style 转义
- 覆盖 `task create/edit`、`draft create`、`milestone create/edit` 五个入口（BACK-508）
- `--plan`、`--notes`、`--final-summary` 在 `task create/edit` 中同样应用 `processCliEscapes`，实现多行计划、备注与总结（BACK-527）

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

- [[concepts/date-fields]] — 日期字段语义与格式
- [[concepts/mcp-server]] — MCP 服务器实现
- [[concepts/web-server]] — Web Server HTTP API

## Related Sources

- [[sources/due-date-fields-task]] — BACK-401 日期字段
- [[sources/actual-start-end-fields-task]] — BACK-492 actual 字段
- [[sources/milestone-actual-dates-task]] — BACK-493 里程碑 actual 字段
- [[sources/back-506-cli-utc-conversion-fix]] — BACK-506 CLI UTC 转换修复
- [[sources/back-508-cli-description-escapes]] — BACK-508 CLI description 转义修复
- [[sources/back-527-cli-escape-sequences-for-plan-notes-summary]] — BACK-527 plan/notes/finalSummary 转义支持
