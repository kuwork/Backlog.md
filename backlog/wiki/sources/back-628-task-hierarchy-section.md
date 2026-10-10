---
title: BACK-628 - 任务模态框显示父任务与子任务
labels: [source, web-ui, task-hierarchy]
created_date: 2026-09-13 01:12
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-628 - Show-parent-task-and-subtasks-in-task-modal.md
---

# BACK-628 - 任务模态框显示父任务与子任务

父子关系在任务详情模态框中不可见——查看或导航层级必须离开模态框。本任务在标题正下方渲染一个层级分区：打开的任务有父时显示 PARENT 行，有子任务时显示可折叠的 SUBTASKS 分区，含完成计数、进度条与按行钻取。

- 新 `TaskHierarchySection.tsx`，渲染在 `TaskDetailsModal` 内容顶部（横幅之下、内容网格之上），仅当存在父或子任务时——无层级的任务渲染与之前完全一致，模态框布局、尺寸与扩展行为不变
- 父行：上箭头图标、PARENT 标签、父 ID + 标题、状态徽标；点击经现有 `onDrillDown` / `handleTaskClick` 路径在模态框中打开父任务
- 子任务分区：头部含图标、SUBTASKS 标签、`done/total` 计数、进度条与 chevron；**整行头部**切换展开/折叠（用户反馈，不只 chevron）；每行含实心/空心完成圆点、ID、标题、状态徽标与钻取 chevron
- 解析在客户端从任务语料完成：父查找与子过滤都用 `canonicalTaskId` 匹配，子按 `sortByTaskId` 排序；`TaskDetailsModal` 新增可选 `availableTasks` prop，由 `App.tsx` 注入
- 执行发现：从 `src/utils/task-path.ts` 导入 `taskIdsEqual` 会把 Core 拉进浏览器 bundle 并使 Web UI 白屏——改用纯模块 `src/utils/task-id.ts` 的 `canonicalTaskId`（见 [[decisions/pure-task-id-module-in-browser-bundle]]）
- i18n：标签加入 `en`/`ja`/`zh-CN`/`zh-TW`；测试：`src/test/web-task-details-modal-hierarchy.test.tsx` 中 5 个 `renderToString` 组件测试
- 资产：参考 mockup `backlog/assets/paste/parent-task-view.png` 与 `subtask-view.png`

## 验收标准

- PARENT 行在标题下方显示父 ID、标题与状态徽标，点击打开父任务
- SUBTASKS 分区显示完成计数与进度条，可展开/折叠
- 每个子任务行显示完成指示、ID、标题、状态徽标与钻取入口，点击打开该子任务
- 分区匹配现有模态框样式，不破坏键盘快捷键、返回导航或未保存草稿处理
- 无父无子的任务不渲染该分区，行为与之前完全一致

## Related Concepts

- [[concepts/web-ui-features]] — 本分区分加入的任务模态框交互约定
- [[concepts/task-lifecycle]] — 本分区分可视化的父/子任务关系
- [[concepts/task-identity]] — 解析所用的 `canonicalTaskId` 无前缀匹配

## Related Sources

- [[sources/back-505]] — 此处复用的 BACK-505 依赖钻取导航
- [[sources/back-624-global-search-dialog]] — 同一反馈波；BACK-624 把 `task-badge-colors.ts` 从 TaskList 拆出
- [[sources/subtask-grouping-fix]] — BACK-496 看板/列表视图中的子任务分组
