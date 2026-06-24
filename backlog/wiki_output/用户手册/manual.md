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

#### 1.2.2.1 无 Git 的纯文件系统项目

```bash
backlog init --no-git
```

适用于非代码项目的任务管理。

#### 1.2.2.2 初始化后目录结构

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

### 1.2.3 验证安装

```bash
backlog --version
```

裸运行（无子命令）将显示欢迎界面并检测当前目录是否已初始化：

```bash
backlog
```

### 1.2.4 配置管理

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

## 1.3 AI 集成设置

Backlog.md 支持两种 AI 集成方式：**MCP 协议**（推荐）和 **CLI 指令文件**。

### 1.3.1 MCP 协议（推荐）

MCP（Model Context Protocol）允许 AI 代理直接调用 Backlog.md 的功能工具，无需用户手动输入 CLI 命令。

#### 1.3.1.1 Claude Code

```bash
claude mcp add backlog --scope user -- backlog mcp start
```

#### 1.3.1.2 OpenAI Codex

```bash
codex mcp add backlog -- backlog mcp start
```

> Codex 使用 `--` 作为 stdio 命令分隔符（BACK-520 更新）。

#### 1.3.1.3 Google Gemini CLI

```bash
gemini mcp add backlog -s user backlog mcp start
```

#### 1.3.1.4 Kiro

```bash
kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
```

#### 1.3.1.5 Cursor

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

### 1.3.2 CLI 指令文件

对于不支持 MCP 的 AI 工具，Backlog.md 可生成代理指令文件，指导 AI 如何使用 `backlog` 命令。

#### 1.3.2.1 生成指令文件

在 `backlog init` 时选择 CLI 指令模式，或后续执行：

```bash
backlog agents --update-instructions
```

将生成以下文件：
- `CLAUDE.md` — Claude Code / Claude Desktop
- `AGENTS.md` — 通用代理指令
- `GEMINI.md` — Gemini CLI
- `.github/copilot-instructions.md` — GitHub Copilot

#### 1.3.2.2 指令文件内容

包含工作流指南、任务创建规范、验收标准格式等，让 AI 了解如何：
- 创建带验收标准的任务
- 使用 `backlog` 命令管理任务生命周期
- 遵循项目规范（分支命名、提交格式等）

### 1.3.3 集成方式对比

| 方式 | 适用工具 | 优点 | 缺点 |
|------|----------|------|------|
| MCP | Claude, Codex, Gemini, Kiro, Cursor | AI 直接调用工具，更可靠、更安全 | 需要工具支持 MCP 协议 |
| CLI 指令 | GitHub Copilot, 其他 AI | 兼容性好，无需特殊协议支持 | AI 需要解析 shell 输出，可靠性稍低 |

### 1.3.4 推荐的 AI 工作流

#### 1.3.4.1 步骤 1：描述想法
告诉 AI 代理你想构建什么，让它拆分为小任务，每个任务包含清晰的描述和验收标准。

#### 1.3.4.2 步骤 2：一次一个任务
每个代理会话只处理一个任务，一个任务一个 PR。确保任务足够小，能在单次对话中完成。

#### 1.3.4.3 步骤 3：编码前写计划
在实施前让代理研究代码库并撰写实现计划（Implementation Plan），放在任务中。

#### 1.3.4.4 步骤 4：实施与验证
让代理实施任务。完成后审查代码、运行测试、检查 lint，验证结果。

#### 1.3.4.5 不满意时的重启循环
清除计划/备注/最终总结，细化任务描述和验收标准，然后在新的会话中重新运行。

# 2 任务管理

## 2.1 任务生命周期

Backlog.md 中每个任务都是一份独立的 Markdown 文件，从想法萌芽到最终归档，经历完整的状态流转。

### 2.1.1 状态流转

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

### 2.1.2 任务文件结构

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

### 2.1.3 核心字段说明

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

### 2.1.4 实际时间自动填充

`actualStart` 和 `actualEnd` 用于追踪任务实际开始和完成时间，系统会在特定条件下自动填充：

- 当任务状态从其他状态变更为 **In Progress** 时，若 `actualStart` 为空，自动设置为当前日期时间
- 当任务状态变更为 **Done**（或其他终态）时，若 `actualEnd` 为空，自动设置为当前日期时间
- 创建任务时直接指定 `--status "In Progress"` 或 `--status "Done"` 也会触发自动填充
- 自动填充仅在字段为空时执行，你可以随时手动覆盖

### 2.1.5 状态变更方式

#### 2.1.5.1 通过 CLI

```bash
# 3 标记为进行中
backlog task edit <id> --status "In Progress"

# 4 标记为已完成（将状态设为终端状态，通常为 Done）
backlog task edit <id> --status "Done"

# 5 归档任务
backlog task archive <id>
```

#### 5.0.0.1 通过 TUI 看板

运行 `backlog board` 启动终端看板，选中任务卡片后使用方向键或快捷键在不同状态列之间移动。

#### 5.0.0.2 通过 Web UI

运行 `backlog browser` 启动浏览器界面，在看板视图中拖放任务卡片到目标状态列。

#### 5.0.0.3 通过 AI 代理（MCP）

AI 代理可直接调用 `update_task` 工具变更任务状态，无需人工介入。

## 5.1 创建与编辑任务

### 5.1.1 创建任务

#### 5.1.1.1 基础创建

执行以下命令，输入任务标题即可快速创建任务：

```bash
backlog task create "任务标题"
```

若当前终端支持交互式 TTY 且未提供标题，系统将自动启动创建向导，引导你填写任务详情。

#### 5.1.1.2 完整参数创建

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

#### 5.1.1.3 常用选项说明

| 选项 | 说明 | 可多次使用 |
|------|------|-----------|
| `-d, --description <text>` | 任务描述 | 否 |
| `--desc <text>` | `--description` 的别名 | 否 |
| `-a, --assignee <assignee>` | 负责人 | 否 |
| `-s, --status <status>` | 初始状态 | 否 |
| `-l, --labels <labels>` | 标签，逗号分隔 | 否 |
| `--priority <priority>` | 优先级：`high`、`medium`、`low` | 否 |
| `--ac <criteria>` | 验收标准 | 是 |
| `--acceptance-criteria <criteria>` | `--ac` 的别名 | 是 |
| `--dod <item>` | Definition of Done 项 | 是 |
| `--no-dod-defaults` | 禁用默认 DoD | 否 |
| `--plan <text>` | 实现计划 | 否 |
| `--notes <text>` | 实现备注 | 否 |
| `--final-summary <text>` | 最终总结 | 否 |
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
| `--comment <text>` | 追加评论（创建时暂不支持，编辑时可用） | 否 |
| `--comment-author <name>` | 评论作者（配合 `--comment` 使用） | 否 |
| `--plain` | 创建后输出纯文本格式 | 否 |

#### 5.1.1.4 description 中的换行

`--description` 和 `--desc` 支持跨平台一致的换行输入：

```bash
# 6 在描述中插入换行
backlog task create "标题" --desc "第一行\n第二行"

# 7 编辑时同样支持
backlog task edit back-10 --desc "修复内容：\n1. 修复 A\n2. 修复 B"
```

- Windows 上输入 `\n` 即可得到换行（CLI 内部模拟 bash 双引号转义层后统一处理）
- 如需输入字面 `\n` 而非换行，Windows 需输入 `\\\\n`，非 Windows 输入 `\\n`
- 此转义仅处理 `\n`（换行）和 `\\`（字面反斜杠），其他序列如 `\t` 原样保留

### 7.0.1 查看任务

#### 7.0.1.1 交互式 TUI 查看

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

#### 7.0.1.2 纯文本输出

在非交互式环境（如脚本或 AI 会话）中，使用 `--plain` 输出结构化纯文本：

```bash
backlog task <id> --plain
backlog task view <id> --plain
```

### 7.0.2 编辑任务

#### 7.0.2.1 基础编辑

```bash
backlog task edit <id> --title "新标题" --status "In Progress"
```

若未提供任何编辑字段，且终端支持交互式 TTY，系统将启动编辑向导。

#### 7.0.2.2 常用编辑选项

| 选项 | 说明 | 可多次使用 |
|------|------|-----------|
| `-t, --title <title>` | 修改标题 | 否 |
| `-d, --description <text>` | 修改描述 | 否 |
| `-a, --assignee <assignee>` | 修改负责人 | 否 |
| `-s, --status <status>` | 修改状态 | 否 |
| `-l, --label <labels>` | 重置标签 | 否 |
| `--add-label <label>` | 追加标签 | 否 |
| `--remove-label <label>` | 移除标签 | 否 |
| `--priority <priority>` | 修改优先级 | 否 |
| `--ordinal <number>` | 修改排序权重 | 否 |
| `-m, --milestone <milestone>` | 修改里程碑 | 否 |
| `--clear-milestone` | 清空里程碑 | 否 |
| `--ac <criteria>` | 追加验收标准 | 是 |
| `--remove-ac <index>` | 删除指定序号（1-based）的验收标准 | 是 |
| `--check-ac <index>` | 勾选指定序号的验收标准 | 是 |
| `--uncheck-ac <index>` | 取消勾选指定序号的验收标准 | 是 |
| `--dod <item>` | 追加 DoD 项 | 是 |
| `--remove-dod <index>` | 删除指定序号的 DoD 项 | 是 |
| `--check-dod <index>` | 勾选指定序号的 DoD 项 | 是 |
| `--uncheck-dod <index>` | 取消勾选指定序号的 DoD 项 | 是 |
| `--plan <text>` | 设置实现计划 | 否 |
| `--notes <text>` | 设置备注（覆盖现有） | 否 |
| `--append-notes <text>` | 追加备注 | 是 |
| `--final-summary <text>` | 设置最终总结 | 否 |
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
| `--modified-file <path>` | 设置关联文件（覆盖现有） | 是 |
| `--plain` | 编辑后输出纯文本格式 | 否 |

#### 7.0.2.3 验收标准操作示例

```bash
# 8 添加新的验收标准
backlog task edit back-10 --ac "新的验收项"

# 9 删除第 2 条验收标准
backlog task edit back-10 --remove-ac 2

# 10 勾选第 1 条验收标准
backlog task edit back-10 --check-ac 1

# 11 取消勾选
backlog task edit back-10 --uncheck-ac 1
```

#### 11.0.0.1 备注与总结操作示例

```bash
# 12 追加备注
backlog task edit back-10 --append-notes "新的备注内容"

# 13 设置最终总结
backlog task edit back-10 --final-summary "任务已完成，实现了..."

# 14 追加到最终总结
backlog task edit back-10 --append-final-summary "补充说明"

# 15 清除最终总结
backlog task edit back-10 --clear-final-summary
```

#### 15.0.0.1 评论操作示例

```bash
# 16 追加一条评论
backlog task edit back-10 --comment "建议将 UI 部分拆分到独立 PR"

# 17 追加评论并指定作者
backlog task edit back-10 --comment "建议将 UI 部分拆分到独立 PR" --comment-author @sara

# 18 同时追加多条评论
backlog task edit back-10 --comment "第一条评论" --comment "第二条评论"
```

评论正文支持 Markdown，但单独的 `---` 行被保留为评论分隔符，不能出现在评论正文中。评论会显示在任务详情的 **Comments** 区域，按追加顺序排列，包含序号、作者（如有）和时间戳。

评论与实现备注、最终总结的区别：

| 内容类型 | 用途 | 写入方式 |
|---------|------|---------|
| 评论 | 讨论、审阅记录、问答 | `--comment` |
| 实现备注 | 执行进度、技术探索过程 | `--notes` / `--append-notes` |
| 最终总结 | PR 式完成摘要 | `--final-summary` |

### 18.0.1 任务列表与筛选

```bash
# 19 列出所有任务
backlog task list

# 20 按状态筛选
backlog task list -s "In Progress"

# 21 按负责人筛选
backlog task list -a "@developer"

# 22 按里程碑筛选
backlog task list -m "M1 - CLI"

# 23 按优先级筛选
backlog task list --priority high

# 24 查看指定父任务的子任务
backlog task list -p back-4

# 25 按字段排序（priority 或 id）
backlog task list --sort priority

# 26 纯文本输出
backlog task list --plain
```

### 26.0.1 完成任务与归档

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

### 26.0.2 日期字段

创建或编辑任务时，可通过以下选项管理日期字段：

```bash
# 27 计划字段（date-only）
backlog task create "API 文档" --due-date 2026-06-01 --planned-start 2026-05-25 --planned-end 2026-05-30

# 28 实际字段（datetime）
backlog task create "紧急修复" --status "In Progress" --actual-start "2026-05-29 10:00"
backlog task edit back-10 --actual-end "2026-05-30 18:00" --clear-actual-start
```

- 计划字段格式为 `YYYY-MM-DD`（date-only）
- 实际字段格式为 `YYYY-MM-DD HH:MM`（UTC datetime）
- 在交互式 TTY 环境下，创建/编辑向导会提示输入日期

#### 28.0.0.1 Web UI 中的日期编辑

在任务详情弹窗的侧边栏中：

- **Due Date** / **Planned Start** / **Planned End** — `date` 输入框
- **Actual Start** / **Actual End** — `datetime-local` 输入框（支持 UTC ↔ 本地时区转换）

**自动填充规则**：当设置 Due Date 且 Planned Start 为空时，系统会自动填充 Planned Start 为当前日期、Planned End 为 Due Date 的值。你可在保存前修改这些自动填充值。

**实际时间自动填充**：当在 Web UI 中将任务状态变更为 In Progress 或 Done 时，系统会自动填充对应的 actual 字段（若为空）。

### 28.0.1 降级为草稿

若发现某个任务尚需完善、暂时无法执行，可将其降级为草稿：

```bash
backlog task demote <id>
```

降级后任务将移入 `backlog/drafts/` 目录，并获得独立的草稿 ID（如 `draft-3`）。

### 28.0.2 标签输入（Web UI）

在 Web UI 的任务详情弹窗中编辑标签时，标签输入框支持智能自动完成：

- **下拉提示**：点击标签输入框或开始输入时，会显示项目中所有已有标签的下拉列表（包含配置标签和所有任务中的标签）
- **模糊搜索**：输入时按字符顺序模糊匹配，如输入 `we` 可匹配 `web-ui`
- **键盘选择**：使用 `↑` / `↓` 箭头高亮选项，按 `Enter` 选中；按 `Escape` 关闭下拉框
- **创建新标签**：输入内容不匹配任何现有标签时，按 `Enter` 或输入逗号 `,` 即可创建新标签
- **重复检测**：如果尝试添加与已有标签仅大小写不同的重复项（如已有 `feature` 时输入 `Feature`），输入框边框会变红提示，且下拉框显示 `feature already added`

### 28.0.3 在编辑器中打开任务

#### 28.0.3.1 TUI 中编辑

在 `backlog task <id>` 或 `backlog board` 的 TUI 界面中：
- 选中目标任务
- 按 `E`（或 `Shift+e`）直接在系统编辑器中打开任务文件
- 编辑器关闭后 TUI 自动恢复，并重新加载最新内容

#### 28.0.3.2 手动编辑

任务文件即为普通 Markdown，可直接使用任何编辑器修改：

```bash
vim backlog/tasks/back-10.md
```

手动编辑后，Backlog.md 的文件监视器会自动刷新索引，无需重启服务。

## 28.1 草稿管理

草稿是 Backlog.md 中一种轻量级的任务前形态，用于记录尚未成熟的想法、待拆分的功能点或需要进一步澄清的需求。

### 28.1.1 草稿的用途

| 场景 | 说明 |
|------|------|
| 快速记录想法 | 无需填写完整字段，先保存标题和简要描述 |
| 待评审需求 | 在正式创建任务前，通过草稿收集反馈 |
| 任务拆分准备 | 将一个复杂功能先记为草稿，再细化为多个正式任务 |
| 避免污染任务列表 | 草稿不占用正式任务 ID，也不会出现在看板的默认视图中 |

### 28.1.2 创建草稿

#### 28.1.2.1 通过 task create 创建

在创建任务时添加 `--draft` 选项，即可直接生成草稿：

```bash
backlog task create "未来可能需要的功能" --draft
```

#### 28.1.2.2 通过 draft create 创建

使用草稿专属子命令，语法更简洁：

```bash
backlog draft create "未来可能需要的功能"
```

#### 28.1.2.3 带描述的草稿

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

### 28.1.3 查看草稿列表

```bash
backlog draft list
```

默认按优先级排序。可选参数：

| 选项 | 说明 |
|------|------|
| `--sort <field>` | 按 `priority` 或 `id` 排序 |
| `--plain` | 纯文本输出 |

### 28.1.4 草稿提升为任务

当草稿内容已经足够清晰，可以开始执行时，将其提升为正式任务：

```bash
backlog draft promote draft-3
```

提升后：
- 草稿文件从 `backlog/drafts/` 移入 `backlog/tasks/`
- 草稿 ID（如 `draft-3`）被替换为正式任务 ID（如 `back-15`）
- 原草稿文件被归档或删除

### 28.1.5 任务降级为草稿

若某个正式任务发现条件不成熟、需要暂缓执行，可将其降级回草稿：

```bash
backlog task demote back-10
```

降级后：
- 任务文件从 `backlog/tasks/` 移入 `backlog/drafts/`
- 原正式任务 ID 被释放，可被新任务复用
- 获得新的草稿 ID（如 `draft-5`）

### 28.1.6 Web UI 草稿页面

浏览器访问 `/drafts` 可查看草稿列表并进行筛选管理。

#### 28.1.6.1 筛选栏

页面顶部提供与任务列表一致的筛选栏：

| 控件 | 说明 |
|------|------|
| 关键字搜索 | 按草稿 ID 或标题搜索，子串匹配，支持清除按钮 |
| 状态筛选 | 下拉选择所有可用状态 |
| 优先级筛选 | 全部 / 高 / 中 / 低 |
| 里程碑筛选 | 全部里程碑 / 无里程碑 / 各个活跃里程碑 |
| 标签筛选 | 多选 chip 输入，带自动补全 |

筛选结果实时显示计数 `显示 X / Y 个草稿`。有活跃筛选时，右侧出现「清除筛选」按钮一键重置。

#### 28.1.6.2 筛选状态持久化

所有筛选条件（包括搜索词）自动同步到 URL 查询参数，页面可分享和收藏。支持的参数：

- `?status=` — 状态过滤
- `?priority=` — 优先级过滤
- `?milestone=` — 里程碑过滤（`__none` 表示无里程碑）
- `?label=` — 标签过滤（可多次出现）
- `?q=` — 关键字搜索

#### 28.1.6.3 草稿卡片与操作

每个草稿显示标题、优先级徽标、ID、创建/更新时间、负责人和标签。点击卡片可编辑草稿详情，右侧「提升为任务」按钮可将草稿提升为正式任务。

### 28.1.7 归档草稿

对于不再需要的草稿，可以直接归档：

```bash
backlog draft archive draft-2
```

归档后草稿移入 `backlog/archive/tasks/` 目录。

### 28.1.8 草稿使用独立 ID 空间

草稿与正式任务使用完全独立的编号体系：

- 正式任务 ID：`back-1`、`back-2`、`back-3`……
- 草稿 ID：`draft-1`、`draft-2`、`draft-3`……

这意味着：
- 草稿的数量不会影响正式任务的 ID 序列
- 草稿提升时会分配下一个可用的正式任务 ID
- 正式任务降级时会分配下一个可用的草稿 ID
- 删除或归档草稿后，其 ID 不会导致正式任务编号的断层

## 28.2 子任务与依赖

Backlog.md 支持通过子任务拆分复杂工作，以及通过依赖关系定义任务间的执行顺序。

### 28.2.1 子任务创建

在创建任务时，使用 `--parent`（或 `-p`）指定父任务 ID，即可创建子任务：

```bash
backlog task create "设计数据库表" -p back-4
backlog task create "实现 REST API" -p back-4
backlog task create "编写单元测试" -p back-4
```

### 28.2.2 小数编号规则

子任务使用小数编号体系，格式为 `父任务ID.序号`：

| 父任务 | 子任务 |
|--------|--------|
| `back-4` | `back-4.1`、`back-4.2`、`back-4.3` |

编号规则：
- 子任务序号按创建顺序自动递增
- 一个父任务可以拥有任意数量的子任务
- 子任务本身不能再拥有子任务（单层结构）
- 子任务在列表、看板、Web UI 中默认与父任务关联展示

### 28.2.3 查看子任务

```bash
# 29 查看指定父任务的所有子任务
backlog task list -p back-4

# 30 查看任务详情时，子任务会自动列出
backlog task view back-4
```

### 30.0.1 依赖任务设置

创建任务时，使用 `--dep`（或 `--depends-on`）指定依赖的其他任务：

```bash
backlog task create "部署到生产环境" \
  --dep "back-5,back-6" \
  --notes "需等前端和后端任务都完成后才能部署"
```

也可在任务创建后追加或修改依赖：

```bash
# 31 覆盖设置依赖
backlog task edit back-10 --dep "back-3,back-4"

# 32 依赖多个任务时可多次使用选项
backlog task edit back-10 --dep "back-3" --dep "back-4"
```

### 32.0.1 依赖关系对序列的影响

Backlog.md 会根据任务间的依赖关系自动计算**执行序列**（Sequences）：

- 无依赖、无被依赖、无 ordinal 的任务归类为 **Unsequenced**（未排序）
- 有依赖关系的任务按拓扑排序分层，形成 **Sequence 1、Sequence 2……**
- 同一 Sequence 中的任务互不依赖，可以并行执行
- 不同 Sequence 之间存在先后关系，Sequence N 的所有任务必须在 Sequence N-1 完成后才能开始

#### 32.0.1.1 查看序列

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

### 32.0.2 Web UI 依赖项钻取

在 Web 界面的任务详情面板中，**Dependencies** 区域会列出该任务的所有依赖任务。每个依赖任务以蓝色标签形式展示：

- **点击依赖任务标签**：直接打开该依赖任务的详情面板，无需返回看板或列表重新查找
- **返回按钮**：当通过点击依赖进入子任务后，任务详情面板标题栏左侧会出现 **← 返回** 箭头按钮，点击即可回到上一层父任务
- **关闭按钮**：点击右上角的 **×** 关闭按钮，会关闭整个任务浏览堆栈（无论已经钻取了多少层）

> 此功能在新建任务或编辑任务模式下不可用，仅在预览（preview）模式下生效。

#### 32.0.2.1 通过 Markdown 链接钻取

在任务描述、文档、决策记录和 Wiki 页面中，如果包含指向其他任务的 `/task/:id` 链接（如 `http://localhost:6420/task/506`），点击后也会在模态框中直接打开目标任务，体验与点击依赖标签一致：

- 支持前缀无关匹配：`/task/506` 和 `/task/BACK-506` 都能正确解析
- 系统会将完整 URL 自动渲染为短别名 `TASK#506`，提升可读性
- 钻取后同样支持返回按钮和浏览器前进/后退导航

#### 32.0.2.2 稳定 URL 与分享

每个任务都有独立的 `/task/:id/:title` URL：

```
http://localhost:6420/task/506/Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion
```

你可以直接复制地址栏链接分享给团队成员，对方打开后会以默认视图为背景显示该任务详情，并能继续钻取其依赖关系。

#### 32.0.2.3 依赖规划建议

| 建议 | 说明 |
|------|------|
| 控制依赖数量 | 过多的依赖会降低灵活性，尽量只保留真正的阻塞关系 |
| 子任务与依赖并用 | 用子任务拆分工作范围，用依赖定义执行顺序 |
| 定期检查序列 | 执行 `backlog sequence list` 识别关键路径和可并行的工作包 |
| 避免循环依赖 | 系统会自动检测循环依赖并阻止创建 |

## 32.1 搜索与序列

### 32.1.1 搜索

Backlog.md 基于 Fuse.js 提供统一的模糊搜索服务，覆盖任务、文档和决策记录。

#### 32.1.1.1 CLI 搜索

执行 `backlog search` 并在后面输入关键词，即可在所有项目中搜索：

```bash
backlog search "用户登录"
```

##### 32.1.1.1.1 过滤条件

| 选项 | 说明 | 示例 |
|------|------|------|
| `--type <type>` | 限制结果类型（`task`、`document`、`decision`） | `--type task` |
| `--status <status>` | 按任务状态过滤 | `--status "In Progress"` |
| `--priority <priority>` | 按优先级过滤（`high`、`medium`、`low`） | `--priority high` |
| `--modified-file <path>` | 按修改文件路径子串过滤 | `--modified-file src/api.ts` |
| `--limit <number>` | 限制返回结果总数 | `--limit 10` |
| `--plain` | 纯文本输出 | `--plain` |

##### 32.1.1.1.2 组合搜索示例

```bash
# 33 搜索包含 "api" 且状态为 In Progress 的任务
backlog search "api" --status "In Progress"

# 34 搜索高优先级的 bug
backlog search "bug" --priority high --type task

# 35 搜索关联了某个文件的改动
backlog search "auth" --modified-file src/auth.ts

# 36 仅搜索文档和决策
backlog search "架构" --type document --type decision
```

#### 36.0.0.1 TUI 搜索

在 `backlog board` 或 `backlog task list` 的交互式界面中，输入搜索关键词即可实时过滤列表。TUI 搜索为即时响应模式，无需按 Enter，输入即更新结果。

#### 36.0.0.2 Web 搜索

运行 `backlog browser` 启动 Web 界面后，在任务列表和看板视图中均提供搜索框。支持命令过滤（command filters）和模糊匹配，可快速定位目标任务。

### 36.0.1 序列

#### 36.0.1.1 序列概念与用途

**序列**（Sequences）是从任务依赖关系自动计算出的可并行执行的任务组。它帮助你在不手动排期的情况下，直观了解：

- **关键路径**：哪些任务必须在其他任务之前完成
- **可并行工作包**：同一序列内的任务可以由不同成员同时推进
- **项目瓶颈**：依赖链最长的路径往往决定整体工期

#### 36.0.1.2 查看序列

```bash
backlog sequence list
```

默认以交互式 TUI 展示序列视图。按 `--plain` 输出纯文本：

```bash
backlog sequence list --plain
```

#### 36.0.1.3 序列输出解读

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

#### 36.0.1.4 TUI 序列视图操作

在 `backlog sequence list` 的交互式界面中：
- 使用方向键或 `j`/`k` 浏览任务
- 按 `Enter` 查看任务详情
- 按 `m` 进入移动模式，可调整任务顺序并自动更新依赖关系
- 按 `Escape` 或 `q` 退出

#### 36.0.1.5 Web UI 序列页面

在浏览器界面中，序列页面支持拖拽重新排序。拖放任务卡片到不同序列位置时，系统会自动更新相关的依赖关系。

#### 36.0.1.6 序列对项目规划的意义

| 应用场景 | 操作 |
|----------|------|
| 规划 Sprint | 根据序列分层将任务分配到不同迭代周期 |
| 识别风险 | 关键路径上的任务延期将直接影响整体进度 |
| 资源分配 | 将同一序列中的任务分配给不同开发者并行推进 |
| 依赖审查 | 定期运行 `backlog sequence list` 检查是否存在不合理的强依赖 |

## 36.1 归档与清理

随着项目推进，已完成的任务会不断累积。Backlog.md 提供归档和清理机制，帮助你保持任务列表的整洁。

### 36.1.1 归档任务

归档是将不再活跃的任务移入 `backlog/archive/tasks/` 目录的操作，属于软删除：

```bash
backlog task archive back-10
```

归档后：
- 任务文件从 `backlog/tasks/` 移入 `backlog/archive/tasks/`
- 任务不再出现在默认的任务列表、看板和搜索结果中
- 原任务 ID 被释放，后续新建任务可以复用该编号

#### 36.1.1.1 归档草稿

草稿也可以单独归档：

```bash
backlog draft archive draft-2
```

### 36.1.2 已归档任务 ID 可复用

Backlog.md 的 ID 分配机制会自动跳过已被占用的编号。归档任务后，其原 ID 会被系统回收，后续执行 `backlog task create` 时可能分配到该编号。

> **注意**：如果其他任务或文档中通过 `dependencies`、`references` 或正文引用了已归档任务的旧 ID，这些引用不会自动更新。建议在归档前确认无重要依赖引用。

### 36.1.3 清理命令

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

### 36.1.4 归档与完成的区别

| 维度 | 归档（Archive） | 完成（Cleanup / Completed） |
|------|----------------|---------------------------|
| 触发方式 | 手动执行 `task archive` | 手动执行 `cleanup`，批量处理 |
| 目标目录 | `backlog/archive/tasks/` | `backlog/completed/` |
| 任务状态 | 任意状态均可归档 | 仅终端状态（如 Done）可被清理 |
| ID 复用 | 归档后 ID 可复用 | 移入 completed 后 ID 是否复用取决于配置 |
| 适用场景 | 废弃任务、重复任务、误创建的任务 | 正常完成但已过时、无需继续查看的历史任务 |
| 是否可恢复 | 可从 archive 目录手动移回 | 可从 completed 目录手动移回 |

### 36.1.5 维护建议

| 频率 | 建议操作 |
|------|----------|
| 每周 | 运行 `backlog cleanup`，将 2 周前已完成的任务移入 completed |
| 每月 | 审查任务列表，将无效或重复任务归档 |
| 每季度 | 检查 `backlog/completed/` 和 `backlog/archive/` 目录，决定是否删除或保留旧文件 |

保持活跃任务列表精简，有助于提升看板加载速度、改善搜索体验，并让团队聚焦于当前正在进行的工作。

# 37 看板与可视化

## 37.1 TUI 看板

在终端中运行 `backlog board`，即可启动基于字符界面的交互式看板。看板按状态分栏展示所有任务，支持键盘导航、任务移动、实时筛选和文件监控，无需离开终端即可掌握项目全貌。

### 37.1.1 启动看板

```bash
backlog board
```

首次启动时，看板会自动加载项目配置中的状态列（默认：`To Do`、`In Progress`、`Done`），并将任务按状态归入对应列。如果启用了里程碑模式，任务会按里程碑分组展示。

#### 37.1.1.1 常用启动选项

```bash
# 38 垂直布局（状态列纵向堆叠，适合窄屏终端）
backlog board --vertical

# 39 显式指定布局方向
backlog board --layout vertical
backlog board --layout horizontal

# 40 里程碑分组模式（按里程碑泳道展示任务）
backlog board --milestones
```

### 40.0.1 键盘导航

看板启动后，使用以下按键进行操作：

| 按键 | 操作 |
|------|------|
| `↑` `↓` `←` `→` | 在看板中移动选择焦点 |
| `Enter` | 打开当前选中任务的详情弹窗 |
| `E` | 在系统编辑器中打开当前任务文件（TUI 自动挂起，退出编辑器后恢复） |
| `Tab` | 在看板视图与任务列表视图之间切换 |
| `M` | 进入/确认看板移动模式 |
| `Q` | 退出看板 |

> **提示**：按 `E` 编辑任务时，TUI 会自动挂起并恢复，无需手动重启看板。

### 40.0.2 看板移动模式

移动模式允许你直接在终端中变更任务状态：

1. 在看板中用方向键选中要移动的任务。
2. 按 `M` 进入移动模式，当前任务会被标记为待移动状态。
3. 使用 `←` `→` 选择目标状态列，用 `↑` `↓` 调整插入位置。
4. 再次按 `M` 或 `Enter` 确认移动，任务状态即刻更新并同步到 Markdown 文件。
5. 按 `Esc` 可取消移动并恢复原位。

> **注意**：来自其他分支的跨分支任务无法在看板中直接移动，系统会在底部状态栏提示原因。

### 40.0.3 任务列表与筛选

按 `Tab` 键可从看板切换至任务列表视图。列表视图支持更精细的筛选：

- **状态筛选**：只显示特定状态的任务。
- **负责人筛选**：按 `@用户名` 过滤。
- **标签筛选**：按标签多选过滤。
- **里程碑筛选**：只显示归属某一里程碑的任务。
- **优先级筛选**：高 / 中 / 低。
- **搜索框**：实时模糊匹配任务标题与描述。

在列表视图底部，按对应快捷键打开筛选面板，勾选条件后列表会即时刷新。筛选条件在看板视图与列表视图之间共享，返回看板后仍保持生效。

#### 40.0.3.1 紧凑视图

当终端高度有限时，列表视图会自动切换为紧凑模式，隐藏部分元数据，仅保留任务 ID、标题和状态，确保在小型终端窗口中也能浏览大量任务。

### 40.0.4 实时文件监控

TUI 看板底层使用文件系统监控（`Bun.watch`），当以下情况发生时，看板会自动刷新：

- 在 Web UI 或其他终端中修改了任务状态
- 通过 `backlog task edit` 命令更新了任务
- AI 代理通过 MCP 工具修改了任务文件

这意味着你可以同时打开 TUI 看板和 Web 界面，任意一侧的改动都会实时同步到另一侧。

### 40.0.5 非终端环境的纯文本回退

当 `backlog board` 运行在非 TTY 环境（如 CI 流水线、脚本管道、IDE 集成终端）时，它会自动回退为纯文本输出，打印结构化的 Markdown 看板表格，而非启动交互式界面：

```bash
# 41 在 CI 中查看看板状态
backlog board > board-status.md
```

纯文本输出包含项目名、时间戳、各状态列的任务清单以及负责人和标签等元数据，便于存档和邮件分享。

### 41.0.1 同时运行多个视图

`backlog board` 与 `backlog browser` 可以并行运行。终端看板适合专注编码时快速查看状态，Web 界面适合详细编辑和拖拽操作，两者数据完全互通。

## 41.1 Web 看板

运行 `backlog browser` 即可启动基于浏览器的可视化任务管理界面。Web 看板基于 React + Tailwind CSS v4 构建，支持拖拽操作、里程碑泳道、标签筛选和实时同步，是团队协作者和偏好图形界面用户的首选工具。

### 41.1.1 启动 Web 界面

```bash
# 42 默认启动：端口 6420，自动打开系统默认浏览器
backlog browser

# 43 指定自定义端口
backlog browser --port 8080

# 44 启动但不自动打开浏览器（适合远程服务器或后台运行）
backlog browser --no-open
```

启动成功后，终端会显示服务地址，例如 `http://localhost:6420`。按 `Ctrl+C`（或 `Cmd+C`）即可停止服务。

> **提示**：可通过配置 `autoOpenBrowser` 和 `defaultPort` 修改默认行为，详见配置管理章节。

### 44.0.1 看板视图

打开 Web 界面后，默认进入看板视图。界面按状态分为多列，每列显示对应状态的任务卡片：

#### 44.0.1.1 拖放操作

- **跨列移动**：按住任务卡片，拖拽到目标状态列即可变更任务状态。
- **调整顺序**：在同一列内上下拖拽，可调整任务在看板中的展示顺序。
- **撤销支持**：所有拖放操作都会实时写入 Markdown 文件，并可通过 Git 回溯。

#### 44.0.1.2 里程碑泳道

启用里程碑视图后，看板会在每列内按里程碑分组展示任务卡片。同一里程碑的任务聚集在一起，形成清晰的横向泳道，方便按迭代或版本追踪进度。

#### 44.0.1.3 标签筛选

看板顶部提供标签筛选下拉框，点击后勾选需要的标签，看板会即时过滤只显示匹配标签的任务。支持多标签组合筛选。

### 44.0.2 所有任务视图

点击导航栏的「所有任务」，切换到表格布局：

- 支持按状态、优先级、标签、里程碑进行多维度筛选
- 表头点击可排序
- 顶部搜索框基于 Fuse.js 实现模糊搜索，实时返回结果

### 44.0.3 甘特图视图

点击导航栏的「甘特图」，进入时间线可视化页面：

- 左侧任务列表 + 右侧时间线双栏布局
- 五级时间粒度切换（日 / 周 / 月 / 季度 / 年）
- 自动解析任务起止时间（`plannedStart` / `plannedEnd` / `createdDate`）
- 任务依赖关系以 SVG 箭头可视化
- 支持拖拽平移时间轴

详见[甘特图视图](../40-Web界面/09-甘特图视图.md)章节。

### 44.0.4 里程碑管理页

导航栏的「里程碑」提供完整的里程碑生命周期管理：

- **创建里程碑**：点击「添加里程碑」按钮，输入名称即可创建。
- **里程碑详情**：每个里程碑卡片展示归属任务数和完成进度。
- **拖放分配**：从未分配任务池中将任务拖拽到目标里程碑，或反向移除。
- **完成检测**：当里程碑下所有任务都进入 `Done` 状态时，系统自动将该里程碑标记为已完成。
- **已完成的里程碑**：默认折叠在页面底部，减少视觉干扰。

### 44.0.5 文档与决策查看

Web 界面还提供项目知识库的只读浏览：

- **文档列表**：按子文件夹分组展示 `backlog/docs/` 下的全部文档，点击标题即可查看 Markdown 渲染内容。
- **决策记录**：展示 `backlog/decisions/` 中的 ADR 决策，包含状态标签和创建时间。

### 44.0.6 实时更新

Web 服务端通过 WebSocket 向所有连接的客户端广播文件变更：

- 在终端用 `backlog task edit` 修改任务后，浏览器中的看板会在 1 秒内自动刷新。
- 在 Web 界面中编辑任务时，如果其他用户或进程同时修改了同一文件，界面会智能合并变更，避免覆盖。
- 草稿保留：正在编辑但未保存的内容，在文件刷新后会被保留，不会丢失。

### 44.0.7 暗黑模式与响应式

Web 界面自动跟随系统主题切换暗黑模式，也支持手动切换。布局针对桌面和移动端做了响应式适配：

- **桌面端**：多列看板并排，适合大屏浏览。
- **移动端**：单列堆叠，支持触摸滑动和长按拖拽。

### 44.0.8 Mermaid 图表与附件

任务 Markdown 中若包含 Mermaid 语法，Web 界面会自动渲染为流程图、时序图或甘特图。`backlog/assets/` 目录下的图片和附件可通过相对路径直接在任务详情中预览。

## 44.1 看板导出

看板导出功能将当前项目状态生成静态 Markdown 文件，便于在 README 中嵌入、发送邮件汇报或存档到版本控制中。

### 44.1.1 导出为 Markdown 表格

```bash
# 45 导出到默认文件 Backlog.md
backlog board export

# 46 导出到指定文件
backlog board export project-status.md

# 47 强制覆盖已存在的文件
backlog board export --force
```

导出文件包含以下内容：

- **项目标题与导出时间戳**
- **版本标注**（若指定了 `--export-version`）
- **按状态分列的 Markdown 表格**，每行显示任务 ID、标题、负责人和标签
- **元数据汇总**：各状态任务数量、完成百分比

> **注意**：默认导出目标为项目根目录的 `Backlog.md`。若该文件已存在且未加 `--force`，命令会提示确认是否覆盖。

### 47.0.1 嵌入 README.md

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

### 47.0.2 导出版本标注

在发布节点或里程碑完成时，可为导出内容附加版本信息：

```bash
# 48 简单版本号
backlog board export --export-version "v1.2.3"

# 49 组合使用：嵌入 README 并标注版本
backlog board export --readme --export-version "Release 2024.12.1-beta"
```

版本字符串会显示在导出表格的标题下方，方便与历史导出记录区分。

### 49.0.1 自动化导出示例

在 CI/CD 或发布脚本中集成看板导出：

```bash
# 50 发布前自动更新 README 看板
backlog board export --readme --force --export-version "$GITHUB_REF_NAME"
git add README.md Backlog.md
git commit -m "chore: update board snapshot"
```

> **提示**：由于 `backlog board export` 是纯读取操作，即使在没有写权限的 CI 环境中也能安全执行。若需提交结果，请确保流水线配置了相应的 Git 凭据。

# 51 文档与决策

## 51.1 文档管理

Backlog.md 将项目文档作为一等公民管理。所有文档存储在 `backlog/docs/` 目录下，以 Markdown 文件形式保存，支持嵌套子文件夹、全局 ID 索引和 CLI 全生命周期操作。

### 51.1.1 创建文档

```bash
# 52 最简创建
backlog doc create "API 设计指南"

# 53 指定文档类型
backlog doc create "架构决策说明" -t guide

# 54 创建到子目录
backlog doc create "部署手册" -p guides/deployment
```

创建成功后，CLI 会输出生成的文件路径，例如 `backlog/docs/guides/deployment/doc-5 - 部署手册.md`。文档 ID（如 `doc-5`）在整个 `backlog/docs/` 树中全局唯一，无论文件位于哪个子文件夹，都可以通过该 ID 进行查看和更新。

#### 54.0.0.1 子路径规则

- 路径总是相对于 `backlog/docs/` 目录，无需写绝对路径。
- 支持多级嵌套，例如 `-p guides/deployment/aws`。
- 不允许使用 `..` 或绝对路径，系统会自动拒绝越级访问。

### 54.0.1 更新文档

```bash
# 55 更新文档内容
backlog doc update doc-5 --content "## 部署步骤\n\n1. 构建镜像\n2. 推送仓库"

# 56 同时更新标题、类型和标签
backlog doc update doc-5 --title "生产环境部署手册" -t runbook --tags deploy,aws

# 57 移动到新的子目录
backlog doc update doc-5 -p guides/production
```

`backlog doc update` 采用增量更新策略：只提供需要修改的字段，未提供的字段会保持原值不变。例如仅传入 `--title` 时，文档内容和路径均不受影响。

### 57.0.1 列出文档

```bash
backlog doc list
```

该命令扫描 `backlog/docs/` 及其所有子目录，输出全部文档的 ID、标题、类型和所在路径。当文档数量较多时，可结合 `backlog search` 进行模糊查找：

```bash
backlog search "部署"
```

搜索范围同时覆盖任务、文档和决策记录。

### 57.0.2 查看文档

```bash
# 58 交互式查看（TUI 弹窗渲染 Markdown）
backlog doc view doc-5

# 59 纯文本输出（适合 AI 代理或脚本解析）
backlog doc view doc-5 --plain
```

`--plain` 标志会输出原始 Markdown 内容与 frontmatter 元数据，方便在流水线或聊天窗口中直接阅读。

### 59.0.1 文档组织建议

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

> **提示**：`backlog doc list` 和 `backlog doc view` 会自动穿透所有子目录，无需记忆文件具体存放位置，只需记住文档 ID 即可。

## 59.1 决策记录

决策记录（Architecture Decision Records，ADR）用于追踪项目中的关键技术与设计选择。Backlog.md 原生支持 ADR 格式，所有决策以 Markdown 文件形式保存在 `backlog/decisions/` 目录中，包含状态元数据和完整上下文。

### 59.1.1 创建决策记录

```bash
# 60 默认状态为 proposed（提议）
backlog decision create "使用 PostgreSQL 作为主数据库"

# 61 创建时直接指定状态
backlog decision create "迁移到 TypeScript" -s accepted
```

创建成功后，系统会在 `backlog/decisions/` 下生成类似 `decision-3 - 迁移到-TypeScript.md` 的文件。文件 frontmatter 中包含 `status` 字段，用于标识决策当前所处的生命周期阶段。

### 61.0.1 状态流转

决策记录支持五种标准状态，反映从提出到退出的完整生命周期：

| 状态 | 含义 |
|------|------|
| `proposed` | 已提出，待讨论或评审 |
| `accepted` | 已接受，成为项目现行标准 |
| `rejected` | 已拒绝，不采纳该方案 |
| `deprecated` | 曾接受但已废弃，不再适用 |
| `superseded` | 已被新的决策替代 |

状态变更通过直接编辑决策文件的 frontmatter 完成，也可借助 MCP 工具或 Web 界面修改。建议在正文中记录状态变更的原因和时间，保持审计轨迹完整。

### 61.0.2 列出决策

```bash
backlog decision list
```

输出包含所有决策的 ID、标题和当前状态。已完成处理的决策（`accepted`、`rejected`、`deprecated`、`superseded`）通常与活跃决策一同展示，便于快速查阅历史选择。

```bash
# 62 纯文本输出（适合脚本处理）
backlog decision list --plain
```

### 62.0.1 ADR 格式简介

生成的决策记录文件遵循标准 ADR 结构：

```markdown
---
status: proposed
date: 2026-05-07
---

# 63 迁移到 TypeScript

## 63.1 背景

项目目前使用 JavaScript，随着代码量增长，类型安全问题日益突出……

## 63.2 决策

全面迁移到 TypeScript，使用严格模式。

## 63.3 后果

- 正向：编译期类型检查、更好的 IDE 支持、降低运行时错误
- 负向：初期迁移成本、团队成员学习曲线
```

#### 63.3.0.1 字段说明

- **status**：决策当前状态，必填。
- **date**：创建日期，自动生成。
- **背景（Context）**：描述问题背景和约束条件。
- **决策（Decision）**：明确陈述做出的决定。
- **后果（Consequences）**：列出该决策带来的正面和负面影响。

### 63.3.1 与任务和文档的关联

在任务创建或编辑时，可通过 `--doc` 选项关联相关决策记录：

```bash
backlog task create "升级构建工具到 Vite" --doc decision-3
```

这样在看板或任务详情中，可以直接跳转到关联的决策上下文，避免重复讨论已定论的技术选型。

### 63.3.2 最佳实践

- **及时记录**：在技术讨论结束后的 24 小时内创建决策记录，防止细节遗忘。
- **保持精简**：每个决策聚焦一个问题，避免将多个不相关的选择混在同一文件中。
- **状态透明**：一旦决策被替代或废弃，立即更新状态为 `superseded` 或 `deprecated`，并在正文中引用替代方案。
- **定期回顾**：每季度运行 `backlog decision list`，检查是否存在长期停留在 `proposed` 状态的决策，推动闭环。

## 63.4 里程碑管理

里程碑用于将任务按迭代、版本或发布周期分组，是追踪阶段进度和规划路线图的核心工具。Backlog.md 的里程碑数据以 Markdown 文件形式存储在 `backlog/milestones/` 目录中，与任务文件共同纳入版本控制。

### 63.4.1 创建里程碑

目前里程碑的创建主要通过 Web 界面完成：

1. 运行 `backlog browser` 启动 Web 界面。
2. 点击导航栏的「里程碑」进入里程碑管理页。
3. 点击「添加里程碑」按钮，输入里程碑名称（例如 `M3 - Web UI`）。
4. 点击保存，系统会在 `backlog/milestones/` 下生成对应的里程碑文件。

> **提示**：AI 代理用户可通过 MCP 工具的 `milestone_add` 直接创建里程碑，无需打开浏览器。

### 63.4.2 编辑里程碑

通过 CLI 编辑里程碑的标题、描述和日期字段：

```bash
backlog milestone edit M1 --title "M1 - 核心 CLI" --description "第一阶段目标" \
  --due-date 2026-06-30 --planned-start 2026-05-01 --planned-end 2026-06-15 \
  --actual-start "2026-05-01 09:00" --actual-end "2026-06-10 18:00"

# 64 清空日期字段
backlog milestone edit M1 --clear-due-date --clear-planned-end --clear-actual-start
```

- 支持通过标题或 ID 定位里程碑（模糊匹配）。
- 计划字段（`dueDate` / `plannedStart` / `plannedEnd`）格式为 `YYYY-MM-DD`。
- 实际字段（`actualStart` / `actualEnd`）格式为 `YYYY-MM-DD HH:MM`（UTC）。
- 传空字符串可清空对应字段。

#### 64.0.0.1 Web UI 中的里程碑日期编辑

在里程碑管理页点击里程碑卡片，可打开编辑弹窗：

- **Due Date** / **Planned Start** / **Planned End** — `date` 输入框
- **Actual Start** / **Actual End** — `datetime-local` 输入框

里程碑的 `actualStart` / `actualEnd` 由下属任务的状态变化自动驱动：
- 当里程碑下任一任务变更为 In Progress 时，若 `actualStart` 为空，自动设为当前日期时间
- 当里程碑下最后一个非终态任务变更为 Done 时，若 `actualEnd` 为空，自动设为当前日期时间
- 你可以随时手动覆盖这些自动填充值

### 64.0.1 里程碑列表与详情

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

#### 64.0.1.1 查看已完成的里程碑

默认情况下，已完成的里程碑会被折叠，减少信息噪音。如需展开：

```bash
backlog milestone list --show-completed
```

纯文本输出（适合脚本解析）：

```bash
backlog milestone list --plain
```

### 64.0.2 任务分配到里程碑

将任务归属到某个里程碑有三种方式：

#### 64.0.2.1 1. 创建任务时指定

```bash
backlog task create "实现看板拖拽" -m "M2 - MCP 支持"
```

`-m` 选项支持模糊匹配，系统会自动找到最接近的里程碑。也可以使用里程碑 ID（如 `m-2`）或纯数字（如 `2`）。

#### 64.0.2.2 2. 编辑现有任务

```bash
backlog task edit 7 --milestone "M2 - MCP 支持"
```

#### 64.0.2.3 3. 清除里程碑归属

```bash
backlog task edit 7 --clear-milestone
```

#### 64.0.2.4 4. Web 界面拖放分配

在 Web 界面的里程碑管理页中，「未分配任务池」展示了所有没有里程碑归属的任务。将任务卡片拖拽到目标里程碑卡片中即可完成分配，反向拖拽则可移除。

### 64.0.3 里程碑完成检测与归档

#### 64.0.3.1 自动完成检测

当一个里程碑下的所有任务都进入 `Done` 状态时，系统会自动将该里程碑标记为已完成。在 `backlog milestone list` 中，它会从「Active milestones」区域移动到「Completed milestones」区域。

#### 64.0.3.2 归档里程碑

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

### 64.0.4 未分配任务池

未归属任何活跃里程碑的任务构成了「未分配任务池」。在 Web 界面的里程碑页中，这些任务集中展示在页面顶部，方便你：

- 快速审视尚未纳入迭代规划的工作项
- 批量拖拽分配到合适的里程碑
- 识别遗漏或需要重新排期的任务

在终端中，未分配任务不会在 `backlog milestone list` 中显示，但可以通过筛选查看：

```bash
backlog task list --milestone ""
```

### 64.0.5 在看板中按里程碑分组

TUI 看板和 Web 看板都支持里程碑分组模式：

```bash
# 65 TUI 看板按里程碑泳道展示
backlog board --milestones
```

在此模式下，看板不再单纯按状态分列，而是在每列内按里程碑形成横向泳道，帮助你直观对比各迭代的剩余工作量。

# 66 Web 界面

## 66.1 启动与访问

Backlog.md 内置了一个现代化的 Web 界面，让你在浏览器中直观管理任务、看板、里程碑和文档。通过 `backlog browser` 命令即可一键启动。

### 66.1.1 启动 Web 服务器

打开终端，进入 Backlog.md 项目目录，执行以下命令：

```bash
backlog browser
```

服务器启动后，将自动在默认浏览器中打开界面地址。控制台会显示类似如下信息：

```
🚀 Backlog Web UI running at http://localhost:6420
```

### 66.1.2 命令行选项

#### 66.1.2.1 指定端口

如果默认端口 `6420` 已被占用，可通过 `--port` 参数指定其他端口：

```bash
backlog browser --port 8080
```

启动后，在浏览器中访问 `http://localhost:8080` 即可进入界面。

#### 66.1.2.2 禁止自动打开浏览器

若不需要自动弹出浏览器窗口（例如在远程服务器或 CI 环境中运行），添加 `--no-open` 参数：

```bash
backlog browser --no-open
```

此时需手动复制控制台输出的地址到浏览器中访问。

#### 66.1.2.3 组合使用

```bash
backlog browser --port 3000 --no-open
```

### 66.1.3 技术特性

Web 界面采用以下技术构建，确保流畅的使用体验：

- **React**：组件化交互界面，页面切换无刷新
- **Tailwind CSS v4**：现代化样式系统，界面简洁统一
- **响应式布局**：自动适配桌面端和移动端屏幕尺寸
- **暗黑模式**：支持系统主题自动切换，也可手动切换亮色 / 暗色模式

### 66.1.4 实时同步

Web 界面与本地 Markdown 文件保持实时同步：

- 在浏览器中修改任务状态或内容，会自动写回到对应的 Markdown 文件
- 在外部编辑器（如 VS Code、Vim）中修改文件，Web 界面会即时刷新显示最新内容
- 无需手动刷新页面，所有视图均通过 WebSocket 实时更新

### 66.1.5 界面布局

Web 界面采用经典的左右布局：

- **左侧边栏**：占据固定宽度，展示导航菜单和文件树
- **右侧内容区**：占据剩余空间，展示任务、看板、文档或 Wiki 内容

#### 66.1.5.1 调整侧边栏宽度

将鼠标移到侧边栏右边缘，光标变为左右箭头时按住拖拽，即可调整侧边栏宽度。拖拽过程中会显示一条蓝色 ghost bar 预览最终位置，松开鼠标后宽度立即生效并自动保存到浏览器本地存储（`localStorage`），下次打开时恢复上次设置的宽度。

- 最小宽度限制为 **200px**，防止侧边栏缩至不可见
- 最大宽度限制为 **500px**，避免占用过多内容区空间

#### 66.1.5.2 折叠侧边栏

侧边栏中部右侧有一个折叠/展开按钮（箭头图标），点击可将侧边栏收起为仅显示图标的最窄模式，再次点击恢复展开。折叠状态与宽度设置均保存到 `localStorage`。

### 66.1.6 停止服务

在运行 `backlog browser` 的终端中按下 `Ctrl + C`，即可停止 Web 服务器。所有已保存的更改均已写入文件系统，数据不会丢失。

## 66.2 看板视图

看板视图以列式布局展示任务，直观反映每个任务当前所处的状态。通过拖拽操作即可快速变更任务状态，无需打开任务详情页。

### 66.2.1 进入看板页面

启动 Web 界面后，点击顶部导航栏的「看板」标签，即可进入看板视图页面。页面默认展示以任务状态划分的列布局。

### 66.2.2 拖放变更任务状态

看板页面将任务按状态分列展示，常见列包括：

- **Todo** — 待办任务
- **In Progress** — 进行中任务
- **Done** — 已完成任务

将鼠标悬停在目标任务卡片上，按住左键拖动卡片，移动到目标状态列后松开，任务状态即自动更新。状态变更会实时同步到对应的 Markdown 文件。

> 拖动过程中，目标列会高亮显示，提示可放置区域。

#### 66.2.2.1 拖拽行为细节

- **保持列排序**：如果当前列已手动排序（如按 ID 降序），拖拽期间视觉顺序保持稳定，不会在光标下重新排序
- **跨列精确放置**：将任务拖入目标列时，可以放置到该列中任意两个现有任务之间。系统会根据你松开鼠标时的视觉位置插入任务，而非简单地追加到列末尾
- **跨列后排序恢复**：任务跨列放置后，目标列的手动排序会自动清除，恢复为默认的 ordinal 排序，确保新任务出现在正确位置

### 66.2.3 里程碑泳道

若项目中存在里程碑，看板页面支持以里程碑为维度划分泳道。在页面上方找到里程碑筛选或视图切换控件，点击选择「按里程碑分组」。

每个里程碑展开为一个横向泳道，泳道内再按状态分列显示任务。这种视图便于追踪特定里程碑的推进情况。

### 66.2.4 标签筛选

页面顶部提供标签筛选下拉框。点击下拉框，勾选需要筛选的标签，看板将只显示带有选中标签的任务。

- 支持多选标签，任务只需匹配任一选中标签即可显示
- 取消勾选或点击「清除筛选」可恢复显示全部任务

#### 66.2.4.1 自定义标签颜色

每个标签右侧有一个彩色小方块（颜色 swatch），点击可打开颜色选择器，为标签设置自定义颜色。

- **预设调色板**：提供 17 种预设颜色，自动适配亮色/暗色模式
- **持久化**：非默认颜色配置保存到 `backlog/config.yml` 的 `label_colors` 字段，重启服务后仍然有效
- **默认恢复**：选择「Default」并保存可恢复为系统默认灰色
- **卡片渲染**：看板任务卡片上的标签会显示配置的背景色，未配置的标签保持默认灰色

> 标签颜色配置按项目独立存储，不同项目可拥有不同的标签配色方案。

### 66.2.5 任务卡片标签

每张任务卡片底部会显示该任务的标签列表。

- **宽度自适应**：卡片会根据自身可用宽度动态计算能显示多少标签，尽可能多地展示，超出部分以 `+N` 折叠
- **实时响应**：调整窗口大小或侧边栏宽度时，标签显示数量会自动重新计算
- **标签颜色**：已配置自定义颜色的标签会以对应背景色显示

### 66.2.6 列内排序

每列右上角有一个「⋮」列操作按钮，点击展开排序菜单：

#### 66.2.6.1 本地排序（6 个选项）

菜单上半部分提供 6 个纯展示排序选项：

- **ID ↑ / ID ↓**：按任务 ID 升序/降序排列
- **标题 ↑ / 标题 ↓**：按任务标题字母顺序升序/降序排列
- **优先级 ↑ / 优先级 ↓**：按优先级升序/降序排列

本地排序仅影响当前看板列的展示顺序，**不会保存到后端**。选中后再次展开菜单，激活的排序项会以深色背景高亮显示，右侧出现 `×` 按钮，点击即可清除排序，恢复按原始顺序（ordinal）显示。

> 拖拽任务卡片或执行下方的「Apply Priority Order」后，本地排序会自动清除。

#### 66.2.6.2 跨分支任务的列菜单

当某一列包含来自其他分支的任务（cross-branch tasks）时，列操作菜单仍然可见，但部分操作会受到限制：

- **本地排序选项**（ID/标题/优先级）仍可正常使用，因为这些仅影响视图展示顺序，不会修改任何持久化数据
- **Apply Priority Order** 按钮会被隐藏，因为该操作会修改当前列所有任务的 `ordinal` 字段，而跨分支任务不应被当前分支的排序操作影响

> 跨分支任务在卡片上会显示分支来源标识。当列中所有任务均属于当前分支时，Apply Priority Order 恢复正常显示。

#### 66.2.6.3 按优先级重排（保存）

菜单底部（以分隔线与上方隔开）提供「按优先级重排（保存）」选项：

- 一键将当前列所有任务按优先级（高 → 中 → 低）重新排列
- 新顺序会保存到后端，刷新页面后仍然保持
- 图标为列表+向上箭头，表示这是一个持久化操作

### 66.2.7 任务卡片日期指示器

看板中的每张任务卡片会显示日期信息（如已设置）：

- **头部**：日历图标 + `plannedStart ~ plannedEnd` 计划日期范围。当年份与当前年一致时自动省略年份，减少视觉噪音。
- **脚部**：时钟图标 + `dueDate` 截止日期，紧邻相对创建时间显示。
- **逾期高亮**：当任务未处于终端状态（Done / Cancelled）且截止日期已过时，`dueDate` 以红色高亮显示（`text-red-600 dark:text-red-400 font-semibold`）。

### 66.2.8 打开任务详情

点击看板中的任意任务卡片，即可打开任务详情模态框：

- 底层看板页面保持可见，地址栏自动更新为 `/task/:id/:title`
- 支持依赖项钻取导航：在任务详情中点击依赖标签可进一步查看子任务
- 任务详情中包含 **Comments** 区域，可查看和追加评论（编辑模式下）
- 关闭模态框后回到原来的看板视图，保留当前的标签筛选和列排序状态
- 直接访问 `/task/:id` 链接时，系统会以看板为背景打开对应任务

> 看板中的任务卡片本身不支持拖放与点击同时触发；开始拖拽后松开即完成状态变更，不会误打开任务详情。

### 66.2.9 实时更新

看板视图支持多人协作场景下的实时同步：

- 其他用户在 Web 界面中拖放任务，你的页面会自动更新卡片位置
- 外部编辑器修改任务文件后，看板列中的卡片内容和状态会自动刷新
- 新建或删除任务后，看板会即时反映变化，无需手动刷新

## 66.3 任务列表

「所有任务」页面以表格形式展示项目中的全部任务，支持多维度筛选和搜索，适合快速定位和管理大量任务。

### 66.3.1 进入任务列表页面

启动 Web 界面后，点击顶部导航栏的「所有任务」标签，进入任务列表页面。页面以表格布局展示任务 ID、标题、状态、优先级、负责人、标签和关联里程碑等关键信息。

### 66.3.2 使用筛选器

表格上方提供一组筛选控件，可叠加使用以精确查找任务。

#### 66.3.2.1 按状态筛选

点击「状态」下拉框，勾选需要查看的状态。支持同时选择多个状态，例如同时勾选 **Todo** 和 **In Progress**，表格将展示待办和进行中的全部任务。

点击「清除」或取消所有勾选，恢复显示所有状态的任务。

#### 66.3.2.2 按优先级筛选

点击「优先级」下拉框，选择 **High**、**Medium** 或 **Low**。优先级筛选为单选模式，切换后将只展示对应优先级的任务。

#### 66.3.2.3 按标签筛选

点击「标签」下拉框，勾选目标标签。支持多选，任务只需包含任一选中标签即可匹配显示。

#### 66.3.2.4 按里程碑筛选

点击「里程碑」下拉框，选择特定里程碑，表格将只展示归属于该里程碑的任务。选择「无里程碑」可筛选出未分配里程碑的任务。

### 66.3.3 使用搜索框

在筛选器右侧的搜索框中输入关键词，按下回车或等待自动搜索，系统将模糊匹配任务标题、描述和正文内容。

#### 66.3.3.1 搜索类型下拉

搜索框左侧有一个图标按钮，点击可展开搜索类型下拉菜单：

- **All（全部）**：默认选项，搜索所有内容类型（任务、文档、决策、Wiki）
- **Tasks（任务）**：仅搜索任务
- **Documents（文档）**：仅搜索文档
- **Decisions（决策）**：仅搜索决策记录
- **Wiki**：仅搜索 Wiki 知识库页面

切换类型后，搜索会立即以新的范围重新执行。各选项使用与侧边栏导航一致的图标，便于快速识别。

#### 66.3.3.2 搜索技巧

- 搜索支持中文和英文
- 可与筛选器叠加使用，先筛选后搜索，进一步缩小范围
- 清空搜索框内容后，列表恢复显示当前筛选条件下的全部任务

### 66.3.4 进入任务详情

在表格中找到目标任务，点击该行任意位置（通常为任务标题或 ID），即可打开任务详情模态框。

#### 66.3.4.1 模态框与背景页面

任务详情以**模态框（Modal）**形式展示在屏幕中央，底层页面（任务列表）保持可见：

- 模态框覆盖在当前页面上方，背景页面略微变暗但仍可辨识
- 关闭模态框后自动回到原来的任务列表页面，不会丢失当前的筛选和排序状态
- 直接访问 `/task/:id` 链接（如 `/task/506`）时，系统会以任务列表为背景打开对应任务模态框

#### 66.3.4.2 稳定 URL 与分享

打开任务详情时，地址栏会自动更新为 `/task/:id/:title` 格式：

```
http://localhost:6420/task/506/Fix-CLI-actualStart-actualEnd-missing-local-to-UTC-conversion
```

- URL 支持前缀无关匹配：`/task/506` 和 `/task/BACK-506` 都能正确打开同一任务
- 裸 `/task/:id` 链接会自动重定向到带标题 slug 的完整 URL
- 你可以直接复制地址栏链接分享给团队成员，对方打开后将以默认视图（看板）为背景显示该任务详情

#### 66.3.4.3 依赖项钻取

在任务详情的 **Dependencies** 区域，每个依赖任务以蓝色标签展示。点击标签即可**钻取进入**该依赖任务，无需返回列表重新查找：

- 钻取后模态框标题栏左侧出现 **← 返回** 按钮，点击回到上一层任务
- 支持连续钻取多层依赖关系（如 A → B → C）
- 浏览器的前进/后退按钮也能正确遍历钻取历史
- 点击右上角 **×** 关闭按钮，关闭整个浏览堆栈

> 钻取导航仅在预览模式下可用，新建或编辑任务模式下点击依赖标签无效。

#### 66.3.4.4 评论

在任务详情的 **Comments** 区域，你可以查看该任务的所有评论：

- **预览模式**：评论以只读形式展示，包含序号、作者（如有）、时间戳和 Markdown 渲染后的正文
- **编辑模式**：点击模态框右上角的 **Edit** 按钮进入编辑模式，Comments 区域底部会出现评论输入表单
  - **Author** 输入框：可选，填写评论作者名称
  - **Add a comment...** 文本框：输入评论正文，支持 Markdown
  - **Add comment** 按钮：提交评论，提交后模态框保持在编辑模式并刷新评论列表
- 跨分支的只读任务显示评论但不提供输入表单
- 评论正文支持 Markdown，但单独的 `---` 行不能出现在评论中（保留为分隔符）

### 66.3.5 表格排序

任务列表的所有表头列（ID、标题、状态、优先级、里程碑、创建时间）均支持点击排序。

#### 66.3.5.1 双箭头排序图标

每列表头右侧显示一组双箭头图标：

- **未激活**：`↑` 和 `↓` 两支箭头均为淡灰色
- **升序激活**：左侧 `↑` 高亮显示，右侧 `↓` 保持灰色
- **降序激活**：右侧 `↓` 高亮显示，左侧 `↑` 保持灰色

点击表头即可按该列排序。再次点击同一列头，切换升序/降序方向。点击其他列头，则按新列重新排序。

> 三种状态的外框宽度完全一致，切换排序方向时表头文字不会产生抖动。

## 66.4 里程碑管理

里程碑用于将任务分组到阶段性目标中，便于追踪项目整体进度。Web 界面提供完整的里程碑列表、详情查看和任务分配功能。

### 66.4.1 进入里程碑页面

启动 Web 界面后，点击顶部导航栏的「里程碑」标签，进入里程碑管理页面。页面分为左右两栏：左侧为里程碑列表，右侧为选中里程碑的详情视图。

### 66.4.2 查看里程碑列表

左侧列表展示项目中所有活跃的里程碑，每个条目显示里程碑名称、描述摘要和完成进度。点击列表中的任意里程碑，右侧详情区将加载该里程碑的完整信息。

### 66.4.3 查看里程碑详情

在右侧详情区中，可查看里程碑的以下信息：

- 名称与描述
- 日期字段：`dueDate`、`plannedStart`、`plannedEnd`（如有设置）
- 归属该里程碑的全部任务列表
- 各状态任务的数量统计
- 完成进度百分比

点击任务列表中的任意任务标题，可跳转至任务编辑页面查看或修改详情。

### 66.4.4 编辑里程碑

在里程碑列表中点击目标里程碑，进入详情视图后：

- 点击「编辑」按钮打开里程碑编辑弹窗
- 可修改里程碑名称、描述
- 可设置或清空三个日期字段：**Due Date**、**Planned Start**、**Planned End**
- 保存后 Markdown 文件同步更新

> 里程碑卡片上会直接显示日期信息（如有），便于在列表中快速识别时间节点。

### 66.4.5 未分配任务池

在里程碑列表上方或详情区附近，找到「未分配任务」区域。该区域展示当前未归属任何里程碑的任务列表，相当于任务分配前的暂存池。

浏览未分配任务，找到需要归类的目标条目。

### 66.4.6 拖放分配任务到里程碑

在未分配任务池中，按住目标任务卡片并拖动，移动到左侧目标里程碑的名称区域后松开，任务即被分配到该里程碑。

分配成功后：

- 目标任务从未分配池消失
- 目标里程碑的任务计数自动更新
- 对应 Markdown 文件中的里程碑字段同步修改

> 支持在同一里程碑详情页内调整任务顺序，拖放任务卡片到目标位置即可。

### 66.4.7 分组内排序

每个里程碑分组（包括「未分配任务」和各个里程碑）都配有独立的排序表头：

- **ID**：按任务 ID 数字升序/降序排列
- **标题**：按任务标题字母顺序排列
- **状态**：按状态名称排列
- **优先级**：按优先级（高 → 中 → 低）排列

点击表头列即可按该列排序，再次点击切换方向。各分组的排序状态完全独立，在一个里程碑中选择「按优先级排序」不会影响其他里程碑的显示顺序。

排序图标采用与任务列表相同的双箭头设计：左侧 `↑` 表示升序，右侧 `↓` 表示降序，激活方向高亮显示。

### 66.4.8 已完成的里程碑

页面底部设有「已完成的里程碑」折叠区。点击折叠标题，可展开查看历史已完成或已归档的里程碑。已完成的里程碑通常不再接受新任务分配，但可点击查看历史记录。

### 66.4.9 搜索里程碑

在里程碑列表上方提供搜索框，输入关键词后，系统将以模糊匹配方式筛选里程碑名称和描述。搜索结果实时反映在列表中，方便在里程碑数量较多时快速定位目标。

清空搜索框后，列表恢复显示全部里程碑。

## 66.5 文档与决策

Web 界面提供文档列表和决策记录的浏览功能，支持按子文件夹分组查看，方便在浏览器中阅读项目知识库内容。

### 66.5.1 进入文档页面

启动 Web 界面后，点击顶部导航栏的「文档」标签，进入文档列表页面。页面以分组形式展示 `backlog/docs/` 目录下的全部 Markdown 文档。

### 66.5.2 浏览文档列表

文档列表按子文件夹自动分组展示。例如：

- **guides** — 存放指南类文档
- **api** — 存放接口文档
- **(根目录)** — 直接存放在 `docs/` 下的文档

点击分组标题可展开或折叠该文件夹下的文档条目。每个文档条目显示标题、最后更新时间摘要和标签（如有）。

### 66.5.3 查看文档内容

在列表中点击目标文档标题，页面跳转至文档详情页。文档内容以渲染后的 Markdown 格式展示，包括：

- 标题与正文
- 代码块与高亮
- 表格与列表
- 图片与链接

点击页面顶部的「返回」按钮或浏览器后退键，可回到文档列表页面。

### 66.5.4 进入决策记录页面

在顶部导航栏中点击「决策」标签，进入决策记录（ADR）列表页面。页面展示 `backlog/decisions/` 目录下的全部决策文件。

每条决策记录显示：

- 决策标题
- 当前状态（Proposed、Accepted、Rejected、Deprecated、Superseded）
- 创建日期

### 66.5.5 查看决策详情

点击决策列表中的任意条目，进入决策详情页。页面渲染展示完整的 ADR 内容，包括决策背景、考量因素、最终决定和后续影响等章节。

决策的状态标签以颜色区分，便于快速识别已采纳、已废弃或待讨论的决策。

## 66.6 设置与主题

设置页面集中管理 Backlog.md 的配置项、Definition of Done 默认值和 Web 界面主题偏好。任务编辑器也在设置相关区域中提供丰富的编辑能力。

### 66.6.1 进入设置页面

启动 Web 界面后，点击顶部导航栏的「设置」标签，进入设置页面。页面分为多个配置区块，从上到下依次排列。

### 66.6.2 查看与修改配置项

在「配置」区块中，可查看当前生效的各项参数，包括：

- 默认编辑器
- Web 服务器端口
- Git 相关选项
- 其他项目级开关

点击需要修改的配置项，在输入框中输入新值，修改完成后点击「保存」按钮。配置变更会立即写回项目配置文件，部分设置（如端口）在重启 `backlog browser` 后生效。

### 66.6.3 编辑 Definition of Done 默认值

在「Definition of Done」区块中，可查看和编辑新建任务时自动附加的默认完成标准清单。

点击文本编辑区，输入或修改 DoD 条目，每行一条。保存后，后续通过 Web 界面或 CLI 创建的新任务将自动携带更新后的默认 DoD 列表。

### 66.6.4 自定义 Web UI 主题

在「主题」区块中，可切换界面外观：

- **跟随系统** — 自动匹配操作系统的亮色或暗色模式设置
- **亮色模式** — 强制使用浅色背景主题
- **暗色模式** — 强制使用深色背景主题

切换后，整个 Web 界面的配色方案即时生效，无需刷新页面。偏好设置会保存在浏览器本地，下次访问时自动恢复。

### 66.6.5 语言切换

在「项目设置」区块的「语言」下拉框中，可选择 Web 界面的显示语言：

- **English** — 英语
- **日本語** — 日语
- **简体中文** — 简体中文
- **繁體中文** — 繁体中文

选择语言后，界面文字会立即切换，无需刷新页面。语言偏好与项目配置一同保存到 `backlog/config.yml`（或项目根配置）的 `locale` 字段中，下次启动 Web 界面时自动恢复。

> 语言设置需要通过「保存更改」按钮写入配置文件后才会持久化。在保存前切换语言，页面会即时预览新语言，但刷新后会恢复为上次保存的设置。

### 66.6.6 使用任务编辑器

在 Web 界面中点击任意任务，即可进入任务编辑器页面。编辑器提供丰富的富表单和 Markdown 编辑能力。

#### 66.6.6.1 富文本 Markdown 编辑器

任务描述区域使用 MDEditor 富文本编辑器。在编辑区中可直接输入 Markdown 语法，编辑器提供实时预览和常用格式快捷按钮：

- 标题层级
- 粗体、斜体、删除线
- 无序列表与有序列表
- 代码块与引用块
- 链接与表格

#### 66.6.6.2 验收标准交互式勾选列表

在任务编辑器中找到「验收标准」区域。每条验收标准左侧带有复选框，点击即可标记为已完成或未完成。勾选状态会自动同步保存到 Markdown 文件的对应章节。

若手动修改 Markdown 源文件中的验收标准格式，编辑器会在加载时自动修复和同步列表结构，确保复选框正常显示。

#### 66.6.6.3 任务内容目录

对于内容较长的任务，编辑器右侧显示「目录」（TOC）面板。目录自动提取任务正文中的各级标题，点击任意标题即可快速滚动到对应位置。滚动页面时，目录会高亮当前所在章节。

#### 66.6.6.4 富表单字段

编辑器顶部提供一组结构化表单字段，点击即可修改：

- **状态** — 下拉选择 Todo、In Progress、Done 等
- **优先级** — 选择 High、Medium、Low
- **标签** — 输入标签名称，支持多标签
- **里程碑** — 下拉选择已有里程碑或留空
- **负责人** — 输入负责人名称
- **依赖** — 添加依赖的其他任务 ID
- **引用** — 添加引用任务或外部链接

修改任意字段后，点击页面底部的「保存」按钮，变更将写回到 Markdown 文件。

### 66.6.7 Mermaid 图表自动渲染

若任务正文中包含 Mermaid 语法代码块，Web 界面会自动将其渲染为可视化图表，包括流程图、时序图、甘特图等。无需额外操作，保存任务后图表即时呈现。

### 66.6.8 图片与附件查看

任务中引用的图片（如 `![描述](assets/xxx.png)`）会在编辑器中直接显示预览图。点击预览图可在新标签页中查看原图。

项目 `backlog/assets/` 目录下的文件会自动通过 Web 服务器提供访问，确保所有附件和截图在 Web 界面中正常加载。

## 66.7 富文本粘贴与文档上传

Backlog.md 的 Web 界面编辑器支持将外部富文本内容一键转换为 Markdown，包括从 Word、Google Docs、网页直接粘贴，以及上传 `.docx` 文件。同时支持截图粘贴，自动上传图片并嵌入任务正文。

### 66.7.1 粘贴为 Markdown

在任务编辑器的 Markdown 编辑区域中，直接从外部来源复制并粘贴内容，编辑器会自动识别富文本 HTML 并将其转换为干净的 Markdown。

#### 66.7.1.1 支持来源

| 来源 | 转换内容 |
|------|---------|
| Microsoft Word | 段落、标题、列表、表格、粗体/斜体/下划线 |
| Google Docs | 段落、标题、列表、表格、格式 |
| Excel | 表格（含表头识别） |
| 网页 | HTML 结构、链接、列表、表格 |
| 截图 | `image/png` 图片，自动上传 |

#### 66.7.1.2 粘贴流程

1. 在外部应用中选中内容并复制
2. 在 Backlog.md 编辑器中按 `Ctrl+V`（或 `Cmd+V`）
3. 编辑器自动读取剪贴板中的 `text/html`
4. 清理 Word/Excel 特定标记（噪声标签、内联样式、mso-list 等）
5. 如有图片，提取并上传至临时目录
6. Turndown 将清理后的 HTML 转为 Markdown
7. 转换结果插入编辑器光标位置

如果剪贴板中不含 HTML（纯文本），编辑器会回退到原生粘贴行为，不做额外处理。

### 66.7.2 上传 Word 文档

除剪贴板粘贴外，编辑器还支持直接上传 `.docx` 文件。这对于包含大量图片或复杂格式的文档尤其有用。

#### 66.7.2.1 操作方式

在任务编辑器中：
- 点击编辑器工具栏的「上传 Word」按钮，选择本地 `.docx` 文件
- 或将 `.docx` 文件直接拖放到编辑器区域

#### 66.7.2.2 转换流程

1. 前端将 `.docx` 文件通过 `POST /api/docx/convert` 发送至后端
2. 后端使用 `mammoth` 库解析文档，提取文本内容为 HTML
3. 文档中的内嵌图片被提取并上传至 `backlog/assets/.temp/`
4. 后端返回原始 HTML、图片列表和转换警告
5. 前端使用与「粘贴为 Markdown」完全相同的 `cleanHtml` + Turndown 流水线将 HTML 转为 Markdown
6. 图片引用以 `/assets/.temp/{uuid}.png` 形式嵌入正文

#### 66.7.2.3 统一流水线保证一致性

Word 文档上传和富文本粘贴共享同一套前端转换逻辑，确保两者输出格式一致。复杂表格、列表嵌套等场景下，统一流水线避免了后端直接转换可能产生的格式差异。

### 66.7.3 图片处理

#### 66.7.3.1 截图粘贴

直接粘贴截图（如 QQ/微信/系统截图工具）时：
- 图片以 `image/png` blob 形式上传
- 保存至 `backlog/assets/.temp/{uuid}.png`
- 编辑器中显示预览图

#### 66.7.3.2 网页图片

粘贴来自网页的内容中包含 `<img>` 标签时：
- Data URI 图片：提取 base64 数据，上传至临时目录
- HTTP(S) URL 图片：后端安全下载后上传
- `file://` 本地路径：被拒绝（浏览器安全限制）

#### 66.7.3.3 保存时提升（Promote）

所有临时图片（包括粘贴截图和 Word 文档提取的图片）在保存任务时自动提升：

1. 前端扫描 Markdown 中的 `/assets/.temp/` 引用
2. 调用 `POST /api/assets/promote` 批量移动文件
3. 图片从 `.temp/` 迁移到 `paste/` 永久目录
4. 前端更新 Markdown 中的 URL 映射后执行保存

临时目录中的过期文件（超过 30 分钟）会在服务器启动时自动清理。

### 66.7.4 限制与注意事项

- **文件大小**：单文件超过 20MB 会返回错误提示
- **格式支持**：仅 `.docx` 格式支持文件上传，旧版 `.doc` 需先转换
- **损坏文档**：无法解析的文档会显示可读错误消息，不会崩溃
- **图片大小**：单张图片若超过大小限制，可能被跳过或导致整体失败（取决于策略配置）

## 66.8 Wiki 浏览与编辑

Backlog.md 的 Web 界面提供完整的 Wiki 模块，用于浏览和编辑 `backlog/wiki/` 目录下的知识库内容。Wiki 是 **LLM 维护的增量式知识库** — AI 代理读取 tasks/docs/decisions 等源文件，自动编译为结构化 wiki 内容；人类可读可编辑，也可直接创建和修改页面。

### 66.8.1 进入 Wiki

启动 Web 界面后，点击顶部导航栏的「Wiki」标签，进入 Wiki 页面。页面分为左右两部分：

- **左侧边栏**：可折叠的文件树，反映 `backlog/wiki/` 的目录结构
- **右侧内容区**：渲染后的 Markdown 内容

### 66.8.2 浏览文件树

侧边栏以树形结构展示 `backlog/wiki/` 的全部内容：

- 点击文件夹左侧的 Chevron 图标展开或折叠
- 文件夹名称右侧显示该目录下的 Markdown 文件数量（如 `concepts (3)`）
- 点击 `.md` 文件即可在右侧查看内容
- 空文件夹也会显示在树中，可展开查看其子内容

#### 66.8.2.1 路径与 URL

Wiki 页面的 URL 保持目录层级的可读性，`/` 分隔符不会被编码为 `%2F`。例如位于 `concepts/web-ui-features.md` 的页面，地址栏显示为：

```
http://localhost:6420/wiki/concepts/web-ui-features
```

路径中的空格、中文等特殊字符会被安全编码，但目录层级始终直观可辨。你可以直接复制或修改地址栏中的路径来快速跳转目标页面。

### 66.8.3 查看页面内容

Wiki 页面以渲染后的 Markdown 格式展示：

- 从 frontmatter 中提取并显示页面标题
- 支持代码块语法高亮、Mermaid 图表、表格、列表
- **Labels 标签**：页面标题下方显示该页面的 labels 标签（如 `concept`、`source`）
- 点击正文中的 `[[wikilink]]` 可跳转到对应页面

### 66.8.4 在线编辑

点击页面右上角的「Edit」按钮进入编辑模式：

- **标题**：在顶部大输入框中修改页面标题，保存后自动写入 frontmatter
- **Labels**：标题下方的 ChipInput 支持添加/删除标签；按 Enter 或逗号添加，Backspace 删除最后一个
- **正文**：使用完整的 Markdown 编辑器（支持粘贴为 Markdown、图片上传、Word 文档转换）
- **保存**：只有内容、标题或 labels 发生变更时，Save 按钮才变为蓝色可用状态
- **取消**：点击 Cancel 放弃所有修改，恢复原始内容

保存后，页面 frontmatter 会自动更新 `updated_date` 字段。

#### 66.8.4.1 切换页面自动退出编辑

在编辑模式下，如果你点击侧边栏中的其他 Wiki 页面，系统会**自动退出编辑模式**，以只读视图显示新页面：

- 未保存的编辑内容会被静默丢弃
- 编辑/查看切换按钮状态会同步更新为「查看」模式
- 避免新页面内容在编辑器中误显示，减少操作困惑

> 如需保存当前修改，请先点击 Save 再切换页面。

### 66.8.5 创建文件与文件夹

在侧边栏的任意位置创建新内容：

1. 将鼠标悬停在文件夹名称或 Wiki 根标题上
2. 右侧会出现 `+` 按钮，点击展开下拉菜单：
   - **Create file** — 创建新页面，输入文件名（自动补全 `.md`）
   - **Create folder** — 创建空文件夹
3. 创建成功后自动导航到新页面

根标题「Wiki」上的 `+` 按钮用于在 `backlog/wiki/` 根目录下创建内容。

### 66.8.6 重命名

在文件或文件夹的下拉菜单中选择 **Rename**：

- 输入新名称，支持跨目录移动（如 `concepts/new-name`）
- 如果当前正在查看该页面，重命名后会自动导航到新路径

### 66.8.7 实时同步

Wiki 内容在所有打开的标签页中实时同步：

- 通过 CLI 或外部编辑器修改 wiki 文件 → WebSocket 广播 → 所有浏览器标签自动刷新
- 在浏览器中编辑保存 → 其他标签页即时显示更新
- 文件树也会自动响应创建、修改、删除、重命名等操作

### 66.8.8 与文档的区别

| | 文档 (docs/) | Wiki (wiki/) |
|---|---|---|
| **维护者** | 人工编写 | 主要由 AI Skill 维护，人类可读可编辑 |
| **用途** | 项目指南、API 文档、参考手册 | 知识库：概念提取、来源摘要、交叉引用 |
| **编辑** | 创建后通过编辑器修改 | 浏览器中直接编辑，frontmatter 自动管理 |
| **结构** | 人工组织 | AI 维护标准目录（`sources/`、`concepts/`、`entities/`） |

## 66.9 统计页面

统计页面提供项目级任务数据概览，帮助快速掌握项目整体进度与需要关注的任务。

### 66.9.1 进入统计页面

启动 Web 界面后，点击顶部导航栏的「统计」标签，即可进入统计页面。

### 66.9.2 页面结构

统计页面分为四个主要区域：

#### 66.9.2.1 贡献热力图

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

##### 66.9.2.1.1 交互

- **悬停**：鼠标悬停在任意格子上，显示浮动提示框，包含具体日期（`YYYY-MM-DD` 格式）和当日完成的任务数量
- **点击**：点击格子后提示框保持固定，直到点击页面其他区域或再次点击该格子
- **标题**：显示过去一年完成的任务总数，如「过去一年完成 143 个任务」，根据语言自动 pluralization

#### 66.9.2.2 状态概览

页面顶部展示项目基本统计：

- **总任务数**：项目中的任务总数
- **完成百分比**：Done 状态任务占比
- **草稿数**：当前草稿数量
- **各状态分布**：To Do / In Progress / Done 等每个状态的任务数量

#### 66.9.2.3 优先级分布

以可视化方式展示任务在各优先级上的分布情况：

- **High** — 高优先级任务数量
- **Medium** — 中优先级任务数量
- **Low** — 低优先级任务数量
- **None** — 未设置优先级的任务数量

#### 66.9.2.4 项目健康度

项目健康度区域是统计页面的核心，展示四类需要特别关注的任务：

| 分类 | 颜色 | 判定条件 |
|---|---|---|
| **临期（At Risk）** | 🟡 琥珀色 | 非 Done 任务，有截止日期，今天或明天截止 |
| **逾期（Overdue）** | 🔴 红色 | 非 Done 任务，截止日期已过 |
| **停滞（Stale）** | 🔵 蓝色 | 非 Done 任务，无截止日期，超过 30 天未更新 |
| **阻塞（Blocked）** | 🔴 红色 | 依赖未完成的任务 |

页面头部以彩色圆点 + 计数的形式水平展示四类健康指标。点击或悬停可查看各类别的具体任务列表。

##### 66.9.2.4.1 健康任务卡片

每个健康分类下方列出匹配的任务卡片：

- **临期 / 逾期卡片**：显示任务标题和**截止日期**（Due by）
- **停滞卡片**：显示任务标题和**更新日期**
- **阻塞卡片**：显示任务标题和**依赖状态**

所有卡片均可点击，点击后跳转至任务编辑页面。

##### 66.9.2.4.2 悬停提示

将鼠标悬停在健康指标圆点上，会显示该类别的中文说明：

- **临期**：「即将截止，需立即处理」
- **逾期**：「已过截止日期」
- **停滞**：「超过 30 天未更新、无明确截止日期」

#### 66.9.2.5 数据自动刷新

统计页面支持实时数据同步：

- **服务端缓存**：后端维护统计缓存，500ms 延迟刷新。当通过 CLI、`backlog` 命令或其他方式创建/修改任务时，统计页面会自动检测到变化并在约 1 秒内更新显示
- **客户端缓存**：页面使用 `localStorage` 缓存上次加载的统计结果，重新打开页面时先展示缓存数据，后台静默拉取最新数据，实现瞬时加载
- **WebSocket 推送**：服务端通过 `"statistics-updated"` 事件主动推送更新，无需手动刷新页面

### 66.9.3 最近活动

统计页面底部展示最近的项目动态：

- **最近创建**：最近 7 天内新建的任务列表
- **最近更新**：最近 7 天内修改过的任务列表

> 若任务从未被编辑过，其创建日期会作为「最近更新」的 fallback 显示，确保新建任务不会被遗漏。

## 66.10 甘特图视图

甘特图视图以时间线方式展示任务的起止时间和依赖关系，帮助你直观把握项目进度、识别关键路径和发现时间冲突。

### 66.10.1 进入甘特图视图

启动 Web 界面后，点击顶部导航栏的「甘特图」标签，即可进入甘特图视图。首次进入时，系统会自动解析所有任务的日期数据并渲染时间线。

### 66.10.2 页面布局

甘特图视图采用左右双栏布局：

- **左侧任务列表**：固定宽度的表格，展示任务 ID、标题、时间列和操作按钮
- **右侧时间线区域**：动态渲染的任务条和依赖箭头，顶部有时间轴刻度

左右两栏的滚动事件双向同步，上下滚动时始终保持对齐。

### 66.10.3 时间粒度切换

时间线顶部提供五级粒度切换按钮：

| 粒度 | 适用场景 | 特点 |
|---|---|---|
| **日** | 查看近期密集的开发任务安排 | 单天多任务水平错位显示，避免重叠 |
| **周** | 迭代进度回顾 | 适合 Sprint 或周会场景 |
| **月** | 月度项目回顾 | 平衡细节与全景 |
| **季度** | 中长期项目概览 | 大跨度时间窗口 |
| **年** | 年度项目大局 | 最宏观视角 |

切换粒度时，任务条的位置和宽度会自动重新计算，确保在当前尺度下清晰可见。

### 66.10.4 任务时间解析

甘特图不依赖任务必须填写计划日期。系统按以下规则自动解析每条任务的有效起止时间：

**开始时间**
1. 若任务填写了 `plannedStart` → 优先使用计划开始时间
2. 若无计划开始时间 → 使用任务创建日期（`createdDate` 的日期部分）

**结束时间**
1. 若任务填写了 `plannedEnd` → 优先使用计划结束时间
2. 若无计划结束时间但有 `updatedDate` → 使用更新日期的日期部分
3. 若仅有创建日期 → 启用最小宽度回退

> **提示**：想让任务在甘特图上显示精确的时间范围，请在任务编辑页面的「计划日期」字段填写 `plannedStart` 和 `plannedEnd`。

### 66.10.5 最小宽度回退

对于只有创建时间、没有计划日期的任务，系统会赋予一个最小视觉宽度，防止它们在时间线上压缩成不可见的细线：

- **日视图**：最小约 4 小时的视觉宽度，同天的多个任务会自动水平错位，避免完全重叠
- **周/月视图**：最小 1 天的宽度
- **季度/年视图**：固定 8 像素的色块宽度，确保在宏观视角下仍然可见

这些任务在左侧列表中以 `*` 标记，悬停时会提示「回退渲染」。

### 66.10.6 任务条交互

#### 66.10.6.1 悬停查看详情

将鼠标悬停在任意任务条上，会弹出提示框显示：

- 任务 ID 和标题
- 解析后的开始时间和结束时间
- 是否为回退渲染（仅有创建时间的任务）

#### 66.10.6.2 点击高亮依赖链

点击任务条后，该任务的整个依赖链会被高亮：

- **前驱任务**（该任务依赖谁）和**后继任务**（谁依赖该任务）保持正常亮度
- **其他无关任务和箭头**淡化至 30% 透明度
- 再次点击任务条或点击空白处取消高亮

这在复杂项目中快速定位上下游影响范围时非常有用。

#### 66.10.6.3 打开任务详情

- **点击左侧列表的「详情」按钮**：打开熟悉的任务编辑模态框，可修改任务字段、日期和依赖关系
- **点击右侧任务条**：高亮依赖链（如上所述）

### 66.10.7 依赖箭头

任务之间的依赖关系通过 SVG 贝塞尔曲线箭头可视化：

- 箭头从前驱任务的结束位置指向后继任务的开始位置
- 多个依赖自动错位，减少线条缠绕
- 箭头会随时间粒度切换自适应缩放
- 依赖箭头同样参与「点击高亮」交互

> **注意**：甘特图视图目前只展示依赖关系的可视化，不支持拖拽调整任务时间。修改任务日期请通过左侧「详情」按钮进入任务编辑页面。

### 66.10.8 列表排序

左侧任务列表的前四列（ID、标题、开始时间、结束时间）支持点击排序：

- 每列表头右侧显示双箭头图标（↑/↓）
- 未激活时为灰色，升序时左箭头高亮，降序时右箭头高亮
- 点击切换升序/降序，点击其他列则按新列排序
- 三种状态外框宽度一致，切换时不引起表头抖动

排序后，右侧甘特条会按新的任务顺序重新布局，但时间位置保持不变。

### 66.10.9 时间线平移

在时间线区域按住鼠标左右拖拽，即可平移时间轴查看更多日期：

- 向左拖拽查看更早的时间
- 向右拖拽查看更晚的时间
- 平移操作平滑流畅，无页面刷新

### 66.10.10 暗黑模式支持

甘特图视图完全适配暗黑模式：

- 任务条、时间轴刻度、依赖箭头均使用 Tailwind CSS `dark:` 变体
- 悬停提示框、高亮状态在暗色背景下依然清晰可辨
- 切换系统主题或手动切换后无需刷新页面

### 66.10.11 跟踪甘特图

跟踪甘特图在同一行上同时展示**计划时间范围**和**实际任务进度**，帮助你直观追踪偏差。

#### 66.10.11.1 双层渲染

每个任务行绘制两个独立定位的元素，z 轴叠加：

- **底层实际条**：状态色实心填充
  - In Progress → 蓝色
  - Done / Completed → 绿色
  - To Do → 灰色
  - Blocked → 红色
  - Cancelled → 浅灰色
- **上层计划边框**：60° 斜线填充框（两层边框：2px 阴影层 + 1px 最终线）

#### 66.10.11.2 偏差场景

| 偏差场景 | 条件 | 视觉表现 |
|---|---|---|
| **早开始** | actualStart < plannedStart | 实际条从计划框左侧提前开始；左侧溢出为纯色 |
| **正常** | actualStart = plannedStart，actualEnd ≤ plannedEnd | 实际条在框内延伸；重叠区颜色+斜线，未到达尾部纯斜线 |
| **延期** | actualEnd > plannedEnd | 实际条超出计划框右侧；右侧溢出为纯色 |

#### 66.10.11.3 左侧时间列

工具栏提供 `showPlanTime` 和 `showActualTime` 开关：

- **Actual Start / Actual End**：始终显示实际时间，按 `actualStart` → `actualEnd` → `createdDate`/`updatedDate` 优先级解析
- **Planned Start / Planned End**：计划时间列，仅在 `showPlanTime` 开启时显示

#### 66.10.11.4 智能依赖箭头

跟踪模式下，依赖箭头的连接点综合考虑实际时间与计划时间：

- 若实际开始早于计划开始，箭头连接到更早的实际位置
- 若实际结束早于计划开始（罕见），回退到计划结束以保持依赖链连贯
- 箭头颜色统一使用灰色，避免与状态色实际条冲突

#### 66.10.11.5 交互增强

- **悬停 Tooltip**：同时展示计划时间范围、实际时间范围和 fallback 指示器
- **图例**：工具栏显示图例说明 — 状态色条=实际、斜线框=计划、箭头=依赖、琥珀色 `*`=估计时间
- **点击高亮**：计划边框层一同参与高亮/淡化
- 默认排序 ID 降序，默认视图日视图
- 加载自动选中首个任务，切换视图自动滚动到选中任务

### 66.10.12 日期字段建议

为了让甘特图发挥最大价值，建议为关键任务填写计划日期：

| 字段 | 作用 | 填写建议 |
|---|---|---|
| `plannedStart` | 任务计划开始时间 | 任务预计启动日期 |
| `plannedEnd` | 任务计划结束时间 | 任务预计完成日期 |
| `dueDate` | 任务截止日期 | 与 `plannedEnd` 区分：截止日期是硬性约束，计划结束是预期完成时间 |
| `actualStart` | 实际开始时间 | 系统自动填充，可手动修正 |
| `actualEnd` | 实际结束时间 | 系统自动填充，可手动修正 |

在任务编辑页面的「计划日期」区域可直接填写这些字段。填写后，甘特图会自动使用更精确的时间范围，不再依赖创建日期的回退渲染。

# 67 AI 集成

## 67.1 MCP 工作流

Backlog.md 通过 Model Context Protocol（MCP）与 AI 编码助手深度集成。MCP 是一种标准化协议，允许 AI 代理直接调用 Backlog.md 的功能工具，无需用户手动输入 CLI 命令。借助 MCP，AI 可以像人类开发者一样阅读、创建和管理任务，实现真正的协作式项目管理。

### 67.1.1 什么是 MCP 集成

传统方式下，AI 助手只能通过阅读指令文件了解 Backlog.md 的 CLI 命令，然后自行执行 shell 命令。这种方式存在两个问题：

- AI 需要解析 shell 输出，容易出错
- 命令执行失败时 AI 难以准确判断原因

MCP 集成彻底改变了这一模式。AI 代理通过标准化协议直接调用 Backlog.md 的工具函数，参数和返回值均为结构化数据，可靠性大幅提升。Backlog.md 的 MCP 服务器运行在本地，通过 stdio 传输与 AI 客户端通信，不暴露任何网络端口。

### 67.1.2 Spec-Driven 工作流

推荐采用 Spec-Driven 工作流与 AI 协作，将大需求拆分为小任务，逐步实施。整个流程分为四个步骤。

#### 67.1.2.1 步骤一：描述想法

向 AI 代理描述你想构建的功能或解决的问题。AI 会协助你将想法拆分为多个小任务，每个任务包含清晰的描述和验收标准。任务要足够小，能够在单次对话中完成。

示例对话方式：

> 我想给项目添加用户认证功能，请帮我拆分成可执行的任务，每个任务都要包含验收标准。

#### 67.1.2.2 步骤二：一次一个任务，一个任务一个 PR

每个代理会话只处理一个任务。这种约束带来三个好处：

- 上下文更聚焦，AI 理解更充分
- 每个任务对应一个独立的 Pull Request，便于代码审查
- 失败时只需重做单个任务，不会波及大范围代码

开始新任务前，让 AI 读取当前任务详情：

```bash
backlog task <id> --plain
```

#### 67.1.2.3 步骤三：编码前写实现计划

在实施代码之前，让 AI 研究当前代码库，然后撰写实现计划（Implementation Plan），并通过 CLI 写入任务中：

```bash
backlog task edit <id> --plan "1. 研究现有代码结构
2. 设计接口
3. 实现核心逻辑
4. 添加测试"
```

实现计划确保了方案反映代码库的当前状态，避免 AI 基于过时的假设进行开发。写完计划后，建议先与团队成员确认，再开始编码。

#### 67.1.2.4 步骤四：实施与验证

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

### 67.1.3 不满意时的重启循环

如果 AI 的实施结果不符合预期，不要在同一会话中继续纠缠。正确的做法是：

1. 清除任务中的旧计划、备注和最终总结
2. 根据经验教训，细化任务描述和验收标准
3. 开启新的 AI 会话，重新运行整个流程

重启循环能避免上下文污染，让 AI 以更清晰的视角重新理解需求。

### 67.1.4 MCP 工具能力清单

通过 MCP 连接后，AI 代理可以执行 Backlog.md 的完整工具集：

#### 67.1.4.1 任务全生命周期管理

- 创建、编辑、查看、归档、搜索任务
- 管理子任务和依赖关系
- 更新任务状态、负责人、标签和优先级
- 处理验收标准的勾选与取消勾选

#### 67.1.4.2 文档与决策

- 创建和更新项目文档
- 创建架构决策记录（ADR）
- 查看文档列表和决策列表

#### 67.1.4.3 里程碑与看板

- 创建、重命名、归档里程碑
- 将任务分配到里程碑
- 读取看板状态分布

#### 67.1.4.4 定义完成（DoD）

- 获取项目的默认 DoD 清单
- 修改默认 DoD 项
- 在单个任务中管理 DoD 勾选状态

#### 67.1.4.5 工作流与配置

- 获取工作流指令和指南
- 读取项目配置
- 查看项目统计概览

### 67.1.5 MCP 资源与提示

Backlog.md MCP 服务器提供以下结构化资源，AI 代理可在会话中主动读取：

| 资源 URI | 内容说明 |
|---------|---------|
| `backlog://workflow/overview` | 工作流概览，包含完整的协作指南 |
| `backlog://docs/task-workflow` | 任务工作流详细指南 |
| `backlog://init-required` | 未初始化项目时的回退资源 |

AI 代理在首次连接或遇到不确定的场景时，会优先读取 `backlog://workflow/overview` 获取上下文指导。

### 67.1.6 安全特性

Backlog.md 的 MCP 实现从设计层面保障安全性：

- **stdio-only 传输**：AI 客户端与 MCP 服务器之间仅通过标准输入输出通信，不监听任何网络端口，外部无法直接访问
- **localhost-only 运行时验证**：Web UI 等服务默认仅绑定本地地址
- **纯协议包装器**：MCP 层不包含任何业务逻辑，所有操作最终通过 Core 层统一处理，与 CLI 和 Web UI 共享同一套数据验证规则
- **roots 发现机制**：MCP 客户端发送 workspace 根目录列表，Backlog.md 自动在目录中查找有效项目。正常启动路径也会跟随客户端 workspace roots 变化（BACK-522），未找到时降级为最小功能模式，仅暴露 `init` 相关工具
- **固定项目根目录**：如需锁定到固定目录（例如全局 `~/.backlog`），使用 `--cwd` 或 `BACKLOG_CWD` 环境变量启动；此时服务器不会跟随客户端 workspace roots

### 67.1.7 常见问题

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

## 67.2 支持的 AI 工具

Backlog.md 支持与多种主流 AI 编码助手集成。不同工具的连接方式略有差异，但核心原理一致：将 Backlog.md 的 MCP 服务器注册到 AI 客户端，使其能够直接调用 Backlog.md 的工具。

### 67.2.1 支持的工具一览

| 工具 | 集成方式 | 配置命令 |
|------|---------|---------|
| Claude Code | MCP | `claude mcp add backlog --scope user -- backlog mcp start` |
| OpenAI Codex | MCP | `codex mcp add backlog -- backlog mcp start` |
| Google Gemini CLI | MCP | `gemini mcp add backlog -s user backlog mcp start` |
| Kiro | MCP | `kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start` |
| Cursor | MCP | 手动配置 `mcpServers` |
| GitHub Copilot | CLI 指令 | 生成 `copilot-instructions.md` |

### 67.2.2 Claude Code

Claude Code 是 Anthropic 推出的命令行 AI 助手，原生支持 MCP。

执行以下命令完成注册：

```bash
claude mcp add backlog --scope user -- backlog mcp start
```

参数说明：

- `--scope user`：将配置写入用户级配置，所有项目可用
- `--` 后的 `backlog mcp start`：启动 Backlog.md MCP 服务器的命令

注册成功后，在 Claude Code 会话中输入 `@backlog` 即可调用 Backlog.md 工具。

### 67.2.3 OpenAI Codex

OpenAI Codex CLI 同样支持 MCP 协议。

执行以下命令：

```bash
codex mcp add backlog -- backlog mcp start
```

> 注意 Codex 使用 `--` 作为 stdio 命令分隔符。该格式在 BACK-520 中更新以匹配当前 Codex CLI 行为。

Codex 会自动将 Backlog.md 的工具集纳入可用工具列表。在对话中，Codex 会根据上下文自主决定何时调用 Backlog.md 工具。

### 67.2.4 Google Gemini CLI

Gemini CLI 通过 `gemini` 命令提供 MCP 支持。

执行以下命令：

```bash
gemini mcp add backlog -s user backlog mcp start
```

参数说明：

- `-s user`：等同于 `--scope user`，作用于用户范围
- `backlog mcp start`：启动命令

### 67.2.5 Kiro

Kiro CLI 的配置方式略有不同，需要显式指定参数拆分方式。

执行以下命令：

```bash
kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
```

注意 `--args` 后的参数使用逗号分隔，而不是空格。

### 67.2.6 Cursor

Cursor 编辑器目前需要通过手动配置 `mcpServers` 来连接 Backlog.md。

打开 Cursor 的设置，找到 MCP 配置入口，添加以下配置：

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

### 67.2.7 GitHub Copilot

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

### 67.2.8 验证集成是否成功

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

## 67.3 代理指令文件

代理指令文件是 Backlog.md 为 AI 编码助手准备的标准化指南文档。这些文件告诉 AI 如何与 Backlog.md 协作，包括工作流规范、命令用法和任务管理标准。通过统一的指令文件，不同 AI 工具对项目的理解保持一致，避免因工具切换导致的工作流偏差。

### 67.3.1 什么是指令文件

AI 编码助手在启动时会读取项目中的特定 Markdown 文件作为上下文。Backlog.md 利用这一机制，生成包含项目管理规范的指令文件。这些文件涵盖：

- Backlog.md 的核心能力介绍
- 任务文件结构说明
- CLI 命令完整参考
- 验收标准与定义完成（DoD）规范
- 典型工作流程示例
- 常见错误与正确做法对比

AI 阅读这些文件后，能够在对话中准确使用 Backlog.md 的功能，无需用户反复解释项目规范。

### 67.3.2 生成指令文件

Backlog.md 提供两种方式生成或更新代理指令文件。

#### 67.3.2.1 初始化项目时自动生成

运行 `backlog init` 初始化新项目时，向导会询问是否需要安装 AI 代理指令：

```bash
backlog init my-project
# 68 交互式向导中出现选项：
# 69 "Install AI agent instructions?"
```

选择安装后，Backlog.md 会根据你的选择生成对应的指令文件。

#### 69.0.0.1 手动更新已有项目的指令

对于已存在的项目，随时可以通过以下命令更新或重新生成指令文件：

```bash
backlog agents --update-instructions
```

该命令会扫描当前项目，根据现有配置重新生成所有指令文件，确保内容与项目当前状态同步。当你修改了任务状态流程、标签体系或其他项目规范后，建议运行此命令更新 AI 指令。

### 69.0.1 生成的文件清单

根据你使用的 AI 工具，Backlog.md 会生成以下一个或多个文件：

| 文件路径 | 适用工具 | 作用范围 |
|---------|---------|---------|
| `CLAUDE.md` | Claude Code / Claude Desktop | 项目根目录 |
| `AGENTS.md` | 通用代理指令 | 项目根目录 |
| `GEMINI.md` | Gemini CLI | 项目根目录 |
| `.github/copilot-instructions.md` | GitHub Copilot | 项目仓库 |

#### 69.0.1.1 CLAUDE.md

专为 Claude Code 和 Claude Desktop 设计。Claude 系列工具会自动读取项目根目录下的 `CLAUDE.md` 作为系统提示的一部分。该文件包含完整的 Backlog.md 操作指南，是功能最全面的指令文件。

#### 69.0.1.2 AGENTS.md

通用代理指令文件，适用于不识别特定品牌文件的 AI 工具。文件内容与 `CLAUDE.md` 基本一致，但采用更通用的表述方式。部分 IDE 插件或自定义 AI 客户端会优先读取 `AGENTS.md`。

#### 69.0.1.3 GEMINI.md

针对 Google Gemini CLI 优化的指令文件。Gemini CLI 会识别项目根目录下的 `GEMINI.md` 并纳入上下文。

#### 69.0.1.4 .github/copilot-instructions.md

专为 GitHub Copilot 设计。由于 Copilot 不支持 MCP 协议，该文件内容更侧重 CLI 命令参考，帮助 Copilot 理解如何在代码生成过程中配合 Backlog.md 的 shell 命令。文件位于 `.github/` 目录下，因此仅在 GitHub 仓库中生效。

### 69.0.2 指令文件包含的内容

所有生成的指令文件都遵循统一的内容框架，主要包括以下模块。

#### 69.0.2.1 工作流指南

说明 AI 与 Backlog.md 协作的推荐流程：

- 如何通过 CLI 或 MCP 读取任务
- 如何在实施前撰写实现计划
- 如何按验收标准逐步完成任务
- 如何添加最终总结并标记任务完成

#### 69.0.2.2 任务创建规范

明确高质量任务的标准：

- 标题应简洁概括任务目的
- 描述聚焦 "为什么" 而非 "怎么做"
- 验收标准必须结果导向、可验证
- 每个任务对应一个独立的 Pull Request

#### 69.0.2.3 验收标准格式

详细说明验收标准的格式要求：

- 使用编号复选框形式 `- [ ] #1 标准内容`
- 通过 CLI 的 `--ac` 参数添加
- 通过 `--check-ac` 和 `--uncheck-ac` 管理完成状态
- 支持单次命令操作多个标准项

#### 69.0.2.4 命令参考

提供完整的 CLI 命令速查表，覆盖：

- 任务创建、编辑、查看、归档
- 验收标准与 DoD 管理
- 搜索与过滤
- 文档和决策管理
- 看板与概览

### 69.0.3 MCP 与 CLI 指令方式对比

Backlog.md 支持两种 AI 集成方式，各有适用场景：

| 对比维度 | MCP 方式 | CLI 指令方式 |
|---------|---------|-------------|
| 工作原理 | AI 直接调用 Backlog.md 的工具函数 | AI 阅读指令文件后自行执行 shell 命令 |
| 可靠性 | 高，参数和返回值均为结构化数据 | 中等，依赖 AI 解析 shell 输出 |
| 支持工具 | Claude Code、Codex、Gemini CLI、Kiro、Cursor | GitHub Copilot |
| 配置复杂度 | 低，一条命令完成注册 | 低，自动生成指令文件 |
| 实时反馈 | 即时，工具调用后立即返回结果 | 有延迟，需等待 shell 命令执行 |
| 错误处理 | AI 可精确获取错误类型和原因 | AI 需从 stderr 中推断错误 |

**推荐策略**：

- 如果使用的 AI 工具支持 MCP，优先选择 MCP 方式
- 对于 GitHub Copilot 等不支持 MCP 的工具，使用 CLI 指令方式作为补充
- 两种方式可以并存：MCP 负责日常任务管理，CLI 指令文件确保 Copilot 也能理解项目规范

## 69.1 Wiki Skill 安装

Backlog.md 内置 `llm-wiki-for-backlog` skill，帮助 AI 代理理解和维护项目知识库。通过 `backlog wiki install` 命令，可将该 skill 一键安装到支持的 AI 工具中。

### 69.1.1 什么是 Wiki Skill

`llm-wiki-for-backlog` 是一个 Agent Skill，提供以下能力：

- **构建知识库**：根据项目 backlog 内容自动生成结构化 wiki
- **增量摄取**：将新任务、文档、决策编译为可交叉引用的知识页面
- **查询与报告**：基于 wiki 内容回答项目相关问题
- **健康检查**：扫描知识库中的矛盾、孤立页面和缺失引用

安装后，AI 代理在会话中可直接引用该 skill 的指南，更准确地执行 wiki 相关操作。

### 69.1.2 支持的 AI 工具

| 别名 | 对应工具 | Skills 目录 |
|------|---------|------------|
| `claude` | Claude Code / Claude Desktop | `.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.codex/skills/` |
| `agents` | 通用 Agents 目录 | `.agents/skills/` |

### 69.1.3 安装 Skill

#### 69.1.3.1 安装到指定 Agent

```bash
backlog wiki install claude
```

该命令会将内置 skill 文件写入 Agent 的 skills 目录。安装结果会显示 skill 名称、描述和触发词。

#### 69.1.3.2 强制覆盖

如果目标目录已存在同名 skill，或该目录被其他 skill 占用，使用 `--force` 覆盖：

```bash
backlog wiki install claude --force
```

#### 69.1.3.3 预览安装

使用 `--dry-run` 预览安装操作，不实际写入文件：

```bash
backlog wiki install codex --dry-run
```

### 69.1.4 安装机制

#### 69.1.4.1 统一存储与符号链接

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

#### 69.1.4.2 Windows 兼容性

Windows 上创建目录符号链接需要管理员权限或开启开发者模式。当符号链接创建失败时，命令会自动**回退到直接复制**文件到 Agent 的实际目录，并记录警告提示。

#### 69.1.4.3 Skill 来源

Skill 内容在构建时嵌入编译后的二进制文件中：

- **Canonical 源**：`.codex/skills/llm-wiki-for-backlog/SKILL.md`
- **嵌入产物**：`src/skills/embedded/llm-wiki-for-backlog.ts`
- **构建时生成**：`scripts/embed-wiki-skill.ts` 将 skill 文件打包为 TypeScript 模块

这意味着即使在没有网络连接或源码仓库的环境中，编译后的 `backlog` 二进制也能完成 skill 安装。

### 69.1.5 更新 Skill

当 Backlog.md 版本升级后，内置 skill 内容可能已更新。重新执行安装命令即可覆盖为最新版本：

```bash
backlog wiki install claude --force
```

建议在每次升级 Backlog.md 后检查并更新已安装的 skill。

# 70 配置与运维

## 70.1 配置管理

Backlog.md 提供灵活的配置系统，支持通过交互式向导或命令行直接管理项目设置。配置存储在 YAML 文件中，与项目代码一起纳入版本控制，确保团队成员使用一致的工作流规范。

### 70.1.1 交互式配置向导

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

### 70.1.2 命令行直接操作

对于需要快速修改单个配置项的场景，使用 `backlog config get` 和 `backlog config set` 命令。

#### 70.1.2.1 查看当前配置

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

#### 70.1.2.2 修改配置项

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

### 70.1.3 关键配置项说明

#### 70.1.3.1 项目基础信息

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `projectName` | 字符串 | — | 项目名称，显示在看板和概览中 |
| `statuses` | 字符串列表 | `To Do, In Progress, Done` | 任务状态流程，按顺序排列 |
| `labels` | 字符串列表 | — | 项目预定义标签列表 |
| `dateFormat` | 字符串 | — | 日期显示格式 |

状态列表的顺序决定了看板中的列排列顺序。第一个状态视为任务的初始状态，最后一个通常代表完成状态。

#### 70.1.3.2 分支与 Git 集成

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `checkActiveBranches` | 布尔值 | `true` | 是否检查活跃分支中的任务状态 |
| `remoteOperations` | 布尔值 | `true` | 是否检查远程分支中的任务 |
| `activeBranchDays` | 整数 | `30` | 分支被视为活跃的天数上限 |

启用 `checkActiveBranches` 后，Backlog.md 会在加载任务时检查其他本地和远程分支，确保跨分支的任务状态准确。这在大型仓库中可能影响性能，可通过减小 `activeBranchDays` 来加速。

`remoteOperations` 依赖于 `checkActiveBranches`，当后者关闭时，前者自动失效。

#### 70.1.3.3 自动化行为

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `autoCommit` | 布尔值 | `false` | 是否在 CLI 变更后自动创建 Git 提交 |
| `bypassGitHooks` | 布尔值 | `false` | 提交时是否绕过 Git 钩子（使用 `--no-verify`） |
| `filesystemOnly` | 布尔值 | `false` | 是否禁用所有 Git 集成，仅使用文件系统 |

启用 `autoCommit` 后，每次通过 CLI 创建或修改任务，Backlog.md 会自动执行 `git commit`，省去手动提交的步骤。配合 `bypassGitHooks` 可在 pre-commit 钩子耗时较长时提升效率。

`filesystemOnly` 适用于纯文件系统项目或无 Git 的环境，开启后所有 Git 相关功能均被禁用。

#### 70.1.3.4 ID 与前缀

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `prefixes.task` | 字符串 | `task` | 任务 ID 前缀 |
| `prefixes.draft` | 字符串 | `draft` | 草稿 ID 前缀 |
| `zeroPaddedIds` | 整数 | — | ID 零填充位数，如 `3` 生成 `task-001` |

前缀配置允许自定义任务和草稿的 ID 格式。例如，将 `prefixes.task` 设为 `back` 后，新任务的 ID 将变为 `back-1`、`back-2` 等。

`zeroPaddedIds` 控制 ID 的格式化宽度。设为 `3` 时，ID 显示为 `task-001`；设为 `4` 时，显示为 `task-0001`。这有助于保持文件名的字典序一致性。

#### 70.1.3.5 Web UI

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultPort` | 整数 | `6420` | Web UI 默认监听端口 |
| `autoOpenBrowser` | 布尔值 | `true` | 启动 Web UI 时是否自动打开浏览器 |

修改 `defaultPort` 可避免与其他本地服务端口冲突。关闭 `autoOpenBrowser` 后，运行 `backlog browser` 只会启动服务器，不会弹出浏览器窗口，适合远程开发或服务器环境。

#### 70.1.3.6 MCP HTTP 传输

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `mcp.http.host` | 字符串 | — | MCP HTTP 服务器绑定地址 |
| `mcp.http.port` | 整数 | — | MCP HTTP 服务器监听端口 |
| `mcp.http.auth.type` | 字符串 | `none` | 认证类型：`none`、`bearer`、`basic` |
| `mcp.http.auth.token` | 字符串 | — | Bearer 认证令牌 |
| `mcp.http.auth.username` | 字符串 | — | Basic 认证用户名 |
| `mcp.http.auth.password` | 字符串 | — | Basic 认证密码 |

默认情况下，MCP 使用 stdio 传输，安全性最高。如需启用 HTTP 传输（例如配合某些特殊客户端），可通过上述配置项设置。启用 HTTP 传输时，强烈建议配置认证机制。

### 70.1.4 配置存储位置

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
defaultPort: 6420
autoOpenBrowser: true
```

修改配置文件后，Backlog.md 会自动加载最新设置，无需重启服务。

## 70.2 Shell 补全

Backlog.md 内置智能 Shell 补全功能，支持 bash、zsh、fish 和 PowerShell。启用后，在终端中输入 `backlog` 命令时按 Tab 键，即可自动补全子命令、选项和动态值，大幅提升操作效率。

### 70.2.1 一键安装补全脚本

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

### 70.2.2 支持的 Shell

#### 70.2.2.1 Bash

Bash 补全脚本支持命令、子命令和选项补全。动态值补全依赖 bash-completion 包。在大多数 Linux 发行版中，该包已预装；如未安装，可通过包管理器获取：

```bash
# 71 Debian/Ubuntu
sudo apt-get install bash-completion

# 72 macOS (Homebrew)
brew install bash-completion
```

#### 72.0.0.1 Zsh

Zsh 用户可直接使用补全功能，无需额外依赖。Zsh 的补全系统功能丰富，支持菜单选择和描述显示，体验最为完整。

#### 72.0.0.2 Fish

Fish 的补全脚本放置在 `~/.config/fish/completions/backlog.fish`，Fish 会自动加载该目录下的所有补全定义。Fish 补全支持描述文本和参数高亮。

#### 72.0.0.3 PowerShell

PowerShell 补全通过注册 `Register-ArgumentCompleter` 命令实现。安装脚本会自动修改 PowerShell 的配置文件（可通过 `$PROFILE` 查看路径）。如需手动注册，可参考补全脚本中的注册逻辑。

### 72.0.1 动态补全能力

Backlog.md 的补全系统不仅支持静态命令和选项，还能从当前项目中动态提取实际数据：

#### 72.0.1.1 实际任务 ID

输入 `backlog task edit ` 后按 Tab，补全系统会列出当前项目中所有有效的任务 ID：

```bash
backlog task edit <TAB>
# 73 显示：task-1  task-2  task-3  doc-1  ...
```

#### 73.0.0.1 状态值

输入 `-s ` 或 `--status ` 后按 Tab，补全系统会从项目配置中读取状态列表：

```bash
backlog task list -s <TAB>
# 74 显示：To Do  In Progress  Done
```

#### 74.0.0.1 标签

输入 `-l ` 或 `--labels ` 后按 Tab，补全系统会汇总所有已使用的标签：

```bash
backlog task create "新功能" -l <TAB>
# 75 显示：bug  feature  docs  backend
```

#### 75.0.0.1 负责人

输入 `-a ` 或 `--assignee ` 后按 Tab，补全系统会列出所有现有任务中出现过的负责人：

```bash
backlog task edit 1 -a <TAB>
# 76 显示：@alice  @bob  @team-lead
```

动态补全的数据来源于当前工作目录下的 Backlog.md 项目。如果在没有 Backlog.md 项目的目录中执行命令，动态值补全会回退到空列表或默认值，但静态命令补全仍然可用。

### 76.0.1 手动安装补全脚本

如果自动安装遇到问题，或需要将补全脚本部署到非标准位置，可以手动安装。Backlog.md 在安装包中内置了各 Shell 的补全脚本源码。

#### 76.0.1.1 查找补全脚本

补全脚本随 npm 包一起安装，位于包目录的 `completions/` 文件夹下：

```bash
# 77 查找全局安装的 backlog.md 包路径
npm root -g
# 78 补全脚本位于：
# 79 <npm-root>/backlog.md/completions/backlog.bash
# 80 <npm-root>/backlog.md/completions/backlog.zsh
# 81 <npm-root>/backlog.md/completions/backlog.fish
# 82 <npm-root>/backlog.md/completions/backlog.ps1
```

#### 82.0.0.1 Bash 手动安装

将以下内容添加到 `~/.bashrc`：

```bash
source /path/to/backlog.bash
```

#### 82.0.0.2 Zsh 手动安装

将补全脚本复制到 Zsh 的函数搜索路径，例如 `~/.zsh/functions/`：

```bash
cp /path/to/backlog.zsh ~/.zsh/functions/_backlog
```

确保 `~/.zshrc` 中的 `fpath` 包含该目录：

```zsh
fpath=(~/.zsh/functions $fpath)
```

#### 82.0.0.3 Fish 手动安装

将补全脚本复制到 Fish 的补全目录：

```bash
cp /path/to/backlog.fish ~/.config/fish/completions/backlog.fish
```

#### 82.0.0.4 PowerShell 手动安装

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

## 82.1 项目概览

`backlog overview` 命令提供项目级任务统计的纯文本输出，适合在终端中快速查看项目状态，或用于脚本和 CI 流水线。

### 82.1.1 启动概览

#### 82.1.1.1 交互式 TUI

在支持 TTY 的终端中直接运行：

```bash
backlog overview
```

系统会输出一个 ANSI 彩色的终端界面，包含状态分布、优先级分布、最近活动和项目健康度。使用终端原生滚动条或鼠标滚轮浏览全部内容。

#### 82.1.1.2 纯文本输出

在非交互式环境或需要管道处理时，使用 `--plain` 模式：

```bash
backlog overview --plain
```

纯文本模式不输出 ANSI 颜色代码，适合重定向到文件或通过管道传递给其他命令：

```bash
backlog overview --plain > project-status.txt
backlog overview --plain | grep "Overdue"
```

### 82.1.2 输出内容

`overview` 命令的输出包含以下维度：

#### 82.1.2.1 状态概览

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

#### 82.1.2.2 优先级分布

```
Priority Breakdown
==================
  high     5  17%
  medium   15 50%
  low      7  23%
  none     3  10%
```

按高 / 中 / 低 / 无优先级统计任务分布。

#### 82.1.2.3 最近活动

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

#### 82.1.2.4 项目健康度

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

### 82.1.3 与 Web 统计页面的关系

| 特性 | CLI `overview` | Web 统计页面 |
|---|---|---|
| 交互性 | 终端 TUI / 纯文本 | 浏览器交互式界面 |
| 颜色 | ANSI 彩色 / 无颜色 | 网页彩色主题 |
| 健康度卡片 | 纯文本列表 | 可点击卡片，带日期标识 |
| 适用场景 | 快速终端查看、CI、脚本 | 详细分析、日常监控 |

两者使用同一套底层统计逻辑（`src/core/statistics.ts`），数据完全一致。
