---
title: BACK-860 - 里程碑弹窗侧栏保存状态
labels: [source, web-ui, milestones, save-state]
created_date: 2026-11-20 11:09
updated_date: 2026-11-20 11:09
source_path: backlog/tasks/back-860 - Show-a-save-status-indicator-for-sidebar-edits-in-the-milestone-popup.md
---

# BACK-860 - 里程碑弹窗侧栏保存状态

里程碑侧栏名称 blur、五个日期字段和文档编辑继续由 `saveMeta` 即时保存，并在 Modal actions 区显示与任务弹窗一致的保存状态 chip。

## 问题

旧 `saving` 只用于禁用头部按钮，预览模式下名称和日期写入没有可见反馈。需要复用现有 `common.saving/saved/failedToSave`，不新增防抖，也不改变编辑模式 Save 按钮。

## 实现要点

- 新增 `idle/saving/saved/failed` 状态，saved 约 2.5 秒后自动回 idle。
- 仅由侧栏 `saveMeta` 驱动 chip；编辑模式 `handleSave` 保持原反馈，两套路径不串联。
- 失败仍显示错误 banner，保留输入值且不触发 `onRefreshData`；与旧行为一致，不额外宣称回滚。
- 复用既有 i18n 键，无新增语言条目。

## 验证

里程碑 Web 7 个文件共 31 项测试通过，包含日期保存成功与失败两项新回归；TypeScript 与 Biome 通过。

## Related Concepts

- [[concepts/web-ui-features]] — 里程碑弹窗的即时保存反馈
- [[concepts/milestones]] — 里程碑元数据与文档字段

## Related Sources

- [[sources/back-859-task-inline-save-status]] — 任务弹窗的同构保存 chip
- [[sources/back-839-batch-inline-metadata-edits]] — 保存状态模式的原始来源
