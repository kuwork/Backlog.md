---
title: BACK-645 - 任务列表验收标准进度定宽条
labels: [source, web-ui]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-645 - Restyle-acceptance-criteria-progress-in-task-list-with-fixed-width-bar.md
---

# BACK-645 - 任务列表验收标准进度定宽条

全部任务列表仍把验收标准进度渲染为等宽字体 `[██████░░░░] 4/7` 格点指示器，与 BACK-630 重样式化后的看板卡片和任务模态框不一致。列表现在用同样的 bar 变体并固定宽度，不随弹性标题列拉伸。

- `AcceptanceCriteriaProgress.tsx`：bar 变体轨道从 `flex-1 min-w-0` 改为 `w-full`，宽度由外层 span className 控制——一个组件服务两种宽度模式，无新变体
- `TaskList.tsx` 从 `cells={10}` 切到 `variant="bar"` 加 `w-20 shrink-0`（固定 80px 占位）；`TaskCard` 保持 `flex-1 min-w-[2.5rem]`，头部行填充不变
- 固定外层 span 内分数文本 `shrink-0`，轨道弹性收缩（约 55px），每行占位不论分数长度都一致
- 门控与可访问性不变：仅至少一条验收标准的 In Progress 任务渲染，保留 `role=progressbar`、aria 值与 title 文本；`cells` 变体仍可用但已无人使用
- 测试：web-acceptance-criteria-progress 6 通过（新定宽用例断言 className 透传与 50% 填充），三个 web-task-list 套件 15 通过（Title 仍是唯一弹性列）
- 双主题真实浏览器走查：2/4 任务在灰轨道上渲染 50% 翠绿填充，0/4 渲染空轨道，每行占位一致

## 验收标准

- 任务列表渲染 BACK-630 条形样式（圆角轨道、翠绿填充、旁附分数）取代等宽格点
- 指示器宽度固定，永不拉伸填满标题单元格；看板卡片不变
- 门控、progressbar ARIA 属性与 title 文本保留

## Related Concepts

- [[concepts/web-ui-features]] — 此处统一的任务列表与看板卡片视觉约定

## Related Sources

- [[sources/back-569-acceptance-criteria-progress-ui]] — 原始验收标准进度指示器
- [[sources/back-625-ac-progress-json-output]] — 同一反馈波；CLI JSON 输出中的 AC 进度
- [[sources/back-628-task-hierarchy-section]] — 同一波中的模态框兄弟重样式
