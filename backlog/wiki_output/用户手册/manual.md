# Backlog.md 用户手册

**Markdown 原生的任务管理与看板可视化工具**

---

Backlog.md 将任意 Git 仓库目录转变为自包含的项目看板。每个任务都是独立的 Markdown 文件，100% 离线私有，无需联网即可使用。

## 核心特性

- **Markdown-native**：所有数据以 `.md` 文件存储，Git 原生友好
- **AI-Ready**：支持 Claude Code、Gemini CLI、Codex、Kiro、Cursor 等 AI 助手
- **双模式界面**：终端 TUI 看板 + 现代 Web 浏览器界面
- **富文本粘贴**：从 Word、Google Docs 一键粘贴为 Markdown，支持 `.docx` 文件上传
- **日期与计划**：任务与里程碑支持 `dueDate`、`plannedStart`、`plannedEnd`，看板卡片实时显示计划窗口与逾期高亮
- **项目健康度**：临期、逾期、停滞、阻塞四维指标，Web 统计页与 CLI `overview` 命令统一呈现
- **Wiki 知识库**：LLM 维护的增量式项目知识库，人类可读可编辑；浏览器中支持文件树导航、在线编辑、labels 标签与实时同步；内置 skill 可安装到 Claude/Codex
- **跨平台**：macOS、Linux、Windows

## 两种使用路径

1. **MCP 规范驱动（推荐）**：AI 代理通过 MCP 协议直接管理任务，无需手动输入命令
2. **手动 CLI 模式**：用户通过终端命令直接操作任务、看板与文档

## 安装

```bash
npm i -g backlog.md
```

其他安装方式：
- `bun add -g backlog.md`
- `brew install backlog-md`
- `nix run github:MrLesk/Backlog.md`

## 快速开始

```bash
# 初始化项目
backlog init my-project

# 创建任务
backlog task create "实现用户登录功能"

# 查看 TUI 看板
backlog board

# 启动 Web 界面
backlog browser
```

---

本手册涵盖从基础安装到高级 AI 集成的完整使用指南。

---

# 1 快速开始

## 1.1 产品概述

Backlog.md 是一款 Markdown 原生的任务管理与看板可视化 CLI 工具，同时作为 MCP 服务器为 AI 编码助手提供协议接口。

### 1.1.1 核心定位

| 特性 | 说明 |
|------|------|
| Markdown-native | 每个任务都是独立的 `.md` 文件，frontmatter 存储元数据，正文记录描述与验收标准 |
| AI-Ready | 支持 Claude Code、Gemini CLI、Codex、Kiro、Cursor 等 MCP/CLI 兼容的 AI 助手 |
| 100% 离线私有 | 所有数据存放在仓库本地，无需联网，无需账号 |
| 跨平台 | macOS、Linux、Windows 全平台支持 |

### 1.1.2 主要功能

#### 1.1.2.1 任务管理
- 任务 CRUD：创建、编辑、查看、归档、删除
- 子任务支持：使用小数编号（如 `back-4.1`）
- 依赖管理：任务间依赖关系与自动序列计算
- 草稿系统：独立草稿 ID 空间，随时提升为正式任务

#### 1.1.2.2 看板可视化
- **终端 TUI 看板**：`backlog board` 启动交互式终端看板
- **Web 浏览器界面**：`backlog browser` 启动 React 现代化界面，支持富文本粘贴与 Word 文档上传
- 看板导出：导出为 Markdown 表格或嵌入 README

#### 1.1.2.3 搜索
- 基于 Fuse.js 的跨任务/文档/决策模糊搜索
- CLI、TUI、Web 三端统一搜索体验
- 支持按状态、优先级、标签等多维过滤

#### 1.1.2.4 AI 集成
- **MCP 协议**：AI 代理直接调用 Backlog.md 工具
- **CLI 指令**：生成代理指令文件指导 AI 使用命令
- **Wiki Skill 安装**：`backlog wiki install` 将内置知识库 skill 部署到 Claude/Codex
- 规范驱动工作流（Spec-Driven）：描述想法 → AI 拆分任务 → 逐个实施

#### 1.1.2.5 Wiki 知识库
- **LLM 维护的增量式知识库**：AI 代理读取 tasks/docs/decisions 等源文件，自动编译为结构化 wiki；人类可读可编辑
- 浏览器中直接浏览 `backlog/wiki/` 文件树，侧边栏可折叠导航
- 在线编辑：标题、正文、labels 标签均可修改，保存自动更新 frontmatter
- 文件管理：创建文件/文件夹、重命名，空文件夹可见
- 实时同步：多标签页/WebSocket 即时同步文件变更
- AI Skill 支持：`backlog wiki install` 一键部署到 Claude/Codex

#### 1.1.2.6 任务评论
- 在任务中追加讨论与审阅记录，支持 Markdown 正文与可选作者
- CLI：`backlog task edit <id> --comment "内容" --comment-author @name`
- MCP：`task_edit` 的 `commentsAppend` 与 `commentAuthor` 字段
- Web UI：任务详情弹窗预览区只读显示评论，编辑模式下可追加新评论
- 评论文本参与搜索，可通过 `backlog search` 找到含相关评论的任务

#### 1.1.2.7 日期与计划
- 任务日期字段：可选 `dueDate`（截止日期）、`plannedStart`（计划开始）、`plannedEnd`（计划结束）
- 里程碑日期：为里程碑设置时间范围与截止点
- 看板日期指示器：TaskCard 直接显示计划日期范围与逾期高亮
- Web UI 自动填充：设置 dueDate 时自动推荐 plannedStart / plannedEnd

#### 1.1.2.8 文档与决策
- 文档管理：支持子文件夹分组
- 决策记录（ADR）：标准架构决策记录格式，支持状态流转
- 里程碑：任务分配、完成检测、归档

### 1.1.3 技术栈

- **运行时**：Bun + TypeScript 5
- **CLI**：Commander.js + Clack 交互式向导
- **TUI**：bblessed 终端界面
- **Web UI**：React + Tailwind CSS v4
- **搜索**：Fuse.js 模糊匹配
- **构建输出**：单文件可执行二进制（含嵌入式 Web 资源）

### 1.1.4 分发渠道

- npm：`backlog.md`
- Homebrew：`backlog-md`
- Nix：`nix run github:MrLesk/Backlog.md`
- GitHub Releases：平台二进制文件

## 1.2 安装与初始化

### 1.2.1 安装

#### 1.2.1.1 通过 npm（推荐）

```bash
npm i -g backlog.md
```

#### 1.2.1.2 通过 Bun

```bash
bun add -g backlog.md
```

#### 1.2.1.3 通过 Homebrew（macOS / Linux）

```bash
brew install backlog-md
```

#### 1.2.1.4 通过 Nix

```bash
nix run github:MrLesk/Backlog.md
```

#### 1.2.1.5 GitHub Releases

访问 [Releases](https://github.com/MrLesk/Backlog.md/releases) 页面下载对应平台的二进制文件。

> **Apple Silicon（M1/M2）提示**：如果你通过 Rosetta 运行 x64 版 Node 或 Bun，CLI 启动器会自动检测本机架构与 Rosetta 状态，解析到匹配的 arm64 平台包；若安装的包与 CPU 架构不匹配，会给出明确的架构信息与重装命令，避免 `illegal hardware instruction` 错误。若遇到二进制解析问题，优先用原生 arm64 运行时重新安装。

### 1.2.2 初始化项目

进入你的 Git 仓库根目录，执行：

```bash
backlog init [project-name]
```

交互式向导将引导你完成：
- 项目名称
- 默认任务状态列表
- 标签定义
- AI 集成方式选择（MCP / CLI 指令 / 跳过）

> 自定义任务 ID 前缀（`--task-prefix`）时只能使用字母，且 `doc`、`decision` 为保留名称（分别被文档与决策占用），所有入口都会拒绝（BACK-647）。

#### 1.2.2.1 无 Git 的纯文件系统项目

```bash
backlog init --no-git
```

适用于非代码项目的任务管理。

#### 1.2.2.2 在其他目录初始化（`--cwd` / `BACKLOG_CWD`）

`backlog init` 遵循与其它命令一致的目录解析规则：`--cwd <path>` 优先，其次是 `BACKLOG_CWD` 环境变量，最后回退到当前工作目录（BACK-593）。

```bash
# 2 不切换 shell 目录即初始化指定仓库
backlog init my-project --cwd /path/to/repo

# 3 在 CI 或脚本中用环境变量固定工作目录
BACKLOG_CWD=/path/to/repo backlog init my-project
```

TUI 与 Web 服务器通过统一的运行时工厂（`createRuntimeCore`）解析工作目录，因此 `BACKLOG_CWD` 对这些入口同样生效——`init` 不再只认进程的当前目录，而是与后续所有命令看到同一个目标目录。

#### 3.0.0.1 初始化后目录结构

```
backlog/
├── tasks/          # 任务文件
├── docs/           # 文档
├── decisions/      # 决策记录
├── drafts/         # 草稿
├── milestones/     # 里程碑
├── archive/        # 归档
├── completed/      # 已完成任务
├── assets/         # 附件
├── config.yml      # 项目配置
└── wiki/           # 知识库（可选）
```

### 3.0.1 验证安装

```bash
backlog --version
```

裸运行（无子命令）将显示欢迎界面并检测当前目录是否已初始化：

```bash
backlog
```

### 3.0.2 配置管理

初始化后可通过高级配置向导调整：

```bash
backlog config
```

可配置项包括：
- 任务 ID 前缀
- 默认状态列表
- Definition of Done 默认清单
- 默认编辑器
- Web UI 端口与自动打开浏览器
- Git 集成选项（自动提交、绕过 hooks 等）

## 3.1 AI 集成设置

Backlog.md 支持两种 AI 集成方式：**MCP 协议**（推荐）和 **CLI 指令文件**。

### 3.1.1 MCP 协议（推荐）

MCP（Model Context Protocol）允许 AI 代理直接调用 Backlog.md 的功能工具，无需用户手动输入 CLI 命令。

#### 3.1.1.1 Claude Code

```bash
claude mcp add backlog --scope user -- backlog mcp start
```

#### 3.1.1.2 OpenAI Codex

```bash
codex mcp add backlog -- backlog mcp start
```

> Codex 使用 `--` 作为 stdio 命令分隔符（BACK-520 更新）。

#### 3.1.1.3 Google Gemini CLI

```bash
gemini mcp add backlog -s user backlog mcp start
```

#### 3.1.1.4 Kiro

```bash
kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
```

#### 3.1.1.5 Cursor

手动配置 `mcpServers`，添加：

```json
{
  "mcpServers": {
    "backlog": {
      "command": "backlog",
      "args": ["mcp", "start"]
    }
  }
}
```

> **CLI 指令方式**：Cursor 也会读取项目根目录的 `AGENTS.md` 作为通用代理指令。运行 `backlog init` 或 `backlog agents --update-instructions` 时，Cursor 对应的指令会写入 `AGENTS.md`，不再生成单独的 `.cursorrules` 文件。

### 3.1.2 CLI 指令文件

对于不支持 MCP 的 AI 工具，Backlog.md 可生成代理指令文件，指导 AI 如何使用 `backlog` 命令。

#### 3.1.2.1 生成指令文件

在 `backlog init` 时选择 CLI 指令模式，或后续执行：

```bash
backlog agents --update-instructions
```

将生成以下文件：
- `CLAUDE.md` — Claude Code / Claude Desktop
- `AGENTS.md` — 通用代理指令（Cursor 亦读取此文件）
- `GEMINI.md` — Gemini CLI
- `.github/copilot-instructions.md` — GitHub Copilot

> 重复执行 `backlog init` 或 `backlog agents --update-instructions` 时，现有 `AGENTS.md` 内容会被保留，Backlog.md 只更新其中的标记区块。

#### 3.1.2.2 指令文件内容

包含工作流指南、任务创建规范、验收标准格式等，让 AI 了解如何：
- 创建带验收标准的任务
- 使用 `backlog` 命令管理任务生命周期
- 遵循项目规范（分支命名、提交格式等）

### 3.1.3 集成方式对比

| 方式 | 适用工具 | 优点 | 缺点 |
|------|----------|------|------|
| MCP | Claude, Codex, Gemini, Kiro, Cursor | AI 直接调用工具，更可靠、更安全 | 需要工具支持 MCP 协议 |
| CLI 指令 | GitHub Copilot, Cursor, 其他 AI | 兼容性好，无需特殊协议支持 | AI 需要解析 shell 输出，可靠性稍低 |

### 3.1.4 推荐的 AI 工作流

#### 3.1.4.1 步骤 1：描述想法
告诉 AI 代理你想构建什么，让它拆分为小任务，每个任务包含清晰的描述和验收标准。

#### 3.1.4.2 步骤 2：一次一个任务
每个代理会话只处理一个任务，一个任务一个 PR。确保任务足够小，能在单次对话中完成。

#### 3.1.4.3 步骤 3：编码前写计划
在实施前让代理研究代码库并撰写实现计划（Implementation Plan），放在任务中。

#### 3.1.4.4 步骤 4：实施与验证
让代理实施任务。完成后审查代码、运行测试、检查 lint，验证结果。

#### 3.1.4.5 不满意时的重启循环
清除计划/备注/最终总结，细化任务描述和验收标准，然后在新的会话中重新运行。

# 4 任务管理

## 4.1 任务生命周期

Backlog.md 中每个任务都是一份独立的 Markdown 文件，从想法萌芽到最终归档，经历完整的状态流转。

### 4.1.1 状态流转

任务从创建到完结的完整流程如下：

```
Draft（草稿） → To Do → In Progress → Done → Archived / Completed
```

| 状态 | 说明 |
|------|------|
| Draft | 草稿状态，使用独立 ID 空间（如 `draft-1`），不占用正式任务编号 |
| To Do | 新建任务的默认状态，等待开始 |
| In Progress | 开始工作时手动标记，或通过 AI 代理自动更新 |
| Done | 工作已完成，任务仍保留在 `backlog/tasks/` 目录中 |
| Archived | 执行 `backlog task archive` 后移入 `backlog/archive/tasks/`，属于软删除 |
| Completed | 执行 `backlog cleanup` 后，Done 任务被移入 `backlog/completed/` 目录 |

### 4.1.2 任务文件结构

每个任务文件顶部包含 YAML frontmatter，用于存储结构化元数据；正文部分记录任务描述、验收标准、实现计划等信息。

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
parentTaskId: "back-4"
---
```

### 4.1.3 核心字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `id` | 任务唯一标识，支持自定义前缀 | `back-10`、`proj-42` |
| `title` | 任务标题，单行文本 | `"实现用户登录"` |
| `status` | 当前状态，必须在项目配置的 `config.statuses` 列表中 | `"To Do"`、`"In Progress"` |
| `assignee` | 负责人列表，使用 `@username` 格式 | `["@alice", "@bob"]` |
| `reporter` | 创建人 | `"@alice"` |
| `priority` | 优先级，可选 `high`、`medium`、`low` | `high` |
| `milestone` | 所属里程碑的 ID 或标题 | `"M1 - CLI"` |
| `dependencies` | 依赖的其他任务 ID 列表 | `["back-1", "back-2"]` |
| `ordinal` | 自定义排序权重，数值越小越靠前 | `1000` |
| `type` | 任务类型，如 `bug`、`feature`、`enhancement`、`docs` | `feature` |
| `dueDate` | 截止日期（ISO 格式，date-only） | `"2026-05-20"` |
| `plannedStart` | 计划开始日期（ISO 格式，date-only） | `"2026-05-10"` |
| `plannedEnd` | 计划结束日期（ISO 格式，date-only） | `"2026-05-18"` |
| `actual_start` | 实际开始时间（UTC datetime） | `"2026-05-10 09:00"` |
| `actual_end` | 实际结束时间（UTC datetime） | `"2026-05-15 18:30"` |
| `parentTaskId` | 父任务 ID，存在时该任务为子任务 | `"back-4"` |
| `labels` | 标签列表 | `["backend", "api"]` |
| `references` | 外部引用链接或文件路径 | `["src/api.ts"]` |
| `docs` | 关联文档 ID | `["doc-5"]` |

### 4.1.4 实际时间自动填充

`actualStart` 和 `actualEnd` 用于追踪任务实际开始和完成时间，系统会在特定条件下自动填充：

- 当任务状态从其他状态变更为 **In Progress** 时，若 `actualStart` 为空，自动设置为当前日期时间
- 当任务状态变更为 **Done**（或其他终态）时，若 `actualEnd` 为空，自动设置为当前日期时间
- 创建任务时直接指定 `--status "In Progress"` 或 `--status "Done"` 也会触发自动填充
- 自动填充仅在字段为空时执行，你可以随时手动覆盖

### 4.1.5 状态变更方式

#### 4.1.5.1 通过 CLI

```bash
# 5 标记为进行中
backlog task edit <id> --status "In Progress"

# 6 标记为已完成（将状态设为终端状态，通常为 Done）
backlog task edit <id> --status "Done"

# 7 归档任务
backlog task archive <id>
```

#### 7.0.0.1 通过 TUI 看板

运行 `backlog board` 启动终端看板，选中任务卡片后使用方向键或快捷键在不同状态列之间移动。

#### 7.0.0.2 通过 Web UI

运行 `backlog browser` 启动浏览器界面，在看板视图中拖放任务卡片到目标状态列。

#### 7.0.0.3 通过 AI 代理（MCP）

AI 代理可直接调用 `update_task` 工具变更任务状态，无需人工介入。

### 7.0.1 重复任务 ID 检测与修复

正常情况下，任务 ID 在创建时即保证唯一。但跨分支合并、零填充等价（`back-1` 与 `back-01`）、外部或手动编辑仍可能产生重复的任务 ID，导致任务在视图、搜索和编辑中静默坍缩。

使用 `backlog doctor` 检测并修复重复 ID：

```bash
# 8 预览冲突（列出冲突组、文件路径、计划的重命名、需人工审查的引用）
backlog doctor

# 9 确认修复并丢弃 .bak 备份（最终化）
backlog doctor --commit

# 10 回滚修复（恢复 .bak 备份）
backlog doctor --rollback
```

修复原则：只改动任务文件名与 frontmatter 中的 `id`，保留内容；重命名与 frontmatter 同步进行（原子性）；对歧义结构 fail-closed 不猜测引用；操作可回滚（生成 `.bak` 备份），`--commit`/`--rollback` 均需人工确认后执行。

### 10.0.1 序号变更不影响 updated_date

仅调整任务序号（如看板重排、批量排序）时，任务的 `updated_date` 不会被刷新，避免产生无意义的 Git diff 噪音。只有当任务内容或元数据真正变化时，`updated_date` 才会更新。

## 10.1 创建与编辑任务

### 10.1.1 创建任务

#### 10.1.1.1 基础创建

执行以下命令，输入任务标题即可快速创建任务：

```bash
backlog task create "任务标题"
```

若当前终端支持交互式 TTY 且未提供标题，系统将自动启动创建向导，引导你填写任务详情。

#### 10.1.1.2 完整参数创建

通过命令行选项可在创建时一次性设置所有字段：

```bash
backlog task create "实现用户登录" \
  -d "支持邮箱和密码登录" \
  -a "@developer" \
  -s "To Do" \
  -l "feature" \
  --priority high \
  --ac "用户可以使用邮箱登录" \
  --ac "密码需要至少8位" \
  --plan "1. 设计数据库表 2. 实现API 3. 写测试" \
  --notes "参考现有认证模块" \
  --dep "back-1" \
  --ref "https://docs.example.com/auth" \
  --doc "doc-5"
```

#### 10.1.1.3 常用选项说明

| 选项 | 说明 | 可多次使用 |
|------|------|-----------|
| `-d, --description <text>` | 任务描述 | 否 |
| `--desc <text>` | `--description` 的别名 | 否 |
| `-a, --assignee <assignee>` | 负责人，可重复使用或以逗号分隔指定多个 | 是 |
| `--unassign` | 显式清空负责人（不回落 `defaultAssignee`，与 `-a` 互斥） | 否 |
| `-s, --status <status>` | 初始状态 | 否 |
| `-l, --labels <labels>` | 标签，逗号分隔 | 否 |
| `--priority <priority>` | 优先级：`high`、`medium`、`low` | 否 |
| `--ac <criteria>` | 追加验收标准（可多次使用） | 是 |
| `--acceptance-criteria <criteria>` | 追加验收标准，`--ac` 的别名 | 是 |
| `--dod <item>` | Definition of Done 项 | 是 |
| `--no-dod-defaults` | 禁用默认 DoD | 否 |
| `--plan <text>` | 实现计划，支持 `\n` 换行转义 | 否 |
| `--notes <text>` | 实现备注，支持 `\n` 换行转义 | 否 |
| `--final-summary <text>` | 最终总结，支持 `\n` 换行转义 | 否 |
| `--ordinal <number>` | 排序权重 | 否 |
| `-m, --milestone <milestone>` | 所属里程碑 | 否 |
| `--draft` | 创建为草稿 | 否 |
| `-p, --parent <taskId>` | 父任务 ID（创建子任务） | 否 |
| `--depends-on <taskIds>` | 依赖任务，逗号分隔 | 是 |
| `--dep <taskIds>` | `--depends-on` 的简写 | 是 |
| `--ref <reference>` | 外部引用链接或文件路径 | 是 |
| `--doc <documentation>` | 关联文档 | 是 |
| `--due-date <date>` | 截止日期（`YYYY-MM-DD`） | 否 |
| `--planned-start <date>` | 计划开始日期（`YYYY-MM-DD`） | 否 |
| `--planned-end <date>` | 计划结束日期（`YYYY-MM-DD`） | 否 |
| `--actual-start <datetime>` | 实际开始时间（`YYYY-MM-DD HH:MM`） | 否 |
| `--actual-end <datetime>` | 实际结束时间（`YYYY-MM-DD HH:MM`） | 否 |
| `--modified-file <path>` | 关联的修改文件 | 是 |
| `--plain` | 创建后输出纯文本格式 | 否 |

#### 10.1.1.4 description 中的换行

`--description` 和 `--desc` 支持跨平台一致的换行输入：

```bash
# 11 在描述中插入换行
backlog task create "标题" --desc "第一行\n第二行"

# 12 编辑时同样支持
backlog task edit back-10 --desc "修复内容：\n1. 修复 A\n2. 修复 B"
```

- Windows 上输入 `\n` 即可得到换行（CLI 内部模拟 bash 双引号转义层后统一处理）
- 如需输入字面 `\n` 而非换行，Windows 需输入 `\\\\n`，非 Windows 输入 `\\n`
- 此转义仅处理 `\n`（换行）和 `\\`（字面反斜杠），其他序列如 `\t` 原样保留
- `--plan`、`--notes`、`--final-summary` 同样支持上述跨平台换行转义（BACK-527）

> **避免 bash ANSI-C 引号**：不要用 `$'...'` 包装多行值。bash 的 `$'...'` 会在 CLI 看到参数之前就把 `\n` 解析成真实换行，导致回显命令跨行断裂、CLI 只取到第一行。请改用普通双引号内的 `\n` 转义（`--plan "第一步\n第二步"`）。此规则同样适用于 `--desc`、`--notes`、`--comment`、`--final-summary`、`--append-notes`、`--append-final-summary` 等所有多行字段。

### 12.0.1 查看任务

#### 12.0.1.1 交互式 TUI 查看

```bash
backlog task <id>
```

或显式使用 view 子命令：

```bash
backlog task view <id>
```

进入 TUI 后：
- 使用方向键或 `j`/`k` 浏览任务详情
- 按 `E` 在系统编辑器中打开任务文件（TUI 自动挂起，退出编辑器后恢复）
- 按 `Escape` 或 `q` 退出查看

#### 12.0.1.2 纯文本输出

在非交互式环境（如脚本或 AI 会话）中，使用 `--plain` 输出结构化纯文本：

```bash
backlog task <id> --plain
backlog task view <id> --plain
```

#### 12.0.1.3 稳定 JSON 输出

读取类命令支持 `--json` 输出结构化、版本化的 JSON，便于脚本解析：

```bash
backlog task list --json
backlog task view back-10 --json
backlog task back-10 --json
backlog search "api" --json
backlog doc list --json
```

输出使用统一信封 `{ schemaVersion: 1, kind: "..." }`，字段与 `--plain` 保持一致，并包含 `dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd` 等日期字段，以及验收标准进度 `acceptanceCriteriaCompleted` / `acceptanceCriteriaCount`（无验收标准的任务为 `0`/`0`）。任务列表、任务详情与搜索结果三类 JSON 使用同一套字段。`--json` 只写 stdout，错误写 stderr；与 `--plain` 互斥，同时指定会报错并返回非零。

JSON 摘要还包含以下字段：

- **`isReady`**（BACK-658）：该任务的依赖就绪判定，与 `--ready` 过滤使用同一份投影结果，两者不会互相矛盾；`task view --json` 额外给出 `readiness` 块（`isReady` / `isBlocked` / `blockingDependencies` / `missingDependencies`）
- **`references` / `modifiedFiles`**（BACK-697）：任务的引用与修改文件列表（无值时为空数组），列表、搜索与详情三类载荷一致携带
- **`source`**：默认读取为 `null`；当通过 `--completed` 扩大语料时，来自 completed 目录的行标记为 `"completed"`（BACK-662）

#### 12.0.1.4 持续监视（`--json --watch`）

`task list --json --watch` 进入监视模式（BACK-657）：监听任务目录变更，每次变化输出一份与一次性 `--json` **逐字节一致**的完整 JSON 替换帧，内容未变化时不重复输出：

```bash
# 13 配合 jq 持续观察某负责人的待办队列
backlog task list -a "@alice" -s "To Do" --json --watch | jq --unbuffered '.tasks | length'
```

- 选项、筛选、排序在每次读取时重新求值，与一次性命令不会漂移
- 通过 SIGINT / SIGTERM 或有界关闭退出；适用于脚本订阅与仪表盘管道

### 13.0.1 编辑任务

#### 13.0.1.1 基础编辑

```bash
backlog task edit <id> --title "新标题" --status "In Progress"
```

若未提供任何编辑字段，且终端支持交互式 TTY，系统将启动编辑向导。

#### 13.0.1.2 多 ID 批量编辑

`task edit` 接受多个任务 ID，用于批量应用**共享类标志**（BACK-680）：

```bash
# 14 将多个任务一次性移动到同一状态
backlog task edit back-1 back-2 back-3 -s "In Progress"

# 15 批量追加标签
backlog task edit back-1 back-2 --add-label sprint-3
```

规则：

- 可批量应用的标志：`-s/--status`、`-a/--assignee`、`-l/--label`、`--add-label`、`--remove-label`、`--priority`、`-m/--milestone`、`--clear-milestone`、`--add-doc`、`--add-ref` 等共享字段
- 逐任务字段（`--title`、`--desc`、`--plan`、`--notes`、`--comment`、`--ordinal`、AC/DoD 项、日期清除等）在多 ID 调用中会被拒绝
- 单个任务失败不中断整批，命令结束时汇总报告每个失败
- 多 ID 调用若未携带任何可批量应用的标志，会报错而不是打开编辑向导

对应地，服务端提供 `POST /api/tasks/move` 批量移动接口，Web 看板的多选拖拽即通过它一次提交（见 [看板视图](../40-Web界面/01-看板视图.md) 的多选小节）。

#### 15.0.0.1 常用编辑选项

| 选项 | 说明 | 可多次使用 |
|------|------|-----------|
| `-t, --title <title>` | 修改标题 | 否 |
| `-d, --description <text>` | 修改描述 | 否 |
| `--append-description <text>` | 追加到现有描述末尾（可重复使用） | 是 |
| `--append-desc <text>` | `--append-description` 的别名 | 是 |
| `-a, --assignee <assignee>` | 修改负责人，可重复使用或以逗号分隔指定多个 | 是 |
| `--unassign` | 显式清空负责人（与 `-a` 互斥） | 否 |
| `-s, --status <status>` | 修改状态 | 否 |
| `-l, --label <labels>` | 重置标签 | 否 |
| `--add-label <label>` | 追加标签 | 否 |
| `--remove-label <label>` | 移除标签 | 否 |
| `--priority <priority>` | 修改优先级 | 否 |
| `--ordinal <number>` | 修改排序权重 | 否 |
| `-m, --milestone <milestone>` | 修改里程碑 | 否 |
| `--clear-milestone` | 清空里程碑 | 否 |
| `--ac <criteria>` | 追加验收标准 | 是 |
| `--acceptance-criteria <criteria>` | 设置/覆盖验收标准（逗号分隔或可多次使用） | 是 |
| `--clear-ac` | 原子清空全部验收标准（与其它 AC 变更选项互斥） | 否 |
| `--remove-ac <index>` | 删除指定序号（1-based）的验收标准 | 是 |
| `--check-ac <index>` | 勾选指定序号的验收标准 | 是 |
| `--uncheck-ac <index>` | 取消勾选指定序号的验收标准 | 是 |
| `--dod <item>` | 追加 DoD 项 | 是 |
| `--remove-dod <index>` | 删除指定序号的 DoD 项 | 是 |
| `--check-dod <index>` | 勾选指定序号的 DoD 项 | 是 |
| `--uncheck-dod <index>` | 取消勾选指定序号的 DoD 项 | 是 |
| `--plan <text>` | 设置实现计划，支持 `\n` 换行转义 | 否 |
| `--append-plan <text>` | 追加到现有实现计划（可重复使用） | 是 |
| `--notes <text>` | 设置备注（覆盖现有），支持 `\n` 换行转义 | 否 |
| `--append-notes <text>` | 追加备注 | 是 |
| `--final-summary <text>` | 设置最终总结，支持 `\n` 换行转义 | 否 |
| `--append-final-summary <text>` | 追加最终总结 | 是 |
| `--clear-final-summary` | 清除最终总结 | 否 |
| `--due-date <date>` | 修改截止日期 | 否 |
| `--planned-start <date>` | 修改计划开始日期 | 否 |
| `--planned-end <date>` | 修改计划结束日期 | 否 |
| `--actual-start <datetime>` | 修改实际开始时间 | 否 |
| `--actual-end <datetime>` | 修改实际结束时间 | 否 |
| `--clear-due-date` | 清除截止日期 | 否 |
| `--clear-planned-start` | 清除计划开始日期 | 否 |
| `--clear-planned-end` | 清除计划结束日期 | 否 |
| `--clear-actual-start` | 清除实际开始时间 | 否 |
| `--clear-actual-end` | 清除实际结束时间 | 否 |
| `--depends-on <taskIds>` | 设置依赖（覆盖现有） | 是 |
| `--dep <taskIds>` | `--depends-on` 的简写 | 是 |
| `--ref <reference>` | 设置引用（覆盖现有） | 是 |
| `--doc <documentation>` | 设置关联文档（覆盖现有） | 是 |
| `--add-ref <reference>` | 追加引用（保留已有值） | 是 |
| `--remove-ref <reference>` | 按值移除引用 | 是 |
| `--clear-refs` | 清空全部引用 | 否 |
| `--add-doc <documentation>` | 追加关联文档 | 是 |
| `--remove-doc <documentation>` | 按值移除关联文档 | 是 |
| `--clear-docs` | 清空全部关联文档 | 否 |
| `--add-dep <taskIds>` | 追加依赖 | 是 |
| `--add-depends-on <taskIds>` | `--add-dep` 的别名 | 是 |
| `--remove-dep <taskIds>` | 按值移除依赖 | 是 |
| `--clear-deps` | 清空全部依赖 | 否 |
| `--remove-comment <index>` | 删除指定序号（1-based）的评论，可逗号分隔 | 是 |
| `--clear-comments` | 清空全部评论 | 否 |
| `--modified-file <path>` | 设置关联文件（覆盖现有） | 是 |
| `--plain` | 编辑后输出纯文本格式 | 否 |

#### 15.0.0.2 验收标准操作示例

```bash
# 16 添加新的验收标准
backlog task edit back-10 --ac "新的验收项"

# 17 删除第 2 条验收标准
backlog task edit back-10 --remove-ac 2

# 18 勾选第 1 条验收标准
backlog task edit back-10 --check-ac 1

# 19 取消勾选
backlog task edit back-10 --uncheck-ac 1

# 20 原子清空全部验收标准（再重新添加，即 clear-then-add 工作流）
backlog task edit back-10 --clear-ac --ac "全新的验收标准"
```

`--clear-ac` 用于一次性清空全部验收标准，且会拒绝与其它 AC 变更选项（`--ac`、`--remove-ac` 等）以外的组合冲突。AC 与 DoD 的编辑与序列化是确定性的，重复编辑不会产生冗余或错乱的清单结构。

#### 20.0.0.1 实现计划追加示例

```bash
# 21 在现有计划后追加内容
backlog task edit back-10 --append-plan "补充集成测试用例"

# 22 先替换计划，再追加多条
backlog task edit back-10 --plan "新计划" --append-plan "第一步" --append-plan "第二步"
```

每次追加会以一个空行与已有内容分隔；多个 `--append-plan` 按命令行顺序依次应用。纯空白值会被忽略。当实现计划章节不存在时，第一次非空追加会自动创建该章节。

#### 22.0.0.1 备注与总结操作示例

```bash
# 23 追加备注
backlog task edit back-10 --append-notes "新的备注内容"

# 24 设置最终总结
backlog task edit back-10 --final-summary "任务已完成，实现了..."

# 25 追加到最终总结
backlog task edit back-10 --append-final-summary "补充说明"

# 26 清除最终总结
backlog task edit back-10 --clear-final-summary
```

#### 26.0.0.1 评论操作示例

```bash
# 27 追加一条评论
backlog task edit back-10 --comment "建议将 UI 部分拆分到独立 PR"

# 28 追加评论并指定作者
backlog task edit back-10 --comment "建议将 UI 部分拆分到独立 PR" --comment-author @sara

# 29 同时追加多条评论
backlog task edit back-10 --comment "第一条评论" --comment "第二条评论"
```

评论正文支持 Markdown，但单独的 `---` 行被保留为评论分隔符，不能出现在评论正文中。评论会显示在任务详情的 **Comments** 区域，按追加顺序排列，包含序号、作者（如有）和时间戳。

评论与实现备注、最终总结的区别：

| 内容类型 | 用途 | 写入方式 |
|---------|------|---------|
| 评论 | 讨论、审阅记录、问答 | `--comment` |
| 实现备注 | 执行进度、技术探索过程 | `--notes` / `--append-notes` |
| 最终总结 | PR 式完成摘要 | `--final-summary` |

#### 29.0.0.1 列表型字段：设置 / 追加 / 移除 / 清空

`--ref`、`--doc`、`--dep` 一类列表字段支持四种语义，同一次命令中互斥（BACK-577 / BACK-578）：

| 操作 | 标志 | 语义 |
|------|------|------|
| 设置 | `--ref` / `--doc` / `--dep` / `--depends-on` | 整个列表**替换**为给定值 |
| 追加 | `--add-ref` / `--add-doc` / `--add-dep` / `--add-depends-on` | 追加到现有值之后，保留原有条目 |
| 移除 | `--remove-ref` / `--remove-doc` / `--remove-dep` | 按**值**删除指定条目 |
| 清空 | `--clear-refs` / `--clear-docs` / `--clear-deps` | 清空整个列表 |

```bash
# 30 覆盖式设置依赖
backlog task edit back-10 --dep "back-3,back-4"

# 31 追加一个依赖，已有依赖保持不变
backlog task edit back-10 --add-dep back-5

# 32 按值移除某个依赖
backlog task edit back-10 --remove-dep back-4

# 33 清空全部依赖
backlog task edit back-10 --clear-deps
```

规则：

- 设置与追加不可混用（`--ref` 与 `--add-ref` 互斥），清空也不可与同类设置/追加/移除混用；违规时**命令失败且任务文件保持不变**
- 移除标志可重复出现或逗号分隔，空值会被拒绝
- **空值设置会被拒绝**：`backlog task edit back-10 --dep ""` 报错并提示改用 `--clear-deps`（旧版本会静默无操作却退出 0，属于假成功）
- MCP `task_edit` 语义一致：数组中出现空字符串元素会被拒绝，只有显式空数组 `[]` 才表示清空

#### 33.0.0.1 引用条目的三种形态

`--ref` / `--add-ref` 的每个条目是**一个位置**，支持三种形态（BACK-651）：

| 形态 | 示例 |
|------|------|
| 外部 URL | `https://docs.example.com/auth` |
| 项目相对文件路径 | `src/utils/editor.ts` |
| 带行号的路径 | `src/utils/editor.ts:42`（单行）或 `src/utils/editor.ts:40-58`（连续区间） |

- 一个条目只承载一个位置；要引用同一份文件的两个区域，请写两个条目
- `--remove-ref` 按存储的完整字符串匹配，行号后缀也需一并给出
- Web 界面中点击带行号后缀的链接会在预览框中按指定行范围展示内容

#### 33.0.0.2 评论删除

```bash
# 34 删除第 2 条评论
backlog task edit back-10 --remove-comment 2

# 35 一次删除多条（列表编辑类标志均支持逗号分隔）
backlog task edit back-10 --remove-comment 2,3

# 36 清空全部评论
backlog task edit back-10 --clear-comments
```

`--remove-comment` 接受 1-based 序号，越界时报错并提示可用序号；`--clear-comments` 不能与 `--comment` 同时使用。删除后剩余评论**按位置重新编号**（序号本身不持久化）。CLI、MCP `task_edit`、Web UI 评论区的逐条删除按钮与「Clear comments」按钮行为一致（BACK-623）。

#### 36.0.0.1 并发编辑保护

任务的"读取—修改—写入"由文件锁保护，避免两个进程同时编辑同一任务时静默丢失其中一次修改（BACK-571）。争用时会立即失败：

```
Edit failed: back-10 is being modified by another process; retry if appropriate.
```

| 表面 | 争用时的表现 |
|------|-------------|
| CLI | 退出码非零并打印上述消息，任务文件不变 |
| Web API | HTTP 409 |
| MCP | 操作错误（`OPERATION_FAILED`） |

采用 fail-fast：**不等待、不合并、不自动重试**，失败方需自行重试。锁基于任务文件本身，跨独立的 backlog 进程生效，而不是只在单个进程内有效。锁也会覆盖草稿降级路径。

### 36.0.1 任务列表与筛选

```bash
# 37 列出所有任务
backlog task list

# 38 按状态筛选
backlog task list -s "In Progress"

# 39 多状态筛选（重复或逗号分隔）
backlog task list -s "To Do" -s "In Progress"

# 40 排除某状态
backlog task list --exclude-status "Done"

# 41 只看未指派任务（与 --assignee 互斥）
backlog task list --unassigned

# 42 按负责人筛选
backlog task list -a "@developer"

# 43 按里程碑筛选
backlog task list -m "M1 - CLI"

# 44 按优先级筛选
backlog task list --priority high

# 45 查看指定父任务的子任务
backlog task list -p back-4

# 46 按字段排序（priority 或 id）
backlog task list --sort priority

# 47 只列出依赖已就绪、可以立即开始的任务
backlog task list --ready

# 48 扩大语料：同时列出 completed 目录中的历史任务
backlog task list --completed

# 49 纯文本输出
backlog task list --plain
```

`--completed`（BACK-662）将读取范围从活跃任务扩大到 `backlog/completed/` 语料，JSON 行以 `source: "completed"` 标记；`backlog search --completed` 与 MCP `list_tasks` / `search_tasks` 的 `completed: true` 参数语义一致。注意：MCP `task_search` 现在默认只搜索活跃任务，需显式传 `completed: true` 才会包含历史任务。

纯文本列表行在任务含验收标准时附带 ` (ac: 已勾选/总数)` 后缀（BACK-659），MCP 纯文本列表同样输出；无验收标准的任务不显示该后缀。

#### 49.0.0.1 依赖就绪过滤（`--ready`）

`backlog task list --ready` 只保留**可以立即开工**的任务（BACK-615）：

- 判定采用 fail-closed：依赖中只要存在**未完成**或**无法解析**的条目，该任务即视为被阻塞
- 已完成的任务无论其状态字符串是什么，都算作"已完成证据"（以完成语料库中的位置为准）
- 依赖身份按规范化 ID 匹配（前缀与零填充差异不影响判定）
- 循环依赖与歧义依赖数据会被如实标记为阻塞，不会猜测
- 相同判定同时出现在 CLI（`--ready`，plain/json/交互式三种输出）、TUI 任务详情面板的 Readiness 行、Web 任务详情 Dependencies 卡片的状态徽章，以及 MCP `task_list` 的 `ready: true` 参数
- 该过滤只做标记与筛选，不修改任何任务，也不改变 ordinal 排序的权威性

### 49.0.1 完成任务与归档

Backlog.md 中没有专门的 `complete` 子命令，完成任务即将其状态修改为终端状态（通常为 `Done`）：

```bash
backlog task edit <id> --status "Done"
```

归档任务会将文件移入 `backlog/archive/tasks/` 目录，属于软删除，原 ID 可被后续新任务复用：

```bash
backlog task archive <id>
```

若希望将已完成的任务从活跃列表中移除，可定期执行清理命令：

```bash
backlog cleanup
```

### 49.0.2 日期字段

创建或编辑任务时，可通过以下选项管理日期字段：

```bash
# 50 计划字段（date-only）
backlog task create "API 文档" --due-date 2026-06-01 --planned-start 2026-05-25 --planned-end 2026-05-30

# 51 实际字段（datetime）
backlog task create "紧急修复" --status "In Progress" --actual-start "2026-05-29 10:00"
backlog task edit back-10 --actual-end "2026-05-30 18:00" --clear-actual-start
```

- 计划字段格式为 `YYYY-MM-DD`（date-only）
- 实际字段格式为 `YYYY-MM-DD HH:MM`（UTC datetime）
- 在交互式 TTY 环境下，创建/编辑向导会提示输入日期

#### 51.0.0.1 Web UI 中的日期编辑

在任务详情弹窗的侧边栏中：

- **Due Date** / **Planned Start** / **Planned End** — `date` 输入框
- **Actual Start** / **Actual End** — `datetime-local` 输入框（支持 UTC ↔ 本地时区转换）

**自动填充规则**：当设置 Due Date 且 Planned Start 为空时，系统会自动填充 Planned Start 为当前日期、Planned End 为 Due Date 的值。你可在保存前修改这些自动填充值。

**实际时间自动填充**：当在 Web UI 中将任务状态变更为 In Progress 或 Done 时，系统会自动填充对应的 actual 字段（若为空）。

**日期清除**：点击任意日期输入框的 Clear 按钮后，保存任务即可从文件中移除对应日期字段。清除操作通过空字符串传递，确保服务端正确接收删除指令（BACK-528）。

#### 51.0.0.2 Web UI 创建任务

在 Web UI 中点击看板或任务列表的「新建任务」按钮打开创建模态框：

- **References / Documentation**：创建模式下即可通过路径自动补全添加引用链接或关联文档；输入 `.back` 可发现 `.backlog` 目录（BACK-526）
- 保存后 references 和 documentation 会写入任务文件


### 51.0.1 降级为草稿

若发现某个任务尚需完善、暂时无法执行，可将其降级为草稿：

```bash
backlog task demote <id>
```

降级后任务将移入 `backlog/drafts/` 目录，并获得独立的草稿 ID（如 `draft-3`）。其他任务对原 ID 的引用会被自动清理（见 [归档与清理](05-归档与清理.md)）。

Web 界面的降级操作带有防误触保护（BACK-646）：降级进行中所有编辑、状态变更与快捷键都被锁定，网络错误时会明确提示"降级可能已成功"并刷新视图供你核对，避免重复提交。

### 51.0.2 标签输入（Web UI）

在 Web UI 的任务详情弹窗中编辑标签时，标签输入框支持智能自动完成：

- **下拉提示**：点击标签输入框或开始输入时，会显示项目中所有已有标签的下拉列表（包含配置标签和所有任务中的标签）
- **模糊搜索**：输入时按字符顺序模糊匹配，如输入 `we` 可匹配 `web-ui`
- **键盘选择**：使用 `↑` / `↓` 箭头高亮选项，按 `Enter` 选中；按 `Escape` 关闭下拉框
- **创建新标签**：输入内容不匹配任何现有标签时，按 `Enter` 或输入逗号 `,` 即可创建新标签
- **重复检测**：如果尝试添加与已有标签仅大小写不同的重复项（如已有 `feature` 时输入 `Feature`），输入框边框会变红提示，且下拉框显示 `feature already added`

### 51.0.3 在编辑器中打开任务

#### 51.0.3.1 TUI 中编辑

在 `backlog task <id>` 或 `backlog board` 的 TUI 界面中：
- 选中目标任务
- 按 `E`（或 `Shift+e`）直接在系统编辑器中打开任务文件
- 编辑器关闭后 TUI 自动恢复，并重新加载最新内容

#### 51.0.3.2 手动编辑

任务文件即为普通 Markdown，可直接使用任何编辑器修改：

```bash
vim backlog/tasks/back-10.md
```

手动编辑后，Backlog.md 的文件监视器会自动刷新索引，无需重启服务。

## 51.1 草稿管理

草稿是 Backlog.md 中一种轻量级的任务前形态，用于记录尚未成熟的想法、待拆分的功能点或需要进一步澄清的需求。

### 51.1.1 草稿的用途

| 场景 | 说明 |
|------|------|
| 快速记录想法 | 无需填写完整字段，先保存标题和简要描述 |
| 待评审需求 | 在正式创建任务前，通过草稿收集反馈 |
| 任务拆分准备 | 将一个复杂功能先记为草稿，再细化为多个正式任务 |
| 避免污染任务列表 | 草稿不占用正式任务 ID，也不会出现在看板的默认视图中 |

### 51.1.2 创建草稿

#### 51.1.2.1 通过 task create 创建

在创建任务时添加 `--draft` 选项，即可直接生成草稿：

```bash
backlog task create "未来可能需要的功能" --draft
```

#### 51.1.2.2 通过 draft create 创建

使用草稿专属子命令，语法更简洁：

```bash
backlog draft create "未来可能需要的功能"
```

#### 51.1.2.3 带描述的草稿

```bash
backlog draft create "重构认证模块" \
  -d "考虑将 Session 认证迁移到 JWT" \
  -l "refactor" \
  -a "@architect"
```

`draft create` 支持的选项包括：

| 选项 | 说明 |
|------|------|
| `-d, --description <text>` | 描述 |
| `--desc <text>` | `--description` 的别名 |
| `-a, --assignee <assignee>` | 负责人 |
| `-s, --status <status>` | 状态（默认 Draft） |
| `-l, --labels <labels>` | 标签，逗号分隔 |
| `--due-date <date>` | 截止日期（`YYYY-MM-DD`） |
| `--planned-start / --planned-end <date>` | 计划起止日期 |
| `--actual-start / --actual-end <datetime>` | 实际起止时间（UTC 存储） |

> 草稿与任务共用同一套创建期日期选项（BACK-693）。

### 51.1.3 编辑草稿

使用 `draft edit` 直接修改草稿字段，选项与 `task edit` 完全一致（BACK-683）：

```bash
backlog draft edit draft-3 --title "更清晰的标题" -l "refactor,backend"
backlog draft edit draft-3 --append-notes "补充调研结论"
```

规则：

- 只接受单个草稿 ID，不支持批量编辑
- 至少需要一个字段标志，否则报错
- `--status` 只接受 `Draft`；要变成正式任务请使用 `backlog draft promote`——脚本中不会被一次"编辑"悄悄提升
- 加 `--plain` 输出编辑后的完整记录

#### 51.1.3.1 草稿 ID 的歧义保护

草稿身份解析是 **fail-closed** 的（BACK-642）：当同一 ID 命中多个草稿文件（如编号漂移造成的 `draft-3` 与 `draft-03` 并存）时，`draft view` / `draft edit` / `draft archive` / `draft promote` 都会列出全部候选并以非零退出，不会任选一个执行。`backlog doctor` 会报告这类草稿身份问题（重复编号、frontmatter 漂移、无法解析的文件）。

### 51.1.4 查看草稿列表

```bash
backlog draft list
```

默认按优先级排序。可选参数：

| 选项 | 说明 |
|------|------|
| `--sort <field>` | 按 `priority` 或 `id` 排序 |
| `--plain` | 纯文本输出 |

### 51.1.5 草稿提升为任务

当草稿内容已经足够清晰，可以开始执行时，将其提升为正式任务：

```bash
backlog draft promote draft-3
```

提升后：
- 草稿文件从 `backlog/drafts/` 移入 `backlog/tasks/`
- 草稿 ID（如 `draft-3`）被替换为正式任务 ID（如 `back-15`）
- 原草稿文件被归档或删除

### 51.1.6 任务降级为草稿

若某个正式任务发现条件不成熟、需要暂缓执行，可将其降级回草稿：

```bash
backlog task demote back-10
```

降级后：
- 任务文件从 `backlog/tasks/` 移入 `backlog/drafts/`
- 原正式任务 ID 被释放，可被新任务复用
- 获得新的草稿 ID（如 `draft-5`）

### 51.1.7 Web UI 草稿页面

浏览器访问 `/drafts` 可查看草稿列表并进行筛选管理。

#### 51.1.7.1 筛选栏

页面顶部提供与任务列表一致的筛选栏：

| 控件 | 说明 |
|------|------|
| 关键字搜索 | 按草稿 ID 或标题搜索，子串匹配，支持清除按钮 |
| 状态筛选 | 下拉选择所有可用状态 |
| 优先级筛选 | 全部 / 高 / 中 / 低 |
| 里程碑筛选 | 全部里程碑 / 无里程碑 / 各个活跃里程碑 |
| 标签筛选 | 多选 chip 输入，带自动补全 |

筛选结果实时显示计数 `显示 X / Y 个草稿`。有活跃筛选时，右侧出现「清除筛选」按钮一键重置。

#### 51.1.7.2 筛选状态持久化

所有筛选条件（包括搜索词）自动同步到 URL 查询参数，页面可分享和收藏。支持的参数：

- `?status=` — 状态过滤
- `?priority=` — 优先级过滤
- `?milestone=` — 里程碑过滤（`__none` 表示无里程碑）
- `?label=` — 标签过滤（可多次出现）
- `?q=` — 关键字搜索

#### 51.1.7.3 草稿卡片与操作

每个草稿显示标题、优先级徽标、ID、创建/更新时间、负责人和标签。点击卡片可编辑草稿详情，右侧「提升为任务」按钮可将草稿提升为正式任务。

### 51.1.8 归档草稿

对于不再需要的草稿，可以直接归档：

```bash
backlog draft archive draft-2
```

归档后草稿移入 `backlog/archive/tasks/` 目录。

### 51.1.9 草稿使用独立 ID 空间

草稿与正式任务使用完全独立的编号体系：

- 正式任务 ID：`back-1`、`back-2`、`back-3`……
- 草稿 ID：`draft-1`、`draft-2`、`draft-3`……

这意味着：
- 草稿的数量不会影响正式任务的 ID 序列
- 草稿提升时会分配下一个可用的正式任务 ID
- 正式任务降级时会分配下一个可用的草稿 ID
- 删除或归档草稿后，其 ID 不会导致正式任务编号的断层

## 51.2 子任务与依赖

Backlog.md 支持通过子任务拆分复杂工作，以及通过依赖关系定义任务间的执行顺序。

### 51.2.1 子任务创建

在创建任务时，使用 `--parent`（或 `-p`）指定父任务 ID，即可创建子任务：

```bash
backlog task create "设计数据库表" -p back-4
backlog task create "实现 REST API" -p back-4
backlog task create "编写单元测试" -p back-4
```

### 51.2.2 小数编号规则

子任务使用小数编号体系，格式为 `父任务ID.序号`：

| 父任务 | 子任务 |
|--------|--------|
| `back-4` | `back-4.1`、`back-4.2`、`back-4.3` |

编号规则：
- 子任务序号按创建顺序自动递增
- 一个父任务可以拥有任意数量的子任务
- 子任务本身不能再拥有子任务（单层结构）
- 子任务在列表、看板、Web UI 中默认与父任务关联展示

### 51.2.3 查看子任务

```bash
# 52 查看指定父任务的所有子任务
backlog task list -p back-4

# 53 查看任务详情时，子任务会自动列出
backlog task view back-4
```

### 53.0.1 依赖任务设置

创建任务时，使用 `--dep`（或 `--depends-on`）指定依赖的其他任务：

```bash
backlog task create "部署到生产环境" \
  --dep "back-5,back-6" \
  --notes "需等前端和后端任务都完成后才能部署"
```

也可在任务创建后追加或修改依赖：

```bash
# 54 覆盖设置依赖
backlog task edit back-10 --dep "back-3,back-4"

# 55 依赖多个任务时可多次使用选项
backlog task edit back-10 --dep "back-3" --dep "back-4"
```

#### 55.0.0.1 依赖目标的解析规则

依赖目标在工作副本任务与 **completed 语料**中解析（BACK-664/707）：

- 依赖一个已完成任务是合法的——完成记录正是就绪判定读取的"完成证据"
- 归档任务的 ID 会被新任务复用，因此归档记录**不参与**依赖解析；只存在于归档中的 ID 视同未知 ID
- 一个 ID 被多条记录同时声称，或一次输入命中多个身份时，命令以歧义错误失败（fail-closed），不会任选一个
- **草稿不能作为依赖目标**（草稿可以依赖任务，但任务不能依赖草稿）

#### 55.0.0.2 写入门禁：自依赖与循环拒绝

创建和编辑依赖时，系统执行硬校验（BACK-707）：

- 依赖**自身**（`--dep back-10` 写在 back-10 上）被拒绝
- 会形成**循环**的依赖被拒绝，错误信息中给出完整链路（如 `TASK-1 -> TASK-2 -> TASK-1`）
- 无法解析的新依赖条目被拒绝（创建时一律严格）

对**存量缺陷**的软化规则：编辑任务时，记录中原本就存在且本次未改动的无法解析条目会被原样保留（CLI 打印警告，JSON/MCP 结果中以数据形式携带），不会因顺手改标题就被迫清理历史债；一旦重写该条目则按新规则校验。

#### 55.0.0.3 依赖缺陷诊断（doctor）

`backlog doctor` 新增依赖缺陷报告（BACK-708），按类别分节列出整个语料的问题：

- **循环依赖**（含自环），按 ID 顺序列出
- **悬空依赖**：引用了不存在 ID 的任务逐条列出
- **草稿目标**：任务依赖了草稿（被禁止的方向）
- **已释放 ID**：依赖指向已归档、编号可被复用的旧 ID，附带可能重新绑定的警告
- **歧义引用**：与重复 ID 报告交叉引用

该报告是**纯诊断**：只报告、不修复（`--fix` 仍只修复重复 ID）；依赖缺陷不影响退出码——语料中长期存在的历史问题不应让每次诊断都失败。

### 55.0.1 依赖关系对序列的影响

Backlog.md 会根据任务间的依赖关系自动计算**执行序列**（Sequences）：

- 无依赖、无被依赖、无 ordinal 的任务归类为 **Unsequenced**（未排序）
- 有依赖关系的任务按拓扑排序分层，形成 **Sequence 1、Sequence 2……**
- 同一 Sequence 中的任务互不依赖，可以并行执行
- 不同 Sequence 之间存在先后关系，Sequence N 的所有任务必须在 Sequence N-1 完成后才能开始

#### 55.0.1.1 查看序列

```bash
backlog sequence list
```

输出示例：

```
Unsequenced:
  back-8 - 优化构建速度

Sequence 1:
  back-1 - 设计数据库表
  back-2 - 搭建项目骨架

Sequence 2:
  back-3 - 实现用户注册 API
  back-4 - 实现用户登录 API

Sequence 3:
  back-5 - 部署到测试环境
```

在上述示例中：
- `back-1` 和 `back-2` 可以并行开发
- `back-3` 和 `back-4` 依赖于 `back-1` 和 `back-2`，需等它们完成后才能开始
- `back-3` 和 `back-4` 之间可以并行
- `back-5` 依赖于 `back-3` 和 `back-4`，必须在最后执行

### 55.0.2 Web UI 依赖项钻取

在 Web 界面的任务详情面板中，**Dependencies** 区域会列出该任务的所有依赖任务。每个依赖任务以蓝色标签形式展示：

- **点击依赖任务标签**：直接打开该依赖任务的详情面板，无需返回看板或列表重新查找
- **返回按钮**：当通过点击依赖进入子任务后，任务详情面板标题栏左侧会出现 **← 返回** 箭头按钮，点击即可回到上一层父任务
- **关闭按钮**：点击右上角的 **×** 与浏览器后退等价，**每次退一层**——已钻取时先回到上一层父任务，回到最外层后再点一次即关闭整个模态框

> 此功能在新建任务或编辑任务模式下不可用，仅在预览（preview）模式下生效。

#### 55.0.2.1 模态框中的父子层级区块

任务详情模态框在标题下方提供层级区块，便于在模态框内直接上下浏览：

- **PARENT 行**：当前任务有父任务时显示，包含父任务 ID、标题与状态标签，点击即打开父任务
- **SUBTASKS 区**：当前任务有子任务时显示完成计数（如 `1/6`）与进度条，点击区块标题行展开或折叠；每条子任务显示完成指示、ID、标题、状态标签与钻取箭头，点击即打开该子任务

两个区块都只在相应关系存在时渲染；没有父子关系的任务不会出现该区块。

#### 55.0.2.2 通过 Markdown 链接钻取

在任务描述、文档、决策记录和 Wiki 页面中，如果包含指向其他任务的 `/task/:id` 链接（如 `http://localhost:6420/task/506`），点击后也会在模态框中直接打开目标任务，体验与点击依赖标签一致：

- 支持前缀无关匹配：`/task/506` 和 `/task/BACK-506` 都能正确解析
- 系统会将完整 URL 自动渲染为短别名 `TASK#506`，提升可读性
- 钻取后同样支持返回按钮和浏览器前进/后退导航

#### 55.0.2.3 稳定 URL 与分享

每个任务都有独立的 `/task/:id/:title` URL：

```
http://localhost:6420/task/506/Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion
```

你可以直接复制地址栏链接分享给团队成员，对方打开后会以默认视图为背景显示该任务详情，并能继续钻取其依赖关系。

#### 55.0.2.4 依赖规划建议

| 建议 | 说明 |
|------|------|
| 控制依赖数量 | 过多的依赖会降低灵活性，尽量只保留真正的阻塞关系 |
| 子任务与依赖并用 | 用子任务拆分工作范围，用依赖定义执行顺序 |
| 定期检查序列 | 执行 `backlog sequence list` 识别关键路径和可并行的工作包 |
| 避免循环依赖 | 系统会自动检测循环依赖并阻止创建 |

## 55.1 搜索与序列

### 55.1.1 搜索

Backlog.md 基于 Fuse.js 提供统一的模糊搜索服务，覆盖任务、文档和决策记录。

#### 55.1.1.1 CLI 搜索

执行 `backlog search` 并在后面输入关键词，即可在所有项目中搜索：

```bash
backlog search "用户登录"
```

##### 55.1.1.1.1 过滤条件

| 选项 | 说明 | 示例 |
|------|------|------|
| `--type <type>` | 限制结果类型（`task`、`document`、`decision`） | `--type task` |
| `--status <status>` | 按任务状态过滤（可重复或逗号分隔多选） | `--status "In Progress"` |
| `--exclude-status <status>` | 排除指定状态的任务 | `--exclude-status "Done"` |
| `--unassigned` | 只显示没有负责人的任务 | `--unassigned` |
| `--priority <priority>` | 按优先级过滤（`high`、`medium`、`low`） | `--priority high` |
| `--modified-file <path>` | 按修改文件路径子串过滤 | `--modified-file src/api.ts` |
| `--completed` | 搜索范围扩大到 completed 语料中的历史任务 | `--completed` |
| `--limit <number>` | 限制返回结果总数 | `--limit 10` |
| `--plain` | 纯文本输出 | `--plain` |

##### 55.1.1.1.2 组合搜索示例

```bash
# 56 搜索包含 "api" 且状态为 In Progress 的任务
backlog search "api" --status "In Progress"

# 57 搜索高优先级的 bug
backlog search "bug" --priority high --type task

# 58 搜索关联了某个文件的改动
backlog search "auth" --modified-file src/auth.ts

# 59 仅搜索文档和决策
backlog search "架构" --type document --type decision

# 60 排除已完成任务
backlog search "api" --exclude-status "Done"

# 61 只搜索未指派的高优先级任务
backlog search "api" --unassigned --priority high
```

#### 61.0.0.1 TUI 搜索

在 `backlog board` 或 `backlog task list` 的交互式界面中，输入搜索关键词即可实时过滤列表。TUI 搜索为即时响应模式，无需按 Enter，输入即更新结果。

#### 61.0.0.2 Web 搜索

运行 `backlog browser` 启动 Web 界面后，按 **Ctrl+K**（Windows/Linux）或 **Cmd+K**（macOS），或点击侧边栏的搜索触发按钮，即可打开全局搜索对话框，一次检索任务、文档、决策与 Wiki 页面。结果按类型分组，关键词与资源 ID 高亮、支持键盘操作与滚动位置记忆；查询与类型过滤同步到 `/search?q=...&type=...` 链接，可刷新或分享。详见[全局搜索](../40-Web界面/10-全局搜索.md)。

#### 61.0.0.3 搜索分数阈值对齐

CLI、TUI、MCP 与 Web UI 使用统一的 Fuse.js 分数阈值 `0.45`，过滤掉相关性过低的结果。这避免了用短数字（如 `63`）搜索时误匹配到无关任务 ID（如 `BACK-410`），同时保持文本查询的 Fuse 语义不变。

### 61.0.1 序列

#### 61.0.1.1 序列概念与用途

**序列**（Sequences）是从任务依赖关系自动计算出的可并行执行的任务组。它帮助你在不手动排期的情况下，直观了解：

- **关键路径**：哪些任务必须在其他任务之前完成
- **可并行工作包**：同一序列内的任务可以由不同成员同时推进
- **项目瓶颈**：依赖链最长的路径往往决定整体工期

#### 61.0.1.2 查看序列

```bash
backlog sequence list
```

默认以交互式 TUI 展示序列视图。按 `--plain` 输出纯文本：

```bash
backlog sequence list --plain
```

#### 61.0.1.3 序列输出解读

```
Unsequenced:
  back-12 - 优化首页加载速度

Sequence 1:
  back-1 - 设计数据库表
  back-2 - 搭建项目骨架

Sequence 2:
  back-3 - 实现用户注册 API
  back-4 - 实现用户登录 API

Sequence 3:
  back-5 - 部署到测试环境
```

- **Unsequenced**：没有依赖关系、也没有被其他任务依赖、且未设置 ordinal 的任务。它们不阻塞任何任务，也不被任何任务阻塞
- **Sequence N**：第 N 层可并行任务组。Sequence 1 没有前置依赖，Sequence 2 依赖于 Sequence 1 中的某些任务，以此类推
- 已标记为 `Done` 的任务不会出现在序列中

#### 61.0.1.4 TUI 序列视图操作

在 `backlog sequence list` 的交互式界面中：
- 使用方向键或 `j`/`k` 浏览任务
- 按 `Enter` 查看任务详情
- 按 `m` 进入移动模式，可调整任务顺序并自动更新依赖关系
- 按 `Escape` 或 `q` 退出

#### 61.0.1.5 Web UI 序列页面

在浏览器界面中，序列页面支持拖拽重新排序。拖放任务卡片到不同序列位置时，系统会自动更新相关的依赖关系。

#### 61.0.1.6 在 CLI 指令中查看序列速查

`backlog instructions overview` 的 Quick Reference 中包含了序列命令速查：

```bash
backlog sequence list --plain
```

该命令输出纯文本序列分层。序列由任务依赖关系派生而来，同一序列内的任务可以并行推进，不同序列之间存在先后依赖。更多序列操作参见本章「查看序列」与「TUI 序列视图操作」两节。

#### 61.0.1.7 序列对项目规划的意义

| 应用场景 | 操作 |
|----------|------|
| 规划 Sprint | 根据序列分层将任务分配到不同迭代周期 |
| 识别风险 | 关键路径上的任务延期将直接影响整体进度 |
| 资源分配 | 将同一序列中的任务分配给不同开发者并行推进 |
| 依赖审查 | 定期运行 `backlog sequence list` 检查是否存在不合理的强依赖 |

## 61.1 归档与清理

随着项目推进，已完成的任务会不断累积。Backlog.md 提供归档和清理机制，帮助你保持任务列表的整洁。

### 61.1.1 归档任务

归档是将不再活跃的任务移入 `backlog/archive/tasks/` 目录的操作，属于软删除：

```bash
backlog task archive back-10
```

归档后：
- 任务文件从 `backlog/tasks/` 移入 `backlog/archive/tasks/`
- 任务不再出现在默认的任务列表、看板和搜索结果中
- 原任务 ID 被释放，后续新建任务可以复用该编号

#### 61.1.1.1 归档草稿

草稿也可以单独归档：

```bash
backlog draft archive draft-2
```

### 61.1.2 已归档任务 ID 可复用

Backlog.md 的 ID 分配机制会自动跳过已被占用的编号。归档任务后，其原 ID 会被系统回收，后续执行 `backlog task create` 时可能分配到该编号。

#### 61.1.2.1 腾出 ID 时的引用清理

归档（`task archive`）与降级（`task demote`）会**自动清理**其他任务对腾出 ID 的引用（BACK-691）：

- 活跃任务与 completed 语料中指向该 ID 的依赖、引用会被移除或修正，防止 ID 复用后旧引用静默绑定到新任务
- 清理涉及的任务 ID 会在 CLI 输出、MCP 结果与 Web 响应（`cleanedTaskIds`）中列出，自动提交时一并纳入提交范围
- 降级产生的草稿保留自己的依赖与父任务字段，但其他任务对它的引用被移除（而不是改写到新的草稿 ID）
- **完成（complete / cleanup）不做清理**——completed 记录正是就绪判定需要的完成证据
- 归档与降级按本地工作副本解析（local-first），不会跨分支误改

> 被清理的任务文件同样受文件锁与自动提交覆盖，无需手工跟进。

### 61.1.3 清理命令

清理命令用于将已完成的旧任务从活跃目录批量移入 `backlog/completed/` 文件夹：

```bash
backlog cleanup
```

执行后，交互式向导将引导你完成以下步骤：

1. 系统扫描所有处于终端状态（通常为 `Done`）的任务
2. 选择时间阈值：1 天、1 周、2 周、3 周、1 个月、3 个月或 1 年
3. 列出符合阈值的所有任务
4. 确认后批量移动到 `backlog/completed/` 目录

```
Found 12 tasks marked as Done.

Move tasks to completed folder if they are older than:
> 1 month

Found 8 tasks older than 1 month:
  - back-3: 设计数据库表 (2026-04-01)
  - back-4: 实现用户注册 (2026-04-02)
  ... and 6 more

Move 8 tasks to completed folder? (y/N)
```

### 61.1.4 归档与完成的区别

| 维度 | 归档（Archive） | 完成（Cleanup / Completed） |
|------|----------------|---------------------------|
| 触发方式 | 手动执行 `task archive` | 手动执行 `cleanup`，批量处理 |
| 目标目录 | `backlog/archive/tasks/` | `backlog/completed/` |
| 任务状态 | 任意状态均可归档 | 仅终端状态（如 Done）可被清理 |
| ID 复用 | 归档后 ID 可复用 | 移入 completed 后 ID 是否复用取决于配置 |
| 适用场景 | 废弃任务、重复任务、误创建的任务 | 正常完成但已过时、无需继续查看的历史任务 |
| 是否可恢复 | 可从 archive 目录手动移回 | 可从 completed 目录手动移回 |

### 61.1.5 维护建议

| 频率 | 建议操作 |
|------|----------|
| 每周 | 运行 `backlog cleanup`，将 2 周前已完成的任务移入 completed |
| 每月 | 审查任务列表，将无效或重复任务归档 |
| 每季度 | 检查 `backlog/completed/` 和 `backlog/archive/` 目录，决定是否删除或保留旧文件 |

保持活跃任务列表精简，有助于提升看板加载速度、改善搜索体验，并让团队聚焦于当前正在进行的工作。

# 62 看板与可视化

## 62.1 TUI 看板

在终端中运行 `backlog board`，即可启动基于字符界面的交互式看板。看板按状态分栏展示所有任务，支持键盘导航、任务移动、实时筛选和文件监控，无需离开终端即可掌握项目全貌。

### 62.1.1 启动看板

```bash
backlog board
```

首次启动时，看板会自动加载项目配置中的状态列（默认：`To Do`、`In Progress`、`Done`），并将任务按状态归入对应列。如果启用了里程碑模式，任务会按里程碑分组展示。

#### 62.1.1.1 常用启动选项

```bash
# 63 垂直布局（状态列纵向堆叠，适合窄屏终端）
backlog board --vertical

# 64 显式指定布局方向
backlog board --layout vertical
backlog board --layout horizontal

# 65 里程碑分组模式（按里程碑泳道展示任务）
backlog board --milestones
```

### 65.0.1 键盘导航

看板启动后，使用以下按键进行操作：

| 按键 | 操作 |
|------|------|
| `↑` `↓` `←` `→` | 在看板中移动选择焦点 |
| `Enter` | 打开当前选中任务的详情弹窗 |
| `N` | 打开任务创建器，直接在看板中新建任务 |
| `E` | 在系统编辑器中打开当前任务文件（TUI 自动挂起，退出编辑器后恢复） |
| `Tab` | 在看板视图与任务列表视图之间切换 |
| `M` | 进入/确认看板移动模式 |
| `PageUp` / `Ctrl+U` | 列表/滚动区向上翻页 |
| `PageDown` / `Ctrl+D` | 列表/滚动区向下翻页 |
| `Home` | 跳到列表/滚动区顶部 |
| `End` | 跳到列表/滚动区底部 |
| `H` `J` `K` `L` | vim 风格的等价导航（与方向键并存） |
| `Q` | 退出看板 |

> **提示**：按 `E` 编辑任务时，TUI 会自动挂起并恢复，无需手动重启看板。

按 `E` 时系统按**该行的实际文件位置**决定打开任务还是草稿（BACK-692）：草稿目录中的行打开草稿文件、任务目录中的行打开任务文件——即使文件的 `status` 字段与所在目录不一致（如降级后状态未改写）也不会开错对象；提示文案中的名词（任务 / 草稿）与实际编辑对象一致。

#### 65.0.1.1 vim 按键族与边界行为

列表组件同时支持方向键与 vim 按键族（`h`/`j`/`k`/`l`），两套按键的**边界语义**是统一的（BACK-588/589）：

- 到达列表首/尾后，按键行为由所在面板决定：可以停在边界、翻页，或跳转到相邻面板——而不是无声无息地失效
- 该规则同样适用于筛选弹窗等复合列表，弹窗内也能用 vim 键导航
- 无需开启配置：vim 键默认可用，与方向键并存

### 65.0.2 在看板中创建任务

按 `N` 键可直接在看板中打开任务创建器，无需退出 TUI 或切换到 Web 界面：

- 字段：Title、Description、Status（包含 Draft 和工作流状态）、Priority，以及五个日期字段——Due、Planned from/to、Actual from/to（BACK-689）；日期格式 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`，非法日期会被拒绝并聚焦回出错字段
- 使用方向键在字段间移动，`Tab` / `Shift+Tab` 切换字段
- 创建非 Draft 任务后，任务会立即插入看板并被聚焦
- 创建 Draft 任务后，系统会提示该草稿不会在看板中显示
- 空看板也保持可打开，创建器始终可用

#### 65.0.2.1 创建器的交互细节

- **鼠标支持**：直接点击 Title / Description / Status / Priority 字段即可聚焦或打开选择器（BACK-679）
- **极端终端尺寸**：弹窗高度与宽度按实际屏幕自适应，最低约 8 行的终端中输入框仍可编辑；宽度按配置的状态/优先级文案长度动态计算，超长状态名会自动切换为紧凑堆叠布局（BACK-678）
- **Unicode 安全输入**：在 astral 字符（如某些生僻汉字）旁插入、删除文字不会造成乱码或光标错位，宽字符按两个显示单元处理（BACK-648/676，emoji 同样按双宽测量）

#### 65.0.2.2 草稿会话

`backlog draft list` 的交互界面是一个以草稿为语料的看板会话（BACK-693/695）：

- 按 `N` 打开的创建器状态固定为 Draft，标题显示为「Create Draft」，字段与任务创建器完全相同（含日期）
- 会话实时监听 `backlog/drafts/` 目录：外部编辑、删除草稿即时反映；草稿被提升为任务后自动从会话中消失
- 任务看板会话始终不显示草稿文件

### 65.0.3 看板移动模式

移动模式允许你直接在终端中变更任务状态：

1. 在看板中用方向键选中要移动的任务。
2. 按 `M` 进入移动模式，当前任务会被标记为待移动状态。
3. 使用 `←` `→` 选择目标状态列，用 `↑` `↓` 调整插入位置。
4. 再次按 `M` 或 `Enter` 确认移动，任务状态即刻更新并同步到 Markdown 文件。
5. 按 `Esc` 可取消移动并恢复原位。

> **注意**：来自其他分支的跨分支任务无法在看板中直接移动，系统会在底部状态栏提示原因。

#### 65.0.3.1 多选移动（Shift + 方向键）

移动模式支持一次移动多个任务（BACK-681）：

1. 按 `M` 进入移动模式后，用 `Shift+↑` / `Shift+↓` 在目标列中移动高亮条（不影响看板顺序）。
2. 按 `M`（或 `Shift+M`）将高亮任务**招募**进移动集合；不支持 Shift 方向键的终端可用此键招募邻近任务。
3. 招募后第一个普通方向键收起高亮，预览整组任务作为一个相邻块落位；确认后一次性写入。
4. 写入期间方向键与取消键冻结；落在原位的移动是无操作。逐任务失败会在底部状态栏报告。

跨分支任务不能被招募。确认采用防抖设计，重复按 Enter 不会重复提交。

### 65.0.4 任务列表与筛选

按 `Tab` 键可从看板切换至任务列表视图。列表视图支持更精细的筛选：

- **状态筛选**：只显示特定状态的任务。
- **负责人筛选**：按 `@用户名` 过滤。
- **标签筛选**：按标签多选过滤。
- **里程碑筛选**：只显示归属某一里程碑的任务。
- **优先级筛选**：高 / 中 / 低。
- **搜索框**：实时模糊匹配任务标题与描述。

在列表视图底部，按对应快捷键打开筛选面板，勾选条件后列表会即时刷新。筛选条件在看板视图与列表视图之间共享，返回看板后仍保持生效。

#### 65.0.4.1 紧凑视图

当终端高度有限时，列表视图会自动切换为紧凑模式，隐藏部分元数据，仅保留任务 ID、标题和状态，确保在小型终端窗口中也能浏览大量任务。

### 65.0.5 里程碑看板视图

`backlog milestones`（交互式里程碑浏览器，BACK-687）提供侧栏 + 嵌入式看板的双栏布局：

- **左侧栏**列出「未分配」桶与全部里程碑（含已完成标记），`↑` / `↓` 移动光标，`Space` 将看板限定到该里程碑（行首显示 `▶`），`Enter` 打开里程碑详情弹窗（纯元数据，无任务列表）
- **右侧**为完整看板，键盘在看板与侧栏之间按焦点路由；筛选栏末尾显示 `<当前显示>/<任务总数>`
- `N` 在侧栏创建里程碑、在看板创建任务（默认归属当前限定的里程碑）；里程碑弹窗中按 `E` 打开编辑表单（标题、描述、Due、Planned / Actual 起止，日期格式 `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`；标题创建后只读）
- 里程碑与任务变更都会实时同步：外部编辑里程碑后弹窗**原地**刷新，被归档 / 删除的里程碑弹窗会带提示关闭

非 TTY 环境下，`backlog milestones list --plain` 输出与 `backlog board -m` 一致的 Markdown 分组看板（先「No Milestone」，再按里程碑文件顺序分节，节内按状态分组），`--show-completed` 可纳入已完成任务（BACK-688）。

### 65.0.6 实时文件监控

TUI 看板底层使用文件系统监控（`Bun.watch`），当以下情况发生时，看板会自动刷新：

- 在 Web UI 或其他终端中修改了任务状态
- 通过 `backlog task edit` 命令更新了任务
- AI 代理通过 MCP 工具修改了任务文件

这意味着你可以同时打开 TUI 看板和 Web 界面，任意一侧的改动都会实时同步到另一侧。

实时刷新对原子写入（atomic writes）具有弹性：CLI 写入任务文件时可能触发短暂的部分内容事件，TUI 会等待文件稳定后再刷新，避免读取到不完整的任务内容。选中任务在刷新、移动、归档或删除后仍保持有效，删除后会自动选中相邻任务。

**已打开弹窗的同步**（BACK-694/696）：看板任务弹窗与里程碑弹窗同样是"活"的——外部修改内容时按内容签名比对后原地重渲染，记录被移出当前视图时弹窗带提示关闭；无变化的刷新（如自己在弹窗内保存产生的回声）不会引起闪烁或重建。

### 65.0.7 验收标准进度指示

状态为 **In Progress** 且包含验收标准（AC）的任务，看板行会显示 ASCII 进度条（BACK-675），如 `[#####-----] 5/10`：

- 使用 `#`（已完成）与 `-`（未完成）纯 ASCII 字符，任何终端字体都能正确渲染
- 列宽足够时显示 10 格条，紧凑列显示 5 格条（宽度阈值 40 列）
- 颜色按完成度：全部完成绿色、不足三分之一红色、其余黄色；只要有勾选就至少显示一格
- 从验收标准实时派生，不持久化；没有 AC 或非 In Progress 的任务不显示
- 任务详情面板不再显示进度条，只保留 checklist 本身——看板行是唯一的进度面

### 65.0.8 帮助弹窗

按 `?` 打开帮助弹窗（BACK-677）：弹窗高度随终端尺寸自适应（从不超出屏幕），调整终端大小时实时重排；滚动上限按实际渲染行数计算，窄终端中换行的说明文字也能滚到底。任务详情弹窗的背景遮罩同样随终端尺寸变化实时重排，缩放终端后不会残留错位区域（BACK-684）。

### 65.0.9 主题自适应与稳定切换

TUI 看板采用终端主题自适应渲染，避免硬编码 ANSI 颜色带来的可读性问题：

- 大多数控件边框使用终端默认色，跟随当前配色方案
- 保留看板移动态的青色高亮，作为当前待移动任务的可识别标记
- 长列表和滚动区支持 `PageUp` / `PageDown` / `Home` / `End` 快速定位，并显示滚动条指示器

`Tab` 键在看板与任务列表之间切换经过稳定性处理，切换前后不会丢失 stdin 输入或积累重复监听器，双向切换均可靠。

### 65.0.10 依赖就绪提示

任务详情面板会为**含有依赖的任务**显示一行 Readiness 判定（BACK-615）：

- `✓ Ready to start` — 依赖全部就绪，可以立即开工
- `● Blocked by <ID>` — 至少有一个依赖尚未完成或无法解析

判定采用 fail-closed：依赖数据不完整、循环或存在歧义时一律按"阻塞"处理，不会猜测。同一判定也出现在 Web 任务详情的 Dependencies 卡片、Web 任务详情的状态徽章、`backlog task list --ready` 以及 MCP `task_list` 的 `ready: true` 参数中。该提示只做展示与筛选，不会修改任务或改变排序。

### 65.0.11 隐藏空状态列

看板可以隐藏当前没有任何任务的状态列，减少视觉杂乱（BACK-590）：

- 使用共享配置键 `hide_empty_columns`（与 Web 界面同一开关）
- 在看板内切换时界面立即反映（乐观更新），写入异步落盘
- 退出 TUI 时会等待挂起的写入完成，避免配置丢失
- 拖拽/移动任务期间所有状态列保持可见，以便作为有效的放置目标

### 65.0.12 窗口标题

进入 TUI 时，终端窗口标题会更新为包含项目名的标题；退出时恢复原标题（BACK-591）。标题的压入/弹出严格配对，在 tmux 等嵌套终端中也能通过透传序列正确恢复。

### 65.0.13 按键提示约定

底部 footer 与帮助面板中的按键提示统一使用**大写字母**表示可按键（如 `N` 新建、`E` 编辑、`M` 移动），避免大小写混用造成误解；footer 文案集中为常量，防止不同视图之间出现措辞漂移（BACK-590 / BACK-594）。

### 65.0.14 非终端环境的纯文本回退

当 `backlog board` 运行在非 TTY 环境（如 CI 流水线、脚本管道、IDE 集成终端）时，它会自动回退为纯文本输出，打印结构化的 Markdown 看板表格，而非启动交互式界面：

```bash
# 66 在 CI 中查看看板状态
backlog board > board-status.md
```

纯文本输出包含项目名、时间戳、各状态列的任务清单以及负责人和标签等元数据，便于存档和邮件分享。

### 66.0.1 同时运行多个视图

`backlog board` 与 `backlog browser` 可以并行运行。终端看板适合专注编码时快速查看状态，Web 界面适合详细编辑和拖拽操作，两者数据完全互通。

## 66.1 Web 看板

运行 `backlog browser` 即可启动基于浏览器的可视化任务管理界面。Web 看板基于 React + Tailwind CSS v4 构建，支持拖拽操作、里程碑泳道、标签筛选和实时同步，是团队协作者和偏好图形界面用户的首选工具。

### 66.1.1 启动 Web 界面

```bash
# 67 默认启动：端口 6420，自动打开系统默认浏览器
backlog browser

# 68 指定自定义端口
backlog browser --port 8080

# 69 启动但不自动打开浏览器（适合远程服务器或后台运行）
backlog browser --no-open
```

启动成功后，终端会显示服务地址，例如 `http://localhost:6420`。按 `Ctrl+C`（或 `Cmd+C`）即可停止服务。

> **提示**：可通过配置 `autoOpenBrowser` 和 `defaultPort` 修改默认行为，详见配置管理章节。

### 69.0.1 看板视图

打开 Web 界面后，默认进入看板视图。界面按状态分为多列，每列显示对应状态的任务卡片：

#### 69.0.1.1 拖放操作

- **跨列移动**：按住任务卡片，拖拽到目标状态列即可变更任务状态。
- **调整顺序**：在同一列内上下拖拽，可调整任务在看板中的展示顺序。
- **撤销支持**：所有拖放操作都会实时写入 Markdown 文件，并可通过 Git 回溯。

#### 69.0.1.2 里程碑泳道

启用里程碑视图后，看板会在每列内按里程碑分组展示任务卡片。同一里程碑的任务聚集在一起，形成清晰的横向泳道，方便按迭代或版本追踪进度。

#### 69.0.1.3 标签筛选

看板顶部提供标签筛选下拉框，点击后勾选需要的标签，看板会即时过滤只显示匹配标签的任务。支持多标签组合筛选。

### 69.0.2 所有任务视图

点击导航栏的「所有任务」，切换到表格布局：

- 支持按状态、优先级、标签、里程碑进行多维度筛选
- 表头点击可排序
- 顶部搜索框是触发按钮：点击它或按 Ctrl+K / Cmd+K 打开全局搜索对话框（Fuse.js 模糊匹配，结果按类型分组，关键词与 ID 高亮）

### 69.0.3 甘特图视图

点击导航栏的「甘特图」，进入时间线可视化页面：

- 左侧任务列表 + 右侧时间线双栏布局
- 五级时间粒度切换（日 / 周 / 月 / 季度 / 年）
- 自动解析任务起止时间（`plannedStart` / `plannedEnd` / `createdDate`）
- 任务依赖关系以 SVG 箭头可视化
- 支持拖拽平移时间轴

详见[甘特图视图](../40-Web界面/09-甘特图视图.md)章节。

### 69.0.4 里程碑管理页

导航栏的「里程碑」提供完整的里程碑生命周期管理：

- **创建里程碑**：点击「添加里程碑」按钮，输入名称即可创建。
- **里程碑详情**：每个里程碑卡片展示归属任务数和完成进度。
- **拖放分配**：从未分配任务池中将任务拖拽到目标里程碑，或反向移除。
- **完成检测**：当里程碑下所有任务都进入 `Done` 状态时，系统自动将该里程碑标记为已完成。
- **已完成的里程碑**：默认折叠在页面底部，减少视觉干扰。

### 69.0.5 文档与决策查看

Web 界面还提供项目知识库的只读浏览：

- **文档列表**：按子文件夹分组展示 `backlog/docs/` 下的全部文档，点击标题即可查看 Markdown 渲染内容。
- **决策记录**：展示 `backlog/decisions/` 中的 ADR 决策，包含状态标签和创建时间。

### 69.0.6 实时更新

Web 服务端通过 WebSocket 向所有连接的客户端广播文件变更：

- 在终端用 `backlog task edit` 修改任务后，浏览器中的看板会在 1 秒内自动刷新。
- 在 Web 界面中编辑任务时，如果其他用户或进程同时修改了同一文件，界面会智能合并变更，避免覆盖。
- 草稿保留：正在编辑但未保存的内容，在文件刷新后会被保留，不会丢失。

### 69.0.7 暗黑模式与响应式

Web 界面自动跟随系统主题切换暗黑模式，也支持手动切换。布局针对桌面和移动端做了响应式适配：

- **桌面端**：多列看板并排，适合大屏浏览。
- **移动端**：单列堆叠，支持触摸滑动和长按拖拽。

### 69.0.8 Mermaid 图表与附件

任务 Markdown 中若包含 Mermaid 语法，Web 界面会自动渲染为流程图、时序图或甘特图。`backlog/assets/` 目录下的图片和附件可通过相对路径直接在任务详情中预览。

## 69.1 看板导出

看板导出功能将当前项目状态生成静态 Markdown 文件，便于在 README 中嵌入、发送邮件汇报或存档到版本控制中。

### 69.1.1 导出为 Markdown 表格

```bash
# 70 导出到默认文件 Backlog.md
backlog board export

# 71 导出到指定文件
backlog board export project-status.md

# 72 强制覆盖已存在的文件
backlog board export --force
```

导出文件包含以下内容：

- **项目标题与导出时间戳**
- **版本标注**（若指定了 `--export-version`）
- **按状态分列的 Markdown 表格**，每行显示任务 ID、标题、负责人和标签
- **元数据汇总**：各状态任务数量、完成百分比

> 子任务以 `└─` 前缀列在父任务之后；更深层级的后代任务（如子任务的子任务）同样按 ID 顺序递归列出，不会遗漏（BACK-654）。

> **注意**：默认导出目标为项目根目录的 `Backlog.md`。若该文件已存在且未加 `--force`，命令会提示确认是否覆盖。

### 72.0.1 嵌入 README.md

如果希望将看板状态直接展示在仓库首页，可使用 `--readme` 标志：

```bash
backlog board export --readme
```

该命令会在 `README.md` 中查找看板标记占位符：

```markdown
<!-- BACKLOG BOARD START -->
<!-- BACKLOG BOARD END -->
```

找到后，将当前看板表格插入到两个标记之间。如果 README 中不存在这对标记，命令会提示你手动添加。

此功能常用于开源项目，让访问者第一眼就能看到当前迭代进度。

### 72.0.2 导出版本标注

在发布节点或里程碑完成时，可为导出内容附加版本信息：

```bash
# 73 简单版本号
backlog board export --export-version "v1.2.3"

# 74 组合使用：嵌入 README 并标注版本
backlog board export --readme --export-version "Release 2024.12.1-beta"
```

版本字符串会显示在导出表格的标题下方，方便与历史导出记录区分。

### 74.0.1 自动化导出示例

在 CI/CD 或发布脚本中集成看板导出：

```bash
# 75 发布前自动更新 README 看板
backlog board export --readme --force --export-version "$GITHUB_REF_NAME"
git add README.md Backlog.md
git commit -m "chore: update board snapshot"
```

> **提示**：由于 `backlog board export` 是纯读取操作，即使在没有写权限的 CI 环境中也能安全执行。若需提交结果，请确保流水线配置了相应的 Git 凭据。

# 76 文档与决策

## 76.1 文档管理

Backlog.md 将项目文档作为一等公民管理。所有文档存储在 `backlog/docs/` 目录下，以 Markdown 文件形式保存，支持嵌套子文件夹、全局 ID 索引和 CLI 全生命周期操作。

### 76.1.1 创建文档

```bash
# 77 最简创建
backlog doc create "API 设计指南"

# 78 指定文档类型
backlog doc create "架构决策说明" -t guide

# 79 创建到子目录
backlog doc create "部署手册" -p guides/deployment
```

创建成功后，CLI 会输出生成的文件路径，例如 `backlog/docs/guides/deployment/doc-5 - 部署手册.md`。文档 ID（如 `doc-5`）在整个 `backlog/docs/` 树中全局唯一，无论文件位于哪个子文件夹，都可以通过该 ID 进行查看和更新。

> `doc create` 也接受 `--plain` 标志。创建输出本身就是纯文本，该标志被接受（而非切换输出格式）是为了让按统一习惯给每条命令附加 `--plain` 的代理调用不会因 "unknown option" 而失败（BACK-592）。

#### 79.0.0.1 子路径规则

- 路径总是相对于 `backlog/docs/` 目录，无需写绝对路径。
- 支持多级嵌套，例如 `-p guides/deployment/aws`。
- 不允许使用 `..` 或绝对路径，系统会自动拒绝越级访问。

### 79.0.1 更新文档

```bash
# 80 更新文档内容
backlog doc update doc-5 --content "## 部署步骤\n\n1. 构建镜像\n2. 推送仓库"

# 81 同时更新标题、类型和标签
backlog doc update doc-5 --title "生产环境部署手册" -t runbook --tags deploy,aws

# 82 移动到新的子目录
backlog doc update doc-5 -p guides/production
```

`backlog doc update` 采用增量更新策略：只提供需要修改的字段，未提供的字段会保持原值不变。例如仅传入 `--title` 时，文档内容和路径均不受影响。

#### 82.0.0.1 多行内容与追加

`--content` 支持 `\n` 换行转义，与任务的 `--desc`、`--plan`、`--notes` 行为一致：

```bash
backlog doc update doc-5 --content "## 概述\n\n第一段\n第二段"
```

如需在保留原有内容的前提下追加文档块，使用可重复的 `--append-content` 选项。追加的块与基础内容之间以空行分隔，可与 `--content` 组合（追加在替换内容之后）：

```bash
# 83 追加一段到现有文档末尾
backlog doc update doc-5 --append-content "## 附录\n\n补充说明"

# 84 先替换再追加
backlog doc update doc-5 --content "新内容" --append-content "附录部分"
```

MCP 的 `document_update` 工具对应提供 `appendContent` 参数。

### 84.0.1 列出文档

```bash
backlog doc list
```

在支持 TTY 的终端中，该命令会打开**双栏交互浏览器**：左栏列出 `Documents (N)`，右栏实时渲染选中文档的 Markdown 内容。`←` / `→` 切换左右栏焦点，`↑` / `↓`（或 `j` / `k`）在当前栏内导航或滚动，Enter 打开完整查看器，`?` 打开帮助弹窗，`q` 退出。活动栏的边框高亮为黄色，失去焦点后恢复。`--plain`、`--json` 以及非 TTY 环境仍输出列表文本，行为不变（BACK-575）。

该命令扫描 `backlog/docs/` 及其所有子目录，输出全部文档的 ID、标题、类型和所在路径。当文档数量较多时，可结合 `backlog search` 进行模糊查找：

```bash
backlog search "部署"
```

搜索范围同时覆盖任务、文档和决策记录。

### 84.0.2 查看文档

```bash
# 85 交互式查看（TUI 弹窗渲染 Markdown）
backlog doc view doc-5

# 86 纯文本输出（适合 AI 代理或脚本解析）
backlog doc view doc-5 --plain
```

`--plain` 标志会输出原始 Markdown 内容与 frontmatter 元数据，方便在流水线或聊天窗口中直接阅读。

#### 86.0.0.1 引用形式与歧义处理

`doc view` 接受三种引用形式，按顺序尝试解析（BACK-598）：

| 形式 | 示例 | 说明 |
|------|------|------|
| 裸 ID | `doc-5` | 默认形式，ID 在整个 `backlog/docs/` 树中唯一时直接命中 |
| 文档相对路径 | `migration/doc-14` | 省略 `.md` 后缀；也支持 `目录/ID-文件名` 形式 |
| 文件名标题 slug | `部署手册` | 取文件名中 `ID - ` 之后的标题部分，大小写不敏感 |

身份解析是 **fail-closed** 的（BACK-596）：当同一 ID 出现在不同子目录（例如 `guide/doc-1 - A.md` 与 `migration/doc-1 - B.md`）时，裸 ID 会立即报错并列出全部候选路径（退出码 1），而不会任选一个。错误信息附带可直接运行的消歧建议——候选唯一时给出 `目录/ID`，否则给出完整路径（含空格时自动加引号）。路径形式拒绝 `..` 越级与盘符前缀，匹配到多个文件同样报错。

相关行为：

- 文档或决策缺少 `id` frontmatter 时仍出现在列表中，但无法通过 ID 寻址
- Web 界面遇到歧义时显示专用提示（服务端返回 HTTP 409 与候选列表），**不会**回退到缓存中的旧条目
- MCP 返回 `AMBIGUOUS_ID` 错误并在结构化内容中给出候选路径

### 86.0.1 文档组织建议

随着项目演进，`backlog/docs/` 下的文件会逐渐增多。推荐采用以下目录结构保持清晰：

```
backlog/docs/
├── readme.md              # 文档目录说明
├── api/
│   ├── doc-1 - REST-规范.md
│   └── doc-2 - GraphQL- schema.md
├── guides/
│   ├── doc-3 - 本地开发.md
│   └── doc-4 - 部署流程.md
└── runbooks/
    └── doc-5 - 故障排查.md
```

> **提示**：`backlog doc list` 和 `backlog doc view` 会自动穿透所有子目录。文档 ID 全局唯一时只需记住 ID；若不同子目录出现同名 ID，可用 `目录/ID`（如 `migration/doc-14`）或标题 slug 消歧，歧义时命令会列出全部候选路径。

## 86.1 决策记录

决策记录（Architecture Decision Records，ADR）用于追踪项目中的关键技术与设计选择。Backlog.md 原生支持 ADR 格式，所有决策以 Markdown 文件形式保存在 `backlog/decisions/` 目录中，包含状态元数据和完整上下文。

### 86.1.1 创建决策记录

```bash
# 87 默认状态为 proposed（提议）
backlog decision create "使用 PostgreSQL 作为主数据库"

# 88 创建时直接指定状态
backlog decision create "迁移到 TypeScript" -s accepted
```

创建成功后，系统会在 `backlog/decisions/` 下生成类似 `decision-3 - 迁移到-TypeScript.md` 的文件。文件 frontmatter 中包含 `status` 字段，用于标识决策当前所处的生命周期阶段。

### 88.0.1 状态流转

决策记录支持五种标准状态，反映从提出到退出的完整生命周期：

| 状态 | 含义 |
|------|------|
| `proposed` | 已提出，待讨论或评审 |
| `accepted` | 已接受，成为项目现行标准 |
| `rejected` | 已拒绝，不采纳该方案 |
| `deprecated` | 曾接受但已废弃，不再适用 |
| `superseded` | 已被新的决策替代 |

状态变更有三条路径（BACK-635）：

```bash
# 89 只改状态，正文保持逐字节不变
backlog decision update decision-3 --status accepted

# 90 状态与正文同一次提交
backlog decision update decision-3 --status superseded --append-content "## 补充\n\n已被 decision-7 替代"
```

`--status` 接受自由文本，文档约定的值为 `proposed` / `accepted` / `rejected` / `superseded`；显式传入的状态优先于正文中 frontmatter 的值。也可直接编辑决策文件的 frontmatter，或在 Web 界面决策详情页编辑（见 [文档与决策](../40-Web界面/04-文档与决策.md)）。MCP 侧提供 `decision_update` 工具（`content` / `appendContent` / `status` 参数）。建议在正文中记录状态变更的原因和时间，保持审计轨迹完整。

### 90.0.1 列出决策

```bash
backlog decision list
```

输出包含所有决策的 ID、标题和当前状态。已完成处理的决策（`accepted`、`rejected`、`deprecated`、`superseded`）通常与活跃决策一同展示，便于快速查阅历史选择。

在支持 TTY 的终端中，该命令会打开**双栏交互浏览器**：左栏列出 `Decisions (N)`，右栏实时渲染选中决策的原始 Markdown，`←` / `→` 切换左右栏焦点，`↑` / `↓`（或 `j` / `k`）在当前栏内导航或滚动，Enter 打开完整查看器，`?` 打开帮助弹窗，`q` 退出，活动栏边框高亮为黄色（BACK-574）。

```bash
# 91 纯文本输出（适合脚本处理）
backlog decision list --plain

# 92 结构化 JSON 输出（版本化信封 kind: "decision-list"）
backlog decision list --json
```

非 TTY 环境默认回退为纯文本输出；决策日志为空时打印 `No decisions found.`。

### 92.0.1 查看决策

```bash
backlog decision view decision-3
```

在 TTY 环境下默认打开可滚动的交互式查看器（PageUp / PageDown / Home / End 可用，Windows 下关闭鼠标跟踪避免 PowerShell / VS Code 挂起），非 TTY 环境回退为 `--plain` 输出 frontmatter 与 Markdown 正文。

当同一 ID 命中多个文件时，命令会打印全部候选路径并以退出码 1 失败，而不会任选一个（与文档一致的 fail-closed 身份规则）。

### 92.0.2 更新决策

```bash
# 93 替换决策正文
backlog decision update decision-3 --content "## 背景\n\n新的背景说明"

# 94 追加一段内容（可重复，保留已有正文）
backlog decision update decision-3 --append-content "## 补充\n\n新增考量"
```

`decision update` 复用结构化章节解析（背景 / 决策 / 后果 / 备选方案），`--content` 与 `--append-content` 都支持与其它命令一致的 `\n` 换行转义；状态通过 `--status` 修改（见上一节），三个选项可单独或组合使用。

### 94.0.1 ADR 格式简介

生成的决策记录文件遵循标准 ADR 结构：

```markdown
---
status: proposed
date: 2026-05-07
---

# 95 迁移到 TypeScript

## 95.1 背景

项目目前使用 JavaScript，随着代码量增长，类型安全问题日益突出……

## 95.2 决策

全面迁移到 TypeScript，使用严格模式。

## 95.3 后果

- 正向：编译期类型检查、更好的 IDE 支持、降低运行时错误
- 负向：初期迁移成本、团队成员学习曲线
```

#### 95.3.0.1 字段说明

- **status**：决策当前状态，必填。
- **date**：创建日期，自动生成。
- **背景（Context）**：描述问题背景和约束条件。
- **决策（Decision）**：明确陈述做出的决定。
- **后果（Consequences）**：列出该决策带来的正面和负面影响。

### 95.3.1 与任务和文档的关联

在任务创建或编辑时，可通过 `--doc` 选项关联相关决策记录：

```bash
backlog task create "升级构建工具到 Vite" --doc decision-3
```

这样在看板或任务详情中，可以直接跳转到关联的决策上下文，避免重复讨论已定论的技术选型。

### 95.3.2 最佳实践

- **及时记录**：在技术讨论结束后的 24 小时内创建决策记录，防止细节遗忘。
- **保持精简**：每个决策聚焦一个问题，避免将多个不相关的选择混在同一文件中。
- **状态透明**：一旦决策被替代或废弃，立即更新状态为 `superseded` 或 `deprecated`，并在正文中引用替代方案。
- **定期回顾**：每季度运行 `backlog decision list`，检查是否存在长期停留在 `proposed` 状态的决策，推动闭环。

## 95.4 里程碑管理

里程碑用于将任务按迭代、版本或发布周期分组，是追踪阶段进度和规划路线图的核心工具。Backlog.md 的里程碑数据以 Markdown 文件形式存储在 `backlog/milestones/` 目录中，与任务文件共同纳入版本控制。

### 95.4.1 创建里程碑

里程碑可通过 CLI、Web 界面或 MCP 创建。

#### 95.4.1.1 CLI 创建

```bash
backlog milestone add "M3 - Web UI"

# 96 一次性设置描述、日期与关联文档
backlog milestone add "M3 - Web UI" \
  --description "本阶段的界面与交互目标" \
  --due-date 2026-07-31 --planned-start 2026-07-01 --planned-end 2026-07-25 \
  --doc doc-5 --doc doc-8
```

`--doc` 可重复使用以关联多个文档，空值会被拒绝；创建时会自动写入 `created_date`。

#### 96.0.0.1 Web 界面创建

1. 运行 `backlog browser` 启动 Web 界面。
2. 点击导航栏的「里程碑」进入里程碑管理页。
3. 点击「添加里程碑」按钮，输入里程碑名称（例如 `M3 - Web UI`）。
4. 描述字段支持 Markdown 编辑、Mermaid 预览与粘贴上传图片（保存前自动 promote 到 `paste/`）。
5. 点击保存，系统会在 `backlog/milestones/` 下生成对应的里程碑文件。

> **提示**：AI 代理用户可通过 MCP 工具的 `milestone_add` 直接创建里程碑，无需打开浏览器。

### 96.0.1 编辑里程碑

通过 CLI 编辑里程碑的标题、描述和日期字段：

```bash
backlog milestone edit M1 --title "M1 - 核心 CLI" --description "第一阶段目标" \
  --due-date 2026-06-30 --planned-start 2026-05-01 --planned-end 2026-06-15 \
  --actual-start "2026-05-01 09:00" --actual-end "2026-06-10 18:00"

# 97 清空日期字段
backlog milestone edit M1 --clear-due-date --clear-planned-end --clear-actual-start
```

- 支持通过标题或 ID 定位里程碑（模糊匹配）。
- 计划字段（`dueDate` / `plannedStart` / `plannedEnd`）格式为 `YYYY-MM-DD`。
- 实际字段（`actualStart` / `actualEnd`）格式为 `YYYY-MM-DD HH:MM`（UTC）。
- 传空字符串可清空对应字段。

里程碑也支持与任务一致的关联文档字段（BACK-619）：

```bash
# 98 覆盖式设置关联文档
backlog milestone edit M1 --doc doc-5

# 99 追加 / 按值移除 / 清空
backlog milestone edit M1 --add-doc doc-8
backlog milestone edit M1 --remove-doc doc-5
backlog milestone edit M1 --clear-docs
```

`--doc`（设置）与 `--add-doc`（追加）在同一命令中互斥，`--clear-docs` 不可与同类其它标志混用；规则与任务的列表型字段完全一致。文档链接的增删属于实质性变更，会刷新 `updated_date`。

#### 99.0.0.1 Web UI 中的里程碑日期编辑

在里程碑管理页点击里程碑卡片，可打开编辑弹窗：

- **Due Date** / **Planned Start** / **Planned End** — `date` 输入框
- **Actual Start** / **Actual End** — `datetime-local` 输入框

里程碑的 `actualStart` / `actualEnd` 由下属任务的状态变化自动驱动：
- 当里程碑下任一任务变更为 In Progress 时，若 `actualStart` 为空，自动设为当前日期时间
- 当里程碑下最后一个非终态任务变更为 Done 时，若 `actualEnd` 为空，自动设为当前日期时间
- 你可以随时手动覆盖这些自动填充值

### 99.0.1 里程碑列表与详情

在终端中查看所有里程碑及其完成状态：

```bash
backlog milestone list
```

输出示例：

```
Active milestones (2):
  m-1: M1 - CLI (8/12 done)
  m-2: M2 - MCP 支持 (3/5 done)

Completed milestones (1):
  (collapsed, use --show-completed to list)
```

每个里程碑显示已完成任务数与总任务数的比值，一目了然地展示进度。

#### 99.0.1.1 查看已完成的里程碑

默认情况下，已完成的里程碑会被折叠，减少信息噪音。如需展开：

```bash
backlog milestone list --show-completed
```

纯文本输出（适合脚本解析）：

```bash
backlog milestone list --plain
```

`--plain` 输出与 `backlog board -m` 完全一致的 Markdown 分组看板（BACK-688）：先是「No Milestone」节，再按里程碑文件顺序分节，节内任务按 `### <状态> (数量)` 小标题分组列出；默认排除 completed 目录中的任务，`--show-completed` 可将其纳入；空状态列自动收窄。

#### 99.0.1.2 TUI 里程碑看板

在 TTY 中运行 `backlog milestones` 进入交互式里程碑看板（BACK-687）：左侧为里程碑列表（`Space` 限定范围、`Enter` 查看元数据、`N` 新建），右侧为嵌入式任务看板，里程碑详情弹窗支持按 `E` 编辑日期与描述。详见 [TUI 看板](../20-看板与可视化/00-TUI看板.md)。

### 99.0.2 任务分配到里程碑

将任务归属到某个里程碑有三种方式：

#### 99.0.2.1 1. 创建任务时指定

```bash
backlog task create "实现看板拖拽" -m "M2 - MCP 支持"
```

`-m` 选项支持模糊匹配，系统会自动找到最接近的里程碑。也可以使用里程碑 ID（如 `m-2`）或纯数字（如 `2`）。

#### 99.0.2.2 2. 编辑现有任务

```bash
backlog task edit 7 --milestone "M2 - MCP 支持"
```

#### 99.0.2.3 3. 按里程碑 ID 过滤任务列表

在 `backlog task list` 的里程碑过滤中，可以使用多种形式定位里程碑：

```bash
# 100 数字别名
backlog task list -m 2

# 101 规范 ID
backlog task list -m m-2

# 102 大小写变体
backlog task list -m "M2"

# 103 标题精确/部分匹配
backlog task list -m "MCP 支持"
```

过滤解析支持数字别名、规范 ID（`m-N`）、大小写变体以及带标点符号的标题，行为在 CLI、交互式任务列表和 MCP `task_list` 的 active/draft 路径中保持一致。如果查询没有匹配到任何里程碑，则返回空列表。

#### 103.0.0.1 4. 清除里程碑归属

```bash
backlog task edit 7 --clear-milestone
```

#### 103.0.0.2 5. Web 界面拖放分配

在 Web 界面的里程碑管理页中，「未分配任务池」展示了所有没有里程碑归属的任务。将任务卡片拖拽到目标里程碑卡片中即可完成分配，反向拖拽则可移除。

### 103.0.1 里程碑完成检测与归档

#### 103.0.1.1 自动完成检测

当一个里程碑下的所有任务都进入 `Done` 状态时，系统会自动将该里程碑标记为已完成。在 `backlog milestone list` 中，它会从「Active milestones」区域移动到「Completed milestones」区域。

#### 103.0.1.2 归档里程碑

已完成的里程碑如果长期保留在活跃列表中会累积噪音。可将其归档：

```bash
backlog milestone archive "M1 - CLI"
```

归档后的里程碑：

- 从活跃里程碑列表中移除
- 其下任务自动变为「未分配」状态（任务本身不会被删除，仅解除里程碑绑定）
- 文件移入归档区，ID 不再参与模糊匹配

归档操作支持通过标题或 ID 定位里程碑：

```bash
backlog milestone archive m-1
backlog milestone archive 1
```

归档**不会**修改任何任务文件——任务保留对该里程碑的引用。如果希望同时清空或改挂任务上的里程碑字段，请使用 `remove`（见下一节）。

### 103.0.2 created_date 与 updated_date

里程碑与任务一样自动维护两个时间戳（BACK-618）：

- `created_date`：创建时写入（UTC，`YYYY-MM-DD HH:MM`）
- `updated_date`：仅在**实质性变更**时刷新——仅顺序调整不会刷新，文档链接的增删会刷新

`backlog milestone list` 会在条目后追加 `(updated ...)`（无更新记录时回退为 `(created ...)`）；MCP `milestone_list` 显示 `Created:` / `Updated:` 标签。历史文件缺少这两个字段时不会报错，显示时回退到 `created_date`。Web 界面在里程碑卡片上显示「最近更新」，详情页顶部信息框显示「创建于 / 更新于」。

### 103.0.3 移除里程碑（remove）

除 `archive` 之外还有 `remove`。两者都会把里程碑文件移入归档目录，区别在于是否处理任务文件上的里程碑字段：

```bash
# 104 默认：清空匹配任务的里程碑字段
backlog milestone remove "Release 1.0"

# 105 保留任务上的里程碑引用
backlog milestone remove "Release 1.0" --task-handling keep

# 106 改挂到另一个活跃里程碑
backlog milestone remove "Release 1.0" --task-handling reassign --reassign-to "Release 2.0"
```

| 操作 | 里程碑文件 | 任务文件 |
|------|-----------|---------|
| `archive` | 移入归档目录 | **不修改**，任务保留对该里程碑的引用 |
| `remove --task-handling keep` | 移入归档目录 | 不修改 |
| `remove --task-handling clear`（默认） | 移入归档目录 | 清空匹配任务的里程碑字段 |
| `remove --task-handling reassign` | 移入归档目录 | 改挂到 `--reassign-to` 指定的活跃里程碑 |

### 106.0.1 未分配任务池

未归属任何活跃里程碑的任务构成了「未分配任务池」。在 Web 界面的里程碑页中，这些任务集中展示在页面顶部，方便你：

- 快速审视尚未纳入迭代规划的工作项
- 批量拖拽分配到合适的里程碑
- 识别遗漏或需要重新排期的任务

在终端中，未分配任务不会在 `backlog milestone list` 中显示，但可以通过筛选查看：

```bash
backlog task list --milestone ""
```

### 106.0.2 在看板中按里程碑分组

TUI 看板和 Web 看板都支持里程碑分组模式：

```bash
# 107 TUI 看板按里程碑泳道展示
backlog board --milestones
```

在此模式下，看板不再单纯按状态分列，而是在每列内按里程碑形成横向泳道，帮助你直观对比各迭代的剩余工作量。

# 108 Web 界面

## 108.1 启动与访问

Backlog.md 内置了一个现代化的 Web 界面，让你在浏览器中直观管理任务、看板、里程碑和文档。通过 `backlog browser` 命令即可一键启动。

### 108.1.1 启动 Web 服务器

打开终端，进入 Backlog.md 项目目录，执行以下命令：

```bash
backlog browser
```

服务器默认绑定到 `127.0.0.1`（回环地址），启动后会自动在默认浏览器中打开界面地址。控制台会显示类似如下信息：

```
🚀 Backlog Web UI running at http://localhost:6420
```

默认仅监听本机请求，同一网络中的其他设备无法直接访问。

### 108.1.2 命令行选项

#### 108.1.2.1 指定端口

如果默认端口 `6420` 已被占用，可通过 `--port` 参数指定其他端口：

```bash
backlog browser --port 8080
```

启动后，在浏览器中访问 `http://localhost:8080` 即可进入界面。

##### 108.1.2.1.1 端口占用时自动换端口

默认情况下（配置项 `autoPort: true`），若默认端口已被占用，服务器会**自动扫描后续可用端口**并在控制台打印真实地址，无需手动指定，也不会直接报错退出：

```
🚀 Backlog Web UI running at http://localhost:6421
```

自动扫描只接受用户端口范围（1024–65535）内的端口，会拒绝操作系统临时分配的随机高位端口。若把配置项 `autoPort` 设为 `false`，端口占用将恢复为直接报 `EADDRINUSE` 错误（此时可用 `--port` 显式指定）。该开关也可在 Web 界面「设置」面板中切换。

#### 108.1.2.2 禁止自动打开浏览器

若不需要自动弹出浏览器窗口（例如在远程服务器或 CI 环境中运行），添加 `--no-open` 参数：

```bash
backlog browser --no-open
```

此时需手动复制控制台输出的地址到浏览器中访问。

#### 108.1.2.3 指定绑定主机

默认情况下 Web 服务器只绑定 `127.0.0.1`，适合本地开发。若需要让局域网内其他设备访问，可使用 `--host` 显式指定：

```bash
# 109 监听所有接口（开放局域网访问）
backlog browser --host 0.0.0.0
```

通配绑定时，控制台会打印具体的 LAN IPv4 地址，并提示当前 API 未认证。浏览器会自动打开第一个可用的 LAN 地址。你也可以绑定到某个具体网卡：

```bash
backlog browser --host 192.168.1.100
```

#### 109.0.0.1 使用自定义浏览器

在 devcontainer 或没有默认浏览器的容器中，可通过 `BROWSER` 环境变量指定启动命令：

```bash
BROWSER=/usr/bin/chromium backlog browser
```

`BROWSER` 被视为单个可执行路径（去除包裹引号，不会拆分或 shell 求值），URL 作为独立参数传入。未设置时按平台自动回退：`open`（macOS）、`cmd /c start`（Windows）、`xdg-open`（Linux）。

#### 109.0.0.2 组合使用

```bash
backlog browser --port 3000 --no-open
BROWSER=/usr/bin/chromium backlog browser --host 127.0.0.1 --port 8080
```

### 109.0.1 技术特性

Web 界面采用以下技术构建，确保流畅的使用体验：

- **React**：组件化交互界面，页面切换无刷新
- **Tailwind CSS v4**：现代化样式系统，界面简洁统一
- **响应式布局**：自动适配桌面端和移动端屏幕尺寸
- **暗黑模式**：支持系统主题自动切换，也可手动切换亮色 / 暗色模式

### 109.0.2 实时同步

Web 界面与本地 Markdown 文件保持实时同步：

- 在浏览器中修改任务状态或内容，会自动写回到对应的 Markdown 文件
- 在外部编辑器（如 VS Code、Vim）中修改文件，Web 界面会即时刷新显示最新内容
- 无需手动刷新页面，所有视图均通过 WebSocket 实时更新

### 109.0.3 界面布局

Web 界面采用经典的左右布局：

- **左侧边栏**：占据固定宽度，展示导航菜单和文件树
- **右侧内容区**：占据剩余空间，展示任务、看板、文档或 Wiki 内容

#### 109.0.3.1 调整侧边栏宽度

将鼠标移到侧边栏右边缘，光标变为左右箭头时按住拖拽，即可调整侧边栏宽度。拖拽过程中会显示一条蓝色 ghost bar 预览最终位置，松开鼠标后宽度立即生效并自动保存到浏览器本地存储（`localStorage`），下次打开时恢复上次设置的宽度。

- 最小宽度限制为 **200px**，防止侧边栏缩至不可见
- 最大宽度限制为 **500px**，避免占用过多内容区空间

#### 109.0.3.2 折叠侧边栏

侧边栏中部右侧有一个折叠/展开按钮（箭头图标），点击可将侧边栏收起为仅显示图标的最窄模式，再次点击恢复展开。折叠状态与宽度设置均保存到 `localStorage`。

### 109.0.4 停止服务

在运行 `backlog browser` 的终端中按下 `Ctrl + C`，即可停止 Web 服务器。所有已保存的更改均已写入文件系统，数据不会丢失。

### 109.0.5 加载指示

Web 界面的加载反馈分为两层（BACK-668/669/670）：

- **首次加载**：看板区域显示与真实列布局一致的骨架屏（呼吸动画的幽灵列），中央为加载环；项目尚未初始化的等待画面同样显示加载环
- **后台索引**：跨分支索引等后台工作进行时，头部右侧显示一个状态 chip（展示当前阶段文案，悬停可见完整信息），头部下缘附带扫动进度条；已加载的看板与树保持可交互，不会被骨架屏覆盖

加载动画在系统开启「减少动态效果」（reduced motion）时仍然播放——加载进度属于必要反馈而非装饰，静止的加载环在远程桌面、虚拟机等环境下容易被误读为卡死。

### 109.0.6 作为常驻服务运行

`backlog browser --no-open` 只启动服务、不打开浏览器，适合注册为开机自启的常驻服务（doc-003）。要点：**每个项目一个独立服务与独立端口**，工作目录必须指向项目根。

- **Linux（systemd 用户服务）**：创建 `~/.config/systemd/user/backlog-browser-<项目>.service`，`ExecStart` 为 `backlog browser --no-open --port <端口>`，`Restart=on-failure`；执行 `loginctl enable-linger` 后无需登录会话即可开机启动；项目较多时可用模板单元 `backlog-browser@.service`
- **macOS（launchd）**：在 `~/Library/LaunchAgents/` 放置 Label 唯一的 plist，配置 `RunAtLoad` 与 `KeepAlive`；注意 Apple Silicon 与 Intel 的二进制路径分别为 `/opt/homebrew/bin/backlog` 与 `/usr/local/bin/backlog`
- **Windows**：用计划任务（`New-ScheduledTaskAction`，`-AtLogOn` 触发）实现登录自启；需要无人登录也常驻时，用 NSSM 包装为真正的 Windows 服务以获得自动重启

## 109.1 看板视图

看板视图以列式布局展示任务，直观反映每个任务当前所处的状态。通过拖拽操作即可快速变更任务状态，无需打开任务详情页。

### 109.1.1 进入看板页面

启动 Web 界面后，点击顶部导航栏的「看板」标签，即可进入看板视图页面。页面默认展示以任务状态划分的列布局。

#### 109.1.1.1 异步加载指示

看板页面采用 bind-first 启动：浏览器界面会立即显示骨架屏和加载阶段文案（如扫描任务、构建索引），后台完成 Core 语料初始化后再渲染真实内容。如果初始化过程中出错，页面会显示可重试的错误面板，点击即可重新加载。加载期间侧边栏保持挂载，仅任务计数显示为加载状态。

#### 109.1.1.2 隐藏空状态列

当项目使用 5+ 个状态而多数任务集中在少数几个状态时，看板会出现大量空列造成杂乱。可在设置面板（或 `config.yml` 的 `hide_empty_columns`）开启**隐藏空状态列**：启用后，当前没有任何任务的空状态列会被自动隐藏，看板只展示至少有一个任务的状态列。

> 拖拽任务期间所有状态列保持可见，以便将任务放入目标列。拖拽结束后，空列再次隐藏。

### 109.1.2 拖放变更任务状态

看板页面将任务按状态分列展示，常见列包括：

- **Todo** — 待办任务
- **In Progress** — 进行中任务
- **Done** — 已完成任务

将鼠标悬停在目标任务卡片上，按住左键拖动卡片，移动到目标状态列后松开，任务状态即自动更新。状态变更会实时同步到对应的 Markdown 文件。

> 拖动过程中，目标列会高亮显示，提示可放置区域。

#### 109.1.2.1 拖拽行为细节

- **保持列排序**：如果当前列已手动排序（如按 ID 降序），拖拽期间视觉顺序保持稳定，不会在光标下重新排序
- **跨列精确放置**：将任务拖入目标列时，可以放置到该列中任意两个现有任务之间。系统会根据你松开鼠标时的视觉位置插入任务，而非简单地追加到列末尾
- **跨列后排序恢复**：任务跨列放置后，目标列的手动排序会自动清除，恢复为默认的 ordinal 排序，确保新任务出现在正确位置

### 109.1.3 里程碑泳道

若项目中存在里程碑，看板页面支持以里程碑为维度划分泳道。在页面上方找到里程碑筛选或视图切换控件，点击选择「按里程碑分组」。

每个里程碑展开为一个横向泳道，泳道内再按状态分列显示任务。这种视图便于追踪特定里程碑的推进情况。

### 109.1.4 标签筛选

页面顶部提供标签筛选下拉框。点击下拉框，勾选需要筛选的标签，看板将只显示带有选中标签的任务。

- 支持多选标签，任务只需匹配任一选中标签即可显示
- 取消勾选或点击「清除筛选」可恢复显示全部任务

#### 109.1.4.1 自定义标签颜色

每个标签右侧有一个彩色小方块（颜色 swatch），点击可打开颜色选择器，为标签设置自定义颜色。

- **预设调色板**：提供 17 种预设颜色，自动适配亮色/暗色模式
- **持久化**：非默认颜色配置保存到 `backlog/config.yml` 的 `label_colors` 字段，重启服务后仍然有效
- **默认恢复**：选择「Default」并保存可恢复为系统默认灰色
- **卡片渲染**：看板任务卡片上的标签会显示配置的背景色，未配置的标签保持默认灰色

> 标签颜色配置按项目独立存储，不同项目可拥有不同的标签配色方案。

### 109.1.5 任务卡片标签

每张任务卡片底部会显示该任务的标签列表。

- **宽度自适应**：卡片会根据自身可用宽度动态计算能显示多少标签，尽可能多地展示，超出部分以 `+N` 折叠
- **实时响应**：调整窗口大小或侧边栏宽度时，标签显示数量会自动重新计算
- **标签颜色**：已配置自定义颜色的标签会以对应背景色显示

### 109.1.6 任务卡片验收标准进度

对于状态为 **In Progress** 且包含验收标准（AC）的任务，卡片标题行会显示圆角进度条和已勾选/总数分数（如 `2/4`），进度条与任务 ID 同处一行弹性排列（BACK-630/645）：

- 进度从验收标准实时计算，不持久化为单独字段
- 没有验收标准的任务不显示任何进度指示
- 全部验收标准勾选后，任务仍保持 In Progress 状态，需手动拖拽到 Done 列完成
- 进度条使用翠绿填充配灰色轨道，亮 / 暗主题下均保证与卡片背景的对比度

任务列表视图同样在标题列显示该进度指示（固定宽度 80px 的进度条，每行占位一致）。

### 109.1.7 显示已完成任务

看板与任务列表的筛选栏提供「显示已完成」（Show completed）复选框（BACK-665）：

- 勾选后，`backlog/completed/` 目录中的已完成记录与活跃任务走同一条筛选、排序与分组管线一并展示；卡片和列表行以「Completed」徽章标记
- 勾选状态同步到地址栏（`completed=1`），可随链接分享、刷新后保留；它计入激活筛选，「清除筛选」会一并取消勾选
- 已完成卡片不可拖拽（状态无法写回 completed 目录），点击打开的是**只读弹窗**：展示全部内容但不提供编辑、状态变更等操作按钮，标题栏下方显示只读提示（BACK-663）
- 未勾选时不产生任何额外查询开销

### 109.1.8 多选与批量拖拽

看板支持一次移动多张卡片（BACK-680/682）：

- **多选**：`Ctrl/Cmd + 点击` 切换单张卡片的选中状态，`Shift + 点击` 按区间选择；选中后页面顶部出现选择工具栏，显示选中数量并提供清除入口
- **批量拖拽**：拖动任一已选中卡片即可整组移动，拖拽幽灵上的徽章显示实际移动的卡片数；对未选中的卡片按住 `Ctrl/Cmd` 起拖会将其并入当前选择
- **定点插入**：批量放置支持精确插入到目标列任意两卡之间，落点顺序按看板阅读顺序一并提交；目标列若处于手动排序状态，放置时自动回到默认排序以保证落点正确
- 跨分支卡片不参与批量写入；在原地松手属于无操作，不会发出请求

### 109.1.9 列内排序

每列右上角有一个「⋮」列操作按钮，点击展开排序菜单：

#### 109.1.9.1 本地排序（6 个选项）

菜单上半部分提供 6 个纯展示排序选项：

- **ID ↑ / ID ↓**：按任务 ID 升序/降序排列
- **标题 ↑ / 标题 ↓**：按任务标题字母顺序升序/降序排列
- **优先级 ↑ / 优先级 ↓**：按优先级升序/降序排列

本地排序仅影响当前看板列的展示顺序，**不会保存到后端**。选中后再次展开菜单，激活的排序项会以深色背景高亮显示，右侧出现 `×` 按钮，点击即可清除排序，恢复按原始顺序（ordinal）显示。

> 拖拽任务卡片或执行下方的「Apply Priority Order」后，本地排序会自动清除。

#### 109.1.9.2 按创建日期排序

列菜单在本地排序之外还提供**按创建日期排序**操作（升序/降序）。系统使用 `parseStoredUtcDate` 比较各任务的 `createdDate` 字段，缺失或无效日期的任务排在末尾，任务 ID 作为平局决胜。该排序与优先级排序一样作用于当前列。

#### 109.1.9.3 跨分支任务的列菜单

当某一列包含来自其他分支的任务（cross-branch tasks）时，列操作菜单仍然可见，但部分操作会受到限制：

- **本地排序选项**（ID/标题/优先级）仍可正常使用，因为这些仅影响视图展示顺序，不会修改任何持久化数据
- **Apply Priority Order** 按钮会被隐藏，因为该操作会修改当前列所有任务的 `ordinal` 字段，而跨分支任务不应被当前分支的排序操作影响

> 跨分支任务在卡片上会显示分支来源标识。当列中所有任务均属于当前分支时，Apply Priority Order 恢复正常显示。

#### 109.1.9.4 按优先级重排（保存）

菜单底部（以分隔线与上方隔开）提供「按优先级重排（保存）」选项：

- 一键将当前列所有任务按优先级（高 → 中 → 低）重新排列
- 新顺序会保存到后端，刷新页面后仍然保持
- 图标为列表+向上箭头，表示这是一个持久化操作

### 109.1.10 任务卡片日期指示器

看板中的每张任务卡片会显示日期信息（如已设置）：

- **头部**：日历图标 + `plannedStart ~ plannedEnd` 计划日期范围。当年份与当前年一致时自动省略年份，减少视觉噪音。
- **脚部**：时钟图标 + `dueDate` 截止日期，紧邻相对创建时间显示。
- **逾期高亮**：当任务未处于终端状态（Done / Cancelled）且截止日期已过时，`dueDate` 以红色高亮显示（`text-red-600 dark:text-red-400 font-semibold`）。

### 109.1.11 打开任务详情

点击看板中的任意任务卡片，即可打开任务详情模态框：

- 底层看板页面保持可见，地址栏自动更新为 `/task/:id/:title`
- 支持依赖项钻取导航：在任务详情中点击依赖标签可进一步查看子任务
- 任务详情中包含 **Comments** 区域，可查看和追加评论（编辑模式下）
- 验收标准（AC）列表项会显示序号编号（`#1`、`#2` …），便于引用与沟通
- 关闭模态框后回到原来的看板视图，保留当前的标签筛选和列排序状态
- 直接访问 `/task/:id` 链接时，系统会以看板为背景打开对应任务

> 看板中的任务卡片本身不支持拖放与点击同时触发；开始拖拽后松开即完成状态变更，不会误打开任务详情。

#### 109.1.11.1 任务详情键盘快捷键

打开任务详情后，以下快捷键可快速操作：

| 按键 | 操作 |
|------|------|
| `e` / `E` | 进入编辑模式 |
| `c` | 变更状态 |
| `d` | 删除任务 |
| `p` | 打印 |
| `Escape` | 关闭模态框 / 取消编辑 |
| `Cmd/Ctrl + S` | 保存修改 |

当焦点在 `input`、`textarea`、`select` 或 `contenteditable` 等可编辑元素内时，预览态快捷键（`e`/`E`/`c`/`d`/`p`）会被抑制，不会拦截正常的文字输入。编辑态的 `Escape` 和 `Cmd/Ctrl + S` 在可编辑目标内仍然生效。

### 109.1.12 实时更新

看板视图支持多人协作场景下的实时同步：

- 其他用户在 Web 界面中拖放任务，你的页面会自动更新卡片位置
- 外部编辑器修改任务文件后，看板列中的卡片内容和状态会自动刷新
- 新建或删除任务后，看板会即时反映变化，无需手动刷新
- 里程碑、文档、决策与 Wiki 的变更同样通过 WebSocket 按类型广播，对应列表原地增量刷新（BACK-698/700）

刷新采用**原地调和**（reconcile）策略：未变化的数据保持原对象引用，已打开的页面、滚动位置与筛选状态不受广播影响；仅在首次加载、配置变更或增量刷新失败时才回退为整页重载。

## 109.2 任务列表

「所有任务」页面以表格形式展示项目中的全部任务，支持多维度筛选和搜索，适合快速定位和管理大量任务。

页面采用全宽布局，不会出现**文档级横向滚动条**：表格在自身容器内滚动，只有「标题」列是弹性列，其余列宽固定（BACK-613）。筛选控件在真正放得下时保持一行；「清除筛选」只在确有激活筛选时渲染，不占用隐形空间。滚动条使用与主题匹配的细样式，亮色与暗色模式下都保持低调。

### 109.2.1 进入任务列表页面

启动 Web 界面后，点击顶部导航栏的「所有任务」标签，进入任务列表页面。页面以表格布局展示任务 ID、标题、状态、优先级、负责人、标签和关联里程碑等关键信息。

### 109.2.2 使用筛选器

表格上方提供一组筛选控件，可叠加使用以精确查找任务。

#### 109.2.2.1 按状态筛选

点击「状态」下拉框，勾选需要查看的状态。支持同时选择多个状态，例如同时勾选 **Todo** 和 **In Progress**，表格将展示待办和进行中的全部任务。

点击「清除」或取消所有勾选，恢复显示所有状态的任务。

#### 109.2.2.2 按状态排除

「状态」筛选旁还提供一个**排除状态**下拉框（StatusExcludedDropdown），用于反向过滤：勾选的状态对应的任务将被隐藏。例如勾选 **Done** 后，表格只展示未完成的任务。包含与排除两个下拉可以叠加使用，筛选状态会同步到地址栏 URL 查询参数，方便分享。

#### 109.2.2.3 按优先级筛选

点击「优先级」下拉框，选择 **High**、**Medium** 或 **Low**。优先级筛选为单选模式，切换后将只展示对应优先级的任务。

#### 109.2.2.4 按标签筛选

点击「标签」下拉框，勾选目标标签。支持多选，任务只需包含任一选中标签即可匹配显示。

标签下拉按**字典序**（不区分大小写）排列，方便快速浏览定位；大小写混合与重音、全半角 Unicode 等价字符均能稳定排序。

#### 109.2.2.5 按里程碑筛选

点击「里程碑」下拉框，选择特定里程碑，表格将只展示归属于该里程碑的任务。选择「无里程碑」可筛选出未分配里程碑的任务。

#### 109.2.2.6 显示已完成任务

筛选栏还提供「显示已完成」复选框：勾选后 `backlog/completed/` 中的历史任务与活跃任务一并展示（带 Completed 徽章），状态同步到 URL，点击打开只读弹窗。详见 [看板视图](01-看板视图.md) 的同名小节。

#### 109.2.2.7 验收标准进度条

状态为 **In Progress** 且含验收标准的任务，标题列会显示固定宽度的圆角进度条与 `已勾选/总数` 分数（BACK-645），每行占位一致；无验收标准的任务不显示。

### 109.2.3 全局搜索

任务列表顶部的搜索框是一个触发按钮（显示「搜索 (⌘K)…」）。点击它，或按 **Ctrl+K** / **Cmd+K**，会打开全局搜索对话框，在其中检索任务、文档、决策与 Wiki 页面。

对话框的完整说明（类型过滤、分组结果、键盘操作、分享链接、位置记忆）见 [全局搜索](10-全局搜索.md)。

- 搜索支持中文和英文，关键词在结果的标题与资源 ID 中高亮
- 对话框始终是全局范围，不与列表页的筛选条件叠加；要按状态、优先级、标签或里程碑缩小任务范围，请使用页面上的筛选下拉框
- 侧边栏与列表页不再提供内联搜索结果下拉

### 109.2.4 进入任务详情

在表格中找到目标任务，点击该行任意位置（通常为任务标题或 ID），即可打开任务详情模态框。

#### 109.2.4.1 模态框与背景页面

任务详情以**模态框（Modal）**形式展示在屏幕中央，底层页面（任务列表）保持可见：

- 模态框覆盖在当前页面上方，背景页面略微变暗但仍可辨识
- 关闭模态框后自动回到原来的任务列表页面，不会丢失当前的筛选和排序状态
- 直接访问 `/task/:id` 链接（如 `/task/506`）时，系统会以任务列表为背景打开对应任务模态框

#### 109.2.4.2 稳定 URL 与分享

打开任务详情时，地址栏会自动更新为 `/task/:id/:title` 格式：

```
http://localhost:6420/task/506/Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion
```

- URL 支持前缀无关匹配：`/task/506` 和 `/task/BACK-506` 都能正确打开同一任务
- 裸 `/task/:id` 链接会自动重定向到带标题 slug 的完整 URL
- 你可以直接复制地址栏链接分享给团队成员，对方打开后将以默认视图（看板）为背景显示该任务详情

#### 109.2.4.3 依赖项钻取

在任务详情的 **Dependencies** 区域，每个依赖任务以蓝色标签展示。点击标签即可**钻取进入**该依赖任务，无需返回列表重新查找：

- 钻取后模态框标题栏左侧出现 **← 返回** 按钮，点击回到上一层任务
- 支持连续钻取多层依赖关系（如 A → B → C）
- 浏览器的前进/后退按钮也能正确遍历钻取历史
- 点击右上角 **×** 关闭按钮与浏览器后退等价：**每次关闭退一层**。从列表直接打开的任务点一次 × 即回到列表；已钻取到子任务时，点 × 先回到上一层父任务，回到最外层后再点一次才关闭模态框
- 返回箭头 **←** 与 × 的行为一致，都只消费一层历史

> 钻取导航仅在预览模式下可用，新建或编辑任务模式下点击依赖标签无效。

#### 109.2.4.4 父子任务层级

若当前任务有父任务或子任务，模态框标题下方会出现层级区块：

- **PARENT 行**：显示父任务的 ID、标题与状态标签；点击该行直接在模态框内打开父任务
- **SUBTASKS 区**：显示子任务完成计数（如 `1/6`）、进度条与折叠箭头；点击区块标题行即可展开或折叠
  - 每条子任务显示完成指示圆点、ID、标题、状态标签与钻取箭头，点击即在模态框内打开该子任务

既没有父任务也没有子任务的任务不会显示该区块，模态框外观与以往完全一致。

#### 109.2.4.5 验收标准编号

任务详情中的验收标准（AC）列表项会显示序号编号（`#1`、`#2` …），便于在讨论或命令行中引用具体条目。

#### 109.2.4.6 依赖关系图切换

任务详情模态框的 **Dependencies** 区域标题右侧有一个关系图按钮，点击后将模态框正文切换为以当前任务为中心的可交互依赖子图（缩放、拖拽、图例过滤、节点钻取），每个任务的视图状态独立记忆。详见 [图谱视图](11-图谱视图.md)。

模态框还会按跳数列出「等待谁 / 被谁等待」的依赖闭包，标注根阻塞任务与无法解析的引用；被拒绝的依赖编辑（如构成循环）会回滚并显示原因。

#### 109.2.4.7 引用与修改文件标签页

模态框中的 **References**（引用）与 **Modified Files**（修改文件）合并为一个标签页面板（BACK-666），标签标题附带条目计数（如 `References(5)`）：

- 默认标签随任务状态选择：已完成任务默认落在 Modified Files，其余任务默认 References；点击切换仅对当前任务生效
- 修改文件以等宽路径 chip 展示，点击可在文件预览中打开；只允许项目相对路径，URL 形式的输入会被拒绝
- 两个列表都支持在编辑模式下增删，保存后写入任务文件

#### 109.2.4.8 日期的 UTC 悬停提示

界面中的日期时间以本地时区显示；将鼠标悬停在带时间的日期上，提示框会显示 Markdown 文件中存储的原始字符串并标注 `(UTC)`（BACK-673）。纯日期值（`YYYY-MM-DD`）不带悬停提示。该规则覆盖任务详情、任务列表、看板卡片、里程碑、草稿与统计页面。

#### 109.2.4.9 已完成任务的只读弹窗

从「显示已完成」或搜索结果打开的已完成任务，弹窗为**只读**（BACK-663）：不显示编辑、状态变更等操作按钮，标题栏下方显示只读提示横幅；跨分支任务的只读行为与此一致。

#### 109.2.4.10 实体 ID 自动链接

任务描述、备注、评论等 Markdown 正文中写出的**任务 / 文档 / 决策 ID**（如 `BACK-506`、`doc-5`、`decision-3`）在渲染时会自动转为可点击链接，点击后按对应的导航方式打开（BACK-614）：

- 解析采用 fail-closed：无法唯一解析的 ID **原样显示为纯文本**，不会猜测目标
- 前缀无关匹配：`506` 与 `BACK-506` 指向同一任务
- 在 Web 编辑器的输入框里输入裸数字时会按上下文自动补全前缀，并提供插入链接的提示
- 三种实体共用同一套规范化身份键，渲染端与输入端行为一致

#### 109.2.4.11 未保存编辑保留

在编辑任务时，如果任务文件在后台被其他进程修改（如他人编辑、外部编辑器保存），模态框**不会重置你未保存的输入**——系统只合并刷新后未触碰的字段，你在标题、描述、计划、备注、日期、AC、DoD、引用和文档上未保存的改动都会保留。

#### 109.2.4.12 评论

在任务详情的 **Comments** 区域，你可以查看该任务的所有评论：

- **评论列表**：以只读形式展示，包含序号、作者（如有）、时间戳和 Markdown 渲染后的正文
- **输入表单**：只要任务可编辑（**包括预览模式**），区域底部就会显示评论输入表单，无需先进入编辑模式（BACK-617）
  - **Author** 输入框（占位提示「评论人」）：可选，填写评论作者名称
  - **Add a comment...** 文本框：使用富 Markdown 编辑器（BACK-631），带工具栏、粘贴转 Markdown、图片 / Word 文档拖入上传与 `[[` 实体链接自动补全；粘贴的图片在保存时自动从临时目录提升到 `assets/paste/`（单独一行的 `---` 仍被保留为分隔符，不能作为评论内容）
  - **Add comment** 按钮：提交后评论列表立即刷新，并**保持当前模式**——在预览模式添加评论不会把模态框切换成编辑模式
- **删除评论**：鼠标悬停在某条评论上时出现删除按钮；Comments 区域标题栏另有 **Clear comments** 按钮一次性清空全部评论（BACK-623）。命令行对应 `--remove-comment <序号>` 与 `--clear-comments`
- **跨分支的只读任务**显示评论列表，但不提供输入表单与删除操作
- 评论正文支持 Markdown，但单独的 `---` 行不能出现在评论中（保留为分隔符）

### 109.2.5 表格排序

任务列表的所有表头列（ID、标题、状态、优先级、里程碑、创建时间）均支持点击排序。

#### 109.2.5.1 默认序号排序

列表**默认按任务序号（ordinal）排序**，与看板一致，无需显式操作。当没有任何列处于激活排序状态时，表格恢复为序号排序模式。

#### 109.2.5.2 三击循环

点击任意表头列，排序按**三击循环**切换：

1. **第一次点击**：按该列升序排列
2. **第二次点击**：切换为降序
3. **第三次点击**：清除该列的排序，恢复默认序号排序

#### 109.2.5.3 双箭头排序图标

每列表头右侧显示一组双箭头图标：

- **未激活**：`↑` 和 `↓` 两支箭头均为淡灰色
- **升序激活**：左侧 `↑` 高亮显示，右侧 `↓` 保持灰色
- **降序激活**：右侧 `↓` 高亮显示，左侧 `↑` 保持灰色

> 三种状态的外框宽度完全一致，切换排序方向时表头文字不会产生抖动。

## 109.3 里程碑管理

里程碑用于将任务分组到阶段性目标中，便于追踪项目整体进度。Web 界面提供完整的里程碑列表、详情查看和任务分配功能。

### 109.3.1 进入里程碑页面

启动 Web 界面后，点击顶部导航栏的「里程碑」标签，进入里程碑管理页面。页面分为左右两栏：左侧为里程碑列表，右侧为选中里程碑的详情视图。

### 109.3.2 查看里程碑列表

左侧列表展示项目中所有活跃的里程碑，每个条目显示里程碑名称、描述摘要和完成进度。点击列表中的任意里程碑，右侧详情区将加载该里程碑的完整信息。

### 109.3.3 查看里程碑详情

点击里程碑卡片的标题（卡片上的按钮为「详情」）会打开里程碑详情模态框，地址栏同步为 `/milestone/:id`，因此链接可直接分享或在刷新后重新打开（与任务详情相同的 modal-over-route 模式，底层页面保持可见）。

详情视图包含：

- 名称与描述（Markdown 渲染，包含 Mermaid 图表；无描述时显示占位提示）
- 顶部信息框显示「创建于 / 更新于」（仅在存在对应时间戳时显示）
- 五个日期字段：`dueDate`、`plannedStart`、`plannedEnd`、`actualStart`、`actualEnd`
- 关联文档（Documentation）卡片：以链接列表展示，可逐条移除
- 归属该里程碑的完整任务列表（支持表头排序）
- 完成进度与各状态任务数量

点击任务列表中的任意任务标题，可跳转到对应任务详情。

### 109.3.4 编辑里程碑

在详情视图的标题栏点击「编辑」按钮进入编辑模式，Add/Edit 与任务模态框共用同一套表单组件：

- **描述**：`PasteAwareMDEditor` 富文本 Markdown 编辑器，支持从 Word/Google Docs/网页粘贴转换、`doc` 上传与剪贴板贴图（保存前调用 promote 接口写入 `paste/`）
- **文档卡片**：预览与编辑模式下都可添加或移除关联文档，添加输入框支持路径自动补全
- **日期字段**：五个日期在预览与编辑模式下均可**行内直接修改**（`date` 与 `datetime-local` 输入，自动完成 UTC ↔ 本地时区转换）
- **脏数据保护**：描述有未保存改动时，按 Esc / Cancel / × 会弹出确认；描述中的链接点击也会被拦截，避免误离开丢失编辑
- **快捷键**：`Ctrl/Cmd+S` 保存
- 保存后 Markdown 文件同步更新，对应任务文件的里程碑字段也会同步

> 里程碑卡片上会直接显示日期信息与「最近更新」（如有），便于在列表中快速识别时间节点。

#### 109.3.4.1 归档与移除的确认对话框

「归档」与「移除」都使用样式化确认弹窗（不再使用浏览器原生 `window.confirm`），文案明确说明对文件的影响（BACK-622）：

- **归档（Archive）**：里程碑文件移入归档目录；**任务文件不会被修改**，任务保留对该里程碑的引用
- **移除（Remove）**：里程碑文件同样移入归档目录，并按下述选项处理任务文件
  - **清空任务的里程碑字段**（默认选项，即把任务上的里程碑字段置空，任务本身不变）
  - 保留任务上的引用，或改挂到另一个活跃里程碑

两个对话框的标题即为操作名（不再重复询问里程碑名称），移除对话框中的选项标签用词也已从「保持任务未分配」改为「清空任务的里程碑字段」——因为该操作实际执行的是清空任务文件里的里程碑字段，而"未分配"只是界面上的分组名。

### 109.3.5 未分配任务池

在里程碑列表上方或详情区附近，找到「未分配任务」区域。该区域展示当前未归属任何里程碑的任务列表，相当于任务分配前的暂存池。

浏览未分配任务，找到需要归类的目标条目。

### 109.3.6 拖放分配任务到里程碑

在未分配任务池中，按住目标任务卡片并拖动，移动到左侧目标里程碑的名称区域后松开，任务即被分配到该里程碑。

分配成功后：

- 目标任务从未分配池消失
- 目标里程碑的任务计数自动更新
- 对应 Markdown 文件中的里程碑字段同步修改

> 支持在同一里程碑详情页内调整任务顺序，拖放任务卡片到目标位置即可。

### 109.3.7 分组内排序

每个里程碑分组（包括「未分配任务」和各个里程碑）都配有独立的排序表头：

- **ID**：按任务 ID 数字升序/降序排列
- **标题**：按任务标题字母顺序排列
- **状态**：按状态名称排列
- **优先级**：按优先级（高 → 中 → 低）排列
- **创建时间（Created）**：按任务创建日期升序/降序排列

**默认排序**：每张里程碑卡片内的任务表默认按序号（ordinal）排序，与「所有任务」页对齐。

**三击循环**：点击任意表头列按三击循环切换——第一次升序、第二次降序、第三次清除该列排序并恢复默认序号排序。

点击表头列即可按该列排序，再次点击切换方向。各分组的排序状态完全独立，在一个里程碑中选择「按优先级排序」不会影响其他里程碑的显示顺序。

排序图标采用与任务列表相同的双箭头设计：左侧 `↑` 表示升序，右侧 `↓` 表示降序，激活方向高亮显示。里程碑卡片本身（各分组之间的排列顺序）保持不变。

### 109.3.8 已完成的里程碑

页面底部设有「已完成的里程碑」折叠区。点击折叠标题，可展开查看历史已完成或已归档的里程碑。已完成的里程碑通常不再接受新任务分配，但可点击查看历史记录。

### 109.3.9 搜索里程碑

在里程碑列表上方提供搜索框，输入关键词后，系统将以模糊匹配方式筛选里程碑名称和描述。搜索结果实时反映在列表中，方便在里程碑数量较多时快速定位目标。

清空搜索框后，列表恢复显示全部里程碑。

## 109.4 文档与决策

Web 界面提供文档列表和决策记录的浏览功能，支持按子文件夹分组查看，方便在浏览器中阅读项目知识库内容。

### 109.4.1 进入文档页面

启动 Web 界面后，点击顶部导航栏的「文档」标签，进入文档列表页面。页面以分组形式展示 `backlog/docs/` 目录下的全部 Markdown 文档。

### 109.4.2 浏览文档列表

文档列表按子文件夹自动分组展示。例如：

- **guides** — 存放指南类文档
- **api** — 存放接口文档
- **(根目录)** — 直接存放在 `docs/` 下的文档

点击分组标题可展开或折叠该文件夹下的文档条目。每个文档条目显示标题、最后更新时间摘要和标签（如有）。

#### 109.4.2.1 侧边栏排序开关

侧边栏的文档区标题栏提供**名称 / ID 两个排序开关**（BACK-667），点击切换排序列与升降序（列名旁显示 `↑` / `↓`）：

- **名称**：按文档标题排序（无标题时回退文件名），数字感知（`doc-4` 排在 `doc-10` 前）
- **ID**：按文档 ID 排序，名称作为平局决胜
- 每个文件夹层级独立排序，文件夹始终排在文件之前

决策区同样提供**标题 / ID 排序开关**（BACK-674），决策为平铺列表、不涉及文件夹。三个侧边栏分区（文档、Wiki、决策）共用同一控件样式。

### 109.4.3 查看文档内容

在列表中点击目标文档标题，页面跳转至文档详情页。文档内容以渲染后的 Markdown 格式展示，包括：

- 标题与正文
- 代码块与高亮
- 表格与列表
- 图片与链接

点击页面顶部的「返回」按钮或浏览器后退键，可回到文档列表页面。

#### 109.4.3.1 文档内锚点跳转

文档正文中的标题链接（`[链接](#章节名)` 形式）会在**当前文档上下文内**平滑滚动跳转，并同步更新地址栏锚点，而不会跳到应用根页面。标题 ID 由统一的 slug 算法生成，人类可读的 TOC 锚点（如 `#A1`、`#A1: Section Title`）仍能被正确解析定位。对于超链接到本地短链接的文档，还支持附加 `:行号` 或 `:起始-结束` 行区间后缀，点击后按指定行范围在预览框中展示内容。

带锚点的链接（如 `/documentation/5#A2`）在**首次加载**时也会自动滚动到目标标题（BACK-637）：内容异步渲染完成后由观察器定位标题，地址栏中的锚点在 URL 规范化（裸 ID 补齐标题 slug）过程中不会丢失。

#### 109.4.3.2 页面目录（TOC）

文档、决策与 Wiki 详情页的头部提供**目录按钮**（BACK-638）：点击展开当前页面的标题大纲，条目层级来自实际渲染的标题（含重复标题与 CJK 标题）：

- 点击条目即平滑滚动到对应章节；滚动页面时当前章节在目录中高亮（scrollspy）
- 含子树的条目可折叠；条目较多时深层级默认折叠，当前所在分支自动展开
- 面板头部提供「全部折叠 / 全部展开」总开关
- 页面没有标题（或处于编辑模式）时目录按钮不出现

#### 109.4.3.3 内容变更静默重载

文档在磁盘上被外部修改时，已打开的文档页会按**内容指纹**比对后静默重载（BACK-639）：只有内容确实变化才更新正文，且保持滚动位置与锚点不丢失；编辑模式下不会重载，未保存的输入不受影响。

#### 109.4.3.4 Mermaid 图表

文档、决策与 Wiki 正文中的 ` ```mermaid ` 代码块会渲染为图表（BACK-640）：围栏语言标识不区分大小写；图表主题跟随界面亮 / 暗模式自动切换；Markdown 编辑器的预览窗格同样渲染 Mermaid。

### 109.4.4 进入决策记录页面

在顶部导航栏中点击「决策」标签，进入决策记录（ADR）列表页面。页面展示 `backlog/decisions/` 目录下的全部决策文件。

每条决策记录显示：

- 决策标题
- 当前状态（Proposed、Accepted、Rejected、Deprecated、Superseded）
- 创建日期

### 109.4.5 查看决策详情

点击决策列表中的任意条目，进入决策详情页。页面渲染展示完整的 ADR 内容，包括决策背景、考量因素、最终决定和后续影响等章节。

决策的状态标签以颜色区分，且状态名称**随界面语言本地化**（如中文界面显示「已接受」）；非标准状态原样显示（BACK-636）。每个状态还带独立图标，颜色不是唯一辨识信号。

#### 109.4.5.1 新建决策

侧边栏决策区的「+」按钮打开新建决策页（BACK-634）：输入标题与正文（可粘贴图片，保存时自动提升到 `assets/paste/`），保存后跳转到新决策页面；正文留空时使用默认的「背景 / 决策 / 后果」模板。

#### 109.4.5.2 编辑决策

决策详情页右上角提供 **Edit** 按钮（BACK-633）：点击进入编辑模式，出现 Cancel / Save 按钮对；编辑过程中列表刷新不会打断或覆盖你的输入；`?edit=true` 深链接可直接以编辑模式打开。

编辑模式下可在头部直接修改**状态**（BACK-635）：下拉框列出 proposed / accepted / rejected / superseded 等标准状态（本地化显示，存储值保持原始英文），也可保留数据中已有的自由状态。只改状态不重写正文。

## 109.5 设置与主题

设置页面集中管理 Backlog.md 的配置项、Definition of Done 默认值和 Web 界面主题偏好。任务编辑器也在设置相关区域中提供丰富的编辑能力。

### 109.5.1 进入设置页面

启动 Web 界面后，点击顶部导航栏的「设置」标签，进入设置页面。页面分为多个配置区块，从上到下依次排列。

### 109.5.2 查看与修改配置项

在「配置」区块中，可查看并编辑当前生效的各项参数，包括：

- **默认负责人（`defaultAssignee`）**：列表型设置，创建任务/草稿未显式指定负责人时自动应用
- **标签（`labels`）**：项目预定义标签列表的编辑器
- **默认编辑器（`defaultEditor`）**：清空该字段即可取消默认编辑器（服务默认的 `code --wait` 会挂住无人值守的代理进程）
- **Web 服务器端口**：`defaultPort` 与自动端口开关（端口被占用时自动改用后续可用端口）
- **隐藏空状态列（`hideEmptyColumns`）**：开启后看板隐藏无任务的状态列，减少视觉杂乱；拖拽任务期间所有状态列保持可见以便放置
- **自动打开浏览器（`autoOpenBrowser`）**
- Git 相关选项（详见[配置管理](../60-配置与运维/00-配置管理.md)）

点击需要修改的配置项，在输入框中输入新值，修改完成后点击「保存」按钮。配置变更会立即写回项目配置文件，部分设置（如端口）在重启 `backlog browser` 后生效。

列表型设置（默认负责人、标签）以**列表编辑器**呈现：可逐项添加或删除条目，保存时写回配置文件的 YAML 列表。这些设置与 `backlog config set` 修改的是同一份配置，两个入口互相可见。

**默认负责人**在创建任务时生效：不指定负责人则套用默认值；显式指定会完全替换默认值（不合并）；在创建表单中清空负责人 chips 则保存为空，不会回落默认值。

### 109.5.3 编辑 Definition of Done 默认值

在「Definition of Done」区块中，可查看和编辑新建任务时自动附加的默认完成标准清单。

点击文本编辑区，输入或修改 DoD 条目，每行一条。保存后，后续通过 Web 界面或 CLI 创建的新任务将自动携带更新后的默认 DoD 列表。

### 109.5.4 自定义 Web UI 主题

在「主题」区块中，可切换界面外观：

- **跟随系统** — 自动匹配操作系统的亮色或暗色模式设置
- **亮色模式** — 强制使用浅色背景主题
- **暗色模式** — 强制使用深色背景主题

切换后，整个 Web 界面的配色方案即时生效，无需刷新页面。偏好设置会保存在浏览器本地，下次访问时自动恢复。

### 109.5.5 语言切换

在「项目设置」区块的「语言」下拉框中，可选择 Web 界面的显示语言：

- **English** — 英语
- **日本語** — 日语
- **简体中文** — 简体中文
- **繁體中文** — 繁体中文

选择语言后，界面文字会立即切换，无需刷新页面。语言偏好与项目配置一同保存到 `backlog/config.yml`（或项目根配置）的 `locale` 字段中，下次启动 Web 界面时自动恢复。

> 语言设置需要通过「保存更改」按钮写入配置文件后才会持久化。在保存前切换语言，页面会即时预览新语言，但刷新后会恢复为上次保存的设置。

### 109.5.6 使用任务编辑器

在 Web 界面中点击任意任务，即可进入任务编辑器页面。编辑器提供丰富的富表单和 Markdown 编辑能力。

#### 109.5.6.1 富文本 Markdown 编辑器

任务描述区域使用 MDEditor 富文本编辑器。在编辑区中可直接输入 Markdown 语法，编辑器提供实时预览和常用格式快捷按钮：

- 标题层级
- 粗体、斜体、删除线
- 无序列表与有序列表
- 代码块与引用块
- 链接与表格

#### 109.5.6.2 验收标准交互式勾选列表

在任务编辑器中找到「验收标准」区域。每条验收标准左侧带有复选框，点击即可标记为已完成或未完成。勾选状态会自动同步保存到 Markdown 文件的对应章节。

若手动修改 Markdown 源文件中的验收标准格式，编辑器会在加载时自动修复和同步列表结构，确保复选框正常显示。

#### 109.5.6.3 任务内容目录

对于内容较长的任务，编辑器右侧显示「目录」（TOC）面板。目录自动提取任务正文中的各级标题，点击任意标题即可快速滚动到对应位置。滚动页面时，目录会高亮当前所在章节。

#### 109.5.6.4 富表单字段

编辑器顶部提供一组结构化表单字段，点击即可修改：

- **状态** — 下拉选择 Todo、In Progress、Done 等
- **优先级** — 选择 High、Medium、Low
- **标签** — 输入标签名称，支持多标签
- **里程碑** — 下拉选择已有里程碑或留空
- **负责人** — 输入负责人名称
- **依赖** — 添加依赖的其他任务 ID
- **引用** — 添加引用任务或外部链接

修改任意字段后，点击页面底部的「保存」按钮，变更将写回到 Markdown 文件。

### 109.5.7 Mermaid 图表自动渲染

若任务正文中包含 Mermaid 语法代码块，Web 界面会自动将其渲染为可视化图表，包括流程图、时序图、甘特图等。无需额外操作，保存任务后图表即时呈现。

### 109.5.8 图片与附件查看

任务中引用的图片（如 `![描述](assets/xxx.png)`）会在编辑器中直接显示预览图。点击预览图可在新标签页中查看原图。

项目 `backlog/assets/` 目录下的文件会自动通过 Web 服务器提供访问，确保所有附件和截图在 Web 界面中正常加载。

## 109.6 富文本粘贴与文档上传

Backlog.md 的 Web 界面编辑器支持将外部富文本内容一键转换为 Markdown，包括从 Word、Google Docs、网页直接粘贴，以及上传 `.docx` 文件。同时支持截图粘贴，自动上传图片并嵌入任务正文。

### 109.6.1 粘贴为 Markdown

在任务编辑器的 Markdown 编辑区域中，直接从外部来源复制并粘贴内容，编辑器会自动识别富文本 HTML 并将其转换为干净的 Markdown。

#### 109.6.1.1 支持来源

| 来源 | 转换内容 |
|------|---------|
| Microsoft Word | 段落、标题、列表、表格、粗体/斜体/下划线 |
| Google Docs | 段落、标题、列表、表格、格式 |
| Excel | 表格（含表头识别） |
| 网页 | HTML 结构、链接、列表、表格 |
| 截图 | `image/png` 图片，自动上传 |

#### 109.6.1.2 粘贴流程

1. 在外部应用中选中内容并复制
2. 在 Backlog.md 编辑器中按 `Ctrl+V`（或 `Cmd+V`）
3. 编辑器自动读取剪贴板中的 `text/html`
4. 清理 Word/Excel 特定标记（噪声标签、内联样式、mso-list 等）
5. 如有图片，提取并上传至临时目录
6. Turndown 将清理后的 HTML 转为 Markdown
7. 转换结果插入编辑器光标位置

如果剪贴板中不含 HTML（纯文本），编辑器会回退到原生粘贴行为，不做额外处理。

### 109.6.2 上传 Word 文档

除剪贴板粘贴外，编辑器还支持直接上传 `.docx` 文件。这对于包含大量图片或复杂格式的文档尤其有用。

#### 109.6.2.1 操作方式

在任务编辑器中：
- 点击编辑器工具栏的「上传 Word」按钮，选择本地 `.docx` 文件
- 或将 `.docx` 文件直接拖放到编辑器区域

#### 109.6.2.2 转换流程

1. 前端将 `.docx` 文件通过 `POST /api/docx/convert` 发送至后端
2. 后端使用 `mammoth` 库解析文档，提取文本内容为 HTML
3. 文档中的内嵌图片被提取并上传至 `backlog/assets/.temp/`
4. 后端返回原始 HTML、图片列表和转换警告
5. 前端使用与「粘贴为 Markdown」完全相同的 `cleanHtml` + Turndown 流水线将 HTML 转为 Markdown
6. 图片引用以 `/assets/.temp/{uuid}.png` 形式嵌入正文

#### 109.6.2.3 统一流水线保证一致性

Word 文档上传和富文本粘贴共享同一套前端转换逻辑，确保两者输出格式一致。复杂表格、列表嵌套等场景下，统一流水线避免了后端直接转换可能产生的格式差异。

### 109.6.3 图片处理

#### 109.6.3.1 截图粘贴

直接粘贴截图（如 QQ/微信/系统截图工具）时：
- 图片以 `image/png` blob 形式上传
- 保存至 `backlog/assets/.temp/{uuid}.png`
- 编辑器中显示预览图

#### 109.6.3.2 网页图片

粘贴来自网页的内容中包含 `<img>` 标签时：
- Data URI 图片：提取 base64 数据，上传至临时目录
- HTTP(S) URL 图片：后端安全下载后上传
- `file://` 本地路径：被拒绝（浏览器安全限制）

#### 109.6.3.3 保存时提升（Promote）

所有临时图片（包括粘贴截图和 Word 文档提取的图片）在保存任务时自动提升：

1. 前端扫描 Markdown 中的 `/assets/.temp/` 引用
2. 调用 `POST /api/assets/promote` 批量移动文件
3. 图片从 `.temp/` 迁移到 `paste/` 永久目录
4. 前端更新 Markdown 中的 URL 映射后执行保存

临时目录中的过期文件（超过 30 分钟）会在服务器启动时自动清理。

### 109.6.4 限制与注意事项

- **文件大小**：单文件超过 20MB 会返回错误提示
- **格式支持**：仅 `.docx` 格式支持文件上传，旧版 `.doc` 需先转换
- **损坏文档**：无法解析的文档会显示可读错误消息，不会崩溃
- **图片大小**：单张图片若超过大小限制，可能被跳过或导致整体失败（取决于策略配置）

## 109.7 Wiki 浏览与编辑

Backlog.md 的 Web 界面提供完整的 Wiki 模块，用于浏览和编辑 `backlog/wiki/` 目录下的知识库内容。Wiki 是 **LLM 维护的增量式知识库** — AI 代理读取 tasks/docs/decisions 等源文件，自动编译为结构化 wiki 内容；人类可读可编辑，也可直接创建和修改页面。

### 109.7.1 进入 Wiki

启动 Web 界面后，点击顶部导航栏的「Wiki」标签，进入 Wiki 页面。页面分为左右两部分：

- **左侧边栏**：可折叠的文件树，反映 `backlog/wiki/` 的目录结构
- **右侧内容区**：渲染后的 Markdown 内容

### 109.7.2 浏览文件树

侧边栏以树形结构展示 `backlog/wiki/` 的全部内容：

- 点击文件夹左侧的 Chevron 图标展开或折叠
- 文件夹名称右侧显示该目录下的 Markdown 文件数量（如 `concepts (3)`）
- 点击 `.md` 文件即可在右侧查看内容
- 空文件夹也会显示在树中，可展开查看其子内容

#### 109.7.2.1 排序开关

Wiki 区标题栏提供**标题 / 文件名两个排序开关**（BACK-672），点击切换排序列与升降序：

- **标题**：按页面 frontmatter 的 `title` 排序（无标题回退文件名），树的显示标签也随之变为标题
- **文件名**：按文件名（不含 `.md`）排序，标签同步显示文件名——即树总是显示当前排序所依据的字段
- 文件夹始终排在页面之前，每层独立排序，数字感知（`page-4` 先于 `page-10`）

#### 109.7.2.2 路径与 URL

Wiki 页面的 URL 保持目录层级的可读性，`/` 分隔符不会被编码为 `%2F`。例如位于 `concepts/web-ui-features.md` 的页面，地址栏显示为：

```
http://localhost:6420/wiki/concepts/web-ui-features
```

路径中的空格、中文等特殊字符会被安全编码，但目录层级始终直观可辨。你可以直接复制或修改地址栏中的路径来快速跳转目标页面。

### 109.7.3 查看页面内容

Wiki 页面以渲染后的 Markdown 格式展示：

- 从 frontmatter 中提取并显示页面标题
- 支持代码块语法高亮、Mermaid 图表、表格、列表
- **Labels 标签**：页面标题下方显示该页面的 labels 标签（如 `concept`、`source`）
- 点击正文中的 `[[wikilink]]` 可跳转到对应页面

### 109.7.4 在线编辑

点击页面右上角的「Edit」按钮进入编辑模式：

- **标题**：在顶部大输入框中修改页面标题，保存后自动写入 frontmatter
- **Labels**：标题下方的 ChipInput 支持添加/删除标签；按 Enter 或逗号添加，Backspace 删除最后一个
- **正文**：使用完整的 Markdown 编辑器（支持粘贴为 Markdown、图片上传、Word 文档转换）
- **保存**：只有内容、标题或 labels 发生变更时，Save 按钮才变为蓝色可用状态
- **取消**：点击 Cancel 放弃所有修改，恢复原始内容

保存后，页面 frontmatter 会自动更新 `updated_date` 字段。

#### 109.7.4.1 切换页面自动退出编辑

在编辑模式下，如果你点击侧边栏中的其他 Wiki 页面，系统会**自动退出编辑模式**，以只读视图显示新页面：

- 未保存的编辑内容会被静默丢弃
- 编辑/查看切换按钮状态会同步更新为「查看」模式
- 避免新页面内容在编辑器中误显示，减少操作困惑

> 如需保存当前修改，请先点击 Save 再切换页面。

### 109.7.5 创建文件与文件夹

在侧边栏的任意位置创建新内容：

1. 将鼠标悬停在文件夹名称或 Wiki 根标题上
2. 右侧会出现 `+` 按钮，点击展开下拉菜单：
   - **Create file** — 创建新页面，输入文件名（自动补全 `.md`）
   - **Create folder** — 创建空文件夹
3. 创建成功后自动导航到新页面

根标题「Wiki」上的 `+` 按钮用于在 `backlog/wiki/` 根目录下创建内容。

### 109.7.6 重命名

在文件或文件夹的下拉菜单中选择 **Rename**：

- 输入新名称，支持跨目录移动（如 `concepts/new-name`）
- 如果当前正在查看该页面，重命名后会自动导航到新路径

### 109.7.7 实时同步

Wiki 内容在所有打开的标签页中实时同步：

- 通过 CLI 或外部编辑器修改 wiki 文件 → WebSocket 广播 → 所有浏览器标签自动刷新
- 在浏览器中编辑保存 → 其他标签页即时显示更新
- 文件树也会自动响应创建、修改、删除、重命名等操作

### 109.7.8 与文档的区别

| | 文档 (docs/) | Wiki (wiki/) |
|---|---|---|
| **维护者** | 人工编写 | 主要由 AI Skill 维护，人类可读可编辑 |
| **用途** | 项目指南、API 文档、参考手册 | 知识库：概念提取、来源摘要、交叉引用 |
| **编辑** | 创建后通过编辑器修改 | 浏览器中直接编辑，frontmatter 自动管理 |
| **结构** | 人工组织 | AI 维护标准目录（`sources/`、`concepts/`、`entities/`） |

## 109.8 统计页面

统计页面提供项目级任务数据概览，帮助快速掌握项目整体进度与需要关注的任务。

### 109.8.1 进入统计页面

启动 Web 界面后，点击顶部导航栏的「统计」标签，即可进入统计页面。

### 109.8.2 页面结构

统计页面分为四个主要区域：

#### 109.8.2.1 贡献热力图

页面最顶部展示 GitHub 风格的贡献热力图，直观呈现过去一年每天完成的任务数量。

- **网格布局**：7 行（周日到周六）× 53 列（周），与 GitHub 贡献图布局一致
- **颜色强度**：5 个级别，从浅到深表示当日完成任务数量
  - Level 0（无任务）：接近背景色的浅灰
  - Level 1（1~2 个任务）：浅绿
  - Level 2（3~5 个任务）：中绿
  - Level 3（6~9 个任务）：深绿
  - Level 4（10+ 个任务）：最深绿
- **暗色模式**：自动切换为暗色主题的绿色渐变色板
- **月份标签**：顶部显示缩写月份名，根据当前语言本地化
- **星期标签**：左侧显示周日、周二、周四的缩写（隔行显示以节省空间）

##### 109.8.2.1.1 交互

- **悬停**：鼠标悬停在任意格子上，显示浮动提示框，包含具体日期（`YYYY-MM-DD` 格式）和当日完成的任务数量
- **点击**：点击格子后提示框保持固定，直到点击页面其他区域或再次点击该格子
- **标题**：显示过去一年完成的任务总数，如「过去一年完成 143 个任务」，根据语言自动 pluralization

#### 109.8.2.2 状态概览

页面顶部展示项目基本统计：

- **总任务数**：项目中的任务总数
- **完成百分比**：Done 状态任务占比
- **草稿数**：当前草稿数量
- **各状态分布**：To Do / In Progress / Done 等每个状态的任务数量

#### 109.8.2.3 优先级分布

以可视化方式展示任务在各优先级上的分布情况：

- **High** — 高优先级任务数量
- **Medium** — 中优先级任务数量
- **Low** — 低优先级任务数量
- **None** — 未设置优先级的任务数量

#### 109.8.2.4 项目健康度

项目健康度区域是统计页面的核心，展示四类需要特别关注的任务：

| 分类 | 颜色 | 判定条件 |
|---|---|---|
| **临期（At Risk）** | 🟡 琥珀色 | 非 Done 任务，有截止日期，今天或明天截止 |
| **逾期（Overdue）** | 🔴 红色 | 非 Done 任务，截止日期已过 |
| **停滞（Stale）** | 🔵 蓝色 | 非 Done 任务，无截止日期，超过 30 天未更新 |
| **阻塞（Blocked）** | 🔴 红色 | 依赖未完成的任务 |

页面头部以彩色圆点 + 计数的形式水平展示四类健康指标。点击或悬停可查看各类别的具体任务列表。

##### 109.8.2.4.1 健康任务卡片

每个健康分类下方列出匹配的任务卡片：

- **临期 / 逾期卡片**：显示任务标题和**截止日期**（Due by）
- **停滞卡片**：显示任务标题和**更新日期**
- **阻塞卡片**：显示任务标题和**依赖状态**

所有卡片均可点击，点击后跳转至任务编辑页面。

##### 109.8.2.4.2 悬停提示

将鼠标悬停在健康指标圆点上，会显示该类别的中文说明：

- **临期**：「即将截止，需立即处理」
- **逾期**：「已过截止日期」
- **停滞**：「超过 30 天未更新、无明确截止日期」

#### 109.8.2.5 数据自动刷新

统计页面支持实时数据同步：

- **服务端缓存**：后端维护统计缓存，500ms 延迟刷新。当通过 CLI、`backlog` 命令或其他方式创建/修改任务时，统计页面会自动检测到变化并在约 1 秒内更新显示
- **客户端缓存**：页面使用 `localStorage` 缓存上次加载的统计结果，重新打开页面时先展示缓存数据，后台静默拉取最新数据，实现瞬时加载
- **WebSocket 推送**：服务端通过 `"statistics-updated"` 事件主动推送更新，无需手动刷新页面

### 109.8.3 最近活动

统计页面底部展示最近的项目动态：

- **最近创建**：最近 7 天内新建的任务列表
- **最近更新**：最近 7 天内修改过的任务列表

> 若任务从未被编辑过，其创建日期会作为「最近更新」的 fallback 显示，确保新建任务不会被遗漏。

## 109.9 甘特图视图

甘特图视图以时间线方式展示任务的起止时间和依赖关系，帮助你直观把握项目进度、识别关键路径和发现时间冲突。

### 109.9.1 进入甘特图视图

启动 Web 界面后，点击顶部导航栏的「甘特图」标签，即可进入甘特图视图。首次进入时，系统会自动解析所有任务的日期数据并渲染时间线。

### 109.9.2 页面布局

甘特图视图采用左右双栏布局：

- **左侧任务列表**：固定宽度的表格，展示任务 ID、标题、时间列和操作按钮
- **右侧时间线区域**：动态渲染的任务条和依赖箭头，顶部有时间轴刻度

左右两栏的滚动事件双向同步，上下滚动时始终保持对齐。

### 109.9.3 时间粒度切换

时间线顶部提供五级粒度切换按钮：

| 粒度 | 适用场景 | 特点 |
|---|---|---|
| **日** | 查看近期密集的开发任务安排 | 单天多任务水平错位显示，避免重叠 |
| **周** | 迭代进度回顾 | 适合 Sprint 或周会场景 |
| **月** | 月度项目回顾 | 平衡细节与全景 |
| **季度** | 中长期项目概览 | 大跨度时间窗口 |
| **年** | 年度项目大局 | 最宏观视角 |

切换粒度时，任务条的位置和宽度会自动重新计算，确保在当前尺度下清晰可见。

### 109.9.4 任务时间解析

甘特图不依赖任务必须填写计划日期。系统按以下规则自动解析每条任务的有效起止时间：

**开始时间**
1. 若任务填写了 `plannedStart` → 优先使用计划开始时间
2. 若无计划开始时间 → 使用任务创建日期（`createdDate` 的日期部分）

**结束时间**
1. 若任务填写了 `plannedEnd` → 优先使用计划结束时间
2. 若无计划结束时间但有 `updatedDate` → 使用更新日期的日期部分
3. 若仅有创建日期 → 启用最小宽度回退

> **提示**：想让任务在甘特图上显示精确的时间范围，请在任务编辑页面的「计划日期」字段填写 `plannedStart` 和 `plannedEnd`。

### 109.9.5 最小宽度回退

对于只有创建时间、没有计划日期的任务，系统会赋予一个最小视觉宽度，防止它们在时间线上压缩成不可见的细线：

- **日视图**：最小约 4 小时的视觉宽度，同天的多个任务会自动水平错位，避免完全重叠
- **周/月视图**：最小 1 天的宽度
- **季度/年视图**：固定 8 像素的色块宽度，确保在宏观视角下仍然可见

这些任务在左侧列表中以 `*` 标记，悬停时会提示「回退渲染」。

### 109.9.6 任务条交互

#### 109.9.6.1 悬停查看详情

将鼠标悬停在任意任务条上，会弹出提示框显示：

- 任务 ID 和标题
- 解析后的开始时间和结束时间
- 是否为回退渲染（仅有创建时间的任务）

#### 109.9.6.2 点击高亮依赖链

点击任务条后，该任务的整个依赖链会被高亮：

- **前驱任务**（该任务依赖谁）和**后继任务**（谁依赖该任务）保持正常亮度
- **其他无关任务和箭头**淡化至 30% 透明度
- 再次点击任务条或点击空白处取消高亮

这在复杂项目中快速定位上下游影响范围时非常有用。

#### 109.9.6.3 打开任务详情

- **点击左侧列表的「详情」按钮**：打开熟悉的任务编辑模态框，可修改任务字段、日期和依赖关系
- **点击右侧任务条**：高亮依赖链（如上所述）

### 109.9.7 依赖箭头

任务之间的依赖关系通过 SVG 贝塞尔曲线箭头可视化：

- 箭头从前驱任务的结束位置指向后继任务的开始位置
- 多个依赖自动错位，减少线条缠绕
- 箭头会随时间粒度切换自适应缩放
- 依赖箭头同样参与「点击高亮」交互

> **注意**：甘特图视图目前只展示依赖关系的可视化，不支持拖拽调整任务时间。修改任务日期请通过左侧「详情」按钮进入任务编辑页面。

### 109.9.8 列表排序

左侧任务列表的前四列（ID、标题、开始时间、结束时间）支持点击排序：

- 每列表头右侧显示双箭头图标（↑/↓）
- 未激活时为灰色，升序时左箭头高亮，降序时右箭头高亮
- 点击切换升序/降序，点击其他列则按新列排序
- 三种状态外框宽度一致，切换时不引起表头抖动

排序后，右侧甘特条会按新的任务顺序重新布局，但时间位置保持不变。

### 109.9.9 时间线平移

在时间线区域按住鼠标左右拖拽，即可平移时间轴查看更多日期：

- 向左拖拽查看更早的时间
- 向右拖拽查看更晚的时间
- 平移操作平滑流畅，无页面刷新

### 109.9.10 暗黑模式支持

甘特图视图完全适配暗黑模式：

- 任务条、时间轴刻度、依赖箭头均使用 Tailwind CSS `dark:` 变体
- 悬停提示框、高亮状态在暗色背景下依然清晰可辨
- 切换系统主题或手动切换后无需刷新页面

### 109.9.11 跟踪甘特图

跟踪甘特图在同一行上同时展示**计划时间范围**和**实际任务进度**，帮助你直观追踪偏差。

#### 109.9.11.1 双层渲染

每个任务行绘制两个独立定位的元素，z 轴叠加：

- **底层实际条**：状态色实心填充
  - In Progress → 蓝色
  - Done / Completed → 绿色
  - To Do → 灰色
  - Blocked → 红色
  - Cancelled → 浅灰色
- **上层计划边框**：60° 斜线填充框（两层边框：2px 阴影层 + 1px 最终线）

#### 109.9.11.2 偏差场景

| 偏差场景 | 条件 | 视觉表现 |
|---|---|---|
| **早开始** | actualStart < plannedStart | 实际条从计划框左侧提前开始；左侧溢出为纯色 |
| **正常** | actualStart = plannedStart，actualEnd ≤ plannedEnd | 实际条在框内延伸；重叠区颜色+斜线，未到达尾部纯斜线 |
| **延期** | actualEnd > plannedEnd | 实际条超出计划框右侧；右侧溢出为纯色 |

#### 109.9.11.3 左侧时间列

工具栏提供 `showPlanTime` 和 `showActualTime` 开关：

- **Actual Start / Actual End**：始终显示实际时间，按 `actualStart` → `actualEnd` → `createdDate`/`updatedDate` 优先级解析
- **Planned Start / Planned End**：计划时间列，仅在 `showPlanTime` 开启时显示

#### 109.9.11.4 智能依赖箭头

跟踪模式下，依赖箭头的连接点综合考虑实际时间与计划时间：

- 若实际开始早于计划开始，箭头连接到更早的实际位置
- 若实际结束早于计划开始（罕见），回退到计划结束以保持依赖链连贯
- 箭头颜色统一使用灰色，避免与状态色实际条冲突

#### 109.9.11.5 交互增强

- **悬停 Tooltip**：同时展示计划时间范围、实际时间范围和 fallback 指示器
- **图例**：工具栏显示图例说明 — 状态色条=实际、斜线框=计划、箭头=依赖、琥珀色 `*`=估计时间
- **点击高亮**：计划边框层一同参与高亮/淡化
- 默认排序 ID 降序，默认视图日视图
- 加载自动选中首个任务，切换视图自动滚动到选中任务

### 109.9.12 日期字段建议

为了让甘特图发挥最大价值，建议为关键任务填写计划日期：

| 字段 | 作用 | 填写建议 |
|---|---|---|
| `plannedStart` | 任务计划开始时间 | 任务预计启动日期 |
| `plannedEnd` | 任务计划结束时间 | 任务预计完成日期 |
| `dueDate` | 任务截止日期 | 与 `plannedEnd` 区分：截止日期是硬性约束，计划结束是预期完成时间 |
| `actualStart` | 实际开始时间 | 系统自动填充，可手动修正 |
| `actualEnd` | 实际结束时间 | 系统自动填充，可手动修正 |

在任务编辑页面的「计划日期」区域可直接填写这些字段。填写后，甘特图会自动使用更精确的时间范围，不再依赖创建日期的回退渲染。

## 109.10 全局搜索

Web 界面提供 macOS Spotlight 风格的居中搜索对话框，一次检索任务、草稿、文档、决策和 Wiki 页面。它取代了早期只能显示 5 条结果的侧边栏内联搜索。

### 109.10.1 打开与关闭

| 操作 | 方式 |
|---|---|
| 打开 | 按 **Ctrl+K**（Windows/Linux）或 **Cmd+K**（macOS）；或点击侧边栏顶部的搜索触发按钮 |
| 关闭 | 按 **Esc**、点击对话框右上角 **×**、点击对话框外的遮罩区域，或按浏览器后退 |

对话框弹出时，背后的页面保持原样并锁定滚动，关闭后回到原页面（筛选、排序等状态不丢失）。

> 侧边栏中的搜索框现在是一个只读的触发按钮，显示「搜索 (⌘K)…」，点击即打开对话框；输入与结果都迁移到了对话框中。

### 109.10.2 对话框布局

- 桌面端：水平居中、距顶部约 12vh、固定 800px 宽、最大高度 75vh，深色半透明遮罩
- 窄屏（宽度小于 640px）：自动铺满全屏，结果行改为固定两行（第一行标题，第二行 ID 与标签）

### 109.10.3 搜索类型

对话框顶部有一排类型标签，选择后立即按新范围重新搜索：

| 标签 | 范围 |
|---|---|
| 全部 | 任务、文档、决策、Wiki |
| 任务 | 仅任务（含草稿） |
| 文档 | 仅文档 |
| Wiki | 仅 Wiki 页面 |
| 决策 | 仅决策记录 |

输入框为空时不展示结果；输入后约 300 毫秒自动执行搜索。

#### 109.10.3.1 包含已完成任务

对话框提供「已完成语料」开关（BACK-662）：开启后搜索范围扩大到 `backlog/completed/` 目录中的历史任务，命中的已完成记录带 Completed 徽章，点击后以**只读弹窗**打开（不提供编辑操作）。默认关闭，默认结果与之前完全一致。

### 109.10.4 结果列表

结果按类型分组（任务 → 文档 → Wiki → 决策），每组有一个带数量与折叠箭头的表头：

- 点击表头（或聚焦后按 Enter / 空格）折叠或展开该组；折叠后该组不参与滚动定位
- 每一行显示：类型图标、资源 ID、标题、状态与优先级标签
- 输入的关键词在**标题与资源 ID**中均会高亮
- 结果数量不设上限；列表使用虚拟滚动，数千条结果也保持流畅

### 109.10.5 键盘操作

| 按键 | 行为 |
|---|---|
| ↑ / ↓ | 上下移动选中项 |
| Enter | 打开选中项 |
| Esc | 关闭对话框 |
| Ctrl+K / Cmd+K | 打开（已在对话框中时保持聚焦） |

### 109.10.6 打开结果的导航行为

- **任务**：以模态框形式覆盖在当前页面上方，关闭后回到搜索对话框，查询词、类型过滤与滚动位置均保留
- **文档 / 决策 / Wiki**：跳转到对应的整页视图，按浏览器后退即可回到搜索对话框

### 109.10.7 位置记忆

在结果列表中滚动后按 Enter 打开条目，再点击返回/后退回到对话框时，列表会恢复到原来的位置（内部记录的是「首个可见行」而非像素偏移，结果集变化时仍能稳定还原）。若位置已失效（例如结果变少），则回到列表顶部。

用 Esc、点击遮罩或 × 关闭对话框时**不会**记录位置——主动放弃搜索时不需要记住滚动。

### 109.10.8 分享与刷新

对话框的状态保存在地址栏中：

```
http://localhost:6420/search?q=timezone&type=task
```

- `q` 为关键词，省略表示未输入
- `type` 为类型过滤（`doc` 是 `document` 的简写），省略表示「全部」
- 刷新页面或把链接发给同事，都会以相同的查询、过滤与结果重新打开对话框

### 109.10.9 相关章节

- [任务列表](02-任务列表.md) — 列表页筛选与任务详情模态框
- [Wiki 浏览与编辑](07-Wiki浏览与编辑.md) — Wiki 页面阅读与编辑

## 109.11 图谱视图

图谱视图（Graph View）以 Neo4j 风格的力导向图展示项目中任务、草稿、里程碑之间的依赖与归属关系，以及 Wiki、文档、决策构成的知识网络。它由内置的依赖图谱服务驱动：该服务扫描 `backlog/` 下的 Markdown 文件构建图数据库，随文件变更自动增量更新，无需手工维护。

### 109.11.1 进入图谱页面

启动 Web 界面后，侧边栏「统计」下方提供两个图谱入口：

- **图谱**（`/graph`）：任务依赖图谱，节点为任务、已完成任务、草稿与里程碑
- **知识图谱**（`/knowledge`）：知识网络，节点为 Wiki 页面、文档、决策与标签（Tag）

直接访问 `/graph` 或 `/knowledge` 链接也能打开对应页面。

### 109.11.2 节点与边的视觉约定

- **节点形状与颜色**：按类别区分（任务 / 已完成 / 草稿 / 里程碑 / Wiki / 文档 / 决策 / 标签），节点半径反映连接度（连接越多越大）；标题以字幕板形式随缩放层级逐步披露
- **边的样式**：
  - **DependsOn**（依赖）：实线
  - **ParentOf**（父子）：虚线，箭头指向父任务
  - **BelongsToMilestone**（归属里程碑）：点线
  - 知识图谱中另有 **TaggedWith**（标签）、**SourcedFrom**（来源）、**LinksTo**（`[[wikilink]]` 引用）边
- **图例**：页面提供可点击的图例，点击某个节点类别可将其暂时隐藏（再次点击恢复），便于聚焦特定类型的节点

### 109.11.3 交互操作

| 操作 | 方式 |
|------|------|
| 缩放 / 平移 | 鼠标滚轮缩放，拖拽空白处平移 |
| 聚焦邻域 | 悬停或点击节点，其直接邻居保持高亮，其余节点淡出 |
| 打开详情 | 点击任务节点打开任务详情模态框（覆盖在图谱之上，关闭后回到图谱且视口保持不变）；点击知识节点在新标签页打开对应的 Wiki / 文档 / 决策页面 |
| 键盘操作 | 方向键平移，`Ctrl+]` / `Ctrl+[` 缩放，`Ctrl+0` 回到总览，`Esc` 清除选中 |

页面右上角提供缩放控制组（放大、缩小、总览）。图谱通过 WebSocket 接收 `graph-updated` 广播，任何文件变更都会在原视口中原地刷新，不会打断当前浏览位置。

### 109.11.4 任务详情中的关系图

任务详情模态框的 **Dependencies** 区域标题右侧有一个关系图切换按钮，点击后将模态框正文切换为以当前任务为中心的**关系子图**：

- 子图沿依赖、父子、里程碑边双向展开（有深度与节点数上限），节点点击可继续钻取到邻居任务
- 每个任务的图视图状态（缩放位置、图例过滤）独立记忆，钻取后返回时原样恢复
- 再次点击标题栏的 **← 返回** 箭头或按 `Esc` 退回任务详情正文

此外，模态框还会展示依赖闭包查询结果：「Waits for / Waited on by」（等待谁 / 被谁等待）按跳数分层列出，根阻塞任务高亮；无法解析或构成循环的引用也会如实标注。对依赖的内联编辑若被拒绝（例如会构成循环），界面会回滚修改并显示本地化原因。

### 109.11.5 图谱服务与缓存

图谱服务随 Web 服务器自动启动，首次构建期间 `/api/graph` 返回 `building` 状态，完成后图谱页面自动可用：

- **扫描范围**：仅 `backlog/` 下的 `tasks`、`drafts`、`milestones`、`completed`（任务图谱）与 `wiki`、`docs`、`decisions`（知识图谱）；归档目录不进入图谱
- **冷启动加速**：按文件指纹缓存校验，未变更的文件不重新解析；解析器或图结构版本升级会自动触发全量重建
- **热更新**：CLI / TUI / Web / MCP 的任何写入都会通过钩子通知图谱服务做增量同步，另有目录监听与定期 reconciliation 兜底
- **缓存位置**：图数据存放在操作系统缓存目录（而非项目树内），按项目路径哈希分槽存放，两个浏览器会话各自持有独立数据库互不争抢；可用环境变量 `BACKLOG_GRAPH_CACHE_DIR` 覆盖缓存目录
- **后端**：默认使用纯 JS 内存后端；可通过 `BACKLOG_GRAPH_BACKEND=kuzu` 选择原生 Kuzu 后端（目前仅在 Node 环境下可用，Bun 下无法加载原生绑定）
- **锁冲突**：同一项目的图谱槽位同一时刻只允许一个进程持有；持有方进程已退出时自动回收锁，持有方仍存活时在交互终端中询问是否接管

> 图谱只做可视化与查询，从不回写 Markdown 文件——所有数据仍以 `backlog/` 下的文件为唯一事实来源。

# 110 AI 集成

## 110.1 MCP 工作流

Backlog.md 通过 Model Context Protocol（MCP）与 AI 编码助手深度集成。MCP 是一种标准化协议，允许 AI 代理直接调用 Backlog.md 的功能工具，无需用户手动输入 CLI 命令。借助 MCP，AI 可以像人类开发者一样阅读、创建和管理任务，实现真正的协作式项目管理。

### 110.1.1 什么是 MCP 集成

传统方式下，AI 助手只能通过阅读指令文件了解 Backlog.md 的 CLI 命令，然后自行执行 shell 命令。这种方式存在两个问题：

- AI 需要解析 shell 输出，容易出错
- 命令执行失败时 AI 难以准确判断原因

MCP 集成彻底改变了这一模式。AI 代理通过标准化协议直接调用 Backlog.md 的工具函数，参数和返回值均为结构化数据，可靠性大幅提升。Backlog.md 的 MCP 服务器运行在本地，通过 stdio 传输与 AI 客户端通信，不暴露任何网络端口。

### 110.1.2 Spec-Driven 工作流

推荐采用 Spec-Driven 工作流与 AI 协作，将大需求拆分为小任务，逐步实施。整个流程分为四个步骤。

#### 110.1.2.1 步骤一：描述想法

向 AI 代理描述你想构建的功能或解决的问题。AI 会协助你将想法拆分为多个小任务，每个任务包含清晰的描述和验收标准。任务要足够小，能够在单次对话中完成。

示例对话方式：

> 我想给项目添加用户认证功能，请帮我拆分成可执行的任务，每个任务都要包含验收标准。

#### 110.1.2.2 步骤二：一次一个任务，一个任务一个 PR

每个代理会话只处理一个任务。这种约束带来三个好处：

- 上下文更聚焦，AI 理解更充分
- 每个任务对应一个独立的 Pull Request，便于代码审查
- 失败时只需重做单个任务，不会波及大范围代码

开始新任务前，让 AI 读取当前任务详情：

```bash
backlog task <id> --plain
```

#### 110.1.2.3 步骤三：编码前写实现计划

在实施代码之前，让 AI 研究当前代码库，然后撰写实现计划（Implementation Plan），并通过 CLI 写入任务中：

```bash
backlog task edit <id> --plan "1. 研究现有代码结构
2. 设计接口
3. 实现核心逻辑
4. 添加测试"
```

实现计划确保了方案反映代码库的当前状态，避免 AI 基于过时的假设进行开发。写完计划后，建议先与团队成员确认，再开始编码。

#### 110.1.2.4 步骤四：实施与验证

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

### 110.1.3 不满意时的重启循环

如果 AI 的实施结果不符合预期，不要在同一会话中继续纠缠。正确的做法是：

1. 清除任务中的旧计划、备注和最终总结
2. 根据经验教训，细化任务描述和验收标准
3. 开启新的 AI 会话，重新运行整个流程

重启循环能避免上下文污染，让 AI 以更清晰的视角重新理解需求。

### 110.1.4 MCP 工具能力清单

通过 MCP 连接后，AI 代理可以执行 Backlog.md 的完整工具集：

#### 110.1.4.1 任务全生命周期管理

- 创建、编辑、查看、归档、搜索任务
- 管理子任务和依赖关系
- 更新任务状态、负责人、标签和优先级
- 处理验收标准的勾选与取消勾选

#### 110.1.4.2 文档与决策

- 创建和更新项目文档
- 创建架构决策记录（ADR）
- 查看文档列表和决策列表

#### 110.1.4.3 里程碑与看板

- 创建、重命名、归档里程碑
- 将任务分配到里程碑
- 读取看板状态分布

#### 110.1.4.4 定义完成（DoD）

- 获取项目的默认 DoD 清单
- 修改默认 DoD 项
- 在单个任务中管理 DoD 勾选状态

#### 110.1.4.5 工作流与配置

- 获取工作流指令和指南
- 读取项目配置
- 查看项目统计概览

### 110.1.5 MCP 资源与提示

Backlog.md MCP 服务器提供以下结构化资源，AI 代理可在会话中主动读取：

| 资源 URI | 内容说明 |
|---------|---------|
| `backlog://workflow/overview` | 工作流概览，包含完整的协作指南 |
| `backlog://docs/task-workflow` | 任务工作流详细指南 |
| `backlog://init-required` | 未初始化项目时的回退资源 |

AI 代理在首次连接或遇到不确定的场景时，会优先读取 `backlog://workflow/overview` 获取上下文指导。

### 110.1.6 安全特性

Backlog.md 的 MCP 实现从设计层面保障安全性：

- **stdio-only 传输**：AI 客户端与 MCP 服务器之间仅通过标准输入输出通信，不监听任何网络端口，外部无法直接访问
- **localhost-only 运行时验证**：Web UI 等服务默认仅绑定本地地址
- **纯协议包装器**：MCP 层不包含任何业务逻辑，所有操作最终通过 Core 层统一处理，与 CLI 和 Web UI 共享同一套数据验证规则
- **roots 发现机制**：MCP 客户端发送 workspace 根目录列表，Backlog.md 自动在目录中查找有效项目。正常启动路径也会跟随客户端 workspace roots 变化（BACK-522），未找到时降级为最小功能模式，仅暴露 `init` 相关工具
- **固定项目根目录**：如需锁定到固定目录（例如全局 `~/.backlog`），使用 `--cwd` 或 `BACKLOG_CWD` 环境变量启动；此时服务器不会跟随客户端 workspace roots

### 110.1.7 常见问题

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

## 110.2 支持的 AI 工具

Backlog.md 支持与多种主流 AI 编码助手集成。不同工具的连接方式略有差异，但核心原理一致：将 Backlog.md 的 MCP 服务器注册到 AI 客户端，使其能够直接调用 Backlog.md 的工具。

### 110.2.1 支持的工具一览

| 工具 | 集成方式 | 配置命令 |
|------|---------|---------|
| Claude Code | MCP | `claude mcp add backlog --scope user -- backlog mcp start` |
| OpenAI Codex | MCP | `codex mcp add backlog -- backlog mcp start` |
| Google Gemini CLI | MCP | `gemini mcp add backlog -s user backlog mcp start` |
| Kiro | MCP | `kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start` |
| Cursor | MCP | 手动配置 `mcpServers` |
| GitHub Copilot | CLI 指令 | 生成 `copilot-instructions.md` |

### 110.2.2 Claude Code

Claude Code 是 Anthropic 推出的命令行 AI 助手，原生支持 MCP。

执行以下命令完成注册：

```bash
claude mcp add backlog --scope user -- backlog mcp start
```

参数说明：

- `--scope user`：将配置写入用户级配置，所有项目可用
- `--` 后的 `backlog mcp start`：启动 Backlog.md MCP 服务器的命令

注册成功后，在 Claude Code 会话中输入 `@backlog` 即可调用 Backlog.md 工具。

### 110.2.3 OpenAI Codex

OpenAI Codex CLI 同样支持 MCP 协议。

执行以下命令：

```bash
codex mcp add backlog -- backlog mcp start
```

> 注意 Codex 使用 `--` 作为 stdio 命令分隔符。该格式在 BACK-520 中更新以匹配当前 Codex CLI 行为。

Codex 会自动将 Backlog.md 的工具集纳入可用工具列表。在对话中，Codex 会根据上下文自主决定何时调用 Backlog.md 工具。

### 110.2.4 Google Gemini CLI

Gemini CLI 通过 `gemini` 命令提供 MCP 支持。

执行以下命令：

```bash
gemini mcp add backlog -s user backlog mcp start
```

参数说明：

- `-s user`：等同于 `--scope user`，作用于用户范围
- `backlog mcp start`：启动命令

### 110.2.5 Kiro

Kiro CLI 的配置方式略有不同，需要显式指定参数拆分方式。

执行以下命令：

```bash
kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
```

注意 `--args` 后的参数使用逗号分隔，而不是空格。

### 110.2.6 Cursor

Cursor 支持两种方式与 Backlog.md 集成。

#### 110.2.6.1 方式一：MCP 配置

打开 Cursor 的设置，找到 MCP 配置入口，手动添加 `mcpServers` 配置：

```json
{
  "mcpServers": {
    "backlog": {
      "command": "backlog",
      "args": ["mcp", "start"]
    }
  }
}
```

配置保存后，Cursor 的 AI 助手即可使用 Backlog.md 的全部工具能力。

#### 110.2.6.2 方式二：CLI 指令文件（AGENTS.md）

Cursor 也会读取项目根目录的 `AGENTS.md` 作为通用代理指令。运行 `backlog init` 或 `backlog agents --update-instructions` 时，Cursor 对应的指令会写入 `AGENTS.md`，不再生成单独的 `.cursorrules` 文件。重复执行时，现有 `AGENTS.md` 内容会被保留，Backlog.md 只更新其中的标记区块。

### 110.2.7 GitHub Copilot

GitHub Copilot 目前不支持 MCP 协议，因此采用 CLI 指令方式集成。

运行以下命令生成代理指令文件：

```bash
backlog agents --update-instructions
```

该命令会在项目根目录生成 `.github/copilot-instructions.md`，其中包含：

- Backlog.md 的完整 CLI 命令参考
- 任务创建规范
- 验收标准格式
- 工作流指南

Copilot 在生成代码时会读取该文件，了解项目的任务管理规范，从而更好地协助开发。

### 110.2.8 验证集成是否成功

完成配置后，可以通过以下方式验证：

1. 启动对应的 AI 客户端
2. 输入类似 "列出我的待办任务" 的指令
3. 观察 AI 是否正确调用了 Backlog.md 的 `list_tasks` 工具
4. 如果 AI 返回了当前项目的任务列表，说明集成成功

如果集成失败，请检查：

- `backlog` 命令是否在系统 PATH 中
- `backlog mcp start` 是否能正常启动（可单独在终端测试）
- AI 客户端的 MCP 配置是否正确指向了 `backlog mcp start`
- 如果使用 Codex，确认命令包含 `--` 分隔符
- 如果 AI 启动的是编译后的二进制而非源码，确保 `dist/backlog` 已重新构建

## 110.3 代理指令文件

代理指令文件是 Backlog.md 为 AI 编码助手准备的标准化指南文档。这些文件告诉 AI 如何与 Backlog.md 协作，包括工作流规范、命令用法和任务管理标准。通过统一的指令文件，不同 AI 工具对项目的理解保持一致，避免因工具切换导致的工作流偏差。

### 110.3.1 什么是指令文件

AI 编码助手在启动时会读取项目中的特定 Markdown 文件作为上下文。Backlog.md 利用这一机制，生成包含项目管理规范的指令文件。这些文件涵盖：

- Backlog.md 的核心能力介绍
- 任务文件结构说明
- CLI 命令完整参考
- 验收标准与定义完成（DoD）规范
- 典型工作流程示例
- 常见错误与正确做法对比

AI 阅读这些文件后，能够在对话中准确使用 Backlog.md 的功能，无需用户反复解释项目规范。

### 110.3.2 生成指令文件

Backlog.md 提供两种方式生成或更新代理指令文件。

#### 110.3.2.1 初始化项目时自动生成

运行 `backlog init` 初始化新项目时，向导会询问是否需要安装 AI 代理指令：

```bash
backlog init my-project
# 111 交互式向导中出现选项：
# 112 "Install AI agent instructions?"
```

选择安装后，Backlog.md 会根据你的选择生成对应的指令文件。

#### 112.0.0.1 手动更新已有项目的指令

对于已存在的项目，随时可以通过以下命令更新或重新生成指令文件：

```bash
backlog agents --update-instructions
```

该命令会扫描当前项目，根据现有配置重新生成所有指令文件，确保内容与项目当前状态同步。当你修改了任务状态流程、标签体系或其他项目规范后，建议运行此命令更新 AI 指令。

### 112.0.1 生成的文件清单

根据你使用的 AI 工具，Backlog.md 会生成以下一个或多个文件：

| 文件路径 | 适用工具 | 作用范围 |
|---------|---------|---------|
| `CLAUDE.md` | Claude Code / Claude Desktop | 项目根目录 |
| `AGENTS.md` | 通用代理指令、Cursor | 项目根目录 |
| `GEMINI.md` | Gemini CLI | 项目根目录 |
| `.github/copilot-instructions.md` | GitHub Copilot | 项目仓库 |

> **注意**：Cursor 不再生成单独的 `.cursorrules` 等 Backlog 拥有的规则文件，统一使用 `AGENTS.md`。重复执行生成命令会保留 `AGENTS.md` 中已有的用户内容，只更新 Backlog 管理的标记区块。

#### 112.0.1.1 CLAUDE.md

专为 Claude Code 和 Claude Desktop 设计。Claude 系列工具会自动读取项目根目录下的 `CLAUDE.md` 作为系统提示的一部分。该文件包含完整的 Backlog.md 操作指南，是功能最全面的指令文件。

#### 112.0.1.2 AGENTS.md

通用代理指令文件，适用于 Cursor 以及不识别特定品牌文件的 AI 工具。文件内容与 `CLAUDE.md` 基本一致，但采用更通用的表述方式。Cursor 会读取项目根目录的 `AGENTS.md` 作为通用代理指令；部分 IDE 插件或自定义 AI 客户端也会优先读取 `AGENTS.md`。

#### 112.0.1.3 GEMINI.md

针对 Google Gemini CLI 优化的指令文件。Gemini CLI 会识别项目根目录下的 `GEMINI.md` 并纳入上下文。

#### 112.0.1.4 .github/copilot-instructions.md

专为 GitHub Copilot 设计。由于 Copilot 不支持 MCP 协议，该文件内容更侧重 CLI 命令参考，帮助 Copilot 理解如何在代码生成过程中配合 Backlog.md 的 shell 命令。文件位于 `.github/` 目录下，因此仅在 GitHub 仓库中生效。

### 112.0.2 指令文件包含的内容

所有生成的指令文件都遵循统一的内容框架，主要包括以下模块。

#### 112.0.2.1 工作流指南

说明 AI 与 Backlog.md 协作的推荐流程：

- **首轮先加载项目实况**：新会话在给出任何答案或计划之前，先运行 `backlog config list`、`backlog search <关键词>`、`backlog task list`、`backlog task view <id>`、`backlog overview` 等命令，读取真实的 `statuses`、`defaultStatus`、`defaultAssignee` 与活跃任务
- 不得假设默认状态集合 `[To Do, In Progress, Done]`；设置或校验任务状态时必须落在配置的 `statuses` 之内
- `defaultStatus` 必须是 `statuses` 的成员，若不是应提示用户修正或另选默认值
- 如何通过 CLI 或 MCP 读取任务
- 如何在实施前撰写实现计划
- 如何按验收标准逐步完成任务
- 如何添加最终总结并标记任务完成

> 这条"先加载实况"的规则写在随 CLI 分发的 `overview` 指南中（而非项目自己的 `AGENTS.md`），因此对任何使用 Backlog.md 的项目都生效（BACK-582）。

`backlog instructions overview` 的加载节奏约定为**每个会话一次**（BACK-656）：指令要求代理在会话开始、给出任何回答或采取行动之前运行一次该命令；同一会话内已读过的无需重复执行。

#### 112.0.2.2 引用与行号定位

指南约定任务的 References 支持**行号引用**（BACK-651），每条引用是三种形态之一：外部 URL、项目相对文件路径、或带行区间的路径（`path:LINE` 单行、`path:START-END` 连续区间）。创建/编辑任务与 MCP 的 `references` / `addReferences` / `removeReferences` 参数均遵循同一约定，`removeReferences` 按完整存储字符串（含行号后缀）匹配。文档链接同样区分三类目标：外部 URL、Backlog 短链接（`/task/:id`、`/doc/:id` 等，可带行号后缀）与项目相对路径。

#### 112.0.2.3 日期与多行输入约定

指南还明确了两类高频输入错误（BACK-572）：

- **日期与时间字段**：CLI 与 MCP 接受**本地时间**输入，存储为 UTC，展示时再转回本地时间。不要读取任务文件里可见的 UTC 值再作为输入传回去，否则会产生时区偏移
- **多行文本字段**：在引号内使用字面量 `\n` 表示换行；不要在引号内按真实回车——shell 会把它拆成多行，实际只保存第一行

#### 112.0.2.4 任务创建规范

明确高质量任务的标准：

- 标题应简洁概括任务目的
- 描述聚焦 "为什么" 而非 "怎么做"
- 验收标准必须结果导向、可验证
- 每个任务对应一个独立的 Pull Request

#### 112.0.2.5 验收标准格式

详细说明验收标准的格式要求：

- 使用编号复选框形式 `- [ ] #1 标准内容`
- 通过 CLI 的 `--ac` 参数添加
- 通过 `--check-ac` 和 `--uncheck-ac` 管理完成状态
- 支持单次命令操作多个标准项

#### 112.0.2.6 命令参考

提供完整的 CLI 命令速查表，覆盖：

- 任务创建、编辑、查看、归档
- 验收标准与 DoD 管理
- 搜索与过滤
- 文档和决策管理
- 看板与概览

### 112.0.3 MCP 与 CLI 指令方式对比

Backlog.md 支持两种 AI 集成方式，各有适用场景：

| 对比维度 | MCP 方式 | CLI 指令方式 |
|---------|---------|-------------|
| 工作原理 | AI 直接调用 Backlog.md 的工具函数 | AI 阅读指令文件后自行执行 shell 命令 |
| 可靠性 | 高，参数和返回值均为结构化数据 | 中等，依赖 AI 解析 shell 输出 |
| 支持工具 | Claude Code、Codex、Gemini CLI、Kiro、Cursor | GitHub Copilot、Cursor |
| 配置复杂度 | 低，一条命令完成注册 | 低，自动生成指令文件 |
| 实时反馈 | 即时，工具调用后立即返回结果 | 有延迟，需等待 shell 命令执行 |
| 错误处理 | AI 可精确获取错误类型和原因 | AI 需从 stderr 中推断错误 |

**推荐策略**：

- 如果使用的 AI 工具支持 MCP，优先选择 MCP 方式
- 对于 GitHub Copilot 等不支持 MCP 的工具，使用 CLI 指令方式作为补充
- Cursor 同时支持 MCP 与 `AGENTS.md` 指令文件，可任选其一或两者并存
- 两种方式可以并存：MCP 负责日常任务管理，CLI 指令文件确保 Copilot、Cursor 等也能理解项目规范

## 112.1 Wiki Skill 安装

Backlog.md 内置 `llm-wiki-for-backlog` skill，帮助 AI 代理理解和维护项目知识库。通过 `backlog wiki install` 命令，可将该 skill 一键安装到支持的 AI 工具中。

### 112.1.1 什么是 Wiki Skill

`llm-wiki-for-backlog` 是一个 Agent Skill，提供以下能力：

- **构建知识库**：根据项目 backlog 内容自动生成结构化 wiki
- **增量摄取**：将新任务、文档、决策编译为可交叉引用的知识页面
- **查询与报告**：基于 wiki 内容回答项目相关问题
- **健康检查**：扫描知识库中的矛盾、孤立页面和缺失引用

安装后，AI 代理在会话中可直接引用该 skill 的指南，更准确地执行 wiki 相关操作。

### 112.1.2 支持的 AI 工具

| 别名 | 对应工具 | Skills 目录 |
|------|---------|------------|
| `claude` | Claude Code / Claude Desktop | `.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.codex/skills/` |
| `agents` | 通用 Agents 目录 | `.agents/skills/` |

### 112.1.3 安装 Skill

#### 112.1.3.1 安装到指定 Agent

```bash
backlog wiki install claude
```

该命令会将内置 skill 文件写入 Agent 的 skills 目录。安装结果会显示 skill 名称、描述和触发词。

#### 112.1.3.2 强制覆盖

如果目标目录已存在同名 skill，或该目录被其他 skill 占用，使用 `--force` 覆盖：

```bash
backlog wiki install claude --force
```

#### 112.1.3.3 预览安装

使用 `--dry-run` 预览安装操作，不实际写入文件：

```bash
backlog wiki install codex --dry-run
```

### 112.1.4 安装机制

#### 112.1.4.1 统一存储与符号链接

Skill 文件集中存储在项目根目录的 `.agents/skills/llm-wiki-for-backlog/` 中。各 Agent 的 skills 目录通过**符号链接**指向该统一位置：

```
.agents/skills/llm-wiki-for-backlog/     ← 实际文件
.claude/skills/llm-wiki-for-backlog/    ← 符号链接
.codex/skills/llm-wiki-for-backlog/     ← 符号链接
```

这种设计的优点是：
- 更新 skill 时只需修改一处
- 多个 Agent 共享同一套 skill 内容
- 避免文件重复和版本不一致

#### 112.1.4.2 Windows 兼容性

Windows 上创建目录符号链接需要管理员权限或开启开发者模式。当符号链接创建失败时，命令会自动**回退到直接复制**文件到 Agent 的实际目录，并记录警告提示。

#### 112.1.4.3 Skill 来源

Skill 内容在构建时嵌入编译后的二进制文件中：

- **Canonical 源**：`.codex/skills/llm-wiki-for-backlog/SKILL.md`
- **嵌入产物**：`src/skills/embedded/llm-wiki-for-backlog.ts`
- **构建时生成**：`scripts/embed-wiki-skill.ts` 将 skill 文件打包为 TypeScript 模块

这意味着即使在没有网络连接或源码仓库的环境中，编译后的 `backlog` 二进制也能完成 skill 安装。

### 112.1.5 更新 Skill

当 Backlog.md 版本升级后，内置 skill 内容可能已更新。重新执行安装命令即可覆盖为最新版本：

```bash
backlog wiki install claude --force
```

建议在每次升级 Backlog.md 后检查并更新已安装的 skill。

# 113 配置与运维

## 113.1 配置管理

Backlog.md 提供灵活的配置系统，支持通过交互式向导或命令行直接管理项目设置。配置存储在 YAML 文件中，与项目代码一起纳入版本控制，确保团队成员使用一致的工作流规范。

### 113.1.1 交互式配置向导

`backlog config` 命令启动高级配置向导，以交互式问答形式引导你完成所有关键设置：

```bash
backlog config
```

向导涵盖以下配置环节：

- Shell 补全安装
- 跨分支任务状态检查
- Git 钩子绕过设置
- 自动提交启用
- ID 零填充格式化
- 默认编辑器选择
- 定义完成（DoD）默认项管理
- Web UI 端口与浏览器自动打开

按提示逐步回答即可，每个选项都有默认值和说明提示。配置完成后，Backlog.md 会自动将设置写入项目配置文件。

### 113.1.2 命令行直接操作

对于需要快速修改单个配置项的场景，使用 `backlog config get` 和 `backlog config set` 命令。

#### 113.1.2.1 查看当前配置

列出所有已配置项及其当前值：

```bash
backlog config list
```

查看单个配置项：

```bash
backlog config get projectName
backlog config get statuses
backlog config get defaultPort
```

#### 113.1.2.2 修改配置项

设置单个配置项的值：

```bash
backlog config set projectName "我的项目"
backlog config set defaultPort 8080
backlog config set autoCommit true
```

设置列表类型的配置项：

```bash
backlog config set statuses "To Do,In Progress,Done"
backlog config set labels "bug,feature,docs"
```

> `config get/set/list` 通过共享的可用键列表展示一致的配置项。对于列表型配置（`statuses`、`labels`），推荐使用 `backlog config get <key>` 查看当前值后直接编辑 `config.yml` 的对应字段（支持块状 YAML 序列），而非通过 `config set` 覆盖。

### 113.1.3 关键配置项说明

#### 113.1.3.1 项目基础信息

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `projectName` | 字符串 | — | 项目名称，显示在看板和概览中 |
| `statuses` | 字符串列表 | `To Do, In Progress, Done` | 任务状态流程，按顺序排列 |
| `labels` | 字符串列表 | — | 项目预定义标签列表 |
| `dateFormat` | 字符串 | — | 日期显示格式 |
| `locale` | 字符串 | `en` | Web UI 界面语言：`en`、`ja`、`zh-CN`、`zh-TW` |

状态列表的顺序决定了看板中的列排列顺序。第一个状态视为任务的初始状态，最后一个通常代表完成状态。

#### 113.1.3.2 任务默认值

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultAssignee` | 字符串列表 | — | 创建任务/草稿未显式指定负责人时自动应用 |
| `defaultEditor` | 字符串 | `code --wait` | 按 `E` 打开任务时使用的编辑器命令 |

```bash
# 114 设置默认负责人（列表，逗号分隔）
backlog config set defaultAssignee "@alice,@bob"

# 115 取消默认负责人（空值会移除该键）
backlog config set defaultAssignee ""

# 116 清除默认编辑器——服务默认的 "code --wait" 会挂住无人值守的代理进程
backlog config set defaultEditor ""
backlog init --default-editor ""
```

`defaultAssignee` 的生效规则是一条三态语义（BACK-579 / BACK-584）：

- **不传** `-a`（字段缺省）→ 应用配置中的默认负责人
- **显式传** `-a`（哪怕只有一个）→ 完全替换默认值，不与默认值合并
- **显式取消** `--unassign`（或 Web UI 中清空负责人 chips）→ 保存为空列表，不回落默认值

默认值在 core 的创建漏斗层应用，因此 CLI `task create`、`draft create`、创建向导、TUI `N` 键创建器、Web 端 `POST /api/tasks` 与 MCP `task_create` 行为一致。

`defaultEditor` 设为空字符串即表示"不使用默认编辑器"：`config set defaultEditor ""` 跳过可执行文件校验并移除该键，`init --default-editor ""` 同样清除既有配置（BACK-586）。非空值仍会校验可执行文件是否存在。

##### 116.0.0.0.1 编辑器解析优先级与 Vim / Neovim 配置

按 `E` 打开编辑器时，解析优先级为（doc-002）：**`EDITOR` 环境变量** > `config.yml` 的 `defaultEditor` > 平台默认（macOS/Linux 为 nano，Windows 为 notepad）。使用 Vim / Neovim 推荐直接设环境变量：

```bash
export EDITOR=nvim          # 或 vim
# 117 也可以写入项目配置
backlog config set defaultEditor nvim
```

- 在 TUI（`backlog board` / `backlog task <id>`）中按 `E` 时，界面会挂起字符屏幕、退出备用缓冲区，编辑器退出后自动恢复终端状态
- 排查：颜色异常时设 `TERM=xterm-256color`；编辑器无响应或立即退出多见于编辑器路径含参数——请写完整可执行路径或用包装脚本
- 可针对单条命令覆盖：`EDITOR=nvim backlog board`

#### 117.0.0.1 分支与 Git 集成

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `checkActiveBranches` | 布尔值 | `true` | 是否检查活跃分支中的任务状态 |
| `remoteOperations` | 布尔值 | `true` | 是否检查远程分支中的任务 |
| `activeBranchDays` | 整数 | `30` | 分支被视为活跃的天数上限 |

启用 `checkActiveBranches` 后，Backlog.md 会在加载任务时检查其他本地和远程分支，确保跨分支的任务状态准确。这在大型仓库中可能影响性能，可通过减小 `activeBranchDays` 来加速。

`remoteOperations` 依赖于 `checkActiveBranches`，当后者关闭时，前者自动失效。

#### 117.0.0.2 自动化行为

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `autoCommit` | 布尔值 | `false` | 是否在 CLI 变更后自动创建 Git 提交 |
| `bypassGitHooks` | 布尔值 | `false` | 提交时是否绕过 Git 钩子（使用 `--no-verify`） |
| `filesystemOnly` | 布尔值 | `false` | 是否禁用所有 Git 集成，仅使用文件系统 |

启用 `autoCommit` 后，每次通过 CLI 创建或修改任务，Backlog.md 会自动执行 `git commit`，省去手动提交的步骤。配合 `bypassGitHooks` 可在 pre-commit 钩子耗时较长时提升效率。

`autoCommit` 只提交每次写入实际触碰的文件（新建文件、被替换的旧路径、移动/归档的源路径与目标路径），不会对整个 `backlog/` 目录执行 `git add`，也不会清空你已有的 staged/unstaged 改动。这保证了自动提交与用户当前工作区的其他变更互不干扰。

`filesystemOnly` 适用于纯文件系统项目或无 Git 的环境，开启后所有 Git 相关功能均被禁用。

#### 117.0.0.3 ID 与前缀

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `prefixes.task` | 字符串 | `task` | 任务 ID 前缀 |
| `prefixes.draft` | 字符串 | `draft` | 草稿 ID 前缀 |
| `zeroPaddedIds` | 整数 | — | ID 零填充位数，如 `3` 生成 `task-001` |

前缀配置允许自定义任务和草稿的 ID 格式。例如，将 `prefixes.task` 设为 `back` 后，新任务的 ID 将变为 `back-1`、`back-2` 等。

**保留前缀**（BACK-647）：任务前缀只允许字母，且不能使用保留名称 `doc` 与 `decision`（它们分别被文档与决策占用）。该规则在所有入口一致生效——`init` 的 `--task-prefix` 标志、交互向导、浏览器初始化页都会拒绝；`backlog doctor` 会报告存量项目的前缀冲突，且冲突未解除时拒绝执行 `--fix`（避免修复重复 ID 时把新编号分配进冲突的存储）。已使用保留前缀的存量项目仍可正常工作，重新初始化不会主动改写它。

`zeroPaddedIds` 控制 ID 的格式化宽度。设为 `3` 时，ID 显示为 `task-001`；设为 `4` 时，显示为 `task-0001`。这有助于保持文件名的字典序一致性。

#### 117.0.0.4 Web UI

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultPort` | 整数 | `6420` | Web UI 默认监听端口 |
| `autoPort` | 布尔值 | `true` | 默认端口被占用时自动扫描后续 100 个用户端口 |
| `autoOpenBrowser` | 布尔值 | `true` | 启动 Web UI 时是否自动打开浏览器 |
| `hideEmptyColumns` | 布尔值 | `false` | 看板是否隐藏无任务的状态列 |

修改 `defaultPort` 可避免与其他本地服务端口冲突。开启 `autoPort`（默认）时，若默认端口已被占用，服务器会自动改用后续可用端口并在终端打印实际地址；系统只接受用户端口范围（1024–65535）内由自己扫描出的端口，拒绝操作系统分配的随机高位端口。关闭 `autoPort` 后，端口占用会恢复为直接报 `EADDRINUSE` 错误。也可在 Web 界面「设置」面板中切换该开关。关闭 `autoOpenBrowser` 后，运行 `backlog browser` 只会启动服务器，不会弹出浏览器窗口，适合远程开发或服务器环境。

`hideEmptyColumns`（对应 `config.yml` 的 `hide_empty_columns`）开启后，看板会隐藏当前没有任何任务的状态列，减少视觉杂乱；拖拽期间所有状态列保持可见以便放置。也可在 Web 界面「设置」面板的 Auto Open Browser 开关旁切换。

#### 117.0.0.5 MCP HTTP 传输

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `mcp.http.host` | 字符串 | — | MCP HTTP 服务器绑定地址 |
| `mcp.http.port` | 整数 | — | MCP HTTP 服务器监听端口 |
| `mcp.http.auth.type` | 字符串 | `none` | 认证类型：`none`、`bearer`、`basic` |
| `mcp.http.auth.token` | 字符串 | — | Bearer 认证令牌 |
| `mcp.http.auth.username` | 字符串 | — | Basic 认证用户名 |
| `mcp.http.auth.password` | 字符串 | — | Basic 认证密码 |

默认情况下，MCP 使用 stdio 传输，安全性最高。如需启用 HTTP 传输（例如配合某些特殊客户端），可通过上述配置项设置。启用 HTTP 传输时，强烈建议配置认证机制。

### 117.0.1 配置存储位置

Backlog.md 按以下优先级查找配置文件：

1. `backlog/config.yml`
2. `backlog.config.yml`（项目根目录）

推荐使用 `backlog/config.yml`，这样配置与任务、文档等项目数据集中存放，便于备份和迁移。当使用 `backlog.config.yml` 时，可通过 `backlogDirectory` 项指定 backlog 文件夹的相对路径。

配置文件的 YAML 格式示例：

```yaml
projectName: "我的项目"
statuses:
  - Backlog
  - To Do
  - In Progress
  - Done
labels:
  - bug
  - feature
  - docs
dateFormat: "YYYY-MM-DD"
checkActiveBranches: true
remoteOperations: true
activeBranchDays: 30
autoCommit: false
bypassGitHooks: false
prefixes:
  task: "back"
  draft: "draft"
defaultAssignee:
  - "@alice"
defaultEditor: "vim"
defaultPort: 6420
autoPort: true
autoOpenBrowser: true
hide_empty_columns: false
```

> **块状 YAML 列表**：列表型配置（`statuses`、`labels`）既支持上面的块状序列写法，也支持内联写法（`statuses: ["To Do", "In Progress", "Done"]`）。系统会优先按标准 YAML 语义解析块状列表，同时兼容旧版内联括号格式。

修改配置文件后，Backlog.md 会自动加载最新设置，无需重启服务。

## 117.1 Shell 补全

Backlog.md 内置智能 Shell 补全功能，支持 bash、zsh、fish 和 PowerShell。启用后，在终端中输入 `backlog` 命令时按 Tab 键，即可自动补全子命令、选项和动态值，大幅提升操作效率。

### 117.1.1 一键安装补全脚本

Backlog.md 提供自动检测和安装功能，根据当前使用的 Shell 类型自动配置补全脚本：

```bash
backlog completion install
```

执行后，工具会检测你的 Shell 环境，将补全脚本安装到对应位置：

| Shell | 安装位置 |
|-------|---------|
| bash | `~/.bashrc` 或 `~/.bash_profile` |
| zsh | `~/.zshrc` |
| fish | `~/.config/fish/completions/` |
| PowerShell | `$PROFILE` 文件 |

安装完成后，需要重新加载 Shell 配置文件或新开一个终端窗口，补全功能即可生效。

### 117.1.2 支持的 Shell

#### 117.1.2.1 Bash

Bash 补全脚本支持命令、子命令和选项补全。动态值补全依赖 bash-completion 包。在大多数 Linux 发行版中，该包已预装；如未安装，可通过包管理器获取：

```bash
# 118 Debian/Ubuntu
sudo apt-get install bash-completion

# 119 macOS (Homebrew)
brew install bash-completion
```

#### 119.0.0.1 Zsh

Zsh 用户可直接使用补全功能，无需额外依赖。Zsh 的补全系统功能丰富，支持菜单选择和描述显示，体验最为完整。

#### 119.0.0.2 Fish

Fish 的补全脚本放置在 `~/.config/fish/completions/backlog.fish`，Fish 会自动加载该目录下的所有补全定义。Fish 补全支持描述文本和参数高亮。

#### 119.0.0.3 PowerShell

PowerShell 补全通过注册 `Register-ArgumentCompleter` 命令实现。安装脚本会自动修改 PowerShell 的配置文件（可通过 `$PROFILE` 查看路径）。如需手动注册，可参考补全脚本中的注册逻辑。

### 119.0.1 动态补全能力

Backlog.md 的补全系统不仅支持静态命令和选项，还能从当前项目中动态提取实际数据：

#### 119.0.1.1 实际任务 ID

输入 `backlog task edit ` 后按 Tab，补全系统会列出当前项目中所有有效的任务 ID：

```bash
backlog task edit <TAB>
# 120 显示：task-1  task-2  task-3  doc-1  ...
```

#### 120.0.0.1 状态值

输入 `-s ` 或 `--status ` 后按 Tab，补全系统会从项目配置中读取状态列表：

```bash
backlog task list -s <TAB>
# 121 显示：To Do  In Progress  Done
```

#### 121.0.0.1 标签

输入 `-l ` 或 `--labels ` 后按 Tab，补全系统会汇总所有已使用的标签：

```bash
backlog task create "新功能" -l <TAB>
# 122 显示：bug  feature  docs  backend
```

#### 122.0.0.1 负责人

输入 `-a ` 或 `--assignee ` 后按 Tab，补全系统会列出所有现有任务中出现过的负责人：

```bash
backlog task edit 1 -a <TAB>
# 123 显示：@alice  @bob  @team-lead
```

动态补全的数据来源于当前工作目录下的 Backlog.md 项目。如果在没有 Backlog.md 项目的目录中执行命令，动态值补全会回退到空列表或默认值，但静态命令补全仍然可用。

### 123.0.1 手动安装补全脚本

如果自动安装遇到问题，或需要将补全脚本部署到非标准位置，可以手动安装。Backlog.md 在安装包中内置了各 Shell 的补全脚本源码。

#### 123.0.1.1 查找补全脚本

补全脚本随 npm 包一起安装，位于包目录的 `completions/` 文件夹下：

```bash
# 124 查找全局安装的 backlog.md 包路径
npm root -g
# 125 补全脚本位于：
# 126 <npm-root>/backlog.md/completions/backlog.bash
# 127 <npm-root>/backlog.md/completions/backlog.zsh
# 128 <npm-root>/backlog.md/completions/backlog.fish
# 129 <npm-root>/backlog.md/completions/backlog.ps1
```

#### 129.0.0.1 Bash 手动安装

将以下内容添加到 `~/.bashrc`：

```bash
source /path/to/backlog.bash
```

#### 129.0.0.2 Zsh 手动安装

将补全脚本复制到 Zsh 的函数搜索路径，例如 `~/.zsh/functions/`：

```bash
cp /path/to/backlog.zsh ~/.zsh/functions/_backlog
```

确保 `~/.zshrc` 中的 `fpath` 包含该目录：

```zsh
fpath=(~/.zsh/functions $fpath)
```

#### 129.0.0.3 Fish 手动安装

将补全脚本复制到 Fish 的补全目录：

```bash
cp /path/to/backlog.fish ~/.config/fish/completions/backlog.fish
```

#### 129.0.0.4 PowerShell 手动安装

在 PowerShell 配置文件中添加补全注册代码。首先确定配置文件路径：

```powershell
$PROFILE
```

如果文件不存在，先创建它：

```powershell
New-Item -Path $PROFILE -ItemType File -Force
```

然后将 `backlog.ps1` 中的内容追加到配置文件中。

完成手动安装后，重新加载 Shell 配置文件或开启新终端窗口即可生效。

## 129.1 项目概览

`backlog overview` 命令提供项目级任务统计的纯文本输出，适合在终端中快速查看项目状态，或用于脚本和 CI 流水线。

### 129.1.1 启动概览

#### 129.1.1.1 交互式 TUI

在支持 TTY 的终端中直接运行：

```bash
backlog overview
```

系统会输出一个 ANSI 彩色的终端界面，包含状态分布、优先级分布、最近活动和项目健康度。使用终端原生滚动条或鼠标滚轮浏览全部内容。

#### 129.1.1.2 纯文本输出

在非交互式环境或需要管道处理时，使用 `--plain` 模式：

```bash
backlog overview --plain
```

纯文本模式不输出 ANSI 颜色代码，适合重定向到文件或通过管道传递给其他命令：

```bash
backlog overview --plain > project-status.txt
backlog overview --plain | grep "Overdue"
```

### 129.1.2 输出内容

`overview` 命令的输出包含以下维度：

#### 129.1.2.1 状态概览

```
Status Overview
===============
  To Do: 12 tasks (40%)
  In Progress: 8 tasks (27%)
  Done: 10 tasks (33%)

  Total Tasks: 30
  Completion: 33%
```

展示各状态任务数量及占比，以及总任务数和整体完成率。

#### 129.1.2.2 优先级分布

```
Priority Breakdown
==================
  high     5  17%
  medium   15 50%
  low      7  23%
  none     3  10%
```

按高 / 中 / 低 / 无优先级统计任务分布。

#### 129.1.2.3 最近活动

```
Recent Activity
===============
Recently Created
----------------
  TASK-32 - 添加用户认证模块

Recently Updated
----------------
  TASK-28 - 优化数据库查询
```

列出最近 7 天内创建和更新的任务。

#### 129.1.2.4 项目健康度

```
Project Health
==============
  Average Task Age: 12 days
  At Risk: 2   Overdue: 1   Stale: 3   Blocked: 1

At Risk Tasks: (due soon, require immediate attention)
------------------------------------------------------
  TASK-15 - 完成 API 文档

Overdue Tasks: (passed the due date)
------------------------------------
  TASK-7 - 修复登录超时问题

Stale Tasks: (No updates for 30+ days, no due date set)
--------------------------------------------------------
  TASK-3 - 调研第三方库

Blocked Tasks: (waiting on dependencies)
----------------------------------------
  TASK-11 - 集成支付网关
```

健康度区域与 Web 统计页面对齐，展示：

- **平均任务年龄**：所有任务的平均存在天数
- **临期（At Risk）**：今天或明天截止的任务
- **逾期（Overdue）**：已过截止日期的任务
- **停滞（Stale）**：无截止日期且超过 30 天未更新的任务
- **阻塞（Blocked）**：依赖未完成的任务

每个分类下列出具体任务 ID 和标题。

> 纯日期的截止日期按**本地时区的当天**解析与展示（BACK-690）：在任意时区下，`dueDate: 2026-09-20` 都显示为 9 月 20 日，不会因 UTC 换算偏移到前一天或后一天；带时间的 created/updated 时间戳仍按 UTC 存储、本地显示。

### 129.1.3 与 Web 统计页面的关系

| 特性 | CLI `overview` | Web 统计页面 |
|---|---|---|
| 交互性 | 终端 TUI / 纯文本 | 浏览器交互式界面 |
| 颜色 | ANSI 彩色 / 无颜色 | 网页彩色主题 |
| 健康度卡片 | 纯文本列表 | 可点击卡片，带日期标识 |
| 适用场景 | 快速终端查看、CI、脚本 | 详细分析、日常监控 |

两者使用同一套底层统计逻辑（`src/core/statistics.ts`），数据完全一致。
