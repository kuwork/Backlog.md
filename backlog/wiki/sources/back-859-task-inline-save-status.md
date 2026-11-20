---
title: BACK-859 - 任务弹窗即时元数据保存状态
labels: [source, web-ui, tasks, save-state]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-859 - Show-the-save-status-indicator-for-immediate-inline-metadata-edits-in-the-task-popup.md
---

# BACK-859 - 任务弹窗即时元数据保存状态

任务弹窗的状态、日期、标题、负责人、优先级和里程碑继续即时单次 PUT，但现在与列表型字段共用头部 Saving/Saved/Failed 状态 chip。

## 问题

BACK-839 只给五个防抖列表字段接入了 `inlineMetaSaveStatus`。侧栏单值字段仍立即写入，却不触碰该状态，因此保存中和成功都没有反馈；用户要求直接复用 chip，而不是把即时字段塞进防抖管线。

## 实现要点

- `handleInlineMetaUpdate` 的即时分支在 PUT 前设 saving，成功设 saved，失败设 failed 并保留原错误提示。
- 不增加 debounce 或新 timer；五个列表字段的合并 flush 不变。
- chip 更新位于既有任务存在性守卫内，创建模式不显示。
- 既有缺口被明确保留：日期/标题输入值在失败时不一定回滚，不能将 chip 失败状态误述为完整回滚。

## 验证

3 项新测试与任务弹窗 13 个套件共 83 项通过，readiness、draft-editing、graph-stack-return 回归通过；TypeScript 与 Biome 通过。

## Related Concepts

- [[concepts/web-ui-features]] — 任务弹窗内联编辑与保存反馈
- [[concepts/live-sync-pattern]] — 乐观更新、失败与刷新协调

## Related Sources

- [[sources/back-839-batch-inline-metadata-edits]] — 防抖列表字段与保存 chip 来源
- [[sources/back-860-milestone-save-status]] — 里程碑弹窗的同构处理
