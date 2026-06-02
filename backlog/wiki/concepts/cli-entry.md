---
type: concept
title: CLI 入口与命令体系
updated: 2026-05-10
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
| `browser` | 启动 Web UI 服务器 |
| `board` | 生成看板 |
| `mcp start` | 启动 MCP 服务器 |
| `wiki install <agent>` | 安装 LLM wiki skill 到指定 Agent |
| `config get/set/list` | 配置管理 |
| `completion install` | Shell 补全安装 |

### 交互式 vs 非交互式

- **TTY 检测**：`process.stdout.isTTY && process.stdin.isTTY` 判断是否为交互式终端
- **自动 plain 回退**：非 TTY 时自动使用 `--plain` 模式，跳过 Clack 交互提示
- **Splash 屏幕**：裸运行（无子命令）时显示欢迎界面，检测项目是否已初始化

### 全局配置迁移

CLI 启动时（除 `init`/`--help`/`--version` 外）自动运行配置迁移：
1. 解析当前工作目录找到 backlog 项目根
2. 加载现有配置
3. 调用 `core.ensureConfigMigrated()` 执行 schema 迁移和里程碑迁移

### AI 集成模式选择

`init` 命令在交互模式下引导用户选择 AI 集成方式：
- **MCP connector**（推荐）：通过 `claude mcp add` / `codex mcp add` 等方式注册
- **CLI commands**：生成 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 等代理指令文件
- **Skip**：不配置 AI 集成

## Wiki Install 命令

`backlog wiki install <agent>` 将内置 `llm-wiki-for-backlog` skill 安装到指定 Agent 的 Skills 目录：
- 支持 `claude`、`codex`、`agents` 别名
- 使用 `.agents/skills/` 作为统一存储，Agent 目录为符号链接
- Windows 上符号链接创建失败时回退到直接复制
- `--force` 覆盖现有 skill，`--dry-run` 预览操作
