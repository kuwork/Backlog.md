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

## [2026-05-23 00:40:21] batch-ingest | 增量摄取 BACK-483 Web UI 侧边栏调整大小

## [2026-05-23 00:40:21] lint | Wiki 健康检查：修复 3 个 dangling link、1 个 orphan、2 处 frontmatter

## [2026-05-23 00:40:21] usermanual-update | 更新用户手册，添加 BACK-483 侧边栏调整大小、搜索类型下拉、Wiki URL 可读路径

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

## [2026-06-04 16:34:00] batch-ingest | 增量摄取 BACK-506~508

**后续更正**: BACK-507、BACK-508 为非正式占位任务，已从 backlog/tasks/ 删除，对应 wiki source 页面已移除。

## [2026-06-04 16:34:00] source-remove | 移除 BACK-507、BACK-508 非正式任务 source 页面

- 删除 `wiki/sources/back-507-no-git-task.md`
- 删除 `wiki/sources/back-508-example.md`
- 更新 `index.md` Sources 统计：49 条
- 更新 `overview.md` Sources 统计：49 条

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

## [2026-06-01 22:55:00] usermanual-update | 更新用户手册，添加依赖项钻取与看板拖拽修复

**更新页面**: 2 个
- `10-任务管理/03-子任务与依赖` — 新增 Web UI 依赖项钻取导航说明（点击依赖标签、返回按钮、关闭堆栈）
- `40-Web界面/01-看板视图` — 扩展拖拽行为细节（保持列排序、跨列精确放置、跨列后排序恢复）

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
