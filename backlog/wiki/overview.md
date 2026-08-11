---
title: Knowledge Base Overview
labels: [overview]
created_date: 2026-05-12 00:00
updated_date: '2026-08-09 00:00'
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
- **AI 集成**：CLI instructions 为默认代理集成路径，`backlog instructions` 提供本地工作流指南；MCP 协议仍支持 Claude Code、Codex、Gemini CLI、Kiro、Cursor 作为可选连接器
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
- **Wikilink 增强**：支持别名语法 `[[target|alias]]`（含 Markdown 行内格式与任意 HTML）、markdown-it-attrs 属性块 `[[target]]{...}`、媒体嵌入 `![[path|alt|WxH]]`（图片/视频/音频）及尺寸控制（BACK-523 / BACK-524）
- **Wiki skill 与 CLI 文档同步**：更新内嵌 skill 文档以覆盖 wikilink 新语法，修复 `scripts/embed-wiki-skill.ts` 的 `$` 转义问题；更新 CLI 多行输入指南（`--desc`/`--plan`/`--notes`/`--comment`/`--final-summary`）（BACK-525）
- **CLI 指令表面**：`backlog instructions` 暴露 overview/task-creation/task-execution/task-finalization/milestones/init-required 等本地指南；裸 `backlog` 输出指向本地指令入口而非旧在线文档；`backlog init` 默认安装短 CLI nudge 到 `AGENTS.md`（BACK-521 / BACK-521.2 / BACK-521.6 / BACK-521.14）
- **CLI 日期 UTC 转换**：`actualStart`/`actualEnd` 在 CLI/MCP 入口统一通过 `localDateTimeToStoredUtc` 转换为 UTC 存储，消除与 Web UI 的输入偏差（BACK-506）
- **CLI description 转义**：`--description`/`--desc` 支持跨平台一致的 `\n` 换行输入；Windows 上模拟 bash 双引号层后统一应用 C-style 转义（BACK-508）
- **CLI plan/notes/finalSummary 转义**：`--plan`、`--notes`、`--final-summary` 在 `task create/edit` 中同样应用 `processCliEscapes`，实现多行输入（BACK-527）
- **创建任务引用与文档**：Web 创建任务模态框现在支持添加 References 和 Documentation，并持久化到任务文件（BACK-526）
- **路径自动补全发现 .backlog**：全局文件搜索从排除列表中移除 `.backlog`，允许用户通过 `.back` 发现 backlog 工作目录，其他点前缀目录仍隐藏（BACK-526）
- **Web 日期清除持久化**：任务详情模态框点击日期选择器 Clear 后客户端发送空字符串，服务端将其识别为删除指令，解决清除不生效问题（BACK-528）
- **看板跨分支列菜单**：列含跨分支任务时仍显示本地排序，仅隐藏会修改 ordinal 的 Apply Priority Order（BACK-512）
- **任务评论**：结构化追加式讨论机制，支持 Markdown 正文、可选作者、时间戳；通过 CLI `--comment`、MCP `commentsAppend`、Web UI 编辑模式表单追加；评论文本参与搜索；以 sentinel-delimited `## Comments` 章节持久化于任务 Markdown 中（BACK-470）
- **自动端口选择**：`autoPort` 配置（默认 `true`），默认端口被占用时自动扫描接下来 100 个用户端口；拒绝 OS 分配的超出范围端口；设置面板提供开关；显式关闭时保留原有 EADDRINUSE 报错行为（BACK-514）
- **里程碑 API 修复**：`PUT /api/milestones/:id` 现在在响应中返回更新后的里程碑对象，修复前端测试失败（BACK-515）
- **甘特图拖拽修复**：拖拽操作改为直接操作 `scrollLeft`/`scrollTop` 而非修改 `viewStart`/`viewEnd`，避免日期尺度和任务位置被意外改变（BACK-516）
- **i18n 字符串碎片化修复**：里程碑展开/折叠按钮从运行时拼接（`hideTasks + tasks`）改为完整短语键，消除日语/中文等非英语语种的语法断裂（BACK-517）
- **TUI 主题自适应**：所有高亮/选择样式从硬编码 ANSI 颜色（`fg: white`, `bg: black`, `bg: blue`）切换为 `inverse + bold`，兼容任意终端主题包括单色配色（BACK-518）
- **CLI 多行与追加**：`doc update --content` 应用 `processCliEscapes`；新增 `--append-content`（doc）与 `--append-description`（task edit）追加选项，MCP 对应 `appendContent`/`descriptionAppend`（BACK-529 / BACK-530）
- **CLI 草稿工作流指南**：CLI 与 MCP 各新增 drafts 指南，说明草稿 vs 任务取舍、promote/demote 后 ID 变化（BACK-532）
- **多行输入避免 ANSI-C 引号**：指南显式警告不要用 `$'...'` 包装多行 CLI 字段（BACK-547）
- **config 块状 YAML 列表**：`parseConfig` 支持块状 YAML 序列解析 statuses/labels，`config get/set` 共享统一键列表（BACK-533）
- **ordinal 重排保留 updated_date**：仅序号变更不刷新 `updated_date`，消除 diff 噪音（BACK-534）
- **清单编辑确定性化**：AC/DoD 解析用 tokenizer+区间解析器替代 regex，新增 `--clear-ac` 原子清空（BACK-537）
- **重复任务 ID 恢复**：`backlog doctor` 人类优先、CLI 权威，预览+确认+可回滚（--commit/--rollback）（BACK-538）
- **ContentStore 竞态修复**：逐项版本守卫+条件合并防止过期刷新覆盖新状态（BACK-540）
- **状态/未指派过滤**：CLI/Web/MCP/TUI 支持多状态选择与 `--exclude-status`；CLI/MCP 支持 `--unassigned` 未指派过滤（BACK-548 / BACK-551）
- **排序增强**：看板列菜单新增创建日期排序；所有任务列表默认按序号排序（表头三击循环）；里程碑卡片新增 Created 列（BACK-541 / BACK-542 / BACK-543）
- **Web 细节增强**：任务详情显示 AC 编号、短链接行区间后缀、文档内锚点链接修复、跨刷新保留未保存草稿、标签过滤器字母排序、看板隐藏空状态列（BACK-531 / BACK-535 / BACK-536 / BACK-544 / BACK-546 / BACK-549）
- **数字 ID 查找修复**：非默认前缀下 `task edit` 裸数字 ID 正确解析（BACK-545）
- **doc view plain**：支持 `--plain` 非交互输出与自动 plain（BACK-552）
- **Apple Silicon 二进制解析**：Rosetta/架构不匹配下正确解析平台包（BACK-550）
- **win32-arm64 构建**：在 Linux runner 交叉编译 win32-arm64 发布二进制，矩阵加 fail-fast:false（BACK-539）
- **浏览器 UI 打包现代化**：用 `Bun.build` + `bun-plugin-tailwind` 取代两步 build:css+compile 流程（BACK-553）

### 上游迁移（v1.47.1 .. v1.48.0）
- **doc-4 差异分类**：上游 39 项变更按 A（必须合入）/B（评估合入）/C（跳过）分类，映射到 fork 迁移任务（BACK-538/537/533/540/534/535/536/550/548/541/542/551/552/549/553/543/544/546）
- **doc-5 A 类分析**：逐项给出迁移建议；A1 类型字段用户决策放弃
- **doc-6 B 类分析**：B1 路由、B9 dateFormat、B2 自定义优先级决策跳过；B8 draft 链接勘误

### 源代码架构域
- **核心层**：`Core` 聚合 `FileSystem` + `GitOperations`，惰性初始化 `ContentStore` + `SearchService`
- **数据流**：Markdown 文件 → `FileSystem` → `ContentStore`（内存缓存 + 文件监视）→ `SearchService`（Fuse.js 索引）
- **CLI**：`cli.ts` 单文件大入口，Commander.js + Clack 交互式向导，支持 TTY 检测与 plain 回退
- **MCP Server**：`McpServer extends Core`，stdio 传输，roots 发现，fallback 模式；正常启动路径也跟随客户端 workspace roots（BACK-522），`--cwd`/`BACKLOG_CWD` 可 pinned 固定根目录
- **Web Server**：`BacklogServer` 基于 `Bun.serve()`，REST API + WebSocket 广播 + React SPA
- **Markdown 流水线**：`gray-matter` 解析 frontmatter + `structured-sections.ts` 提取 AC/DoD/计划/备注
- **资源管理**：`AssetManager` 处理上传、data URI、安全远程下载，临时目录 `.temp/` + 保存时 promote 到 `paste/`（任务、文档、Wiki 编辑器均支持）
- **Skill 嵌入**：构建时将 `.codex/skills/` 嵌入 `src/skills/embedded/` 供编译后二进制使用
- **MCP 安全**：stdio-only 传输，Windows 上修复 stdin close 误触发导致的挂起问题
- **MCP 客户端设置**：统一 helper 支持 Claude/Codex/Gemini/Kiro；Codex 使用 `--` stdio 分隔符；新增编译二进制 MCP stdio smoke 测试（BACK-520）
- **CLI/MCP 指令指南补齐**：将 agent-guidelines.md 中缺失的运营指导（目录布局、黄金法则、任务字段速查、里程碑指南、图片/资源处理、常见问题含文档引用路径示例）回传到 CLI/MCP 指令表面；明确创建任务时不包含 Implementation Plan，执行前需用户批准（BACK-521.14）
- **里程碑 CLI 与 MCP 指南**：新增独立 milestones 指南，统一 CLI `backlog milestone ...` 与 MCP `milestone_*` 工具的创建、编辑、移除、归档、分配语义（BACK-521.7 / BACK-521.14）
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

- Sources ingested: 108
- Concepts extracted: 26
- Entities catalogued: 2
- Execution notes: 14
- Decisions recorded: 28
- Patterns: 5
- Reasoning traces: 2
- User manual pages: 24
- Reports generated: 7
