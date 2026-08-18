---
title: TaskIdentityIndex 替换 ID-keyed 合并模式
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [execution, core, identity]
extracted_from: [BACK-567]
---

# TaskIdentityIndex 替换 ID-keyed 合并模式

## 模式

1. 用 `canonicalTaskId + normalizeRecordPath` 作为身份键
2. 收集所有来源记录（working copy、completed、branch states）
3. 对每个身份按以下优先级选出胜者：
   - working copy 优先
   - 最近修改（most_recent）
   - 最多完成项（most_progressed）
4. 同一身份若存在多个 live 路径，则 fail-closed（AmbiguousTaskIdError / 409）
5. 暴露 `getTasks(includeCompleted)`、`getOccupiedIds`、`resolve(id)` 供 CLI/MCP/浏览器统一使用
6. 保留 fork 特有的 cross-branch-tasks 数据流（recentBranchesOnly）不变

## 收益

- 消除等时间戳扫描顺序释放 live ID 的竞态
- 跨分支、本地、完成、归档记录统一身份规则
- 歧义 ID 不再猜测，而是显式失败

## Related Sources

- [[sources/back-567-cross-branch-task-identity]]
