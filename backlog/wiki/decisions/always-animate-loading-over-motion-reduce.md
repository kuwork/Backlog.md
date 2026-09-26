---
title: 加载指示器始终动画，优先于 motion-reduce 抑制
description: BACK-670 刻意背离上游，移除六处 motion-reduce 抑制
labels: [decision, web-ui, accessibility, upstream-migration]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 加载指示器始终动画，优先于 motion-reduce 抑制

## Context

开发主机跑在 RDP 上且 Windows 动画关闭（`MinAnimate=0`），Chromium 因此报告 `prefers-reduced-motion: reduce`，从上游原样移植来的六处 `motion-reduce:` 抑制让所有加载 affordance 完全静止。静止的 spinner 与挂死的应用无法区分——而 RDP/VM/ kiosk 恰恰是关动画最多的宿主。

## Decision

加载进度是**必要反馈而非装饰**：删除全部六处抑制（5 × `motion-reduce:animate-none` + 1 × `motion-reduce:hidden`，分布在 LoadingSpinner、BoardLoadingSkeleton、BranchIndexingIndicator），作为刻意的 fork 背离登记进迁移台账（doc-12/doc-13 WEB-14 行）。每个删除点带注释记录 WHY，防止下一个移植者条件反射地恢复。`motion-reduce` 对将来真正的装饰性动画仍然可用。jsdom 契约断言钉住三个组件中不得出现 `motion-reduce`。

## Rejected alternatives

- 保留上游抑制（无障碍惯例）——惯例的前提是动画属于装饰；加载指示器静止时用户无法区分"慢"与"死"
- 用 prefers-reduced-motion 换更慢的动画而非静止——增加维护面，收益相同的信号仍可被忽略

## Related Sources

- [[sources/back-670-loading-motion-reduce-removal]] — 本决策的落地与 CDP 实测
- [[sources/back-669-initial-loading-skeleton]] — 引入 skeleton 动画的前置任务
- [[sources/back-668-branch-indexing-header-chip]] — 引入索引指示器动画的前置任务
