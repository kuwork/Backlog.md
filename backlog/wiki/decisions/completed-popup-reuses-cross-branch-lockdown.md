---
title: completed 语料弹窗复用 cross-branch 只读锁定
description: BACK-663 让 completed 弹窗继承现成的只读门控，而非再造一套
labels: [decision, web-ui, completed-corpus]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# completed 语料弹窗复用 cross-branch 只读锁定

## Context

BACK-662 让搜索对话框能打开 `backlog/completed/` 记录，但弹窗仍按可编辑棋盘记录构建——只读门控只看 `task.branch`，而 completed 记录带 `source: "completed"` 且无 branch，于是 Edit、行内编辑、评论增删、AC/DoD 勾选全都对一个没有刷新路径的记录开放。

## Decision

门控拆成两层：`isFromOtherBranch = Boolean(task?.branch)` 继续命名"分支原因"；`isReadOnly = isFromOtherBranch || task?.source === "completed"` 才是所有 guard clause、按钮条件、`disabled` 属性与样式读取的唯一入口。completed 弹窗**继承** cross-branch 的整套锁定，不再手写第二套。横幅仍是标题栏下的单一槽位，`isReadOnly` 时渲染，措辞按原因选（`completedCorpusHint` vs `crossBranchHint(branch)`）。

## Rejected alternatives

- 为 completed 单写一套只读逻辑——两套门控必然漂移；revert 探针证明半个改动（只改横幅不改门控）恰好复现旧症状
- 在记录上伪造 branch 字段——污染数据语义，且横幅措辞会错

已知共享限制原样保留：预览模式下 AC 复选框仍看似可点但静默 no-op，cross-branch 弹窗行为相同，留作一行式后续。

## Related Sources

- [[sources/back-663-completed-popup-read-only]] — 本决策的落地
- [[sources/back-662-completed-corpus-query-search]] — 把这些记录暴露出来的前置搜索
- [[sources/back-567-cross-branch-task-identity]] — 被复用的 cross-branch 锁定形状
