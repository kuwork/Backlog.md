---
title: 里程碑更新重构模式（rename → update + rawContent 保留）
labels: [execution, milestone, refactoring]
created_date: 2026-05-25 23:45
updated_date: 2026-05-25 23:45
---

# 里程碑更新重构模式（rename → update + rawContent 保留）

从 BACK-401 提取的跨任务可复用知识：当方法职责从「单一字段修改」扩展到「多字段更新」时，需要同步修复隐藏的逻辑短路问题。

## 场景

原始方法 `renameMilestone(id, newTitle)` 只负责重命名。当需要支持同时更新描述和日期字段时，直接扩展参数列表会导致一个隐蔽 bug：

```typescript
// 旧实现：仅比较标题
if (existingTitle === newTitle) return "No changes made";
// 如果只改日期，会在这里短路返回，日期更新被跳过
```

## 标准重构步骤

1. **重命名方法**以反映真实职责：`renameXxx` → `updateXxx`
2. **调整短路条件**：从「单一字段未变」改为「所有相关字段均未变」
3. **分离「是否需要重写关联任务」的判断**：标题未变时，跳过 `updateTasks()` 文件重写，但继续执行其他字段更新
4. **序列化层同步**：如果旧序列化逻辑硬编码了固定章节（如只写 `## Description`），需改为保留 `rawContent`，避免扩展字段时丢失用户自定义章节

## BACK-401 中的应用

| 层级 | 变更 |
|---|---|
| FileSystem | `renameMilestone` → `updateMilestone`，接受 `title`、`description`、`dueDate`、`plannedStart`、`plannedEnd` |
| Core | `updateMilestone` 判断「标题 + 日期均未变」才短路；标题未变时跳过 `updateTasks` |
| MCP Handlers | `editMilestone`（原 `renameMilestone`）不再因仅日期变化而返回 "No changes made" |
| Serializer | `serializeMilestone` 从硬编码 `## Description` 改为保留 `rawContent`，支持 `## Notes` 等自定义章节 |

## Related Sources
- [[sources/due-date-fields-task]] — BACK-401 原始实现
