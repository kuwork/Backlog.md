---
title: Wiki Operations Log
labels: [log]
created_date: 2026-05-06 00:00
updated_date: 2026-09-26 14:55
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
- 摄取关键源文件...

## [2026-05-06 21:24:47] batch-ingest | 批量摄取任务与文档

- 扫描并分析了 backlog 全部目录结构...

## [2026-05-07 01:43:12] rename | 用户手册目录与输出文件重命名

- 将 `wiki/userguide/` 重命名为 `wiki/usermanual/`

## [2026-05-07 01:59:00] usermanual-create | 根据 wiki 内容生成用户手册全部章节

- 基于 wiki concepts、entities、sources 内容，生成 `wiki/usermanual/` 结构化用户手册
- 7 个章节共 22 个页面

## [2026-05-10 01:38:59] batch-ingest | 增量摄取 5 个新任务与相关源代码变更

- 新 source 页面 5 个、新 concept 页面 3 个...

## [2026-05-12 09:14:40] batch-ingest | 增量摄取 BACK-475 docx 上传与内嵌 skill 架构

## [2026-05-12 09:22:00] usermanual-update | 更新用户手册，添加 docx 粘贴上传与 Wiki Skill 安装章节

## [2026-05-12 09:45:00] wiki-create | 创建 HonKit 预览用户手册开发者指南

## [2026-05-14 10:35:00] batch-ingest | Incremental ingest: 7 updated tasks, 1 new source, 2 updated concepts

## [2026-05-17 02:20:03] batch-ingest | 增量摄取 BACK-478 Web UI i18n 支持

## [2026-05-20 21:30:00] source-update | 修正 BACK-473 Web UI Wiki 任务描述

## [2026-05-20 21:40:00] report-create | 创建功能机会分析报告

## [2026-05-20 23:45:00] batch-ingest | 增量摄取 BACK-419 降级为草稿、BACK-480 搜索修复、源码变更

## [2026-05-22 02:15:00] source-ingest | 摄取 BACK-423 Web UI 文档文件夹分组

## [2026-05-22 10:00:00] batch-ingest | 增量摄取 BACK-481 Wiki 搜索支持、BACK-482 Wikilink 与 Markdown 相对链接预览修复

## [2026-05-23 00:40:21] batch-ingest | 增量摄取 BACK-483 Web UI 侧边栏调整大小

## [2026-05-23 00:40:21] lint | Wiki 健康检查：修复 3 个 dangling link、1 个 orphan、2 处 frontmatter

## [2026-05-23 00:40:21] usermanual-update | 更新用户手册，添加 BACK-483 侧边栏调整大小、搜索类型下拉、Wiki URL 可读路径

## [2026-05-23 11:15:00] source-ingest | BACK-484 Web UI sort optimization

## [2026-05-23 15:18:00] batch-ingest | 增量摄取 BACK-485 草稿提升流程修复、BACK-486 草稿页筛选功能

## [2026-05-25 00:45:24] batch-ingest | 增量摄取 BACK-487 SSL 错误处理、BACK-488 Wiki 粘贴图片 promote 修复

## [2026-05-25 00:45:24] pairing-memory-extraction | 补做遗漏的配对记忆提取

## [2026-05-25 23:45:24] batch-ingest | 增量摄取 BACK-401 日期字段、社区 Fork 分析文档

## [2026-05-25 23:45:24] usermanual-update | 更新用户手册，添加 BACK-401 日期字段支持

## [2026-05-25 23:45:24] source-remove | 撤销两个社区分析文档的摄取

## [2026-05-26 23:42:00] batch-ingest | 摄取 BACK-489 / BACK-490，新增 project-health 概念

## [2026-05-27 00:00:00] pattern-extraction | 从 304 个完成任务中提取 4 个可复用模式

## [2026-05-28 00:50:54] batch-ingest | 摄取 BACK-491 智能甘特图视图

## [2026-05-28 00:50:54] usermanual-update | 更新用户手册，添加甘特图视图章节

## [2026-05-29 22:36:00] batch-ingest | 增量摄取 BACK-492~498、doc-6、m-7

**检测基线**: 2026-05-28 00:50:54（上次 batch-ingest）
**Git 变更文件**: 13 个 backlog 任务 + 1 个文档 + 1 个里程碑 + 40+ 个源代码/测试/配置文件

**新 source 页面**: 13 个
- `sources/actual-start-end-fields-task` — BACK-492 actualStart/actualEnd 字段支持
- `sources/milestone-actual-dates-task` — BACK-493 里程碑 actualStart/actualEnd 支持
- `sources/task-edit-modal-keyboard-fix` — BACK-494 键盘快捷键与输入冲突修复
- `sources/tracking-gantt-view-task` — BACK-495 跟踪甘特图（计划 vs 实际对比）
- `sources/tracking-gantt-left-table-task` — BACK-495.1 左表与时间解析引擎
- `sources/tracking-gantt-dual-layer-task` — BACK-495.2 双层甘特条渲染
- `sources/tracking-gantt-tooltip-legend-task` — BACK-495.3 Tooltip、图例与交互增强
- `sources/tracking-gantt-arrow-resolution-task` — BACK-495.4 智能依赖箭头时间解析
- `sources/subtask-grouping-fix` — BACK-496 子任务 ID 排序归组修复
- `sources/timezone-handling-fix` — BACK-497 CLI 与 Web UI 时区处理不一致修复
- `sources/actual-dates-auto-create-task` — BACK-498 创建任务时自动填充 actual 字段
- `sources/tracking-gantt-design-doc` — doc-6 跟踪甘特图设计方案
- `sources/ganttview-milestone` — m-7 GanttView 里程碑

**新 concept 页面**: 0 个（更新 5 个现有概念）
- `concepts/date-fields` — 扩展 actualStart/actualEnd，区分 date-only vs datetime 存储
- `concepts/gantt-view` — 扩展跟踪甘特图双层渲染、智能依赖箭头、交互增强
- `concepts/web-ui-features` — 扩展键盘修复、子任务归组、时区一致性、跟踪甘特图
- `concepts/cli-entry` — 扩展 actual 字段 CLI 选项
- `concepts/task-lifecycle` — 扩展 actual 字段与自动填充规则

**Pairing Memory (6)**:
- `wiki/execution/actual-date-auto-population` — 跨 create/update 统一自动填充模式
- `wiki/execution/timezone-unification` — UTC 字符串统一解析模式
- `wiki/decisions/datetime-vs-date-only` — actual 字段采用 datetime 存储的决策
- `wiki/decisions/duck-typing-for-testability` — 使用 duck-typing 替代 instanceof
- `wiki/reasoning/tracking-gantt-design` — BACK-495 跟踪甘特图设计推理

**更新导航**: `index.md`（Sources 41 条，Concepts 19 条，Execution 6 条，Decisions 7 条，Reasoning 2 条）、`overview.md`

## [2026-05-29 22:36:00] usermanual-update | 更新用户手册，添加跟踪甘特图、actual 字段、时区一致性等内容

**更新页面**: 4 个
- `40-Web界面/09-甘特图视图` — 扩展跟踪甘特图完整指南（双层渲染、偏差场景、图例、Tooltip、智能依赖箭头）
- `10-任务管理/00-任务生命周期` — 扩展 actualStart/actualEnd 字段说明与自动填充规则
- `10-任务管理/01-创建与编辑任务` — 扩展 `--actual-start`、`--actual-end` CLI 选项与 Web UI datetime-local 输入
- `30-文档与决策/02-里程碑管理` — 扩展里程碑 actualStart/actualEnd 支持与自动填充规则

**新增用户手册页面**: 0 个

## [2026-05-30 10:25:00] batch-ingest | 增量摄取 BACK-499~501

**检测基线**: 2026-05-29 22:36:00（上次 batch-ingest）
**Git 变更文件**: 3 个 backlog 任务 + 16 个源代码/测试/配置文件

**新 source 页面**: 3 个
- `sources/sidebar-collapse-button-fix` — BACK-499 修复侧边栏折叠按钮与 resize handle 重叠
- `sources/label-color-customization-task` — BACK-500 看板标签颜色自定义与卡片标签溢出优化
- `sources/task-detail-label-dropdown-task` — BACK-501 任务详情标签输入添加下拉框与模糊过滤

**更新 concept 页面**: 1 个
- `concepts/web-ui-features` — 扩展标签颜色自定义、卡片标签宽度自适应、标签输入下拉框

**Pairing Memory (3)**:
- `wiki/decisions/color-key-over-raw-css` — 标签颜色使用 key 字符串而非原始 CSS 存储
- `wiki/decisions/width-aware-label-measurement` — 隐藏测量容器 + ResizeObserver 实现宽度自适应标签
- `wiki/execution/label-color-persistence-pattern` — 标签颜色持久化模式（配置中存储非默认映射）

**更新导航**: `index.md`（Sources 44 条，Decisions 9 条，Execution 7 条）、`overview.md`

## [2026-05-30 10:30:00] usermanual-update | 更新用户手册，添加标签颜色自定义、标签输入下拉框、侧边栏折叠

**更新页面**: 3 个
- `40-Web界面/01-看板视图` — 扩展标签筛选（颜色自定义、卡片标签宽度自适应）
- `10-任务管理/01-创建与编辑任务` — 扩展标签输入下拉框与模糊过滤说明
- `40-Web界面/00-启动与访问` — 扩展侧边栏折叠按钮说明

## [2026-05-31 01:11:00] batch-ingest | 增量摄取 BACK-502~503 及相关源码

**检测基线**: 2026-05-30 10:25:00（上次 batch-ingest）
**Git 变更文件**: 2 个新 backlog 任务 + 16 个源代码/测试/配置文件

**新 source 页面**: 2 个
- `sources/back-502` — BACK-502 同步 llm-wiki-for-backlog SKILL.md 更新到嵌入代码
- `sources/task-completion-heatmap-task` — BACK-503 统计页面贡献热力图与服务端缓存

**更新 concept 页面**: 3 个
- `concepts/web-ui-features` — 扩展热力图、统计缓存、locale 切换防覆盖
- `concepts/web-server` — 扩展统计缓存架构与 WebSocket 广播
- `concepts/web-ui-i18n` — 扩展 App.tsx 首次加载限制与 locale 切换修复

**Pairing Memory (3)**:
- `wiki/execution/statistics-cache-pattern` — 服务端 debounced 缓存 + 客户端 localStorage 双缓存层模式
- `wiki/decisions/inline-style-over-tailwind-for-heatmap` — Bun CSS build 崩溃迫使热力图使用 inline style
- `wiki/decisions/sunday-start-week-grid` — 与 GitHub 贡献图保持一致采用周日开始

**更新导航**: `index.md`（Sources 46 条，Execution 8 条，Decisions 11 条）、`overview.md`

## [2026-06-01 22:50:00] batch-ingest | 增量摄取 BACK-504~505 及相关源码

**检测基线**: 2026-05-31 01:11:00（上次 batch-ingest）
**Git 变更文件**: 2 个新 backlog 任务 + 16 个源代码/测试/配置文件

**新 source 页面**: 2 个
- `sources/back-504` — BACK-504 修复看板拖拽列排序重置与跨列放置定位
- `sources/back-505` — BACK-505 Web UI 任务依赖项钻取导航

**更新 concept 页面**: 1 个
- `concepts/web-ui-features` — 扩展看板拖拽修复、依赖项钻取导航

**Pairing Memory (4)**:
- `wiki/execution/task-drill-down-navigation-pattern` — 任务详情钻取导航模式（taskHistory 堆栈管理）
- `wiki/decisions/draggedtaskid-lift-to-board` — draggedTaskId 提升到 Board 组件以支持跨列拖拽
- `wiki/decisions/task-history-stack-over-route` — 使用任务历史堆栈替代路由实现钻取导航

**更新导航**: `index.md`（Sources 48 条，Execution 9 条，Decisions 13 条）、`overview.md`

## [2026-06-01 22:55:00] usermanual-update | 更新用户手册，添加依赖项钻取与看板拖拽修复

**更新页面**: 2 个
- `10-任务管理/03-子任务与依赖` — 新增 Web UI 依赖项钻取导航说明（点击依赖标签、返回按钮、关闭堆栈）
- `40-Web界面/01-看板视图` — 扩展拖拽行为细节（保持列排序、跨列精确放置、跨列后排序恢复）

## [2026-06-04 16:34:00] batch-ingest | 增量摄取 BACK-506~508

**检测基线**: 2026-06-01 22:50:00（上次 batch-ingest）
**Git 变更文件**: 1 个已提交任务（BACK-506）+ 2 个未追踪新增任务（BACK-507、BACK-508）

**新 source 页面**: 3 个
- `sources/back-506-cli-utc-conversion-fix` — BACK-506 CLI actualStart/actualEnd local-to-UTC 转换修复
- `sources/back-507-no-git-task` — BACK-507 占位任务
- `sources/back-508-example` — BACK-508 占位示例任务

**更新 concept 页面**: 2 个
- `concepts/date-fields` — 扩展 CLI UTC 转换说明（BACK-506）
- `concepts/cli-entry` — 扩展 actual 字段 local→UTC 转换说明

**更新 execution 页面**: 1 个
- `execution/timezone-unification` — 补充 `localDateTimeToStoredUtc` 工具与 BACK-506 引用

**更新导航**: `index.md`（Sources 51 条）、`overview.md`

## [2026-06-04 16:34:00] batch-ingest | 增量摄取 BACK-506~508（更正）

**后续更正**: BACK-507、BACK-508 为非正式占位任务，已从 backlog/tasks/ 删除，对应 wiki source 页面已移除。

## [2026-06-04 16:34:00] source-remove | 移除 BACK-507、BACK-508 非正式任务 source 页面

- 删除 `wiki/sources/back-507-no-git-task.md`
- 删除 `wiki/sources/back-508-example.md`
- 更新 `index.md` Sources 统计：49 条
- 更新 `overview.md` Sources 统计：49 条

## [2026-06-05 15:19:06] batch-ingest | 增量摄取 BACK-509~511

**检测基线**: 2026-06-04 16:34:00（上次 batch-ingest）
**Git 变更文件**: 3 个新 backlog 任务（BACK-509、BACK-510、BACK-511）

**新 source 页面**: 3 个
- `sources/stable-task-modal-urls-task` — BACK-509 稳定任务模态框 URL 与钻取支持
- `sources/wiki-page-switch-edit-mode-fix` — BACK-510 修复 Wiki 页面切换不退出编辑模式
- `sources/local-url-short-aliases-task` — BACK-511 Markdown 本地 URL 短别名渲染

**更新 concept 页面**: 1 个
- `concepts/web-ui-features` — 扩展任务模态框 URL、Wiki 编辑模式修复、本地 URL 别名

**Pairing Memory (4)**:
- `wiki/execution/task-drill-down-navigation-pattern` — 扩展 URL 路由层（backgroundLocation、URL sync effect、replace 关闭、Markdown 拦截、前缀无关匹配）
- `wiki/decisions/background-location-modal-route` — 采用 React Router backgroundLocation state 模式保持模态框底层页面
- `wiki/decisions/replace-over-navigate-minus-one` — 关闭模态框使用 replace 导航消除竞态
- `wiki/decisions/anchor-prefix-guard` — parseLocalUrl 中添加 `#` 前缀守卫防止 heading anchor 误识别

**更新导航**: `index.md`（Sources 52 条，Decisions 16 条）、`overview.md`

## [2026-06-05 15:25:00] usermanual-update | 更新用户手册，添加任务模态框 URL、Wiki 编辑模式修复、本地 URL 别名

**更新页面**: 4 个
- `40-Web界面/01-看板视图` — 新增「打开任务详情」章节，说明模态框打开、URL 同步、钻取导航
- `40-Web界面/02-任务列表` — 重写「进入任务详情」章节，扩展为模态框与背景页面、稳定 URL 与分享、依赖项钻取
- `10-任务管理/03-子任务与依赖` — 扩展 Web UI 依赖项钻取，新增 Markdown 链接钻取、稳定 URL 与分享
- `40-Web界面/07-Wiki浏览与编辑` — 新增「切换页面自动退出编辑」章节（BACK-510）

**新增用户手册页面**: 0 个

## [2026-06-06 01:00:21] batch-ingest | 增量摄取 BACK-508、BACK-512

**检测基线**: 2026-06-05 15:19:06（上次 batch-ingest）
**Git 变更文件**: 2 个新 backlog 任务 + 5 个源代码/测试文件

**新 source 页面**: 2 个
- `sources/back-508-cli-description-escapes` — BACK-508 CLI description 换行符转义修复
- `sources/back-512-kanban-column-sort-menu-cross-branch` — BACK-512 看板列排序菜单跨分支任务修复

**更新 concept 页面**: 2 个
- `concepts/cli-entry` — 扩展 description 转义处理说明
- `concepts/web-ui-features` — 扩展跨分支任务列排序菜单

**Pairing Memory (2)**:
- `wiki/execution/cli-cross-platform-escape-pattern` — CLI 跨平台转义一致性两层架构
- `wiki/decisions/simulate-bash-escape-on-windows` — 选择模拟 bash 行为而非引入新 API

**更新用户手册**: 2 个页面
- `10-任务管理/01-创建与编辑任务` — 新增 description 换行输入说明
- `40-Web界面/01-看板视图` — 新增跨分支任务列菜单限制说明

**更新导航**: `index.md`（Sources 54 条，Execution 10 条，Decisions 17 条）、`overview.md`

## [2026-06-06 01:03:00] lint | Wiki 健康检查与修复

**扫描范围**: 148 个页面
**报告**: `wiki_output/reports/lint-2026-06-06.md`

**发现问题**:
- 6 个缺失页面（被引用但文件不存在）
- 6 个页面未入 index
- 2 处非法 wikilink（管道符）
- 1 处重复标题
- 统计不一致
- 3 个概念缺口

**修复内容**:
- 新建 `sources/stable-task-modal-urls-task`、`sources/wiki-page-switch-edit-mode-fix`、`sources/local-url-short-aliases-task`
- 新建 `decisions/anchor-prefix-guard`、`decisions/background-location-modal-route`、`decisions/replace-over-navigate-minus-one`
- 新建 `concepts/wikilink`
- `index.md` 补全 6 个缺失条目，删除重复 `## Decisions`
- `developer-notes/honkit-usermanual-preview.md` 修正非法 wikilink
- `overview.md` 修正统计为 Sources 56 / Concepts 20 / Decisions 17 / Reports 3

## [2026-06-09 00:40:40] batch-ingest | Ingest BACK-470 comment feature, BACK-514 autoPort, BACK-515-518 fixes

**检测基线**: 2026-06-06 01:03:00（上次 batch-ingest / lint）
**Git 变更文件**: 10 个 backlog 任务

**新 source 页面**: 10 个
- `sources/back-470-task-comments` — BACK-470 任务评论功能（父任务）
- `sources/back-470-1-core-task-comments` — BACK-470.1 核心任务评论模型与 Markdown 持久化
- `sources/back-470-2-cli-mcp-task-comments` — BACK-470.2 CLI 与 MCP 评论暴露
- `sources/back-470-3-server-web-task-comments` — BACK-470.3 Server API 与 Web UI 评论支持
- `sources/back-470-4-tui-docs-task-comments` — BACK-470.4 终端 UI 评论渲染与公共文档更新
- `sources/back-514-auto-port` — BACK-514 浏览器 Web UI 自动端口选择
- `sources/back-515-milestone-update-fix` — BACK-515 修复 Web API 里程碑更新响应缺失里程碑对象
- `sources/back-516-gantt-drag-fix` — BACK-516 修复甘特图拖拽交互改为滚动而非修改视图范围
- `sources/back-517-i18n-fragmentation-fix` — BACK-517 修复里程碑展开/折叠按钮 i18n 字符串拼接反模式
- `sources/back-518-tui-theme-adaptive` — BACK-518 TUI 主题自适应渲染：移除硬编码颜色

**新 concept 页面**: 4 个
- `concepts/task-comments` — 任务评论模型、Markdown 持久化、跨表面暴露、搜索索引
- `concepts/auto-port` — autoPort 配置、动态端口扫描、多实例并发
- `concepts/i18n-string-fragmentation` — i18n 字符串拼接反模式与完整短语替代方案
- `concepts/tui-theme-adaptive` — 逆视频高亮、移除硬编码 ANSI 颜色、跨主题兼容

**更新导航**: `index.md`（Sources 66 条，Concepts 24 条）、`overview.md`

## [2026-06-09 01:35:00] batch-ingest | Ingest BACK-470 comment feature (5 sources), BACK-514 autoPort, BACK-515-518 fixes; add concepts/task-comments, concepts/auto-port; update usermanual

## [2026-06-24 00:30:00] batch-ingest | Ingest BACK-520 Codex MCP fix, BACK-522 MCP roots discovery, doc-001 testing style guide

**检测基线**: 2026-06-09 01:35:00（上次 batch-ingest）
**Git 变更文件**: 3 个 backlog 源文件（当前 wiki-tmp 分支可见）

**新 source 页面**: 3 个
- `sources/back-520-fix-codex-mcp-connection-failure` — BACK-520 修复 Codex MCP 连接失败
- `sources/back-522-resolve-mcp-project-root-from-client-workspace-roots` — BACK-522 从客户端 workspace roots 解析 MCP project root
- `sources/doc-001-testing-style-guide` — doc-001 测试风格指南

**更新 concept 页面**: 2 个
- `concepts/mcp-server` — 补充正常启动路径 roots 发现、`pinned` 标志、`startupHasProject` 行为
- `concepts/mcp-workflow` — 补充统一 MCP 客户端设置 helper、Codex `--` 分隔符、已知问题

**新 execution 页面**: 1 个
- `execution/mcp-client-setup-pattern` — 统一 AI 客户端 MCP 注册与错误处理模式

**新 decision 页面**: 1 个
- `decisions/mcp-roots-discovery-scope` — 将 roots 发现扩展到正常启动路径并保留 pinned CWD

**更新导航**: `index.md`（Sources 69 条，Execution 11 条，Decisions 18 条）、`overview.md`

## [2026-06-24 00:35:00] adjust | Revert doc-001 ingestion

**调整原因**: 用户要求去掉 doc-001 的更新内容。

**撤销内容**:
- 删除 `sources/doc-001-testing-style-guide`
- 从 `index.md` 移除 doc-001 条目
- 从 `overview.md` 移除测试风格指南领域描述
- `overview.md` Sources 统计从 69 调整为 68

**保留内容**: BACK-520、BACK-522 相关 sources、concepts、execution、decision 及用户手册更新不变。

## [2026-06-27 21:05:00] batch-ingest | Ingest BACK-523 wikilink alias/attrs, BACK-524 media wikilinks, BACK-525 skill/docs sync

**检测基线**: 2026-06-24 00:30:00（上次 batch-ingest）
**Git 变更文件**: 20 个 backlog 源文件（当前分支可见），其中 16 个（back-507.*、m-7 agent-cli-workflow）已不在工作树中，4 个当前存在：BACK-522、BACK-523、BACK-524、BACK-525。
**实际处理**: BACK-522 已存在最新 source 页面且内容一致，跳过；处理 BACK-523、BACK-524、BACK-525。

**新 source 页面**: 3 个
- `sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs` — BACK-523 Wiki wikilink 别名与 markdown-it-attrs 支持
- `sources/back-524-add-media-wikilink-support-for-images-video-and-audio` — BACK-524 媒体 wikilink 支持（图片/视频/音频）
- `sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs` — BACK-525 更新 wiki skill 与 CLI 多行输入文档

**更新 concept 页面**: 3 个
- `concepts/wikilink` — 补充别名语法、markdown-it-attrs 属性块、媒体 wikilink、Web UI 渲染方式
- `concepts/embedded-skills` — 补充 BACK-525 skill 文档同步与 `$` 转义修复说明
- `concepts/web-ui-features` — 在 Wiki 功能中列出别名、属性块、媒体嵌入支持

**新 decision 页面**: 1 个
- `decisions/wikilink-regex-pipeline` — BACK-523 选择轻量正则流水线而非 remark/rehype

**新 execution 页面**: 1 个
- `execution/wikilink-media-rendering-pattern` — 媒体 wikilink 的解析、路径解析、尺寸控制与组件注册模式

**更新导航**: `index.md`（Sources 71 条，Decisions 19 条，Execution 12 条）、`overview.md`

**跳过**: BACK-522（已是最新），以及历史提交中已删除的 back-507.* / m-7 agent-cli-workflow 源文件。

**mini-lint**: 新页面 wikilink 交叉引用均已验证存在，无孤立页面。

## [2026-07-14 07:14:00] batch-ingest | 增量摄取 BACK-526~528

**检测基线**: 2026-06-27 21:05:00（上次 batch-ingest）
**Git 变更文件**: 3 个新 backlog 任务 + 4 个源代码/测试文件

**新 source 页面**: 3 个
- `sources/back-526-create-task-references-and-backlog-autocomplete` — BACK-526 修复创建任务引用输入与 .backlog 路径自动补全发现
- `sources/back-527-cli-escape-sequences-for-plan-notes-summary` — BACK-527 CLI task create/edit 对 plan、notes、finalSummary 解释 \n 转义序列
- `sources/back-528-web-task-detail-date-clear-persisting` — BACK-528 修复 Web 任务详情日期清除不持久化

**更新 concept 页面**: 3 个
- `concepts/web-ui-features` — 扩展创建任务 references/documentation、.backlog 自动补全、日期清除持久化
- `concepts/cli-entry` — 扩展 plan/notes/finalSummary 的 processCliEscapes 支持
- `concepts/date-fields` — 补充 Web UI 空字符串清除机制

**更新 execution 页面**: 1 个
- `execution/cli-cross-platform-escape-pattern` — 补充 BACK-527 扩展应用

**新 decision 页面**: 3 个
- `decisions/allow-backlog-directory-in-autocomplete` — BACK-526 选择放行 .backlog 同时隐藏其他点目录
- `decisions/reuse-processCliEscapes-for-plan-notes-summary` — BACK-527 选择复用现有转义函数
- `decisions/empty-string-over-undefined-for-date-clear` — BACK-528 选择空字符串清除日期

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 更新 CLI 跨平台转义模式
- [x] `wiki/decisions/` — 提取 3 个微决策
- [ ] `wiki/reasoning/` — 无复杂规划需记录
- [ ] `wiki/patterns/` — 无 3+ 相似任务
- [ ] `wiki/retrospectives/` — 非周期性回顾时机

**更新导航**: `index.md`（Sources 74 条，Decisions 22 条）、`overview.md`

**mini-lint**: 新页面 wikilink 交叉引用均已验证存在，无孤立页面。

## [2026-07-14 07:14:00] usermanual-update | 更新创建与编辑任务章节

**更新页面**: 1 个
- `10-任务管理/01-创建与编辑任务` — 扩展 `--plan`/`--notes`/`--final-summary` 的 `\n` 换行转义说明、Web UI 创建任务 references/documentation 支持、.backlog 路径自动补全、日期清除持久化行为

## [2026-07-14 11:20:27] batch-ingest | 增量摄取 BACK-521.2 / BACK-521.14 及相关指令指南源码

**检测基线**: 2026-07-14 07:14:00（上次 batch-ingest）
**Git 变更文件**: 2 个 backlog 任务 + 11 个指令指南/源码/测试文件

**新 source 页面**: 6 个
- `sources/back-521` — BACK-521 CLI-first agent workflow refactor
- `sources/back-521.1` — BACK-521.1 Shared workflow instruction registry and CLI access
- `sources/back-521.2` — BACK-521.2 短 CLI nudge 与 init 默认迁移
- `sources/back-521.6` — BACK-521.6 Root command local instruction hub
- `sources/back-521.7` — BACK-521.7 Milestone CLI parity with MCP operations
- `sources/back-521.14` — BACK-521.14 更新 CLI/MCP 指令指南缺失的代理指导

**新 concept 页面**: 2 个
- `concepts/cli-instructions` — CLI 指令表面与 CLI 优先代理集成
- `concepts/milestones` — 里程碑管理（CLI 与 MCP 语义统一）

**更新 concept 页面**: 3 个
- `concepts/mcp-workflow` — 补充 CLI instructions 为默认路径、最新 MCP 指南结构、里程碑指南
- `concepts/cli-entry` — 补充 `backlog instructions` 命令、里程碑命令、AI 集成默认选择
- `concepts/task-lifecycle` — 补充创建任务不含 Implementation Plan、执行前需用户批准、禁止直接编辑任务

**更新 entity 页面**: 2 个
- `entities/ai-agents` — 更新默认 CLI instructions、短 nudge、MCP 可选
- `entities/backlog-cli` — 补充指令指南模块与注册表

**新 decision 页面**: 2 个
- `decisions/cli-instructions-default-over-mcp` — CLI instructions 作为默认 AI 集成路径
- `decisions/short-cli-nudge-over-long-guide` — 短 CLI nudge 替代长 agent instruction 指南

**新 execution 页面**: 1 个
- `execution/instruction-guide-backport-pattern` — agent-guidelines 运营指导回传到 CLI/MCP 指令表面的模式

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 提取 instruction-guide-backport-pattern
- [x] `wiki/decisions/` — 提取 2 个微决策
- [ ] `wiki/reasoning/` — 无复杂规划需记录
- [ ] `wiki/patterns/` — 无 3+ 相似任务
- [ ] `wiki/retrospectives/` — 非周期性回顾时机

**更新导航**: `index.md`（Sources 80 条，Concepts 26 条，Decisions 24 条，Execution 13 条）、`overview.md`

**mini-lint**: 新页面 wikilink 交叉引用均已验证存在，无孤立页面。

## [2026-08-10 22:56:48] batch-ingest | 增量摄取 BACK-529~553 及迁移文档 doc-4/5/6

**检测基线**: 2026-07-14 11:20:27（上次 batch-ingest，BACK-528）
**Git 变更文件**: 25 个新 backlog 任务 + 3 个迁移文档（当前 wiki-tmp 分支可见）

**新 source 页面**: 28 个
- `sources/back-529-doc-update-multiline-append` — BACK-529 doc update 多行与追加
- `sources/back-530-append-description` — BACK-530 task edit 追加描述
- `sources/back-531-local-link-line-range` — BACK-531 短链接行区间后缀
- `sources/back-532-cli-draft-workflow-guides` — BACK-532 草稿工作流指南
- `sources/back-533-config-block-yaml-lists` — BACK-533 config 块状 YAML 列表
- `sources/back-534-preserve-updated-date-ordinal-reorder` — BACK-534 ordinal 保留时间戳
- `sources/back-535-preserve-unsaved-web-drafts` — BACK-535 跨刷新保留草稿
- `sources/back-536-in-document-hash-links` — BACK-536 文档锚点链接
- `sources/back-537-deterministic-checklist-serialization` — BACK-537 清单确定性解析
- `sources/back-538-duplicate-task-id-recovery` — BACK-538 重复 ID 恢复
- `sources/back-539-linux-runner-win32-arm64-build` — BACK-539 Linux runner win32-arm64
- `sources/back-540-content-store-stale-refresh-guard` — BACK-540 过期刷新守卫
- `sources/back-541-board-column-created-sort` — BACK-541 看板创建日期排序
- `sources/back-542-ordinal-task-list-sort` — BACK-542 序号排序
- `sources/back-543-milestone-cards-created-column` — BACK-543 里程碑 Created 列
- `sources/back-544-ac-numbers-browser-detail` — BACK-544 AC 编号显示
- `sources/back-545-cli-task-edit-numeric-id` — BACK-545 数字 ID 查找
- `sources/back-546-label-filters-alphabetical` — BACK-546 标签字母排序
- `sources/back-547-avoid-bash-ansi-c-quoting` — BACK-547 避免 ANSI-C 引号
- `sources/back-548-status-exclude-filtering` — BACK-548 状态排除过滤
- `sources/back-549-hide-empty-board-columns` — BACK-549 隐藏空状态列
- `sources/back-550-apple-silicon-binary-resolution` — BACK-550 Apple Silicon 二进制解析
- `sources/back-551-unassigned-task-filtering` — BACK-551 未指派过滤
- `sources/back-552-doc-view-plain` — BACK-552 doc view plain
- `sources/back-553-modernize-browser-bundling` — BACK-553 浏览器 UI 打包现代化
- `sources/doc-4-upstream-migration-classification` — doc-4 迁移差异分类
- `sources/doc-5-a-class-migration-analysis` — doc-5 A 类迁移分析
- `sources/doc-6-b-class-migration-analysis` — doc-6 B 类迁移分析

**更新 concept 页面**: 9 个
- `concepts/cli-entry` — 多行追加、过滤、doctor、config、doc view plain
- `concepts/web-ui-features` — 排序增强、状态过滤、AC 编号、行区间、锚点、草稿保留
- `concepts/markdown-pipeline` — 确定性清单解析、文档锚点链接
- `concepts/core-architecture` — ContentStore 版本守卫、块状 YAML、ordinal 时间戳
- `concepts/search-sequences` — 多状态/排除/未指派过滤
- `concepts/task-lifecycle` — doctor、清单编辑、重复 ID
- `concepts/milestones` — Web 卡片 Created 列
- `concepts/cli-instructions` — drafts 指南、ANSI-C 警告
- `concepts/mcp-server` — appendContent/descriptionAppend/statusExcluded/unassigned/acceptanceCriteriaClear
- `concepts/embedded-skills` — BACK-553 构建现代化

**新 decision 页面**: 4 个
- `decisions/doctor-human-first-fail-closed-repair` — 重复 ID 修复不猜测
- `decisions/tokenizer-over-regex-sentinel` — tokenizer 替代 regex
- `decisions/content-store-version-guard` — 版本守卫
- `decisions/ignore-ordinal-for-updated-date` — ordinal 忽略时间戳

**新 execution 页面**: 1 个
- `execution/content-store-version-guard-pattern` — 版本守卫刷新合并模式

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 提取 ContentStore 版本守卫模式
- [x] `wiki/decisions/` — 提取 4 个微决策
- [ ] `wiki/reasoning/` — 无复杂规划需记录
- [ ] `wiki/patterns/` — 无 3+ 相似任务
- [ ] `wiki/retrospectives/` — 非周期性回顾时机

**更新导航**: `index.md`（Sources 108 条，Decisions 28 条，Execution 14 条）、`overview.md`

**mini-lint**: 新页面 wikilink 交叉引用均在下面验证，无孤立页面。

## [2026-08-10 23:05:00] usermanual-update | 更新用户手册，覆盖 BACK-529~553 功能

**更新页面**: 10 个
- `30-文档与决策/00-文档管理` — doc update 多行内容与 `--append-content` 追加
- `40-Web界面/01-看板视图` — 按创建日期排序、隐藏空状态列、AC 编号显示
- `40-Web界面/02-任务列表` — 状态排除下拉、标签字母排序、默认序号排序与三击循环、AC 编号、未保存编辑保留
- `40-Web界面/03-里程碑管理` — Created 列、默认序号排序、三击循环
- `40-Web界面/04-文档与决策` — 文档内锚点跳转与行区间后缀
- `40-Web界面/05-设置与主题` — 隐藏空状态列开关
- `10-任务管理/00-任务生命周期` — doctor 重复 ID 修复、序号变更不影响 updated_date
- `10-任务管理/01-创建与编辑任务` — `--append-description`、`--clear-ac`、避免 ANSI-C 引号、多状态/排除/未指派过滤
- `10-任务管理/04-搜索与序列` — `--exclude-status`、`--unassigned` 搜索过滤
- `60-配置与运维/00-配置管理` — hide_empty_columns、块状 YAML 列表解析、列表键编辑指引

**新增用户手册页面**: 0 个

## [2026-08-17 22:06:00] usermanual-update | 更新用户手册，覆盖 BACK-410/554~569 功能

**更新页面**: 11 个
- `00-快速开始/02-AI集成设置` — Cursor AGENTS.md 清理说明
- `10-任务管理/01-创建与编辑任务` — `--append-plan`、稳定 `--json` 输出
- `10-任务管理/04-搜索与序列` — `backlog instructions overview` 序列速查、0.45 搜索分数阈值
- `20-看板与可视化/00-TUI看板` — `N` 键 composer、主题自适应滚动、原子写入 live refresh、AC 进度
- `30-文档与决策/02-里程碑管理` — 里程碑 ID 过滤任务列表
- `40-Web界面/00-启动与访问` — 默认回环 + `--host`、BROWSER 环境变量
- `40-Web界面/01-看板视图` — 内联字段快捷键保护、异步加载、AC 进度
- `50-AI集成/01-支持的AI工具` — 补充 Cursor 的 MCP 与 AGENTS.md 双路径
- `50-AI集成/02-代理指令文件` — Cursor 统一使用 AGENTS.md
- `60-配置与运维/00-配置管理` — autoCommit 精确到触碰文件

**新增用户手册页面**: 0 个

**更新导航**: `index.md`（User Manual 章节日期刷新）

## [2026-08-17 23:00:00] batch-ingest | 增量摄取 BACK-410/554~569、doc-7/8、draft-89 及顶层文档

**检测基线**: 2026-08-10 22:56:48（上次 batch-ingest，BACK-529~553 及 doc-4/5/6）

**Git 变更文件**: 17 个新任务（BACK-410、BACK-554~569）+ 2 个迁移文档（doc-7、doc-8）+ 1 个草稿（draft-89）+ 3 个顶层 markdown 文件更新（README.md、README.en.md、CLI-INSTRUCTIONS.md）

**新 source 页面**: 21 个
- `sources/back-410-cursor-agents-md-cleanup` — BACK-410 Cursor AGENTS.md init cleanup
- `sources/back-554-document-sequences-command-in-cli-instructions` — BACK-554 CLI instructions 中补充 sequences 命令
- `sources/back-555-tui-live-refresh-atomic-writes` — BACK-555 TUI live refresh 对原子写入稳健
- `sources/back-556-task-edit-append-plan` — BACK-556 task edit 新增 --append-plan
- `sources/back-557-browser-shortcuts-inline-fields` — BACK-557 防止浏览器快捷键拦截内联字段
- `sources/back-558-browser-server-loopback-only` — BACK-558 浏览器服务器仅绑定回环
- `sources/back-559-browser-launch-honor-browser-env` — BACK-559 启动浏览器 honor BROWSER 环境变量
- `sources/back-560-milestone-id-filtering` — BACK-560 里程碑 ID 查询解析过滤
- `sources/back-561-autocommit-exact-files` — BACK-561 autoCommit 精确到触碰文件
- `sources/back-562-stable-json-output` — BACK-562 只读命令稳定 JSON 输出
- `sources/back-563-tui-intent-first-composer` — BACK-563 TUI N 键任务 composer
- `sources/back-564-search-score-threshold` — BACK-564 搜索分数阈值跨表面对齐
- `sources/back-565-tui-theme-adaptive-scroll` — BACK-565 TUI 主题自适应、滚动、Tab 切换
- `sources/back-566-browser-async-loading` — BACK-566 浏览器异步 idle-stable 加载指示
- `sources/back-567-cross-branch-task-identity` — BACK-567 同路径跨分支任务版本统一身份
- `sources/back-568-core-browser-task-boundary` — BACK-568 Core 作为浏览器任务唯一边界
- `sources/back-569-acceptance-criteria-progress-ui` — BACK-569 TUI/Web 任务摘要 AC 进度
- `sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification` — doc-7 上游 v1.48.0→v1.49.3 迁移差异分类
- `sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain` — doc-8 上游 v1.48.0→v1.49.3 按领域迁移分析
- `sources/draft-89-windows-ci-under-three-minutes` — draft-89 Windows CI 压到三分钟以下
- `sources/readme-en-md` — README.en.md 英文产品概述

**更新 source 页面**: 3 个
- `sources/readme-md` — 更新产品概述
- `sources/cli-instructions-md` — 更新 CLI 命令参考
- `sources/doc-4-upstream-migration-classification` — 更新上游迁移分类

**更新 concept 页面**: 8 个
- `concepts/web-server` — bind-first 服务器、WebSocket loading 三态、浏览器异步加载
- `concepts/cli-entry` --json、sequences 文档
- `concepts/cli-tui` — TUI composer、主题自适应滚动
- `concepts/web-ui-features` — 浏览器加载状态、内联字段快捷键、AC 进度
- `concepts/core-architecture` — TaskIdentityIndex、Core 浏览器边界、autoCommit 精确文件
- `concepts/milestones` — 里程碑 ID 过滤
- `concepts/search-sequences` — 0.45 Fuse 分数阈值
- `concepts/cli-instructions` — sequences Quick Reference

**新 concept 页面**: 5 个
- `concepts/json-output` — 稳定 JSON 输出契约
- `concepts/task-identity` — canonical ID + 逻辑路径统一跨分支身份
- `concepts/browser-loading` — 浏览器加载状态
- `concepts/upstream-migration` — 上游迁移策略
- `concepts/ci-platform-contracts` — CI 平台契约测试策略

**更新 entity 页面**: 2 个
- `entities/backlog-cli` — 新增浏览器/JSON/TUI 功能
- `entities/ai-agents` — 更新 Cursor AGENTS.md 清理

**新 decision 页面**: 6 个
- `decisions/json-output-no-duplicate-integrity-warning` — JSON 输出不接重复 ID 前置检查
- `decisions/tui-composer-no-type-no-cas` — TUI composer 不迁移 type 字段与 git CAS 管线
- `decisions/search-score-threshold-over-substring` — 搜索统一使用 0.45 Fuse 分数阈值
- `decisions/browser-loopback-with-host-opt-in` — 浏览器服务器默认回环 + --host 显式开放 LAN
- `decisions/autocommit-exact-files-no-cas` — autoCommit 精确文件提交但不移植临时索引 CAS 管线
- `decisions/keep-sequences-upstream-removed` — 保留 sequences 功能并补充 CLI 文档

**新 execution 页面**: 3 个
- `execution/browser-launch-utils-pattern` — 浏览器启动命令统一模式
- `execution/task-identity-index-pattern` — TaskIdentityIndex 替换 ID-keyed 合并模式
- `execution/search-score-threshold-pattern` — 统一搜索分数阈值模式

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 提取浏览器启动、任务身份索引、搜索阈值模式
- [x] `wiki/decisions/` — 提取 6 个微决策
- [ ] `wiki/reasoning/` — 无复杂规划需记录
- [ ] `wiki/patterns/` — 无 3+ 相似任务
- [ ] `wiki/retrospectives/` — 非周期性回顾时机

**更新导航**: `index.md`（Sources 129 条，Concepts 31 条，Decisions 35 条，Execution 17 条）、`overview.md`

**mini-lint**: 全 wiki wikilink 扫描无 dangling link；调整 2 处旧 wikilink 概念/源页面中的 `[[demo]]` 示例目标为真实页面 `[[concepts/wikilink|...]]`。

## [2026-09-08 17:30:00] batch-ingest | 增量摄取 BACK-570~623（v1.50.1 迁移波次）、doc-9/10/16、m-6/m-8、draft-92/96/125

**基线**: 2026-08-17 23:00:00。git 不可用（全部 commit 的 committer 日期为今日，作者日期失真），回退全量扫描交叉对照 log.md。

**新增 Sources（63）**:
- BACK-570~623 共 54 个任务（全部 Done，v1.50.1 上游迁移波次）
- 迁移文档：doc-9（v1.49.3→v1.50.1 差异分类 17A/9B/7C）、doc-10（按领域分析）、doc-16（To-Do 任务三次迁移对照清算）
- 里程碑：m-6（New Milestones UI 存根）、m-8（Agent CLI Workflow）
- 草稿：draft-92（上游 #839→BACK-577）、draft-96（上游 #853→BACK-591）、draft-125（上游 BACK-624→BACK-602）

**新增 Decisions（14）**: fail-fast 任务锁、空 setter 拒绝（与上游 emptyClears 刻意分叉）、三态 assignee 语义、隐藏列延迟 reveal、按键族边界导航、编辑器清空守卫、实体身份 fail-closed、B16 先补 publication 地基、显式测试超时、就绪指引语料、符号链接 checkout、包 scope 推导、spread 透传、cachedTasks 重建 identity-index

**新增 Concepts（1）**: concepts/task-locking（任务锁与并发编辑）

**更新 Concepts（10）**: core-architecture（增量跨分支加载、本地快路径、createRuntimeCore、entity-id）、task-identity、task-comments、milestones、cli-tui、ci-platform-contracts、upstream-migration（第三波闭环）、cli-instructions、markdown-pipeline、web-ui-features

**新增 Execution（1）**: execution/pre-existing-failure-triage（stash 探针/基线对照/计数对比/先红后绿/JSDOM 钉桩）

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 预存测试失败分诊方法（BACK-596~602/612 跨任务提取）
- [x] `wiki/decisions/` — 提取 14 个微决策
- [ ] `wiki/reasoning/` — 无复杂规划需记录（B16 两阶段方案已入 decisions/b16-publication-foundation-first）
- [ ] `wiki/patterns/` — 迁移波次统一执行结构（git log --grep 审查→分类→适配→三段式验证）出现 6+ 次，建议固化为 pattern，**待人工确认后创建**
- [ ] `wiki/retrospectives/` — 第三波迁移完成是回顾时机，数据回顾待人工发起

**更新导航**: `index.md`（Sources 192 条，Concepts 32 条，Decisions 49 条，Execution 18 条）、`overview.md`

**mini-lint**: 全 wiki wikilink 扫描——无真实 dangling link；剩余命中均为文档示例（`[[path/to/page]]`、`![[assets/photo.png]]` 语法示例）与历史 bug 复现描述，无需修复。

## [2026-09-08 17:45:00] pattern + retrospective | 固化迁移波次模式，生成 v1.50.1 波次回顾

**人工确认后创建**:
- `patterns/upstream-migration-wave.md` — 三波 60+ 任务验证的上游迁移标准执行结构（分类→领域分析→draft 导入→任务落地→三段式验证→清算闭环），含 5 个陷阱与参考任务

**数据回顾**:
- `retrospectives/2026-09-v1-50-1-wave.md` — BACK-570~623 共 54 任务：两波爆发（08-22~08-27 完成 32，09-06~09-08 完成 22），周期中位数 0 天（31/54 当日创建当日完成）、P90 18 天、最大 56 天；测试稳定化簇占 20%；定性观察留待人工补充

**更新导航**: `index.md`（Patterns 6 条，Retrospectives 首条）、`overview.md`

## [2026-09-13 01:12:00] batch-ingest | 增量摄取 BACK-624~628（v1.50.1 迁移波后增量）

**检测基线**: 2026-09-08 17:30:00（上次 batch-ingest）
**Git 变更检测**: `git status --porcelain` 干净，HEAD = `cc8c96b`（上次摄取提交）。但该提交的祖先里含 2026-09-11/12 新增内容，故按作者日期逐文件比对 `git log --format='%h|%ai' --name-only` 后确定真实增量：`backlog/tasks/back-624..628`（5 个任务，作者日期 2026-09-11 23:33 ~ 09-12 17:09）及其 `src/` 变更、2 个 `backlog/assets/paste/` 参考图。`updated_date` 落在 2026-09-1x 的 backlog 项经核对仅这 5 个任务与 doc-9/doc-10（后两者内容已被上次摄取的上游迁移来源页覆盖）。

**新 source 页面（5）**:
- `sources/back-624-global-search-dialog` — Web UI 全局 Spotlight 搜索对话框（/search modal-over-route、虚拟列表、分组折叠、滚动记忆、8 轮反馈迭代）
- `sources/back-625-ac-progress-json-output` — 任务 JSON 摘要新增 `acceptanceCriteriaCompleted` / `acceptanceCriteriaCount`
- `sources/back-626-dependabot-mermaid-bump` — mermaid 11.15.0 → 11.16.1，清除 5 个 GHSA
- `sources/back-627-back-arrow-history-fix` — 返回箭头由 push 改为 pop（历史栈/模态栈 1:1）
- `sources/back-628-task-hierarchy-section` — 任务模态框 PARENT 行 + 可折叠 SUBTASKS 区

**新 concept 页面（1）**: `concepts/spotlight-search`（路由与历史语义、结果呈现、虚拟列表、导航目标、视口适配）

**更新 concept 页面（6）**: `web-ui-features`（搜索对话框章节、层级区块、返回箭头、mermaid 版本）、`json-output`（AC 进度字段）、`search-sequences`（Web 搜索入口重构与服务端能力说明）、`web-server`（SPA 路由补 `/search`）、`web-ui-i18n`（`searchDialog` 命名空间、zh-TW 审计待办）、`task-lifecycle`（子任务层级区块）

**更新 entity（1）**: `entities/backlog-cli`（JSON AC 字段、/search 路由、mermaid 版本）

**新 decision 页面（7）**:
- `decisions/react-router-history-for-search-dialog` — PRD 的 pushState/popstate 契约映射为 Router 语义
- `decisions/pop-over-push-for-modal-back` — 每个模态层级 pop 一个历史条目，**取代** `replace-over-navigate-minus-one`
- `decisions/background-location-for-modal-targets-only` — 只给模态目标挂背景，整页目标走普通 push
- `decisions/visible-start-index-over-scroll-top` — 滚动记忆用行索引而非像素
- `decisions/hand-rolled-virtual-list-over-dependency` — 定高前提下零新依赖
- `decisions/mermaid-11-16-1-supply-chain-maturity` — 供应链验证成熟度优先于版本新度
- `decisions/pure-task-id-module-in-browser-bundle` — 浏览器 bundle 只导入纯模块

**更新 decision 页面（2）**: `replace-over-navigate-minus-one` 标注为已被取代（保留无 backgroundLocation 的回退路径）；`background-location-modal-route` 追加后续细化

**新 execution 页面（2）**:
- `execution/modal-route-history-invariant` — 历史栈与模态栈 1:1 不变式、6 步标准流程、5 个常见陷阱
- `execution/web-bundle-purity-guard` — Web 侧导入纯净性判定与 BACK-628 白屏案例

**新 reasoning 页面（1）**: `reasoning/back-624-global-search-dialog` — PRD 适配、六项方案对比、风险与缓解

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 提取模态路由历史栈不变式与浏览器 bundle 纯净性守卫（BACK-624/627/628 跨任务可复用）
- [x] `wiki/decisions/` — 提取 7 个微决策，其中 1 个显式取代旧决策
- [x] `wiki/reasoning/` — BACK-624 分解与方案对比留痕（大特性 + PRD 偏差）
- [ ] `wiki/patterns/` — 本批 5 个任务结构各异（UI 子系统 / JSON 字段 / 依赖升级 / 导航修复 / 模态区块），未达 3+ 同构阈值
- [ ] `wiki/retrospectives/` — 2026-09 v1.50.1 波次回顾已于 09-08 生成，本批非周期性回顾时机

**更新导航**: `index.md`（Sources 196 条，Concepts 33 条，Decisions 55 条，Execution 20 条，Reasoning 3 条）、`overview.md`（新增「波后增量」段与统计刷新；用户手册页数由陈旧的 24 修正为实际的 33）

**mini-lint**: 全 wiki wikilink 扫描（1669 条出链）——本批新增/更新页面出链全部解析成功；`index.md` 覆盖全部 9 个内容子目录（无遗漏文件）。剩余 42 条未解析命中均为既有文档示例（`[[path/to/page]]`、`[[target|alias]]`、`![[assets/photo.png]]`）与 BACK-482 的历史 bug 复现描述（`[[../developer-notes/security-gotchas]]`，该 `../` 形式在修复后按页面相对语义解析，属正确用法），无需修复。已确认的语境性遗留：BACK-624 的 `zh-TW` 全量文案审计（记录于 source 页与 `searchDialog` 命名空间条目，非 wiki 缺陷）。

## [2026-09-13 01:20:15] usermanual-update | 补齐 BACK-570~623 波次的用户手册覆盖

**触发**：审查发现最近两次提交（`cc8c96b` V1.50.1 wiki摄取、`bf423cc` V1.50.2 wiki摄取）均未包含用户手册更新。核对结论：

- `bf423cc`（BACK-624~628）对应的手册改动已于本轮补齐，但仍留在工作区未随该提交入库
- `cc8c96b`（BACK-570~623 迁移波次，54 个任务）中**大量面向用户的能力从未写入手册**——该提交只更新了 wiki 的 source/concept/decision 层，没有 `usermanual-update` 记录（对比 `9e97cb1` 波次留有该记录）

**缺失项审计（逐条核对 BACK-570~623 来源页）**：

| 能力 | 来源 | 手册原状 |
|---|---|---|
| `defaultAssignee` / `--unassign` / 多重 `-a` | BACK-579/584/585 | 缺失；`-a` 被记为不可重复 |
| `--add-*` / `--remove-*` / `--clear-*` 列表字段语义与空值拒绝 | BACK-577/578 | 缺失 |
| `--remove-comment` / `--clear-comments` | BACK-623 | 缺失 |
| 并发编辑 fail-fast（CLI 非零 / Web 409 / MCP 错误） | BACK-571 | 缺失 |
| `task list --ready` 依赖就绪过滤 | BACK-615 | 缺失 |
| `decision view` / `decision update` / 双栏浏览器 / `--json` | BACK-574 | 仅 create/list |
| `doc list` 双栏浏览器、`doc create --plain`、`doc view` 三种引用形式与歧义 fail-closed | BACK-575/592/596/598 | 缺失 |
| 里程碑 `created_date`/`updated_date`、`documentation` 字段、`milestone add` CLI、`milestone remove --task-handling` | BACK-618/619 | 缺失；且"创建主要通过 Web 界面"的说法已过时 |
| Web 里程碑详情 `/milestone/:id`、编辑模态框重构、归档/移除对话框文案 | BACK-580/622 | 仅简单编辑描述 |
| Web `defaultAssignee`/`labels` 编辑器、`defaultEditor` 可清空、`autoPort` | BACK-581/583/586（`autoPort` 属 BACK-514 的旧缺口） | 配置区块只列了少数项 |
| 实体 ID 自动链接、任务列表全宽无横向滚动 | BACK-613/614 | 缺失 |
| preview 模式直接添加评论、评论删除 UI | BACK-617/623 | 手册仍写"仅编辑模式可评论"（行为已变更） |
| TUI vim 键边界导航、隐藏空列、窗口标题、Readiness 行、footer 大写提示 | BACK-588/589/590/591/615/594 | 缺失 |
| `init` 及全套命令遵循 `--cwd` / `BACKLOG_CWD` | BACK-593 | 缺失 |
| 代理首轮加载实况、日期本地时间输入与字面 `\n` 约定 | BACK-582/572 | 缺失 |

**更新页面（12）**：`00-快速开始/01-安装与初始化`、`10-任务管理/01-创建与编辑任务`、`20-看板与可视化/00-TUI看板`、`30-文档与决策/00-文档管理`、`30-文档与决策/01-决策记录`、`30-文档与决策/02-里程碑管理`、`40-Web界面/00-启动与访问`、`40-Web界面/02-任务列表`、`40-Web界面/03-里程碑管理`、`40-Web界面/05-设置与主题`、`50-AI集成/02-代理指令文件`（另有本轮早前更新的 `40-Web界面/02-任务列表`、`10-任务管理/03-子任务与依赖` 等）

**判定无需文档化**：纯内部实现（增量跨分支加载 BACK-601/602、queryTasks 本地快路径、gray-matter 无缓存包装、ContentStore watcher 重试、启动器包解析 BACK-621）、测试稳定化（BACK-603~612）、以及**行为纠正类修复**（空态提示互换 BACK-620、里程碑更新返回 BACK-515、任务列表宽度 BACK-613 的布局纠正）——后者恢复的是既有文档描述的行为，手册无需新增说明。`BACK-570` 的 CLI banner wiki 安装提示已由 `50-AI集成/03-Wiki Skill 安装` 覆盖。

**重新生成**：`wiki_output/用户手册/manual.md`（merge.py；4557 行，较上一版 +346 行）。

## [2026-09-26 14:00:00] lint | Wiki 健康检查与 source_path 修复

**范围**：全量 360 个 wiki 页面 / 1666 条 wikilink / 196 条 `source_path` 回溯。

**报告**：`wiki_output/reports/lint-2026-09-26.md`

**扫描结果**：
- 真实死链 **0**：1666 条 wikilink 中 11 条不解析，逐条复核后全部落在代码围栏或行内反引号内（`[[wikilinks]]`、`![[path|alt|WxH]]`、`path/to/page`、`target`、`...`），均为语法示例，无需修复。
- `source_path` 失效 **20/196（10.2%）**，分三类处置：
  - **重命名 14 条（已修）**：`back-508`、`back-521`、`back-526`、`back-529`、`back-538`、`back-548`、`back-578`、`back-580`、`back-590`、`back-601`、`back-475`(docx-upload-task)、`back-483`(sidebar-resize-search-task)、`back-487`(ssl-network-error-fix)、`back-496`(subtask-grouping-fix)。判定依据为对每个当前文件跑 `git log --follow --name-status` 均得到 `R100 old → new` 显式重命名记录，非标题相似性猜测。已改写 `source_path` 并 bump `updated_date`。
  - **源已删除 4 条（本次未改）**：`draft-92`、`draft-96`（均 `d236aac6` V1.52.0 合并批次删除）、`draft-125`（`4a417d7a` 删除）、`doc-16`（`720d58ad` 升级分析删除）。按约定保留页面、不删除。
  - **人工判定 2 条（已加正文标注，保留原值）**：`sources/config-docs` 的 `source_path` 是目录表达式 `backlog/docs/ + backlog/decisions/`，从未可解析；`sources/tracking-gantt-design-doc` 指向的 `doc-6 - 跟踪甘特图设计方案.md` 已不存在，现存唯一 `doc-6` 是 `migration/doc-6 - B类上游任务迁移分析报告（v1.47.1-..-v1.48.0）.md`，git 中 `doc-6` 从未有甘特图文件 → 判定为 **ID 被复用**，不自动改写。
- **孤儿/不可达**：计入相对 Markdown 链接并剔除代码块后无入链的页面 4 个 —— `index`、`log`、`usermanual/SUMMARY` 属结构性页面；**`overview` 无任何入链且不在 `index.md`，是唯一真正不可达的高层综合页**（本次未修）。`usermanual/40-Web界面/10-全局搜索` 虽未入 index，但已被 `usermanual/SUMMARY.md` 与 `40-Web界面/02-任务列表.md` 引用，可达。
- **frontmatter**：41 页缺 `updated_date`（多为 `usermanual/` 早期页面），`usermanual/SUMMARY.md` 完全无 frontmatter（本次未修）。
- **约定偏差**：`index.md` / `overview.md` 中 9 处 `[[../wiki_output/reports/…]]` 逃逸 wiki 根指向 `wiki_output/`，文件确实存在可解析，但违反「wikilink 只在 `wiki/` 内解析」约定（本次维持）。

**修复后复验**：`source_path` 失效由 20 降至 **6**（即上述 4 条源已删除 + 2 条人工判定，均为有意保留）；16 个被改页面行尾全部保持 LF。

## [2026-09-26 14:50:00] batch-ingest | 增量摄取 BACK-630~714（v1.52.0 迁移波 + Kuzu 依赖图谱）、doc-11~15、doc-002/003、m-9、6 个草稿

**检测基线**: 2026-09-13 01:12:00（上次 batch-ingest，BACK-624~628）
**Git 变更文件**: 84 个新 backlog 任务（BACK-630~714，缺 629/671）+ 5 个文档（doc-11/12/13 迁移分析、doc-14/15 BRDS 图谱设计）+ doc-002/003 + 1 个里程碑（m-9）+ 6 个现存新草稿（draft-121/130/135/140/142/169）

**新 source 页面**: 98 个（84 任务 + 8 文档 + 1 里程碑 + 6 草稿，含 doc-002 VIM/Neovim 编辑器配置、doc-003 browser 常驻服务补摄；doc-001 按 2026-06-24 用户要求继续排除）

**新 concept 页面**: 1 个
- `concepts/kuzu-graph` — FileNode(path PK) 模型、MemoryGraphStore 默认后端、指纹冷启动、热更新管道、/graph 与 /knowledge 双视图

**更新 concept 页面**: 22 个
- `web-ui-features`、`web-server`、`wikilink`、`browser-loading`、`web-ui-i18n`（图谱视图、内容实体广播、in-place refresh、completed-corpus、侧边栏排序、加载架构）
- `cli-tui`、`cli-entry`、`cli-instructions`、`search-sequences`、`json-output`、`core-architecture`、`task-locking`、`markdown-pipeline`（composer/弹窗/多选/里程碑 board、draft edit、批量移动、JSON 契约扩展、搜索单源化、实体锁拆分、哨兵扫描）
- `task-identity`、`task-lifecycle`、`milestones`、`date-fields`、`asset-management`、`mcp-server`、`upstream-migration`、`embedded-skills`（draftIdentityKey、vacated-ID 清理、actualEnd 盖章、v1.50.1→v1.52.0 第四波台账）

**新 decision 页面**: 16 个
- `memory-graph-store-default-backend`、`filenode-path-primary-key`、`doctor-dependency-defects-warning-exit-zero`、`tolerate-history-not-new-mistakes`、`local-corpus-closure-over-graph-service`、`demote-removes-references-not-rewrites`、`milestone-popup-in-place-rerender`、`nonpublishing-rename-fallback-load`、`completed-popup-reuses-cross-branch-lockdown`、`empty-selection-means-no-filter`、`sanitize-filename-untitled-fallback`、`draft-prefix-routing-over-store-probing`、`cli-draft-edit-refuses-non-draft-status`、`always-animate-loading-over-motion-reduce`、`toc-entries-from-rendered-dom`、`free-text-status-storage`

**新 execution 页面**: 4 个（更新 2 个）
- `bun-windows-test-toolkit`、`revert-matrix-verification`、`blessed-tui-test-harness`、`cdp-live-verification`
- 更新 `image-promote-integration`（.temp promote 已复制到六个表面）、`pre-existing-failure-triage`（本波新实例）

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 提取 Bun Windows 测试工具箱、回退矩阵验证、blessed 测试基建、CDP 实检 4 个跨任务模式
- [x] `wiki/decisions/` — 提取 16 个微决策
- [ ] `wiki/reasoning/` — BACK-702~714 图谱系列由 doc-14/15 设计文档承载推理，无需另建
- [ ] `wiki/patterns/` — 「上游移植 byte-identical + revert-check」已在 patterns/upstream-migration-wave 覆盖，本波未达新阈值
- [ ] `wiki/retrospectives/` — v1.52.0 波次回顾待人工发起

**更新导航**: `index.md`（Sources 294 条，Concepts 34 条，Decisions 71 条，Execution 24 条）、`overview.md`（新增第四波迁移、Kuzu 图谱、Web 实时化等段落）

**数据异常记录**: BACK-629/671 不存在（ID 跳号）；`archive/tasks/` 两个 back-694 文件与 tasks/back-693/694 撞号（source 页已加 provenance 注记，建议 backlog doctor 核对）；m-9 frontmatter `documentation` 字段仍引用旧名 `doc-014`（磁盘已改名 doc-14，需经 backlog CLI 修正）；doc-13 实际文件名与常规编号格式不同（source_path 已用真实路径）；BACK-670/674/677~680 与上游迁移台账撞号（fork 保留编号，doc-12 有逐条警告）。

## [2026-09-26 14:55:00] usermanual-update | 更新用户手册，覆盖 BACK-630~714（v1.52.0 波 + 图谱视图）

**新建页面**: 1 个
- `40-Web界面/11-图谱视图` — /graph 任务依赖图谱与 /knowledge 知识图谱完整指南（BACK-702~714），已登记 SUMMARY.md

**更新页面**: 19 个
- `40-Web界面/00-启动与访问`、`01-看板视图`、`02-任务列表`、`04-文档与决策`、`07-Wiki浏览与编辑`、`10-全局搜索` — 加载架构、AC 进度条、completed 语料、多选批量拖拽、关系图、排序开关、决策编辑、TOC/锚点、in-place 刷新等
- `10-任务管理/01-创建与编辑任务`、`02-草稿管理`、`03-子任务与依赖`、`04-搜索与序列`、`05-归档与清理` — 批量编辑、draft edit、多状态过滤、--completed、JSON 新字段、依赖环治理、vacated-ID 清理
- `20-看板与可视化/00-TUI看板`、`02-看板导出` — composer 日期/鼠标/Unicode、Shift 多选、里程碑 board、弹窗 live sync、孙任务导出
- `30-文档与决策/01-决策记录`、`02-里程碑管理` — 决策状态三路径编辑、--plain 分组输出
- `50-AI集成/02-代理指令文件` — overview 每会话一次、path:LINE 引用
- `60-配置与运维/00-配置管理`、`02-项目概览`、`00-快速开始/01-安装与初始化` — 编辑器配置、常驻服务、保留前缀、时区修复

**判定无需文档化**: 纯内部实现（BACK-701 测试基建、643/649/650/653/655/685/686/699 内部重构、712 wiki lint 指引）；行为纠正类修复（706 使实际行为与既有文档一致）。

**重新生成**: `wiki_output/用户手册/manual.md`（merge.py；4557 → 4951 行）。

## [2026-09-26 16:30:00] source-ingest | 补录 BACK-629，并更正 14:50 波次的「数据异常记录」

**更正对象**：14:50 batch-ingest 条目末尾的「BACK-629/671 不存在（ID 跳号）」。

**更正结论**：
- **BACK-629 不是跳号，是漏摄取**：`backlog/tasks/back-629 - Fix-global-search-dialog-not-following-the-light-theme.md` 存在，`status: Done`，created 2026-09-14 03:30 —— 在检测基线 2026-09-13 01:12 之后，属本波范围。任务聚焦 BACK-624 全局搜索对话框的 dark-first 配色（无亮色对应项、无 `dark:` 变体），逐项改写为 light + `dark:` 对。
- **BACK-671 才是真正的 ID 跳号**：`backlog/tasks/` 下 670 之后直接是 672。

**补录动作**：
- 新建 `sources/back-629-global-search-dialog-light-theme`（source_path 已核对存在），`index.md` Sources 表增 1 条
- `overview.md` 统计：Sources ingested 294 → 295；**Reports generated 7 → 10**（`wiki_output/reports/` 实际 10 份，该数字此前未随报告产出更新）
- 用户手册未新增章节：BACK-629 恢复的是「对话框跟随主题」这一既有文档描述的行为（与 40-Web界面/10-全局搜索 一致），属行为纠正类，无需新增说明

**复核结果（本波摄取的事实性抽查）**：
- 600+ 任务与 source 页面一一对应，除 629 外无缺失；无 source 页面指向不存在的任务文件
- 294→295 个 source 页面的 `source_path` 复扫：失效仍为 6 条（4 条源已删除 + 2 条人工判定，均为有意保留），新增页面全部可解析
- 全量 wikilink 扫描（剔除代码围栏与行内反引号）：**0 死链**；新增的 1 concept / 16 decision / 4 execution 页面交叉引用目标均存在
- 抽样核对通过：`SCHEMA_VERSION 2` / `PARSER_VERSION 3`、150ms 防抖 + 5 分钟对账、`backlog-graph-<sha256-16>.kuzu` 命名、`BACKLOG_GRAPH_BACKEND`/`BACKLOG_GRAPH_CACHE_DIR`、`EDGE_DASH` 三态、`draftIdentityKey`/`isReservedTaskPrefix`/`compareTaskIds`/`installCloseConnectionFetch`/`BACKLOG_CWD` 等符号均与实际代码一致；`backlog doctor` 实测悬空引用 78 条、退出码 0，与 decisions/doctor-dependency-defects-warning-exit-zero 的描述吻合

**遗留未修（非本次引入）**：`overview` 仍是无入链孤儿页；`usermanual/SUMMARY.md` 无 frontmatter；41 页缺 `updated_date`；`m-7 - ganttview` 里程碑尚无 source 页面（历史欠账，非本波范围）。

## [2026-09-26 20:50:00] source-remove | 移除全部 12 个 draft source 页面（用户裁决：wiki 不收录草稿内容）

**规则变更**：wiki 只收录已落地事实（tasks / docs / decisions / milestones / 顶层文档），`backlog/drafts/` 下的草稿**一律不摄为 source 页面**。理由：草稿是未落地的上游提案或待办想法，写进 wiki 会被读成既成事实 —— 典型如 `TaskIdentityIndex.getContestedIds()`、`TaskCorpus.ambiguousIds`、promote/demote 的「解析前置自检」三者在 fork 代码中均不存在，却曾被写进 `concepts/task-identity` 的现状描述。此前各波摄取草稿属既有惯例，本次起作废。

**删除清单**（12 个）：`draft-89`、`draft-92`、`draft-96`、`draft-125`、`draft-121`、`draft-130`、`draft-135`、`draft-140`、`draft-142`、`draft-169`、`draft-filters-task`、`draft-promote-flow-task`。

**副作用一併解决**：`draft-92/96/125` 属 `source_path` 失效里的「源已删除」类（草稿文件在 `d236aac6` 合并批次与 `4a417d7a` 中被删），此前按"依约定保留页面"维持。本次随新规则删除后，失效总数由 **6 → 3**（余 `config-docs` 目录表达式、`doc-16` 源已删、`tracking-gantt-design-doc` ID 复用）。

**反向引用处理**（能映射则映射，不能则整条移除）：

| 引用方 | 原指向 | 处置 |
|---|---|---|
| `sources/back-668-branch-indexing-header-chip` | draft-125 | 改引 `sources/back-602` |
| `sources/back-602-incremental-cross-branch-task-loading` | draft-125（自述原始上游记录） | 移除；正文已写明 ported upstream BACK-624 |
| `concepts/ci-platform-contracts` | draft-89 | 移除（CI 事实由 BACK-609/610/612/605 承载） |
| `concepts/web-ui-features` | draft-filters-task | 移除 |
| `decisions/cli-draft-edit-refuses-non-draft-status` | draft-promote-flow-task | 移除（`draft promote` 命令事实写在正文 Rejected alternatives） |
| `sources/back-644`、`back-692`、`back-693`、`smart-gantt-view-task` | draft-promote-flow-task | 移除 |
| `sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification` | draft-121 / draft-169 | 改为不带链接的台账状态描述：CORE-2 尚未提升为 fork 任务；INF-2 无上游任务号、由 commit 复原 |

**正文清理**：`concepts/task-identity` 删除 draft-140/142 两条（连同上一条 correction 加的「未迁移」标注一并移除 —— 标注不是解法，不收录才是）；其中仍有价值的 fork 事实改写到该留的地方：`src/graph/relations.ts` 由 `recordsById` 桶推导 `ambiguousIds` 补进 `concepts/kuzu-graph` 的 fail-closed 条目，自引用在解析后判出、`doctor` 依赖缺陷退出码 0 并入 BACK-707 条目自身。

**同步**:`index.md` 移除 12 条 Sources 行；`overview.md` Sources 295 → 283，三处 draft 指涉改写为落地任务编号（BACK-539/605、BACK-577/591/602）；`log.md` 历史条目不动（append-only）。

**复验**（`tmp/wiki-ingest-audit.py`）：source_path 失效 3（有意保留）、wikilink 死链 0、600+ 任务与 source 页一一对应、未登记页 3（index/log/overview）、overview 统计漂移 0。

## [2026-09-26 22:25:00] reasoning-extract | 新增 2 页推理脉络：Kuzu 后端/生命周期、知识图谱关系模型

**推翻 14:50 的判断**：当时写「BACK-702~714 图谱系列由 doc-14/15 设计文档承载推理，无需另建」。该判断不成立 —— doc-14/15 是**写给实现者的规范**（DDL、建边规则、校验清单），不承载"为什么这样选"；真正带实测反转的取舍此前只存在于任务 Implementation Notes 里，wiki 查不到。

**新 reasoning 页面**:2 个
- `reasoning/kuzu-graph-backend-and-lifecycle` — 11 项方案对比：双后端 vs 单 kuzu（实测 SEGFAULT 否决后者）、`Task(id)` PK vs `FileNode(path PK)`、冷启动判据（全量重算 / 内容哈希 / size+mtime 边车）、notify 钩子 vs watcher vs 轮询三层、SSE vs 既有 WebSocket、项目树内 vs OS 缓存 slot、迁移脚本 vs 自描述版本；含 4 条「计划 vs 落地」偏离
- `reasoning/knowledge-graph-relations` — 节点类型来源的**反转**（计划：frontmatter `type` 且禁止按目录推断；落地：白名单目录决定，硬理由为 `serializeDocument`/`serializeDecision` 只序列化固定键会静默抹掉自定义 frontmatter）、Tag 节点 vs 并行字段、`source_path` 两类解析、wikilink 两级基准与唯一命中才成边、语义 `relations` 暂缓（无消费者）、同 payload 两视图与 caption 按估算宽度截断

**与既有页面的分工**：16 个 decision 页记单点结论，reasoning 记完整推导链，两者互链不重叠；`concepts/kuzu-graph` 新增 Related Reasoning 双向入口。

**同步**:`index.md` Reasoning 段 +2 行；`overview.md` Reasoning traces 3 → 5。

**遗留（写作过程中发现，未修）**:
- `doc-15` 仍停留在 frontmatter `file_type` 版，与实现（目录决定）**相反**；属 `backlog/docs/` 正式文档，须经 Core/CLI 改，已列入待办待用户确认
- 代码注释 3 处过时仍写 frontmatter：`fingerprint.ts:28`、`import.ts:21`、`incremental.ts:88`
- `backlog/wiki/usermanual/` 下新出现 `package.json` + `node_modules`（22:04，非本 agent 所为）：虽被 `.gitignore` 忽略，但 **wiki 扫描与图谱 scanner 会递归 `wiki/` 目录**，381 个第三方 md 会被当成 wiki 节点入图，建议移除或迁出 `wiki/` 根目录

## [2026-10-03 01:30:25] batch-ingest | 增量摄取 BACK-715~744、doc-17~22、m-10（Memos 功能线 + 状态机语义化 + 列表分页双模型）

登记：Sources +39（BACK-715~744 共 30、doc-17~22 共 6、back-222/back-420 归档历史补建、m-10 里程碑页新建），Concepts +7（memos / state-machine / list-paging / json-watch / statistics-corpus-scope / toc-scrollspy / live-sync-pattern），Decisions +2（[[decisions/hand-rolled-state-machine-validator-over-engine]]、[[decisions/cli-list-window-over-cursor]]），Execution +1（[[execution/two-list-paging-models-wiring]]）。draft-170~172 按用户裁决不收录。index.md Sources 行同步 back-702/703、doc-14/15 的新 frontmatter title/labels；overview.md 新增 Memos / 状态机语义化 / 列表分页双模型 / watch 生命周期 / v1.52.0→v1.53.0 第五波五节，统计 283→322 sources、34→41 concepts、24→25 execution、71→73 decisions。source_path 健康检查 322 页：4 个失效路径——doc-16（源文件 2026-09-15 被 commit 720d58ad 删除、无改名记录，正文加"源文件已不存在"说明）、config-docs 与 tracking-gantt-design-doc（2026-09-26 lint 已有溯源存疑标注，保留）、src-architecture（`src/` 为目录型 source，存在即有效）。配对记忆：reasoning 无（本批为规范文档无分解规划）；patterns 无新建建议（memos 线是既有 [[patterns/cross-surface-feature-addition]] 的教科书实例）；retrospectives 跳过（距 2026-09-08 不足一月）。

## [2026-10-03 01:30:25] usermanual-update | 更新用户手册：新增 70-快速笔记 章节，覆盖 Memos/分页/状态机编辑器/watch 改进
## [2026-10-03 09:29:12] batch-ingest | 增量摄取 BACK-745（memo 搜索语料签名门控）、修正 back-742 描述修复注记与 memo 搜索刷新语义（签名+TTL 双门控），重新合并用户手册
## [2026-10-03 09:44:38] wiki-recovery | 恢复 usermanual/10-任务管理/00-任务生命周期.md：stash-pop 期间 blob a76f97ea 损坏导致页面被误删，从 HEAD 基线重建并按 concepts/state-machine.md 重写「状态机」节，已重新合并手册

## [2026-10-05 08:40:00] batch-ingest | 增量摄取 BACK-746~747（Memo 钉板 + 归档）
登记：Sources +2（[[sources/back-746-memo-board-webgl-pinboard]]、[[sources/back-747-memo-archiving]]），Concepts +1（[[concepts/memo-board]]），Decisions +3（[[decisions/board-hover-archive-overlay]]、[[decisions/memo-archive-rename-not-rewrite]]、[[decisions/init-memos-dirs-symmetric]]），Execution +1（[[execution/webgl-html-overlay-hover-control]]）。concepts/memos 扩展「钉板与归档」节；overview.md 顶部 Memos 行与「Memos 快速笔记子系统」节同步。基线 2026-10-03 09:44 之后的唯一变更源为 BACK-746/747 两个任务（746/747 提交在 wiki-tmp 工作流中基于 release 线 cherry-pick 后纳入）。reasoning 无（两个任务均为直实现无分解规划）；patterns 无新建；retrospectives 跳过。

## [2026-10-05 08:40:00] usermanual-update | 快速笔记章节新增「钉板视图与归档」页，重新合并手册
70-快速笔记 新增 04-钉板视图与归档.md（SUMMARY.md 同步），02-Web备忘页面 补钉板模式节与卡片归档说明。运行 merge.py 重新生成 wiki_output/用户手册/manual.md。

## [2026-10-07 22:50:00] batch-ingest | 增量摄取 BACK-748~756（9 个新任务）

**检测基线**: 2026-10-05 08:40:00（上次 batch-ingest，BACK-746/747）
**Git 变更文件**: 9 个 backlog 任务（BACK-748~756）+ 其 src/ 变更

**新 source 页面**: 9 个
- `sources/back-748-fix-sidebar-resize-handle` — BACK-748 修复侧栏 resize handle 被 Tailwind v4 preflight `hr{height:0}` 坍缩
- `sources/back-749-pinboard-fixed-height-ellipsis` — BACK-749 钉板便签固定高度 + 溢出省略号
- `sources/back-750-memo-tag-bar` — BACK-750 Memo 标签历史条单行折叠与 `#topic#` 话题语法（含并入的 BACK-751 范围）
- `sources/back-751-auto-link-entity-id-ranges` — BACK-751 实体 ID 区间与斜杠列表自动链接为下拉选择器
- `sources/back-752-sequences-tui-two-pane` — BACK-752 Sequences TUI 双面板视图
- `sources/back-753-referenced-by-backlinks` — BACK-753 文档与决策页反向链接
- `sources/back-754-re-parent-task` — BACK-754 任务重定父
- `sources/back-755-include-completed-subtasks` — BACK-755 父任务视图纳入已完成子任务
- `sources/back-756-graph-canvas-high-dpi` — BACK-756 图谱 canvas 高 DPI 渲染加速

**更新 concept 页面**: 6 个（交叉链接，未新增页）
- `concepts/memo-board` — + back-749、back-750
- `concepts/memos` — + back-749、back-750
- `concepts/wikilink` — + back-751、back-753
- `concepts/kuzu-graph` — + back-756
- `concepts/task-identity` — + back-754、back-755
- `concepts/cli-tui` — + back-752

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 无新增（本批为独立 UI/CLI 特性，无跨任务可复用模式达阈值）
- [x] `wiki/decisions/` — 无新增微决策页（各任务决策点已写入 source 页正文）
- [ ] `wiki/reasoning/` — 无复杂分解规划需记录
- [ ] `wiki/patterns/` — 未达 3+ 同构阈值
- [ ] `wiki/retrospectives/` — 距 2026-09-08 不足一月，跳过

**更新导航**: `index.md`（Sources +9 行）、`overview.md`（新增本波段落、统计 323→334 sources、41→42 concepts、25→26 execution、73→76 decisions、34→41 user manual pages）

**mini-lint**: 9 个新 source 页 `source_path` 全部解析到磁盘真实文件；全量 334 个 source 反向引用扫描 0 缺失。

## [2026-10-07 22:50:00] usermanual-update | 更新用户手册，覆盖 BACK-748~756

**更新页面**: 9 个
- `70-快速笔记/04-钉板视图与归档` — 修正便签高度行为（固定 150px + 溢出省略号，替代原"随内容自动增长"）
- `70-快速笔记/02-Web备忘页面` — 标签历史条单行折叠、active 置顶、`#topic#` 话题语法与 composer 自动补全、实体 ID 区间/斜杠列表链接
- `70-快速笔记/03-搜索与知识互联` — 补充 `#topic#` 话题语法与实体 ID 区间链接
- `40-Web界面/11-图谱视图` — 新增高 DPI 渲染性能说明（视口裁剪、批绘、MAX_DPR=2、文本 LOD）
- `40-Web界面/02-任务列表` — 实体 ID 自动链接扩展区间 `BACK-715~747` 与斜杠列表 `BACK-743/744/745` 下拉
- `40-Web界面/00-启动与访问` — 侧栏 resize handle 修复说明
- `10-任务管理/03-子任务与依赖` — `task edit --parent/--clear-parent` 重定父、父视图纳入已完成子任务
- `10-任务管理/04-搜索与序列` — `sequence list` TUI 双面板视图
- `30-文档与决策/00-文档管理`、`30-文档与决策/01-决策记录` — 新增「反向链接」节

**新增用户手册页面**: 0 个

**重新生成**: `wiki_output/用户手册/manual.md`（merge.py）

## [2026-10-09 21:40:00] wiki-create | 新增 developer-notes：GitHub CI 发布注意事项

- 新建 `developer-notes/github-actions-release-gotchas.md`——`.github/workflows/release.yml` 标签触发自动发布链路的触发机制、作业依赖、三条硬规则（npm 版本号烧号、部分成功、OIDC dist-tag 授权）、打标签前检查、观察诊断与失败后处置决策表；全部条目来自真实事故
- 已登记 `index.md` Developer Notes 表（本批提交一并入库）

## [2026-10-09 23:00:00] batch-ingest | 增量摄取 BACK-757~762、RELEASE-v1.53.2-CN，收尾 developer-notes 页

**检测基线**: 2026-10-07 22:50:00（上次 batch-ingest，BACK-748~756）
**检测方式**: `git status --porcelain` + HEAD 祖先链逐文件比对（本仓 commit 日期失真，--since 不可信——HEAD b48bf699 之外 a0a68b4c/3b9d7103 等任务提交未进线性视野，直接以磁盘内容对照 log.md 为准）
**变更源**: 6 个新任务（BACK-757~762，全部 Done，2026-10-08~09）+ 1 个顶层发布说明（RELEASE-v1.53.2-CN.md，未追踪）+ 1 个上一会话遗留的 developer-notes 页收尾；backlog/docs、decisions、milestones 无变更

**新 source 页面（7）**:
- `sources/back-757-memo-backlog-dir-resolution` — memo 目录解析配置化 + re-init 补建结构
- `sources/back-758-graph-backlog-dir-resolution` — 图谱扫描/监听目录解析配置化
- `sources/back-759-cross-branch-prefix-visibility` — 跨分支加载前缀转发 + include_cross_branch 配置化
- `sources/back-760-cross-branch-settings-toggles` — 设置页跨分支三开关（扫描/展示两轴）
- `sources/back-761-terminal-card-actual-end` — 终态卡片 actualEnd 时间戳 + isTerminalStatusName 防二次推导
- `sources/back-762-terminal-statuses-readonly` — 终态集读取路径显式化、设置页只读化、派生值不落盘
- `sources/release-v1-53-2-cn` — v1.53.2-CN hotfix 发布说明

**更新 concept（9）**: `memos`（目录解析）、`kuzu-graph`（扫描/监听解析）、`core-architecture`（前缀转发段 + 配置体系 include_cross_branch）、`web-ui-features`（设置页三开关 + 终态只读 + 卡片时间戳）、`state-machine`（终态集显式化/判定 API 分层）、`cli-entry`（config list 派生行 + task list 跨分支配置）、`search-sequences`（/api/search crossBranch 回退）、`web-server`（派生值 spread、/api/statuses 形状、resolveCrossBranchVisibility）、`cli-instructions`（指南点名 terminalStatuses）

**新 decision 页面（4）**:
- `decisions/backlog-dir-single-resolution` — 全产物面统一 resolveBacklogDirectory（BACK-757/758）
- `decisions/cross-branch-config-default-param-override` — 配置为默认、参数为覆盖（BACK-759）
- `decisions/scan-show-two-axes` — include_cross_branch 不得停止扫描（BACK-760）
- `decisions/terminal-set-derived-not-stored` — 终态集派生、只读、唯一写入口（BACK-762）

**新 execution 页面（1）**: `execution/custom-backlog-dir-rollout-audit` — 配置目录推广时的硬编码路径审计模式（默认 fixture 掩盖缺陷、读/写/监听逐面核对、re-init 补建）

**Pairing Memory Checklist**:
- [x] `wiki/execution/` — 配置目录审计模式（BACK-757/758 跨任务提炼）
- [x] `wiki/decisions/` — 4 个微决策（含 1 个两轴分工、1 个派生值治理）
- [ ] `wiki/reasoning/` — 无复杂分解规划需记录（6 任务均为直实现 bug 修复/小特性）
- [ ] `wiki/patterns/` — 未达 3+ 同构阈值（ BACK-761/762 共享"派生集合治理"主题但仅 2 例）
- [ ] `wiki/retrospectives/` — 距 2026-09-08 回顾一月有余，但属小型增量波，留待下次大波或人工发起

**用户手册**: 更新 3 页（`40-Web界面/01-看板视图` 完成时间戳、`40-Web界面/05-设置与主题` 跨分支三开关 + 终态只读、`60-配置与运维/00-配置管理` include_cross_branch + terminalStatuses 派生行 + 自定义目录生效说明）；merge.py 重新合并 manual.md（4951 → 5448 行）

**更新导航**: `index.md`（Sources 334→341、Decisions 76→80、Execution 26→27）、`overview.md`（新增本波段落、统计同步）

**mini-lint**: 7 个新 source 页 `source_path` 全部解析到磁盘真实文件（RELEASE-v1.53.2-CN.md 为仓库根未追踪文件，按 README/CLI-INSTRUCTIONS 先例收录）；新页面出链（concepts/decisions/execution/sources）目标均存在；index.md 覆盖全部内容子目录。

## [2026-10-09 23:10:00] adjust | 发布说明版本号 1.53.2-CN → 1.53.4-CN 全量改名

**更正对象**：23:00 batch-ingest 条目登记的 RELEASE-v1.53.2-CN。

**事实核对**：npm `latest` dist-tag 已指向 1.53.4-CN，git 存在 `chore: sync package.json version to v1.53.4-CN [skip ci]` 同步提交；1.53.2/1.53.3 号段在发布尝试中烧号（`developer-notes/github-actions-release-gotchas` 的 E403/部分成功条目即来自这两次事故），BACK-757/758 hotfix 的实际发布版本为 **v1.53.4-CN**。

**改名动作**：
- `RELEASE-v1.53.2-CN.md` → `RELEASE-v1.53.4-CN.md`（标题行同步）
- `sources/release-v1-53-2-cn` → `sources/release-v1-53-4-cn`（frontmatter title/source_path、正文版本号同步）
- 反向引用同步：`sources/back-757`、`sources/back-758`、`index.md`、`overview.md`（含烧号注记）、`usermanual/60-配置与运维/00-配置管理.md`
- merge.py 重新合并 manual.md

**保持不变**：发布说明正文"上一个版本：v1.53.1-CN"链接（v1.53.2-CN 为烧号孤儿版，非正式前版）；23:00 历史条目不动（append-only）。

## [2026-10-09 23:25:00] source-remove | 移除 RELEASE 发布说明摄取，确立「wiki 不收录发布说明」规则

**规则变更**（用户裁决，同 2026-09-26 排除草稿的先例）：`RELEASE-vX.md` 发布说明**一律不摄为 source 页面**。理由：发布说明是面向用户的交付文案，其事实内容由 BACK 任务页承载；release 分支已留存全部历史版本，wiki 再收一份只会与任务页内容重复、并随版本号改名产生 maintenance 负担。1.53.2/1.53.4 两次改名（23:00 ingest → 23:10 adjust → 23:25 remove）即为例证。

**删除清单**：
- `RELEASE-v1.53.4-CN.md`（仓库根副本——release 分支已有同名文件，此处属重复）
- `sources/release-v1-53-4-cn`

**反向引用清理**：
- `sources/back-757`、`sources/back-758` 移除 Related Sources 中的发布说明行
- `index.md` Sources 表移除该行（340 条）
- `overview.md` 删除「发布」bullet、「自定义目录全面生效」bullet 去掉版本号标注；统计 341 → 340
- `usermanual/60-配置与运维/00-配置管理.md` 自定义目录说明去掉版本号归属（内容保留，事实源自 BACK-757/758 任务页）
- merge.py 重新合并 manual.md

**历史条目**：23:00 与 23:10 两条 log 条目不动（append-only）。

## [2026-10-09 23:45:00] style-normalize | 全面规范化 511 页 + 风格约定写入 AGENTS.md

**背景**（用户裁决）：用户反馈 wiki 编写风格混乱、语言逐月漂移（05~07 中文 → 09 月 156 篇整页英文 → 10 月中英混排）、frontmatter/标题/Related 小节多套约定并存。用户选定：全面规范化存量 + 目标语言简体中文为主 + 手册缺口全补。

**合同**：`AGENTS.md` WIKI GUIDELINES 新增「页面风格约定」12 条（语言、frontmatter 字段序/日期/labels、title 格式 `BACK-757 - 中文短标题`、H1=title、source/decision/execution 三类骨架、Related 小节命名与顺序、翻译忠实性、术语对照、LF）。

**执行**：AgentSwarm 三波共 24 批（B01~B19 + W1~W4），覆盖 sources 340 / concepts 42 / decisions 80 / execution 27 / reasoning 5 / entities 2 / patterns 6 / retrospectives 1 / developer-notes 8 = 511 页（B01/B04 有 3 页重叠由先到者定稿）。156 篇英文 source 页全量译中（保留 file:line、命令、标识符、wikilink 原样）；5 个无 H1 页补齐；合并式 `## Related` 全部拆分；空 Related 小节删除；`## Summary`/`## Acceptance Criteria`/`## Implementation Notes` 等英文小节名归位中文化；frontmatter 统一字段序、日期去引号、labels 行内化、updated_date 统一 `2026-10-09 23:30`、清约定外字段（created:/decision_date:/description）。

**校验**：全合同脚本扫描 511 页——引号日期 0、块状 labels 0、约定外字段 0、缺 source_path 0、H1≠title 0（初报 6 例均为代码围栏内 `#` 注释误报，围栏感知复扫确认）、陈旧 updated_date 0、合并 Related 0、英文小节名 0、CRLF 0。

**index.md**：按各批 TSV 映射（tmp/wiki-style-map/，511 唯一路径）脚本同步 Title 列 510 格（1 行为表头伪行忽略）。

**裁量留痕**：developer-notes/patterns 互链归入 Related Concepts（惯例沿用 sources/path-autocomplete-task 先例）；milestone 里程碑页 title 用 `m-10 - …` 式；reasoning 页 title 去任务 ID（合同第 3 条「concept/decision/execution/reasoning 页不含 ID」）；工作树行尾为 CRLF（core.autocrlf），入库经 .gitattributes 归一 LF。

**遗留**：① DEVELOPMENT-GUIDE.md 546 行超合同篇幅锚点，拆分待编辑决策；② 手册 12+2 缺口补全由并行代理执行（见后续条目）；③ `sources/inline-code-html-escaping-fix` 的 source_path 指向 back-208 文件与 BACK-476 不符，属原始资料事实未改，建议 lint 时核实。

## [2026-10-10 00:20:00] usermanual-update | 手册缺口补全 12+2，新增故障排查页

**背景**（用户裁决）：只读审计发现手册缺失 5 项、过薄 7 项、错误陈述 2 条（见 23:45 条目前的工作）；用户选定全做。

**错误修正（2）**：① 任务生命周期页删除不存在的 `backlog config reset statuses`（config 仅 get/set/list，恢复默认七列只能经 Web 设置页状态机编辑器 Default 按钮）；② 创建与编辑页"没有 complete 子命令"改写为 `backlog task complete <id>` 真实用法（仅接受终态任务，成功移入 completed/；MCP `task_complete` 同语义）。

**缺失补齐（5，其中 1 项部分）**：`05-归档与清理` 增单任务完成清理节；`01-安装与初始化` 增升级路径（npm/brew/二进制）与非交互初始化节（`--defaults`/`--integration-mode`/`--agent-instructions`）；`00-MCP工作流` 资源列表重写为 10 资源全表并删除幻影 URI `backlog://docs/task-workflow`；`00-配置管理` 增 `onStatusChange` 自动化回调与 `defaultStatus`/`maxColumnWidth`/`definitionOfDone`/`milestones` 键表；`defaultReporter` 因源码无消费逻辑跳过（仅类型与序列化）。

**过薄加厚（7）**：MCP 工具清单改为 7 域分类全表（源码实为 27 个工具，纠正审计的 28）；`02-代理指令文件` 增 instructions 十册完整列表；`03-Wiki Skill 安装` 增安装后的工作流节（摄取/查询/lint/flowback）；新建 `60-配置与运维/03-故障排查.md`（7 节，SUMMARY 登记，index 同步）；`taskResolutionStrategy` 入配置表并在设置页补语义；`mcp.http.*` 重写为"预留未实现，仅 stdio"（纠正误导性表述）。

**产物**：merge.py 重新合并 manual.md（5448 → 5695 行）。统计：User manual pages 41 → 42。
