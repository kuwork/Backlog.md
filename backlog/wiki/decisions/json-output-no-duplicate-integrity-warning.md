---
title: JSON 输出不接重复 ID 前置检查
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [decision, cli, json, data-integrity]
---

# JSON 输出不接重复 ID 前置检查

## 背景

上游 BACK-545 为 read 命令引入了 `printDuplicateIntegrityWarning`：每次 `task list`/`search`/`board export` 执行前全量扫描本地任务文件，发现重复 ID 则 stderr 警告并 exit code 1。

## 决策

Fork 在 BACK-562 中决定**不移植该前置检查**。

## 理由

- Fork 已通过 BACK-538 实现 `backlog doctor` 人类优先的重复 ID 诊断与修复
- Web 提供 `/api/tasks/duplicate-ids` 端点供主动检查
- 每次 read 命令额外一次磁盘全量扫描会显著降低 CLI 性能，与 fork 的本地时区/快速 CLI 目标冲突
- 重复 ID 在 fork 中应通过显式 doctor/Web 检查处理，而非静默拦截只读命令

## 替代方案

- 选择 A：移植上游前置检查并拦截 read 命令 → 拒绝，性能与 UX 代价高
- 选择 B：保持 doctor/Web 主动检查 → 采纳

## Related Sources

- [[sources/back-562-stable-json-output]] — JSON 输出实现
- [[sources/back-538-duplicate-task-id-recovery]] — Doctor 重复 ID 修复
