---
title: BACK-517 修复里程碑展开/折叠按钮 i18n 字符串拼接反模式
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [source, bug, web-ui, milestones, i18n]
source_path: backlog/tasks/back-517 - Fix-i18n-string-fragmentation-in-milestone-expand-collapse-button.md
---

# BACK-517 修复里程碑展开/折叠按钮 i18n 字符串拼接反模式

修复一种 i18n 反模式：里程碑展开/折叠按钮通过在运行时拼接两个独立的 locale 片段来构建文本。

## 问题

```tsx
{isExpanded ? t.milestones.hideTasks : t.milestones.showTasks} {t.milestones.tasks}
```

这在每种语言下都产生了破碎或不自然的结果：
- `ja`: `"非表示 件のタスク"` — 完全不通（需要数字前缀）
- `zh-CN`: `"隐藏 个任务"` — 不自然的间距 + 量词
- `zh-TW`: `"隱藏 個任務"` — 同样的问题
- `en`: 偶然能工作，但仍然脆弱

## 修复

将 `showTasks` 和 `hideTasks` 改为包含名词的完整短语：
- `en`: `"Show tasks"` / `"Hide tasks"`
- `zh-CN`: `"显示任务"` / `"隐藏任务"`
- `zh-TW`: `"顯示任務"` / `"隱藏任務"`
- `ja`: `"タスクを表示"` / `"タスクを非表示"`

从所有 locale 文件中移除了不再使用的 `tasks` 键。

## 相关概念
- [[concepts/i18n-string-fragmentation]] — i18n 字符串拼接反模式
- [[concepts/web-ui-i18n]] — Web UI 国际化架构

## 相关来源
- [[sources/web-ui-i18n-task]] — BACK-478 i18n 原始实现
