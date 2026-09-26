---
title: doctor 依赖缺陷诊断为 warning，退出码保持 0
description: BACK-708 刻意让依赖缺陷报告与 draft-identity 报告的退出码语义分叉
labels: [decision, dependencies, cli]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# doctor 依赖缺陷诊断为 warning，退出码保持 0

## Context

`backlog doctor` 新增了五类依赖缺陷的语料级报告（环、悬空引用、draft 目标、已发布 id、模糊引用）。问题：这些缺陷该不该让 doctor 退出非 0？本仓库实测带着 78 个历史遗留悬空引用，若按失败处理，每次运行都失败，doctor 将不可用。

## Decision

依赖缺陷全部按 **warning** 报告，运行仍退出 0。理由：诊断命令不应把一种"持续存在的语料状态"当作失败。有修复路径的发现（重复 ID）或配置类故障保留各自的退出码；诊断性发现不改变退出码。报告只诊断不修复——环没有可剪的 canonical 边，悬空引用没有目标，所以 `--fix` 仍只修重复 ID。

## Rejected alternatives

- 与 draft-identity 报告一致地 fail-closed——会让带着 78 个遗留拼写的真实仓库每次运行都红，使命令失去价值
- 提供 `--fix` 自动清理依赖列表——自动删边/改引用没有安全语义，修复必须人工判断

## Related Sources

- [[sources/back-708-doctor-dependency-defects]] — 本决策的落地
- [[sources/back-707-dependency-gate-cycles]] — 写门禁容忍存量缺陷，doctor 是它们唯一浮现的地方
- [[sources/back-538-duplicate-task-id-recovery]] — 保留非零退出码的重复 ID 修复流程
