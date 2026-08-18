---
title: 统一搜索分数阈值模式
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [execution, search]
extracted_from: [BACK-564]
---

# 统一搜索分数阈值模式

## 模式

1. 在 `task-search.ts` 的 `TaskSearchOptions` 和 `SharedTaskFilterOptions` 中加入可选 `scoreThreshold`
2. Fuse 分支在 `scoreThreshold` 设置时过滤 `result.score <= threshold`；未设置时保持原行为
3. 所有搜索入口统一传入与 Web UI 相同的阈值（0.45）
4. 测试覆盖短数字查询不再误匹配无关 ID，文本查询保持语义

## 反模式

- 为数字查询单独实现子串分支后再回退到阈值方案；直接复用 Web 行为更简单一致

## Related Sources

- [[sources/back-564-search-score-threshold]]
