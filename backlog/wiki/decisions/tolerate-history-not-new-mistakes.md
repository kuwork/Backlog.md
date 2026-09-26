---
title: 依赖写门禁"容忍历史，不容忍新错误"
description: BACK-707 写门禁对磁盘上已存在的悬空依赖放行（带警告），新引入的一律拒绝
labels: [decision, dependencies, core]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# 依赖写门禁"容忍历史，不容忍新错误"

## Context

本仓库实测 147 条依赖边中 78 条（53%）解析不到任何记录（历史遗留 `task-NNN` 拼写）。严格门禁下，BACK-217 这类记录连原样写回自己的依赖列表都被拒——改个标题都会失败。门禁在"保护语料"与"让旧记录不可写"之间失效了。

## Decision

`validateDependencies` 按候选逐条判断：

- 已存储在磁盘上的不可解析 ID **原样带过**：写回时保留记录里的原始拼写（`task-213` 仍是 `task-213`），CLI stderr 打警告、JSON/MCP 以数据形式携带
- 写入新引入的任何不可解析 ID **一律拒绝**；create 永远严格（没有存量列表可比）
- 比较前两侧必须先同样 canonicalize，否则容忍逻辑永远不触发

同时新增硬拒绝：自引用与环（直接或链式，报错信息带环链），draft 目标、里程碑目标、模糊身份维持硬拒绝。

## Rejected alternatives

- 整体比较新旧列表——掩盖了逐候选的真实变化
- 容忍时把 ID canonicalize 重写——会静默改写历史拼写，且让"是否带过"的判断失效
- 从图服务取邻接——图快照可能落后于被评判的这次写入；环检测走门禁自己加载的 tasks + completed 语料

## Related Sources

- [[sources/back-707-dependency-gate-cycles]] — 本决策的落地
- [[sources/back-708-doctor-dependency-defects]] — 被容忍的存量缺陷在 doctor 报告中浮现
- [[sources/back-615-dependency-readiness-guidance]] — 门禁语义不得与之矛盾的 readiness
