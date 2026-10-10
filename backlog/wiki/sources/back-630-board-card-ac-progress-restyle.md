---
title: BACK-630 - 看板卡片验收标准进度重排与换样式
labels: [source, web-ui, board]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-630 - Restyle-and-reposition-acceptance-criteria-progress-on-web-board-cards.md
---

# BACK-630 - 看板卡片验收标准进度重排与换样式

Web 看板卡片上的验收标准进度指示器位于标题下方，是宽等宽字体 `[██████░░░░] 4/7` 条，视觉上与任务身份脱节。本任务把它移入卡片头部行、紧邻任务 ID，并重样式化为任务模态框在子任务上已用的圆角翠绿进度条。

- `AcceptanceCriteriaProgress.tsx` 新增 `variant` prop：`cells`（默认，TaskList 仍在用的原等宽指示器，不变）与 `bar`（圆角 h-2 轨道、`bg-emerald-500` 填充、轨道右侧附勾选/总数分数，对齐 `TaskHierarchySection.tsx`）
- `TaskCard.tsx` 把指示器与任务 ID 渲染进同一 flex-1 组，计划日期与优先级徽标保持右钉；标题下方的位置已移除
- 门控不变：仅至少含一条验收标准的 In Progress 任务渲染它，从清单实时推导；保留 `role=progressbar` 与 aria 属性；不持久化进度值
- 用户报告发现的暗色对比 bug：轨道原为 `dark:bg-gray-700`，与卡片表面完全同色；计算相对亮度后改为 `dark:bg-gray-500`（对卡片 2.13，之前 1.00；gray-400 会以 1.06 抹掉翠绿填充）
- 在真实浏览器（Chromium 对开发服务器）双主题下用 0/4、1/4、2/4 卡片验证，并对轨道/填充颜色做像素采样
- 测试：`web-acceptance-criteria-progress.test.tsx` 中 5 个用例覆盖 bar 变体（分数、宽度、aria 值、标记顺序）

## 验收标准

- 看板卡片头部在任务 ID 右侧立即显示 AC 进度；标题下方指示器已移除
- bar 变体用圆角轨道 + 翠绿填充与精确分数，双主题下均可与卡片表面区分
- 门控、aria 属性与 title 文本不变；无指示器的卡片保持原头部布局
- 任务列表视图（TaskList）渲染不变

## Related Concepts

- [[concepts/web-ui-features]] — 看板卡片与模态框进度呈现约定
- [[concepts/task-lifecycle]] — 指示器所来源的验收标准清单进度

## Related Sources

- [[sources/back-628-task-hierarchy-section]] — BACK-628 模态框子任务进度条样式被 bar 变体复用
- [[sources/back-569-acceptance-criteria-progress-ui]] — 本任务重样式的 BACK-569 原始 AC 进度指示器
