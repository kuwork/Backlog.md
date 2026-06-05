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
