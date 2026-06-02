---
title: Wiki Content Catalog
labels:
  - index
created_date: '2026-05-12 00:00'
updated_date: '2026-05-22 10:00'
---
# Wiki Content Catalog


Read this file FIRST on any wiki operation.

## Sources

| File | Title | Labels |
|---|---|---|
| [[sources/readme-md]] | README.md 产品概述 | source |
| [[sources/cli-instructions-md]] | CLI-INSTRUCTIONS.md 命令参考 | source |
| [[sources/mcp-support-task]] | BACK-287 MCP 支持实现 | source |
| [[sources/web-server-task]] | BACK-100 嵌入式 Web 服务器 | source |
| [[sources/config-docs]] | 配置文档与决策记录 | source |
| [[sources/src-architecture]] | 源代码架构总览 | source |
| [[sources/paste-as-markdown-task]] | BACK-208 粘贴为 Markdown 支持 | source |
| [[sources/windows-mcp-fix-task]] | BACK-465 Windows MCP document tool 挂起修复 | source |
| [[sources/file-preview-task]] | BACK-467 本地文件预览与语法高亮 | source |
| [[sources/wiki-web-ui-task]] | BACK-473 Web UI Wiki 区域与文件树导航 | source |
| [[sources/wiki-install-task]] | BACK-474 Wiki Install 命令 | source |
| [[sources/docx-upload-task]] | BACK-475 Word 文档上传与图片提取 | source |
| [[sources/inline-code-html-escaping-fix]] | BACK-476 行内代码 HTML 实体转义修复 | source |
| [[sources/web-ui-i18n-task]] | BACK-478 Web UI i18n 支持 | source |
| [[sources/path-autocomplete-task]] | BACK-479 Web UI 路径自动补全与文档编辑 | source |
| [[sources/milestone-search-fix]] | BACK-480 修复里程碑页面搜索模糊匹配误报 | source |
| [[sources/demote-to-draft-action]] | BACK-419 Web UI 降级为草稿操作 | source |
| [[sources/folder-grouping-for-docs]] | BACK-423 Web UI 文档文件夹分组 | source |
| [[sources/wiki-search-task]] | BACK-481 将 Wiki 纳入 Web 搜索范围 | source |
| [[sources/wikilink-markdown-preview-fix]] | BACK-482 修复 Wikilink 与 Markdown 相对链接预览 | source |

## Concepts

| File | Title | Description |
|---|---|---|
| [[concepts/task-lifecycle]] | 任务生命周期 | 任务从草稿到归档的完整流程与字段说明 |
| [[concepts/cli-tui]] | CLI 与 TUI 界面 | 命令行与终端交互式界面功能 |
| [[concepts/web-ui-features]] | Web UI 功能 | 浏览器界面的页面、视图与技术特性 |
| [[concepts/mcp-workflow]] | MCP 工作流与 AI 集成 | AI 代理集成方式与推荐工作流 |
| [[concepts/search-sequences]] | 搜索与序列 | Fuse.js 模糊搜索与依赖序列计算 |
| [[concepts/core-architecture]] | 核心架构与数据流 | Core、FileSystem、ContentStore、SearchService 的协作关系 |
| [[concepts/cli-entry]] | CLI 入口与命令体系 | Commander.js 命令注册、交互/非交互模式、全局配置迁移 |
| [[concepts/mcp-server]] | MCP Server 实现 | stdio 传输、tools/resources/prompts、roots 发现机制 |
| [[concepts/web-server]] | Web Server 与浏览器界面 | Bun.serve HTTP API、WebSocket 实时同步、React SPA |
| [[concepts/markdown-pipeline]] | Markdown 解析与序列化流水线 | gray-matter + 结构化章节提取、frontmatter 预处理 |
| [[concepts/paste-as-markdown]] | 粘贴为 Markdown | 富文本自动转换为 Markdown，支持图片上传 |
| [[concepts/asset-management]] | 资源管理与临时文件提升 | AssetManager、临时目录、安全下载、promote 机制 |
| [[concepts/file-preview]] | 本地文件预览 | 代码/Markdown 文件预览、语法高亮、行号、行范围 |
| [[concepts/docx-conversion]] | Word 文档转换 | `.docx` 上传、HTML 提取、图片保存、统一 Markdown 流水线 |
| [[concepts/embedded-skills]] | 内嵌 Skill 架构 | 构建时嵌入 skill 到二进制、Agent 安装机制 |
| [[concepts/web-ui-i18n]] | Web UI 国际化 | 零依赖轻量级 i18n、类型安全翻译字典、编译时嵌入 |

## Entities

| File | Title | Description |
|---|---|---|
| [[entities/backlog-cli]] | Backlog.md CLI 工具 | 项目技术栈、模块结构与分发渠道 |
| [[entities/ai-agents]] | AI 代理与集成 | 支持的 AI 工具与集成方式对比 |

## Comparisons

_No comparisons created yet._

## User Manual

| File | Title | Description |
|---|---|---|
| [[usermanual/README]] | 用户手册封面 | Backlog.md 简介、核心特性、快速开始 |
| [[usermanual/00-快速开始/00-产品概述]] | 产品概述 | 核心定位、主要功能、技术栈、分发渠道 |
| [[usermanual/00-快速开始/01-安装与初始化]] | 安装与初始化 | 多种安装方式、项目初始化、配置管理 |
| [[usermanual/00-快速开始/02-AI集成设置]] | AI 集成设置 | MCP 协议配置、CLI 指令文件、推荐工作流 |
| [[usermanual/10-任务管理/00-任务生命周期]] | 任务生命周期 | 状态流转、任务文件结构、核心字段 |
| [[usermanual/10-任务管理/01-创建与编辑任务]] | 创建与编辑任务 | task create/edit/show/list 命令详解 |
| [[usermanual/10-任务管理/02-草稿管理]] | 草稿管理 | 草稿创建、提升、降级、独立 ID 空间 |
| [[usermanual/10-任务管理/03-子任务与依赖]] | 子任务与依赖 | 子任务创建、依赖设置、序列影响 |
| [[usermanual/10-任务管理/04-搜索与序列]] | 搜索与序列 | search 命令、序列概念与规划意义 |
| [[usermanual/10-任务管理/05-归档与清理]] | 归档与清理 | archive、cleanup、归档与完成的区别 |
| [[usermanual/20-看板与可视化/00-TUI看板]] | TUI 看板 | 终端交互式看板操作指南 |
| [[usermanual/20-看板与可视化/01-Web看板]] | Web 看板 | 浏览器看板拖放操作与筛选 |
| [[usermanual/20-看板与可视化/02-看板导出]] | 看板导出 | export 命令、README 嵌入、版本标注 |
| [[usermanual/30-文档与决策/00-文档管理]] | 文档管理 | doc create/update/list/view 命令 |
| [[usermanual/30-文档与决策/01-决策记录]] | 决策记录 | decision create/list、ADR 状态流转 |
| [[usermanual/30-文档与决策/02-里程碑管理]] | 里程碑管理 | 里程碑创建、分配、归档、未分配池 |
| [[usermanual/40-Web界面/00-启动与访问]] | 启动与访问 | browser 命令、端口、响应式与暗黑模式 |
| [[usermanual/40-Web界面/01-看板视图]] | 看板视图 | Web 看板拖放、泳道、筛选、实时更新 |
| [[usermanual/40-Web界面/02-任务列表]] | 任务列表 | 表格布局、多维筛选、搜索、任务跳转 |
| [[usermanual/40-Web界面/03-里程碑管理]] | Web 里程碑管理 | 里程碑详情、任务分配、折叠区、搜索 |
| [[usermanual/40-Web界面/04-文档与决策]] | Web 文档与决策 | 文档列表、子文件夹、决策查看 |
| [[usermanual/40-Web界面/05-设置与主题]] | 设置与主题 | 配置编辑、DoD 默认值、MDEditor、Mermaid |
| [[usermanual/40-Web界面/06-富文本粘贴与文档上传]] | 富文本粘贴与文档上传 | Word/Google Docs 粘贴转 Markdown、.docx 上传、图片 promote |
| [[usermanual/50-AI集成/00-MCP工作流]] | MCP 工作流 | Spec-Driven 四步工作流、工具能力、安全 |
| [[usermanual/50-AI集成/01-支持的AI工具]] | 支持的 AI 工具 | 6 款工具的配置命令与步骤详解 |
| [[usermanual/50-AI集成/02-代理指令文件]] | 代理指令文件 | 指令文件生成、内容、MCP vs CLI 对比 |
| [[usermanual/50-AI集成/03-Wiki Skill 安装]] | Wiki Skill 安装 | backlog wiki install、skill 嵌入二进制、Agent 符号链接 |
| [[usermanual/60-配置与运维/00-配置管理]] | 配置管理 | config 命令、关键配置项、YAML 示例 |
| [[usermanual/60-配置与运维/01-Shell补全]] | Shell 补全 | completion install、4 种 shell、动态补全 |

## Developer Notes

| File | Title | Description |
|---|---|---|
| [[developer-notes/honkit-usermanual-preview]] | HonKit 预览用户手册 | 本地预览、构建静态站点、生成 PDF 的完整操作流程 |
| [[developer-notes/ci-testing-gotchas]] | CI 与测试踩坑笔记 | 常见 CI 失败场景、文件系统测试陷阱、Biome 格式化细节 |
| [[developer-notes/architecture-gotchas]] | 架构分层规范 | Server 层禁止直接拥有文件读取/解析逻辑、HTTP handler 职责边界 |
| [[developer-notes/security-gotchas]] | 安全检查清单 | 路径遍历防护、SSRF 防护、文件大小限制、新增 API 安全自检 |

## Reports

| File | Title | Description |
|---|---|---|
| [[../wiki_output/reports/backlog-md-user-guide-zh]] | Backlog.md 用户使用指引 | 中文完整用户手册，涵盖安装、任务管理、看板、Web UI、AI 集成等 |
| [[../wiki_output/reports/feature-opportunities]] | 功能机会分析 | 基于现有架构的功能增强建议与优先级排序 |
