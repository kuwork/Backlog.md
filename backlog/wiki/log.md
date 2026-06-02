---
title: Wiki Operations Log
labels: [log]
created_date: 2026-05-06 00:00
---


# Wiki Operations Log

Chronological, append-only record of all wiki operations.

## [2026-05-06 21:24:47] init | Wiki initialized

- Created `backlog/wiki/` directory structure
- Created `backlog/wiki_output/` directory structure
- Injected wiki guidelines into `AGENTS.md`
- Generated `index.md`, `log.md`, `overview.md`
- Project: Backlog.md CLI/MCP tool

## [2026-05-06 21:24:47] source-ingest | 摄取项目源代码目录 src/

- 扫描 src/ 目录全部模块（16 个子目录，~10,000+ 行核心代码）
- 摄取关键源文件：
  - `src/index.ts` — 公共 API 导出门面
  - `src/cli.ts` — CLI 入口与命令体系
  - `src/core/backlog.ts` — Core 领域类（任务 CRUD、ID 生成、配置迁移、跨分支查询）
  - `src/core/content-store.ts` — ContentStore 内存缓存与文件监视器
  - `src/core/search-service.ts` — SearchService Fuse.js 搜索索引
  - `src/file-system/operations.ts` — FileSystem 文件系统操作
  - `src/types/index.ts` — 领域类型定义
  - `src/mcp/server.ts` — McpServer MCP 协议层
  - `src/server/index.ts` — BacklogServer HTTP API 与 WebSocket
  - `src/markdown/parser.ts` — Markdown 解析流水线
- 创建 source 页面：`sources/src-architecture`
- 创建 5 个 concept 页面：核心架构与数据流、CLI 入口与命令体系、MCP Server 实现、Web Server 与浏览器界面、Markdown 解析与序列化流水线
- 更新 `index.md`、`overview.md`

## [2026-05-06 21:24:47] batch-ingest | 批量摄取任务与文档

- 扫描并分析了 backlog 全部目录结构（tasks/ 154 个、completed/ 304 个、docs/ 4 个、decisions/ 2 个、drafts/ 16 个、milestones/ 2 个、archive/ 47 个）
- 摄取关键源文件：README.md、CLI-INSTRUCTIONS.md、BACK-287、BACK-100、doc-001~003、decision-1、BACK-383、BACK-428、BACK-3、BACK-4、BACK-7、BACK-5、BACK-173、BACK-273、BACK-308、BACK-213、BACK-174、BACK-180、BACK-401、BACK-346
- 创建 5 个 source 摘要页面
- 创建 5 个 concept 页面：任务生命周期、CLI/TUI、Web UI、MCP 工作流、搜索与序列
- 创建 2 个 entity 页面：Backlog.md CLI 工具、AI 代理与集成
- 生成中文用户使用指引：`wiki_output/reports/backlog-md-user-guide-zh.md`
- 更新 `index.md`、`overview.md`

## [2026-05-07 01:43:12] rename | 用户手册目录与输出文件重命名

- 将 `wiki/userguide/` 重命名为 `wiki/usermanual/`，以更准确反映其用途
- 合并输出文件从 `guide.md` 改为 `manual.md`
- 更新 `AGENTS.md` Wiki Structure 说明
- 输出：`backlog/wiki_output/用户手册/manual.md`（294 个资产）

## [2026-05-07 01:59:00] usermanual-create | 根据 wiki 内容生成用户手册全部章节

- 基于 wiki concepts、entities、sources 内容，生成 `wiki/usermanual/` 结构化用户手册
- 创建 README.md（封面/简介）和 SUMMARY.md（目录导航）
- 7 个章节共 22 个页面：
  - 00-快速开始：产品概述、安装与初始化、AI 集成设置
  - 10-任务管理：任务生命周期、创建与编辑任务、草稿管理、子任务与依赖、搜索与序列、归档与清理
  - 20-看板与可视化：TUI 看板、Web 看板、看板导出
  - 30-文档与决策：文档管理、决策记录、里程碑管理
  - 40-Web界面：启动与访问、看板视图、任务列表、里程碑管理、文档与决策、设置与主题
  - 50-AI集成：MCP 工作流、支持的 AI 工具、代理指令文件
  - 60-配置与运维：配置管理、Shell 补全
- 所有页面遵循 usermanual-writing-guide.md 规范：去序号标题、YAML frontmatter、操作类叙事风格

## [2026-05-10 01:38:59] batch-ingest | 增量摄取 5 个新任务与相关源代码变更

- **检测基线**: 2026-05-06 21:24:47（上次 batch-ingest）
- **Git 变更文件**: 5 个 backlog 任务 + 25 个源代码文件
- **新 source 页面**: 5 个
  - `sources/paste-as-markdown-task` — BACK-208 富文本粘贴转 Markdown
  - `sources/windows-mcp-fix-task` — BACK-465 Windows MCP stdio 挂起修复
  - `sources/file-preview-task` — BACK-467 本地文件预览与语法高亮
  - `sources/wiki-web-ui-task` — BACK-473 Web UI Wiki 区域与文件树导航
  - `sources/wiki-install-task` — BACK-474 Wiki Install CLI 命令
- **新 concept 页面**: 3 个
  - `concepts/paste-as-markdown` — Turndown 转换引擎、Word HTML 清理、图片粘贴 promote 机制
  - `concepts/asset-management` — AssetManager 类、临时目录设计、SSRF 安全下载
  - `concepts/file-preview` — `/api/file-content`、语法高亮、行号、行范围
- **更新 concept 页面**: 4 个
  - `concepts/web-ui-features` — 添加 Wiki 区域、粘贴为 Markdown、本地文件预览
  - `concepts/web-server` — 添加 `/api/file-content`、upload/promote、wiki tree/page API
  - `concepts/cli-entry` — 添加 `wiki install <agent>` 命令
  - `concepts/mcp-workflow` — 添加 Windows MCP document tool 挂起问题与修复
- **更新导航文件**: `index.md`、`overview.md`

## [2026-05-23 00:40:21] batch-ingest | 增量摄取 BACK-483 Web UI 侧边栏调整大小

**检测基线**: 2026-05-22 10:00:00（上次 batch-ingest）
**Git 变更文件**: 1 个 backlog 源文件（未跟踪）

**新 source 页面**: 1 个
- `sources/sidebar-resize-search-task` — BACK-483 侧边栏拖拽调整大小、ghost bar 预览、localStorage 持久化、搜索类型下拉、Wiki URL 分段编码

**更新 concept 页面**: 1 个
- `concepts/web-ui-features` — 添加全局布局/侧边栏调整大小章节、所有任务搜索类型下拉、Wiki URL 编码策略

**更新导航文件**: `index.md`、`overview.md`
- Sources ingested 统计: 20 → 21

## [2026-05-23 00:40:21] lint | Wiki 健康检查：修复 3 个 dangling link、1 个 orphan、2 处 frontmatter

**扫描范围**: `backlog/wiki/` 全部 46 个页面（不含 usermanual）

**修复问题**:
- **Dangling links (3)**:
  - `concepts/paste-as-markdown.md:44` — `[[docx-conversion]]` → `[[concepts/docx-conversion]]`
  - `sources/folder-grouping-for-docs.md:72` — `[[sources/web-ui-i18n]]` → `[[sources/web-ui-i18n-task]]`
  - `sources/folder-grouping-for-docs.md:73` — `[[sources/web-ui-full-doc-editing]]` → `[[sources/path-autocomplete-task]]`
- **Orphan page (1)**:
  - `developer-notes/DEVELOPMENT-GUIDE` — 新增 `index.md` 条目 + `ci-testing-gotchas.md` Related 链接
- **Frontmatter 缺失 (2)**:
  - `developer-notes/DEVELOPMENT-GUIDE.md` — 补全 `created_date`
  - `concepts/paste-as-markdown.md` — 补全 `updated_date`

**产出报告**: `wiki_output/reports/lint-2026-05-23.md`

## [2026-05-23 00:40:21] usermanual-update | 更新用户手册，添加 BACK-483 侧边栏调整大小、搜索类型下拉、Wiki URL 可读路径

**更新页面**: 3 个
- `40-Web界面/00-启动与访问` — 新增「界面布局」章节，描述左右布局与侧边栏拖拽调整宽度（ghost bar、localStorage 持久化、200–500px 限制）
- `40-Web界面/02-任务列表` — 「使用搜索框」章节新增「搜索类型下拉」子节（All/Tasks/Documents/Decisions/Wiki）
- `40-Web界面/07-Wiki浏览与编辑` — 「浏览文件树」章节新增「路径与 URL」子节，说明 `/` 不编码为 `%2F`、特殊字符安全编码、地址栏直接跳转

## [2026-05-12 09:14:40] batch-ingest | 增量摄取 BACK-475 docx 上传与内嵌 skill 架构

- **检测基线**: 2026-05-10 01:38:59（上次 batch-ingest）
- **Git 变更文件**: 1 个 backlog 任务 + 4 个源代码/配置文件
- **新 source 页面**: 1 个
  - `sources/docx-upload-task` — BACK-475 Word 文档上传与图片提取
- **新 concept 页面**: 2 个
  - `concepts/docx-conversion` — `.docx` 上传、后端 mammoth 提取、前端统一 cleanHtml+Turndown 流水线
  - `concepts/embedded-skills` — 构建时 skill 嵌入二进制、`embed-wiki-skill.ts` 生成 `Record<string, string>`
- **更新 concept 页面**: 3 个
  - `concepts/paste-as-markdown` — 添加 Word 文档上传说明、 mammoth 依赖
  - `concepts/web-ui-features` — 任务编辑增加 `.docx` 文件上传
  - `concepts/web-server` — 添加 `/api/docx/convert` 端点
- **更新导航文件**: `index.md`、`overview.md`

## [2026-05-12 09:22:00] usermanual-update | 更新用户手册，添加 docx 粘贴上传与 Wiki Skill 安装章节

- **新增页面**: 2 个
  - `40-Web界面/06-富文本粘贴与文档上传` — Word/Google Docs 粘贴为 Markdown、.docx 文件上传、图片 promote 机制
  - `50-AI集成/03-Wiki Skill 安装` — `backlog wiki install` 命令、skill 嵌入二进制架构、Agent 符号链接与 Windows 回退
- **更新页面**: 4 个
  - `README.md` — 核心特性增加富文本粘贴与 Wiki 知识库
  - `00-快速开始/00-产品概述` — Web 界面增加粘贴/上传说明，AI 集成增加 Wiki Skill 安装
  - `SUMMARY.md` — 添加新页面导航链接
  - `index.md` — 用户手册目录增加 2 个新条目

## [2026-05-12 09:45:00] wiki-create | 创建 HonKit 预览用户手册开发者指南

- **新 developer-notes 页面**: `developer-notes/honkit-usermanual-preview` — HonKit 本地预览、静态构建、PDF 生成的完整操作流程
- **涵盖内容**:
  - 前置条件与目录结构说明
  - `npx honkit serve --port 4000` 启动实时预览
  - `npx honkit build` 构建静态站点到 `_book/`
  - PDF 生成的 Calibre 依赖与替代方案
  - 常见问题排查（GitBook CLI 兼容性、中文路径、ebook-convert）
- **更新导航文件**: `index.md`

## [2026-05-14 10:35:00] batch-ingest | Incremental ingest: 7 updated tasks, 1 new source, 2 updated concepts

- **Updated sources**: back-208, back-465, back-467, back-473, back-474, back-475 (verified existing summaries)
- **New source**: [[sources/inline-code-html-escaping-fix]] — BACK-476 行内代码 HTML 实体转义修复
- **Updated concepts**: [[concepts/markdown-pipeline]] — 添加渲染安全章节（HTML 实体转义保护机制）; [[concepts/web-ui-features]] — 更新 Wiki 功能描述（在线编辑、实时同步、文件管理）
- **Updated index.md**: added new source entry, migrated table column `Type` → `Labels`
- **Updated overview.md**: updated domain coverage (Wiki 在线编辑), stats (13 sources)

## [2026-05-17 02:20:03] batch-ingest | 增量摄取 BACK-478 Web UI i18n 支持

- **检测基线**: 2026-05-14 10:35:00（上次 batch-ingest）
- **Git 变更文件**: 1 个 backlog 任务 + 30 个源代码/配置文件
- **新 source 页面**: 1 个
  - `sources/web-ui-i18n-task` — BACK-478 Web UI i18n 支持
- **新 concept 页面**: 1 个
  - `concepts/web-ui-i18n` — 零依赖轻量级 i18n 架构、DeepString 类型安全、编译时嵌入策略
- **更新 concept 页面**: 2 个
  - `concepts/web-ui-features` — 添加语言切换与国际化技术特性
  - `concepts/web-server` — 前端技术栈补充 locales/ 目录与 I18nContext
- **更新导航文件**: `index.md`、`overview.md`

## [2026-05-20 21:30:00] source-update | 修正 BACK-473 Web UI Wiki 任务描述，同步代码迭代后的实际功能

- **更新 source 页面**: `sources/wiki-web-ui-task`
  - 修正原始任务中"Wiki 内容只读"的过时描述 → 补充在线编辑、Wikilink 预览、文件管理三大演进功能
  - 补充扩展后的后端 API 表格（PUT 更新、POST 创建、PATCH 重命名）
  - 补充前端技术细节（`PasteAwareMDEditor`、`WikiLinkPreview`、`hasChanges` 检测）
- **更新 concept 页面**: `concepts/web-ui-features`
  - Wiki 章节补充 Wikilink 交互预览模态框、目录文件数量统计、未保存变更检测
  - 更新 `updated_date`
- **更新导航文件**: `index.md` 的 `updated_date`

**背景**: BACK-473 原始任务限定 Wiki 为"只读"（`[[wikilinks]]` 渲染为粗体），但代码后续迭代增加了在线编辑、可点击 wikilink 预览、侧边栏文件/文件夹创建与重命名等功能。wiki 中的 source 摘要停留在任务完成时的快照，与实际代码脱节，现已修正。


## [2026-05-20 21:40:00] report-create | 创建功能机会分析报告

- **新报告**: `wiki_output/reports/feature-opportunities` — 基于 Backlog.md 现有架构的功能增强建议
- **涵盖内容**:
  - **高优先级**: Wiki CLI 桥接（`wiki ingest`/`search`/`status`）、任务模板系统（`backlog template`）
  - **中优先级**: 轻量级时间追踪（`task start/stop/log`）、批量操作（`task bulk`）、依赖关系可视化（`backlog graph`）
  - **低优先级/长期**: Git Hook 集成（自动状态流转）、Sprint/迭代管理、日历视图
  - 每个建议包含现状分析、建议命令、价值评估、与现有架构的契合度
  - 架构契合度总结表（复用现有能力 × 新增复杂度）
- **更新导航文件**: `index.md`（Reports 区域添加引用）、`overview.md`（域覆盖增加功能机会分析）

## [2026-05-20 23:45:00] batch-ingest | 增量摄取 BACK-479 路径自动补全、BACK-480 里程碑搜索修复

## [2026-05-21 22:50:00] batch-ingest | 增量摄取 BACK-419 降级为草稿、BACK-480 搜索修复、源码变更

**变更文件**
- `backlog/tasks/back-480` — 里程碑搜索模糊匹配误报修复（已更新 source 页面）
- `backlog/tasks/back-419` — Web UI 降级为草稿操作（新建 source 页面）
- `src/server/index.ts` — 新增 `POST /api/tasks/:id/demote` 端点
- `src/web/components/TaskDetailsModal.tsx` — demote 按钮、i18n 硬编码修复
- `src/web/lib/api.ts` — `apiClient.demoteTask(id)`
- `src/web/locales/*` — demote 翻译键（en/ja/zh-CN/zh-TW）
- `src/web/components/MilestonesPage.tsx` — 子串包含匹配 + Fuse.js fallback 搜索策略
- `src/test/server-demote-endpoint.test.ts` — demote API 测试
- `src/test/web-milestones-page-search.test.tsx` — 搜索测试补充 I18nProvider

**Wiki 更新**
- **新建 source 页面**: `sources/demote-to-draft-action` — BACK-419 任务摘要、出现条件、后端/前端实现细节
- **更新 source 页面**: `sources/milestone-search-fix` — 补充三层匹配策略、测试修复细节
- **更新 concept 页面**: `concepts/web-ui-features`
  - 任务编辑章节补充"降级为草稿"功能描述
  - 里程碑章节补充搜索误匹配修复说明
  - 更新 `updated_date`
- **更新导航文件**: `index.md`（添加 demote-to-draft-action source 引用、更新日期）
- **更新概览**: `overview.md`（Sources ingested: 17 → 18）


## [2026-05-22 02:15:00] source-ingest | 摄取 BACK-423 Web UI 文档文件夹分组

- **新建 source 页面**: `sources/folder-grouping-for-docs` — BACK-423 任务摘要、后端/前端实现细节、关键设计决策
  - 后端：`DocsTreeNode`、`getDocsTree()`、`createDocsFolder()`、`GET /api/docs/tree`、`POST /api/docs/folder`
  - 前端：`DocTreeItem`、`DocActionDropdown`、`docsTree` 状态、`?path` 查询参数预填充
  - 设计决策：独立 `docsTree` 而非从 `docs` 数组派生、无独立重命名操作、树节点标题解析策略
- **更新 concept 页面**: `concepts/web-ui-features`
  - "文档与决策"章节补充文档文件夹树详情（展开/折叠、文件夹操作、无独立重命名、`filteredDocs` 策略）
  - 更新 `updated_date`
- **更新导航文件**: `index.md`（添加 folder-grouping-for-docs source 引用、更新日期）

## [2026-05-22 10:00:00] batch-ingest | 增量摄取 BACK-481 Wiki 搜索支持、BACK-482 Wikilink 与 Markdown 相对链接预览修复

- **检测基线**: 2026-05-22 02:15:00（上次 source-ingest）
- **Git 变更文件**: 2 个 backlog 任务 + 4 个源代码/测试文件
- **新 source 页面**: 2 个
  - `sources/wiki-search-task` — BACK-481 将 Wiki 纳入 Web 搜索范围：SearchService 索引、ContentStore 集成、Web 搜索 UI 渲染
  - `sources/wikilink-markdown-preview-fix` — BACK-482 修复 Wikilink 父目录遍历预览、支持标准 Markdown 相对链接预览、readWikiPage rootDir 扩展
- **更新 concept 页面**: 2 个
  - `concepts/search-sequences` — 补充 Wiki 搜索实体、fileName 权重、type:wiki 语法
  - `concepts/web-ui-features` — 补充 Wiki 搜索结果显示、Wikilink 预览模态框、Markdown 相对链接拦截与 SPA 导航
- **更新导航文件**: `index.md`、`overview.md`

## [2026-05-23 11:15:00] source-ingest | BACK-484 Web UI sort optimization

- **新 source 页面**: `sources/web-ui-sort-optimization` — 任务列表双箭头排序图标、里程碑分组独立排序表头、看板列操作菜单本地排序
- **更新 concept 页面**: `concepts/web-ui-features`
  - 新增「排序交互」章节，涵盖任务列表表头排序、里程碑分组独立排序、看板列本地排序
- **更新导航文件**: `index.md`（添加 web-ui-sort-optimization source 引用、更新日期）

## [2026-05-23 15:18:00] batch-ingest | 增量摄取 BACK-485 草稿提升流程修复、BACK-486 草稿页筛选功能

- **检测基线**: 2026-05-23 11:15:00（上次 source-ingest）
- **Git 变更文件**: 2 个 backlog 任务 + 6 个源代码/测试/本地化文件
- **新 source 页面**: 2 个
  - `sources/draft-promote-flow-task` — BACK-485 修复草稿提升流程并统一操作按钮样式：草稿检测、Promote/Demote 按钮、翡翠绿/琥珀色配色、后端返回 Task 对象、按钮样式统一
  - `sources/draft-filters-task` — BACK-486 草稿页添加筛选功能：关键字搜索、状态/优先级/里程碑/标签筛选、结果计数器、URL 同步、空状态适配
- **更新 concept 页面**: `concepts/web-ui-features`
  - 新增「草稿页面」章节，涵盖筛选栏布局、5 个筛选维度、客户端过滤、URL 同步、空状态
- **更新导航文件**: `index.md`（添加 2 个 source 引用、更新日期）

## [2026-05-25 00:45:24] batch-ingest | 增量摄取 BACK-487 SSL 错误处理、BACK-488 Wiki 粘贴图片 promote 修复

**检测基线**: 2026-05-23 15:18:00（上次 batch-ingest）
**Git 变更文件**: 2 个 backlog 任务 + 2 个源代码文件

**新 source 页面**: 2 个
- `sources/ssl-network-error-fix` — BACK-487 GitOperations.fetch SSL 网络错误未优雅处理修复
- `sources/wiki-pasted-images-promote-fix` — BACK-488 Wiki 页面保存时粘贴图片未迁移到 paste/ 修复

**更新 source 页面**: 1 个
- `sources/paste-as-markdown-task` — 添加 BACK-488 后续修复说明与关联链接

**更新 concept 页面**: 2 个
- `concepts/paste-as-markdown` — 补充 Wiki 编辑器也支持图片 promote 的说明
- `concepts/web-ui-features` — Wiki 章节补充「粘贴图片 promote」功能描述

**更新导航文件**: `index.md`、`overview.md`
- Sources ingested 统计: 23 → 25
- Overview 补充网络错误恢复能力说明

## [2026-05-25 00:45:24] pairing-memory-extraction | 补做遗漏的配对记忆提取

**背景**: 用户在摄取完成后指出未按技能说明执行 pairing memory extraction 步骤。

**补做内容**:
- `wiki/execution/image-promote-integration` — 从 BACK-208/488 提取「编辑器保存流程中集成图片 promote」的可复用步骤
- `wiki/execution/network-error-pattern-extension` — 从 BACK-487 提取「扩展 Git 网络错误识别模式」的标准流程
- `wiki/decisions/reuse-asset-promote-for-wiki-images` — 记录 BACK-488 选择复用现有 API 而非新建后端逻辑的决策
- 更新 `index.md` — 新增 Execution Notes 和 Decisions 区域

**说明**: `src/web/styles/style.css` 的 git diff 仅为 Tailwind CSS 头部注释版本变化，无语义变更，不纳入摄入。

## [2026-05-25 23:45:24] batch-ingest | 增量摄取 BACK-401 日期字段、社区 Fork 分析文档

**检测基线**: 2026-05-25 00:45:24（上次 batch-ingest）
**Git 变更文件**: 1 个新 backlog 任务（BACK-401）+ 23 个源代码/配置/测试文件 + 2 个未跟踪社区分析文档

**新 source 页面**: 3 个
- `sources/due-date-fields-task` — BACK-401 dueDate / plannedStart / plannedEnd 跨层支持
- `sources/community-feature-directions` — 39 个活跃 Fork 功能增强方向分析
- `sources/community-showcase` — 39 个活跃 Fork 亮点实践 Showcase

**新 concept 页面**: 1 个
- `concepts/date-fields` — 三个日期字段语义、存储格式、CLI/Web/MCP 使用方式

**更新 concept 页面**: 5 个
- `concepts/task-lifecycle` — frontmatter 示例与字段说明补充 plannedStart / plannedEnd
- `concepts/web-ui-features` — 补充里程碑日期编辑、TaskCard 日期指示器、自动填充规则、逾期高亮
- `concepts/cli-entry` — 补充 `--due-date` 等选项、`milestone edit` 命令、日期字段 CLI 使用
- `concepts/mcp-server` — 补充 `milestone_edit` 工具（原 milestone_rename）与日期字段 schema
- `concepts/web-server` — 里程碑 PUT 端点补充含日期字段说明

**Pairing Memory 提取**:
- `wiki/execution/milestone-update-refactor` — renameMilestone → updateMilestone + rawContent 保留 + 关联任务重写优化
- `wiki/decisions/date-only-storage` — 日期字段采用 YYYY-MM-DD date-only 存储的决策
- `wiki/decisions/web-ui-date-autofill` — dueDate 触发 plannedStart / plannedEnd 自动填充的 UX 决策

**更新导航文件**: `index.md`（添加 3 source + 1 concept + 1 execution + 2 decisions 条目）、`overview.md`（域覆盖增加日期字段与社区分析；统计更新）

**未摄取**: `backlog/wiki/Backlog用户手册.zip`（wiki 生成产物，不纳入来源）；`src/web/components/WikiDetail.tsx` 的 BACK-488 后续微小调整已在先前 batch-ingest 覆盖，无实质新内容。

## [2026-05-25 23:45:24] usermanual-update | 更新用户手册，添加 BACK-401 日期字段支持

**更新页面**: 6 个
- `00-快速开始/00-产品概述` — 新增「日期与计划」核心特性章节
- `usermanual/README` — 核心特性列表增加日期与计划
- `10-任务管理/00-任务生命周期` — frontmatter 示例与字段说明补充 `plannedStart` / `plannedEnd`
- `10-任务管理/01-创建与编辑任务` — 创建/编辑选项表格添加 `--due-date`/`--planned-start`/`--planned-end`/`--clear-*`；新增「日期字段」章节（CLI 用法、Web UI 自动填充规则）
- `30-文档与决策/02-里程碑管理` — 新增「编辑里程碑」章节（CLI `milestone edit`、日期字段、模糊匹配）
- `40-Web界面/01-看板视图` — 新增「任务卡片日期指示器」章节（日历图标、计划日期范围、时钟图标、逾期高亮）
- `40-Web界面/03-里程碑管理` — 新增「编辑里程碑」章节（弹窗编辑、日期字段设置与清空、卡片日期显示）

## [2026-05-25 23:45:24] source-remove | 撤销两个社区分析文档的摄取

**撤销原因**: 用户明确要求不将 `github-issue-community-features.md` 和 `github-issue-community-showcase.md` 纳入 wiki 来源。

**移除内容**:
- 删除 `wiki/sources/community-feature-directions.md`
- 删除 `wiki/sources/community-showcase.md`
- 更新 `wiki/index.md` — 移除 2 个 source 条目
- 更新 `wiki/overview.md` — Sources ingested 统计 28 → 26，移除「社区 Fork 分析」域覆盖
- 更新 `wiki/concepts/date-fields.md` — 移除 Related Sources 中的社区分析链接
- 更新 `wiki/sources/due-date-fields-task.md` — 移除 Related Sources 中的社区分析链接

**说明**: `wiki_output/reports/community-fork-analysis.md` 等报告文件保留在 wiki_output 中，不受影响。

## [2026-05-26 23:42:00] batch-ingest | 摄取 BACK-489 / BACK-490，新增 project-health 概念

**新增 Sources (2)**:
- `wiki/sources/back-489-health-indicators-task.md` — BACK-489 项目健康指标重构（临期 / 逾期 / 停滞）
- `wiki/sources/back-490-overview-command-task.md` — BACK-490 CLI overview 命令（项目级统计）

**新增 Concepts (1)**:
- `wiki/concepts/project-health.md` — 项目健康度四维指标（At Risk / Overdue / Stale / Blocked）

**更新 Concepts (3)**:
- `wiki/concepts/cli-entry.md` — 添加 `overview` 命令说明与输出结构
- `wiki/concepts/web-ui-features.md` — 补充统计页面健康度区域与看板卡片视觉标识
- `wiki/concepts/date-fields.md` — 无内容变更（BACK-401 source 已完整）

**更新导航 (2)**:
- `wiki/index.md` — Sources 28 条，Concepts 18 条
- `wiki/overview.md` — 添加「项目健康度」域覆盖，统计更新

**Pairing Memory (2)**:
- `wiki/execution/statistics-robustness.md` — 阻塞任务检测大小写敏感修复 + recentlyUpdated 回退模式
- `wiki/decisions/remove-json-overview.md` — 移除 `--json` 选项，plain + TUI 覆盖需求

## [2026-05-27 00:00:00] pattern-extraction | 从 304 个完成任务中提取 4 个可复用模式

**新增 Patterns (4)**:
- `wiki/patterns/cross-surface-feature-addition.md` — 跨表面功能添加的 12 层遍历 checklist
- `wiki/patterns/refactoring-rollout.md` — 重构分阶段推出的 6 阶段子任务推进法
- `wiki/patterns/bug-fix-prevention.md` — 症状修复 → 根因分析 → 审计扫荡 → 回归测试
- `wiki/patterns/tui-editor-integration.md` — blessed TUI 中安全启动外部编辑器的 8 步流程

**更新导航 (2)**:
- `wiki/index.md` — Patterns 区从空变为 4 个条目
- `wiki/overview.md` — 统计新增 Patterns: 4


## [2026-05-28 00:50:54] batch-ingest | 摄取 BACK-491 智能甘特图视图

**Git 基线**: 2026-05-26 23:42:00 → 2026-05-28 00:50:54

**新增 Sources (1)**:
- `backlog/tasks/back-491 - Add-smart-Gantt-View.md` → `wiki/sources/smart-gantt-view-task.md`

**新增 Concepts (1)**:
- `wiki/concepts/gantt-view.md` — Gantt 甘特图视图（纯 React/CSS 渲染、时间解析、依赖箭头、多级粒度）

**更新 Concepts (1)**:
- `wiki/concepts/web-ui-features.md` — 添加"甘特图（Gantt View）"小节

**新增 Reasoning (1)**:
- `wiki/reasoning/back-491-smart-gantt-view.md` — 问题分解、方案对比、关键设计决策与风险缓解

**新增 Decisions (1)**:
- `wiki/decisions/no-external-gantt-library.md` — 纯 React/CSS 自研 vs 引入第三方 Gantt 库的决策

**更新导航 (2)**:
- `wiki/index.md` — Sources +1, Concepts +1, Reasoning 从空变为 1 个条目, Decisions +1
- `wiki/overview.md` — 领域覆盖新增"智能甘特图"，统计更新


## [2026-05-28 00:50:54] usermanual-update | 更新用户手册，添加甘特图视图章节

**新增用户手册页面 (1)**:
- `wiki/usermanual/40-Web界面/09-甘特图视图.md` — 甘特图视图完整使用指南（页面布局、时间粒度、日期解析、最小宽度回退、任务条交互、依赖箭头、排序、时间线平移、暗黑模式）

**更新用户手册页面 (1)**:
- `wiki/usermanual/20-看板与可视化/01-Web看板.md` — 在「所有任务视图」后新增「甘特图视图」小节并链接到详情章节

**修复索引遗漏 (2)**:
- `wiki/index.md` 补录 `40-Web界面/08-统计页面`（此前存在文件但未索引）
- `wiki/index.md` 补录 `60-配置与运维/02-项目概览`（此前存在文件但未索引）

**导航更新 (1)**:
- `wiki/usermanual/SUMMARY.md` — Web 界面章节新增「甘特图视图」条目
