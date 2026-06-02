---
title: 统计模块健壮性模式（大小写敏感匹配与日期回退）
labels: [execution, statistics, bug-fix]
created_date: 2026-05-26 23:42
updated_date: 2026-05-26 23:42
---

# 统计模块健壮性模式（大小写敏感匹配与日期回退）

从 BACK-490 提取的跨任务可复用知识：统计与过滤逻辑中，ID 比较和日期回退是常见陷阱。

## 场景 1：阻塞任务检测的大小写敏感陷阱

`core.createTask` 在存储时将任务 ID 规范化为大写，但依赖数组保留原始大小写。直接字符串比较会导致 `task-1` 与 `TASK-1` 被视为不同任务。

### 修复模式

```typescript
// 错误：直接字符串比较
const isBlocked = task.dependencies?.some(
  depId => !completedIds.includes(depId) // task-1 !== TASK-1
);

// 正确：使用 ID 比较工具
const isBlocked = task.dependencies?.some(
  depId => !completedIds.some(id => taskIdsEqual(id, depId))
);
```

**原则**：任何涉及任务 ID 比较的代码路径，优先使用 `taskIdsEqual()` 而非 `===`。

## 场景 2：recentlyUpdated 回退到 createdDate

任务在创建后若从未被编辑，可能缺少 `updatedDate`。统计「最近更新」时若严格依赖 `updatedDate`，会遗漏大量新建任务。

### 修复模式

```typescript
const recentlyUpdated = tasks.filter(t => {
  const date = t.updatedDate || t.createdDate;
  return isWithinDays(date, 7);
});
```

**原则**：`updatedDate` 存在时优先使用，否则回退到 `createdDate`。此模式适用于所有「最近活动」类统计。

## BACK-490 中的应用

| 文件 | 变更 |
|---|---|
| `src/core/statistics.ts` | `blockedTasks` 检测改用 `taskIdsEqual()`；`recentlyUpdated` 回退到 `createdDate` |
| `src/test/stats-command.test.ts` | 新增测试验证大小写混合 ID 的阻塞检测 |

## Related Sources
- [[sources/back-490-overview-command-task]] — BACK-490 原始实现
