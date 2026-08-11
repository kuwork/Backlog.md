---
title: 重复 ID 修复采用人类优先、CLI 权威、不猜测
labels: [decision, data-consistency, cli]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
---

# 重复任务 ID 修复采用人类优先、CLI 权威、不猜测（BACK-538）

## 决策

`backlog doctor` 输出先供人类阅读（冲突组、确切文件路径、计划的重命名、需人工审查的引用），修复仅在明确确认后应用。提供 `--commit`（丢弃 .bak 备份并最终化）与 `--rollback`（恢复 .bak 备份）。

## 理由

- 重复 ID 修复涉及 git 合并、零填充等价、外部/手动编辑等不可预测来源，自动修复有数据丢失风险
- 修复不猜测引用：只改文件名与 frontmatter id，引用由人类审查
- 原子性（重命名+frontmatter 同时进行）+ 可回滚（.bak 备份）降低修复风险

## 拒绝的替代方案

- 全自动修复：无法安全处理引用，有静默损坏风险
- 仅检测不修复：无法解决用户实际问题

## 关联

- 相关任务：[[sources/back-538-duplicate-task-id-recovery]]
- 原则：fail-closed、确定性、内容保留、原子性、不猜测引用、可回滚
