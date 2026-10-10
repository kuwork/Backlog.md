---
title: 扫描与展示是两个轴：include_cross_branch 不得停止扫描
labels: [decision, config, core, web-ui]
created_date: 2026-10-09 22:00
updated_date: 2026-10-09 23:30
---

# 扫描与展示是两个轴：include_cross_branch 不得停止扫描

## 背景

设置页接入跨分支开关后发现：关闭 Cross-Branch Tasks 后服务器仍在索引其他分支，直觉修法是让该键连扫描一起停。但两条路径共享同一次加载：`getActiveAndCompletedTaskIds` → `loadTasksWithStableBranchSnapshot`，分支条目在 identity index 层进入，ID 分配候选集与 `task view <跨分支 id>` 都读这个 index。

## 决定

BACK-760：`include_cross_branch: false` 时服务器仍扫描其他本地分支（日志继续 "indexing N other local branches"）不是矛盾而是刻意分工——扫描由 `check_active_branches` 控制，`include_cross_branch` 只决定扫描结果是否进入看板/任务列表/搜索。

- 保持分工：扫描 = `check_active_branches`（成本与 ID 分配），展示 = `include_cross_branch`（查询期过滤）
- 设置页把两个开关都暴露出来（Cross-Branch Tasks + Check Active Branches + Active Branch Days），文案写明关闭扫描会收窄 ID 分配候选集
- 展示轴的过滤在查询路径做，语料无需重载（见 [[decisions/cross-branch-config-default-param-override]]）

## 被否方案

- **让 include_cross_branch 也停扫描**：该键默认 false，等于默认禁用跨分支加载——BACK-759 修复的 ID 分配候选集（705→749）回退、BACK-715 撞号复现、`task view <id>` 再次 not found
- **为展示单独建一套加载**：双份 git 扫描成本翻倍，缓存语义复杂化

## Related Sources

- [[sources/back-760-cross-branch-settings-toggles]] — 本决策的实现任务
- [[sources/back-759-cross-branch-prefix-visibility]] — 共享加载路径与 ID 分配牵连的实测
