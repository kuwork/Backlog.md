---
type: report
title: Backlog.md 用户使用指引
created: 2026-05-06
lang: zh-CN
---

# Backlog.md 用户使用指引

> Markdown 原生的任务管理与看板可视化工具 | 版本：v1.40+

---

## 目录

1. [产品简介](#1-产品简介)
2. [安装与初始化](#2-安装与初始化)
3. [任务管理](#3-任务管理)
4. [看板与统计](#4-看板与统计)
5. [Web UI 界面](#5-web-ui-界面)
6. [搜索](#6-搜索)
7. [文档与决策记录](#7-文档与决策记录)
8. [里程碑管理](#8-里程碑管理)
9. [草稿工作流](#9-草稿工作流)
10. [配置管理](#10-配置管理)
11. [AI 代理集成（MCP）](#11-ai-代理集成mcp)
12. [Shell 智能补全](#12-shell-智能补全)
13. [进阶功能](#13-进阶功能)
14. [常见问题](#14-常见问题)

---

## 1. 产品简介

**Backlog.md** 将任意 Git 仓库目录转变为自包含的项目看板，所有任务以纯 Markdown 文件形式存储在仓库内，无需外部服务，100% 离线可用。

### 核心特性

- 📝 **Markdown 原生任务** — 每个任务都是独立的 `.md` 文件，可直接阅读编辑
- 🤖 **AI-Ready** — 深度支持 Claude Code、Codex、Gemini CLI、Kiro、Cursor 等 AI 助手
- 📊 **终端看板** — `backlog board` 在终端绘制实时交互式看板
- 🌐 **现代化 Web 界面** — `backlog browser` 启动浏览器内的可视化任务管理
- 🔍 **强大搜索** — 基于 Fuse.js 的模糊搜索，跨任务/文档/决策
- ✅ **Definition of Done 默认清单** — 每个新建任务自动附带项目级验收清单
- 📤 **看板导出** — 一键导出为 Markdown 表格或嵌入 README
- 🔒 **100% 私有离线** — 所有数据存放在你的仓库中
- 💻 **跨平台** — macOS、Linux、Windows

### 两种使用方式

| 方式 | 适用场景 | 说明 |
|---|---|---|
| **MCP 规范驱动**（推荐） | AI 辅助开发 | AI 代理直接调用 Backlog.md 工具管理任务 |
| **手动 CLI 模式** | 手动管理 | 用户通过终端命令直接操作 |

---

## 2. 安装与初始化

### 2.1 安装

```bash
# 推荐：Bun
bun add -g backlog.md

# 或 npm
npm i -g backlog.md

# 或 Homebrew（macOS/Linux）
brew install backlog-md

# 或 Nix
nix run github:MrLesk/Backlog.md
```

> **提示**：也可以不安装直接使用 `npx backlog.md <命令>` 或 `bunx backlog.md <命令>`。

### 2.2 初始化项目

在任意 Git 仓库目录中执行：

```bash
backlog init "我的项目"
```

初始化向导会引导你完成：
1. **项目名称** — 默认识别当前目录名
2. **Backlog 文件夹** — 选择 `backlog/`、`.backlog/` 或自定义路径
3. **配置位置** — 文件夹本地 `config.yml` 或根目录 `backlog.config.yml`
4. **AI 集成方式** — MCP 连接器（推荐）或 CLI 指令文件
5. **高级设置** — 编辑器、端口、DoD 默认值等（可选）

#### 无 Git 项目

对于非代码项目或不想使用 Git 的场景：

```bash
backlog init "个人规划" --no-git
```

这会创建一个纯文件系统项目，禁用跨分支检测、远程操作和自动提交。

#### 重新初始化

随时运行 `backlog init` 更新配置，现有配置会被保留并作为默认值预填充。

---

## 3. 任务管理

### 3.1 创建任务

```bash
# 最简创建
backlog task create "添加用户认证系统"

# 带详细信息的创建
backlog task create "添加用户认证" \
  -d "使用 OAuth 2.0 实现登录" \
  -a @sara \
  -s "To Do" \
  -l auth,backend \
  --priority high \
  --ac "必须支持 Google 登录" \
  --ac "必须支持密码登录" \
  --plan "1. 调研 OAuth 库\n2. 实现核心逻辑\n3. 编写测试" \
  --dep back-1,back-2 \
  --ref https://docs.example.com \
  --doc doc-1
```

#### 常用选项

| 选项 | 说明 | 示例 |
|---|---|---|
| `-d, --desc` | 任务描述 | `-d "详细描述"` |
| `-a, --assignee` | 负责人 | `-a @sara` |
| `-s, --status` | 状态 | `-s "In Progress"` |
| `-l, --labels` | 标签（逗号分隔） | `-l bug,frontend` |
| `--priority` | 优先级 | `--priority high` |
| `--ac` | 验收标准（可多次使用） | `--ac "必须工作"` |
| `--plan` | 实施计划 | `--plan "步骤1\n步骤2"` |
| `--notes` | 实施备注 | `--notes "调研完成"` |
| `--dep` | 依赖任务 | `--dep back-1,back-2` |
| `--ref` | 外部引用 | `--ref src/api.ts` |
| `--doc` | 关联文档 | `--doc doc-1` |
| `--dod` | DoD 项（可多次使用） | `--dod "运行测试"` |
| `--no-dod-defaults` | 不使用默认 DoD | |
| `--draft` | 创建为草稿 | |
| `-p, --parent` | 父任务（创建子任务） | `-p 14` |

#### 多行输入

**推荐方式（适用于所有 Shell，包括 AI 代理）：**

```bash
backlog task edit 7 --notes "第一行"
backlog task edit 7 --append-notes "第二行"
backlog task edit 7 --append-notes "第三行"
```

**单次命令（真实换行）：**

```bash
backlog task create "Feature" --desc "第一行
第二行

最后一段"
```

### 3.2 查看任务

```bash
# 交互式 TUI 查看（按 E 编辑）
backlog task 7

# 纯文本输出（适合 AI/脚本）
backlog task 7 --plain
```

### 3.3 编辑任务

```bash
# 修改基本字段
backlog task edit 7 -a @john -l backend --priority medium

# 添加/替换计划、备注、最终总结
backlog task edit 7 --plan "新的实施计划"
backlog task edit 7 --notes "替换现有备注"
backlog task edit 7 --append-notes "追加内容"
backlog task edit 7 --final-summary "PR 风格的完成总结"

# 管理验收标准
backlog task edit 7 --ac "新的标准"           # 添加
backlog task edit 7 --remove-ac 2            # 删除第 2 条
backlog task edit 7 --check-ac 1             # 标记完成
backlog task edit 7 --uncheck-ac 1           # 标记未完成

# 管理 DoD
backlog task edit 7 --check-dod 1
backlog task edit 7 --uncheck-dod 1
backlog task edit 7 --remove-dod 2

# 管理依赖
backlog task edit 7 --dep back-3,back-4

# 清除最终总结
backlog task edit 7 --clear-final-summary
```

### 3.4 列出任务

```bash
# 列出所有任务
backlog task list

# 按状态筛选
backlog task list -s "In Progress"

# 按负责人筛选
backlog task list -a @sara

# 按父任务列出子任务
backlog task list --parent 42

# 纯文本输出
backlog task list --plain
```

### 3.5 归档与清理

```bash
# 归档单个任务（移入 archive/，ID 可复用）
backlog task archive 7

# 降级为草稿
backlog task demote 7

# 批量清理已完成的旧任务
backlog cleanup
```

`cleanup` 命令会交互式询问清理范围（1 天到 1 年），预览后将旧 Done 任务移入 `completed/` 文件夹。

### 3.6 子任务

```bash
# 创建子任务
backlog task create -p 14 "实现登录页面"

# 子任务使用小数编号，如 back-14.1、back-14.2
```

---

## 4. 看板与统计

### 4.1 终端看板

```bash
# 启动交互式 TUI 看板
backlog board
```

**键盘操作：**
- `↑↓←→` — 移动选择
- `Enter` — 打开任务详情
- `E` — 在编辑器中打开当前任务
- `Tab` — 在看板与任务列表间切换
- `q` — 退出

### 4.2 看板导出

```bash
# 导出到默认文件 Backlog.md
backlog board export

# 导出到指定文件
backlog board export project-status.md

# 强制覆盖已有文件
backlog board export --force

# 导出到 README.md（嵌入看板标记）
backlog board export --readme

# 带版本号
backlog board export --export-version "v1.2.3"
```

### 4.3 项目统计

```bash
# 交互式统计面板
backlog overview
```

显示：
- 各状态任务数量与完成百分比
- 优先级分布（高/中/低/无）
- 近期活动（最近 7 天创建/更新的任务）
- 项目健康度（平均任务年龄、阻塞任务）

---

## 5. Web UI 界面

### 5.1 启动 Web UI

```bash
# 默认启动（端口 6420，自动打开浏览器）
backlog browser

# 自定义端口
backlog browser --port 8080

# 不自动打开浏览器
backlog browser --no-open
```

### 5.2 后台服务化

让 Web UI 作为长期运行的本地服务：

**Linux / WSL2 (systemd):**
```bash
# 创建 ~/.config/systemd/user/backlog-browser-<项目>.service
systemctl --user enable --now backlog-browser-<项目>.service
```

**macOS (launchd):**
```bash
launchctl load -w ~/Library/LaunchAgents/md.backlog.browser.<项目>.plist
```

**Windows (PowerShell):**
```powershell
$action = New-ScheduledTaskAction -Execute "backlog.exe" `
            -Argument "browser --no-open --port 6420" `
            -WorkingDirectory "C:\path\to\project"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "Backlog Browser" -Action $action -Trigger $trigger
```

> 详见 `backlog/docs/doc-003 - Running-Backlog-Browser-as-a-Service.md`

### 5.3 Web UI 功能

| 功能 | 说明 |
|---|---|
| 交互式看板 | 拖放任务到不同状态列，支持里程碑泳道 |
| 所有任务 | 表格视图，支持多维度筛选 |
| 里程碑 | 里程碑管理，未分配任务池，拖放分配 |
| 文档 | 文档列表与查看，支持子文件夹分组 |
| 决策 | 决策记录查看 |
| 设置 | 配置管理、DoD 默认值编辑、主题自定义 |
| 实时同步 | 文件系统变更自动刷新所有视图 |
| 暗黑模式 | 系统/手动切换 |
| Mermaid 图表 | 任务中的 Mermaid 语法自动渲染 |

---

## 6. 搜索

```bash
# 模糊搜索
backlog search "auth"

# 按状态筛选
backlog search "api" --status "In Progress"

# 按优先级筛选
backlog search "bug" --priority high

# 组合筛选
backlog search "web" --status "To Do" --priority medium

# 纯文本输出
backlog search "feature" --plain
```

搜索范围覆盖：任务、文档、决策记录。

---

## 7. 文档与决策记录

### 7.1 文档管理

```bash
# 创建文档
backlog doc create "API 设计指南"

# 创建到子目录
backlog doc create "部署手册" -p guides/deployment

# 更新文档
backlog doc update doc-1 --content "更新后的 Markdown 内容"
backlog doc update doc-1 --title "新标题" -t guide --tags setup,runbook -p guides

# 列出所有文档
backlog doc list

# 查看文档
backlog doc view doc-1
```

### 7.2 决策记录（ADR）

```bash
# 创建决策
backlog decision create "使用 PostgreSQL 作为主数据库"

# 带状态
backlog decision create "迁移到 TypeScript" -s proposed

# 列出决策
backlog decision list
```

决策状态：`proposed`（提议）、`accepted`（已接受）、`rejected`（已拒绝）、`deprecated`（已废弃）、`superseded`（已替代）。

---

## 8. 里程碑管理

```bash
# 列出里程碑
backlog milestone list

# 归档里程碑
backlog milestone archive "M1 - CLI"
```

在 Web UI 中：
- 创建、重命名、删除里程碑
- 将任务拖放到里程碑中
- 查看里程碑完成状态（所有任务 Done 则自动标记完成）
- 已完成的里程碑默认折叠

---

## 9. 草稿工作流

草稿是尚未正式立项的想法，使用独立的 ID 空间。

```bash
# 创建草稿
backlog draft create "调研 GraphQL"

# 或
backlog task create "初步想法" --draft

# 提升为正式任务
backlog draft promote 3.1

# 将正式任务降级为草稿
backlog task demote 7
```

---

## 10. 配置管理

### 10.1 交互式配置向导

```bash
backlog config
```

涵盖：
- 跨分支检测精度（`checkActiveBranches`、`activeBranchDays`）
- Git 工作流（`autoCommit`、`bypassGitHooks`）
- ID 格式化（`zeroPaddedIds`）
- 编辑器集成（`defaultEditor`，带可用性检查）
- DoD 默认值（交互式增删重排）
- Web UI 默认值（`defaultPort`、`autoOpenBrowser`）

### 10.2 直接读写配置

```bash
# 查看所有配置
backlog config list

# 读取单项
backlog config get defaultEditor

# 设置单项（带验证）
backlog config set defaultEditor "nvim"
```

### 10.3 配置文件示例

```yaml
project_name: "Backlog.md"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: []
definition_of_done:
  - "测试通过"
  - "文档已更新"
  - "无回归问题"
date_format: "yyyy-mm-dd hh:mm"
max_column_width: 20
default_editor: "rider"
auto_open_browser: true
default_port: 6420
remote_operations: true
auto_commit: false
zero_padded_ids: 0
check_active_branches: true
active_branch_days: 10
task_prefix: "back"
```

### 10.4 编辑器配置

优先级：
1. `EDITOR` 环境变量
2. `config.defaultEditor`
3. 平台默认（macOS/Linux: nano，Windows: notepad）

```bash
# 设置编辑器
backlog config set defaultEditor "nvim"

# 环境变量方式（推荐）
export EDITOR=nvim
```

---

## 11. AI 代理集成（MCP）

### 11.1 快速配置

运行 `backlog init` 选择 MCP 连接器，或手动配置：

**Claude Code:**
```bash
claude mcp add backlog --scope user -- backlog mcp start
```

**Codex:**
```bash
codex mcp add backlog backlog mcp start
```

**Gemini CLI:**
```bash
gemini mcp add backlog -s user backlog mcp start
```

**Kiro:**
```bash
kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
```

**手动配置（Cursor 等）:**
```json
{
  "mcpServers": {
    "backlog": {
      "command": "backlog",
      "args": ["mcp", "start"],
      "env": {
        "BACKLOG_CWD": "/absolute/path/to/project"
      }
    }
  }
}
```

### 11.2 AI 工作流建议

**Step 1 — 描述想法**
告诉 AI 代理你想构建什么，让它拆分为小任务。

**Step 2 — 一次一个任务**
每个会话处理一个任务，一个任务一个 PR。

**Step 3 — 编码前写计划**
让代理先写 Implementation Plan，你审查批准后再编码。

**Step 4 — 实施与验证**
审查代码、运行测试、检查 lint。

**不满意时**：清除 plan/notes/final summary，细化任务描述和 AC，在新会话中重试。

---

## 12. Shell 智能补全

Backlog.md 内置 bash、zsh、fish、PowerShell 的补全脚本。

### 安装

```bash
# 自动检测当前 shell 并安装
backlog completion install

# 手动指定 shell
backlog completion install --shell bash
backlog completion install --shell zsh
backlog completion install --shell fish
backlog completion install --shell pwsh
```

### 补全能力

- `backlog <TAB>` — 显示所有命令
- `backlog task edit <TAB>` — 显示实际任务 ID
- `--status <TAB>` — 显示配置中的状态值
- `--priority <TAB>` — 显示 high/medium/low
- `--labels <TAB>` — 显示现有标签

---

## 13. 进阶功能

### 13.1 序列（Sequences）

从任务依赖关系自动计算可并行执行的任务组：

```bash
# 列出序列
backlog sequence list
```

同一序列中的任务可以并行工作，依赖关系定义了执行顺序。

### 13.2 任务依赖

```bash
# 创建时添加依赖
backlog task create "Feature" --dep back-1,back-2

# 编辑时添加依赖
backlog task edit 7 --dep back-3

# 查看依赖
backlog task 7
```

自动验证：防止循环依赖，验证任务存在性。

### 13.3 自定义 ID 前缀

```bash
# 在 backlog init 时配置
# 或在 config.yml 中修改
```

支持自定义任务前缀（默认 `back`）和草稿前缀（默认 `draft`）。

### 13.4 文件系统项目（无 Git）

```bash
backlog init "项目名" --no-git
```

适用于：
- 非代码项目
- 不想使用 Git 的场景
- 快速原型

禁用：跨分支检测、远程操作、自动提交。

### 13.5 跨分支任务

Backlog.md 会自动检测远程分支中的任务。在 `backlog board` 和 `backlog task list` 中，来自其他分支的任务会显示分支来源信息。

可通过配置调整：
- `checkActiveBranches=true` — 检测活跃分支
- `activeBranchDays=30` — 多少天内的分支视为活跃
- `remoteOperations=true` — 启用远程操作

---

## 14. 常见问题

### Q: 如何修改已有任务文件？

推荐通过 CLI/Web/MCP 修改，以保持字段类型和元数据一致性。手动编辑可能导致 frontmatter 解析问题。

### Q: 归档后 ID 还能用吗？

可以。`archive/tasks/` 中的归档任务是**软删除**，其 ID 可被新任务复用。`completed/` 和 `tasks/` 中的任务 ID 仍被保留。

### Q: Web UI 修改后需要刷新吗？

不需要。Web UI 会实时监控文件系统变更并自动刷新所有视图。

### Q: 如何在 CI/CD 中使用？

使用 `--plain` 标志获取纯文本输出，便于脚本解析：

```bash
backlog task list --plain
backlog search "deploy" --plain
```

### Q: 支持哪些编辑器？

支持所有命令行编辑器：VIM、Neovim、nano、Helix 等。通过 `EDITOR` 环境变量或 `backlog config set defaultEditor` 配置。

### Q: 如何备份数据？

所有数据都在仓库的 `backlog/` 文件夹中。使用 Git 提交即可自动备份。如果启用了 `autoCommit=true`，修改会自动提交。

---

*本指引由 Backlog.md Wiki 自动生成，基于项目任务、文档与决策记录编译。*
