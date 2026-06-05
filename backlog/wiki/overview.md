---
title: Knowledge Base Overview
labels: [overview]
created_date: 2026-05-12 00:00
updated_date: 2026-06-05 15:19
---

# Knowledge Base Overview

## Project

**Backlog.md** — 一款 Markdown 原生的任务管理与看板可视化 CLI 工具，同时作为 MCP 服务器为 AI 编码助手提供协议接口。

## Domain Coverage

### 核心功能域
- **任务管理**：CRUD、子任务、草稿、归档、依赖、验收标准、DoD
- **看板**：终端 TUI 看板、Web 交互式看板、看板导出
- **搜索**：基于 Fuse.js 的跨任务/文档/决策/wiki 模糊搜索，支持 `type:wiki <keyword>` 语法过滤
- **Web UI**：React + Tailwind CSS v4 的现代化浏览器界面
- **AI 集成**：MCP 协议支持 Claude Code、Codex、Gemini CLI、Kiro、Cursor
- **粘贴为 Markdown**：Word/Excel/Google Docs 富文本自动转换，截图图片上传与嵌入
- **本地文件预览**：任务 References 和 Markdown 中的本地路径点击预览，支持语法高亮和行范围
- **Wiki Web UI**：浏览器中浏览和编辑 `backlog/wiki/` 文件树，实时同步，支持创建/重命名文件和文件夹；Wikilink 点击弹出预览模态框，标准 Markdown 相对链接在 wiki 页面内支持 SPA 导航预览
- **Wiki Install**：`backlog wiki install <agent>` 将内置 skill 安装到 Claude/Codex/Agents
- **功能机会分析**：基于现有架构的功能增强建议（Wiki CLI 桥接、任务模板、时间追踪、批量操作等），详见 [[../wiki_output/reports/feature-opportunities]]
- **Word 文档转换**：`.docx` 上传、Markdown 转换、内嵌图片提取与 promote
- **Web UI 国际化**：零依赖自定义 i18n（React Context + Hook），4 种语言（en/ja/zh-CN/zh-TW），~300 翻译键编译时嵌入二进制
- **日期字段支持**：任务与里程碑可选 `dueDate` / `plannedStart` / `plannedEnd`（date-only）与 `actualStart` / `actualEnd`（datetime UTC）；跨 CLI/TUI/Web/MCP 一致暴露；Web UI 自动填充规则与逾期高亮
- **项目健康度**：临期 / 逾期 / 停滞 / 阻塞 四维指标，Web 统计页与 CLI `overview` 命令统一呈现
- **智能甘特图**：`/gantt` 纯 React/CSS 时间线视图，五级粒度（日/周/月/季度/年），自动日期解析与最小宽度回退，任务依赖箭头可视化
- **跟踪甘特图**：在同一行上双层渲染实际条（状态色实心）与计划边框（60° 斜线填充），支持计划 vs 实际偏差追踪（早开始、正常、延期），含 Tooltip、图例与智能依赖箭头
- **时区一致性**：所有 UTC 存储字符串统一通过 `parseStoredUtcDate` 解析为本地时间，消除 CLI 与 Web UI 显示偏差
- **标签颜色自定义**：看板标签可设置 17 种预设颜色，持久化到 `config.yml`，支持暗黑模式自动切换（BACK-500）
- **卡片标签宽度自适应**：TaskCard 根据容器宽度动态计算可显示标签数量，ResizeObserver 实时响应（BACK-500）
- **标签输入下拉框**：任务详情模态框的 ChipInput 支持自动完成，模糊搜索过滤，大小写不敏感重复检测（BACK-501）
- **贡献热力图**：Statistics 页面顶部 GitHub 风格 7×53 网格，周日开始，GitHub 官方色板（inline style），hover/click tooltip，4 语言本地化（BACK-503）
- **统计缓存自动刷新**：服务端 `cachedStatisticsResponse` + 500ms debounce `invalidateStatistics()`，ContentStore 变更触发重新计算，WebSocket 广播 `"statistics-updated"`，客户端 `localStorage` 缓存瞬时加载（BACK-503）
- **Locale 切换可靠性**：修复 `App.tsx` `loadAllData()` 无条件覆盖 locale 的 bug，仅首次加载时同步服务器配置（BACK-503）
- **看板拖拽修复**：拖拽开始时不再清除列排序，避免任务在光标下跳动；`draggedTaskId` 提升到 Board 级别，跨列拖拽支持精确插入到任意位置（BACK-504）
- **依赖项钻取导航**：任务详情面板中 Dependencies 标签可点击打开子任务，标题栏左侧返回按钮回到父任务，关闭按钮清空整个浏览堆栈（BACK-505）
- **稳定任务模态框 URL**：`/task/:id` 路由支持从任意视图打开任务详情，底层页面保持可见；前缀无关匹配（`506` → `BACK-506`）；裸 `/task/:id` 自动重定向到 `/task/:id/:title`；Markdown 中的 `/task/` 链接在模态框内打开（BACK-509）
- **Wiki 编辑模式修复**：切换 Wiki 页面时自动退出编辑模式，避免新页面内容在编辑器中误显示（BACK-510）
- **本地 URL 短别名**：Markdown 中同源 URL 渲染为 `DOC#:id`、`Decisions#:id`、`TASK#:id`、`WIKI#:path` 别名，提升可读性同时保持点击性与模态框导航（BACK-511）
- **CLI 日期 UTC 转换**：`actualStart`/`actualEnd` 在 CLI/MCP 入口统一通过 `localDateTimeToStoredUtc` 转换为 UTC 存储，消除与 Web UI 的输入偏差（BACK-506）
- **CLI description 转义**：`--description`/`--desc` 支持跨平台一致的 `\n` 换行输入；Windows 上模拟 bash 双引号层后统一应用 C-style 转义（BACK-508）
- **看板跨分支列菜单**：列含跨分支任务时仍显示本地排序，仅隐藏会修改 ordinal 的 Apply Priority Order（BACK-512）

### 源代码架构域
- **核心层**：`Core` 聚合 `FileSystem` + `GitOperations`，惰性初始化 `ContentStore` + `SearchService`
- **数据流**：Markdown 文件 → `FileSystem` → `ContentStore`（内存缓存 + 文件监视）→ `SearchService`（Fuse.js 索引）
- **CLI**：`cli.ts` 单文件大入口，Commander.js + Clack 交互式向导，支持 TTY 检测与 plain 回退
- **MCP Server**：`McpServer extends Core`，stdio 传输，roots 发现，fallback 模式
- **Web Server**：`BacklogServer` 基于 `Bun.serve()`，REST API + WebSocket 广播 + React SPA
- **Markdown 流水线**：`gray-matter` 解析 frontmatter + `structured-sections.ts` 提取 AC/DoD/计划/备注
- **资源管理**：`AssetManager` 处理上传、data URI、安全远程下载，临时目录 `.temp/` + 保存时 promote 到 `paste/`（任务、文档、Wiki 编辑器均支持）
- **Skill 嵌入**：构建时将 `.codex/skills/` 嵌入 `src/skills/embedded/` 供编译后二进制使用
- **MCP 安全**：stdio-only 传输，Windows 上修复 stdin close 误触发导致的挂起问题
- **网络错误恢复**：GitOperations 将 SSL 错误（`SSL_ERROR_SYSCALL`、`SSL handshake failed` 等）识别为网络错误并优雅降级到本地数据

### 项目管理域
- **里程碑**：创建、分配、完成检测、归档；支持 actualStart/actualEnd 自动填充
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

- Sources ingested: 56
- Concepts extracted: 20
- Entities catalogued: 2
- Execution notes: 10
- Decisions recorded: 17
- Patterns: 5
- Reasoning traces: 2
- User manual pages: 24
- Reports generated: 3
