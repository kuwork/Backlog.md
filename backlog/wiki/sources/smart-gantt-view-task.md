---
title: "BACK-491: Add Smart Gantt View"
labels: [source, feature, web-ui, gantt, visualization]
created_date: 2026-05-28 00:50
updated_date: 2026-05-28 00:50
source_path: backlog/tasks/back-491 - Add-smart-Gantt-View.md
---

# BACK-491: Add Smart Gantt View

新增纯 React/CSS 渲染的甘特图时间线视图，基于现有任务日期字段与依赖关系，填补项目时间维度可视化空白。

## 核心需求

- `/gantt` 路由页面：左侧任务列表 + 右侧时间线双栏布局
- 五级时间粒度切换：日 / 周 / 月 / 季度 / 年
- 任务起止时间自动解析规则，兼容无计划日期的任务
- 任务依赖关系箭头可视化（SVG 贝塞尔曲线）
- 单击任务条高亮依赖链（前驱/后继高亮，其他淡化至 30%）
- 时间线支持拖拽平移

## 时间解析规则（强制优先级）

**开始时间**
1. `plannedStart` 存在 → 优先使用
2. 无 `plannedStart` → 使用 `createdDate` 日期部分（YYYY-MM-DD）

**结束时间**
1. `plannedEnd` 存在 → 优先使用
2. 无 `plannedEnd` 但 `updatedDate` 存在 → 使用 `updatedDate` 日期部分
3. 仅有 `createdDate` → 启用动态最小宽度回退

## 最小宽度回退机制

解决单日期任务在大跨度视图中被压缩为细线的问题：

| 视图 | 回退最小时长 |
|---|---|
| 日视图 | 4 小时（纯前端视觉宽度，便于同天多任务垂直错位） |
| 周视图 | 1 天 |
| 月视图 | 1 天 |
| 季度/年视图 | 固定视觉像素宽度（如 8px） |

回退逻辑仅对仅有 `createdDate` 的任务自动填充，不影响有完整计划时间的任务。

## 同天多任务渲染

日视图中仅有创建时间的任务通过动态最小宽度自然形成水平错位，避免完全重叠。

## 工程实现

- 纯 React/CSS 渲染，零外部甘特图库依赖
- `src/web/components/GanttView.tsx` 主组件（含子组件）
- `src/web/App.tsx` 注册 `/gantt` 路由
- `src/web/components/SideNavigation.tsx` 添加导航入口
- `src/server/index.ts` 添加服务端路由表条目支持 SPA 直接刷新
- 四国语言（en/ja/zh-CN/zh-TW）补充 `gantt` 命名空间翻译键
- 全量 Tailwind CSS `dark:` 变体支持暗黑模式

## 交互细节

- 左表四列（ID、标题、开始、结束）支持点击排序，与"所有任务"页双箭头交互一致
- 任务条悬停显示完整信息（ID、标题、起止时间、是否回退渲染）
- 单点任务在大跨度视图悬停显示真实计划时间（如有）
- 左表"详情"按钮点击打开现有 `TaskDetailsModal`
- 排序后右侧甘特条按新顺序重新布局

## Out of Scope

- 不新增数据库/字段
- 不支持手动拖拽调整时间（未来迭代）
- 不计算复杂关键路径（未来迭代）

## 相关概念

- [[concepts/gantt-view]] — 甘特图视图的架构与渲染策略
- [[concepts/web-ui-features]] — Web UI 整体功能概览
- [[concepts/date-fields]] — 日期字段语义与存储格式

## Related Sources

- [[sources/due-date-fields-task]] — 日期字段支持（plannedStart / plannedEnd）
- [[sources/draft-promote-flow-task]] — 任务详情模态框复用
