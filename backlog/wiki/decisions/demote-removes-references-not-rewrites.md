---
title: demote 移除被腾空的引用，而非改写为新草稿身份
description: BACK-691 在 archive/demote 后清理 vacated-ID 引用；demote 直接移除而不是重指
labels: [decision, task-lifecycle, core]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# demote 移除被腾空的引用，而非改写为新草稿身份

## Context

归档或 demote 一个任务会腾空它的 ID，留下指向悬空编号的依赖与引用；一旦该编号被重新分配给无关任务，旧依赖就静默绑到了错误的任务上。demote 场景还有一个选择：把引用改写成新草稿的 `DRAFT-n` 身份。

## Decision

- archive/demote 后，在工作副本与 completed 语料中**移除**所有指向被腾空 ID 的依赖与引用（`sanitizeVacatedTaskLinks`），并把清理到的任务 ID 上报给每个界面
- demote 时引用是**移除**而非改写成新草稿身份：依赖关系属于任务语义，草稿不是合法的依赖目标（BACK-707 的硬规则），改写只会制造一条立刻非法的边
- complete 不清理——completed 依赖正是 readiness 要读的东西
- 三个命令改为 local-first 解析（`includeCrossBranch: false` + fail-closed 歧义），不再为本地能解析的目标触发全量跨分支刷新

## Rejected alternatives

- demote 时把引用重指到 `DRAFT-n`——draft 永远不是合法依赖目标，改写等于埋雷
- 保留悬空引用不动——ID 再分配后静默错绑（回归测试 `vacated-task-references` 钉住了这个场景）

## Related Sources

- [[sources/back-691-local-first-lifecycle-vacated-refs]] — 本决策的落地
- [[sources/back-707-dependency-gate-cycles]] — draft 不可作为依赖目标的门禁规则
- [[sources/back-567-cross-branch-task-identity]] — 被绕开的跨分支解析机制
