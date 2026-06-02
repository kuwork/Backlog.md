---
title: Knowledge Base Overview
labels: [overview]
created_date: 2026-05-12 00:00
---


# Knowledge Base Overview

## Project

**Backlog.md** — 一款 Markdown 原生的任务管理与看板可视化 CLI 工具，同时作为 MCP 服务器为 AI 编码助手提供协议接口。

## Domain Coverage

### 核心功能域
- **任务管理**：CRUD、子任务、草稿、归档、依赖、验收标准、DoD
- **看板**：终端 TUI 看板、Web 交互式看板、看板导出
- **搜索**：基于 Fuse.js 的跨任务/文档/决策模糊搜索
- **Web UI**：React + Tailwind CSS v4 的现代化浏览器界面
- **AI 集成**：MCP 协议支持 Claude Code、Codex、Gemini CLI、Kiro、Cursor
- **粘贴为 Markdown**：Word/Excel/Google Docs 富文本自动转换，截图图片上传与嵌入
- **本地文件预览**：任务 References 和 Markdown 中的本地路径点击预览，支持语法高亮和行范围
- **Wiki Web UI**：浏览器中浏览和编辑 `backlog/wiki/` 文件树，实时同步，支持创建/重命名文件和文件夹
- **Wiki Install**：`backlog wiki install <agent>` 将内置 skill 安装到 Claude/Codex/Agents
- **功能机会分析**：基于现有架构的功能增强建议（Wiki CLI 桥接、任务模板、时间追踪、批量操作等），详见 [[../wiki_output/reports/feature-opportunities]]
- **Word 文档转换**：`.docx` 上传、Markdown 转换、内嵌图片提取与 promote
- **Web UI 国际化**：零依赖自定义 i18n（React Context + Hook），4 种语言（en/ja/zh-CN/zh-TW），~300 翻译键编译时嵌入二进制

### 源代码架构域
- **核心层**：`Core` 聚合 `FileSystem` + `GitOperations`，惰性初始化 `ContentStore` + `SearchService`
- **数据流**：Markdown 文件 → `FileSystem` → `ContentStore`（内存缓存 + 文件监视）→ `SearchService`（Fuse.js 索引）
- **CLI**：`cli.ts` 单文件大入口，Commander.js + Clack 交互式向导，支持 TTY 检测与 plain 回退
- **MCP Server**：`McpServer extends Core`，stdio 传输，roots 发现，fallback 模式
- **Web Server**：`BacklogServer` 基于 `Bun.serve()`，REST API + WebSocket 广播 + React SPA
- **Markdown 流水线**：`gray-matter` 解析 frontmatter + `structured-sections.ts` 提取 AC/DoD/计划/备注
- **资源管理**：`AssetManager` 处理上传、data URI、安全远程下载，临时目录 `.temp/` + 保存时 promote 到 `paste/`
- **Skill 嵌入**：构建时将 `.codex/skills/` 嵌入 `src/skills/embedded/` 供编译后二进制使用
- **MCP 安全**：stdio-only 传输，Windows 上修复 stdin close 误触发导致的挂起问题

### 项目管理域
- **里程碑**：创建、分配、完成检测、归档
- **序列**：从依赖关系计算可并行任务组
- **文档**：Markdown 文档创建与管理，支持子文件夹
- **决策记录**：ADR 格式，支持状态流转

### 配置与运维
- **配置层**：CLI flags → 项目配置 → 内置默认值
- **编辑器**：VIM/Neovim/Helix/nano 等，支持 TUI 挂起恢复
- **后台服务**：systemd/launchd/Task Scheduler/NSSM
- **Shell 补全**：bash/zsh/fish/PowerShell 动态补全
- **文档构建**：HonKit 本地预览、静态站点生成、PDF 导出（依赖 Calibre）

## 主要产出

- [[../wiki_output/reports/backlog-md-user-guide-zh|Backlog.md 用户使用指引（中文）]] — 涵盖安装、任务管理、看板、Web UI、AI 集成等完整操作手册

## 统计

- Sources ingested: 17
- Concepts extracted: 16
- Entities catalogued: 2
- Reports generated: 1
