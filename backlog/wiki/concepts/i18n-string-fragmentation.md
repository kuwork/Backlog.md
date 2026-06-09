---
title: i18n 字符串拼接反模式（i18n String Fragmentation）
created_date: '2026-06-09 00:40'
updated_date: '2026-06-09 00:40'
labels: [concept, i18n, anti-pattern, web-ui]
---

# i18n 字符串拼接反模式（i18n String Fragmentation）

一种 i18n 反模式：完整的 UI 短语被拆分成部分片段，在运行时拼接，导致非英语 locale 产生破碎或不自然的翻译。

## 示例

```tsx
{isExpanded ? t.milestones.hideTasks : t.milestones.showTasks} {t.milestones.tasks}
```

其中 `hideTasks`/`showTasks` 是动词片段，`tasks` 是名词片段。

## 按 Locale 拆解

| Locale | 片段 1 | 片段 2 | 结果 | 问题 |
|---|---|---|---|---|
| en | `"Hide"` | `"tasks"` | `"Hide tasks"` | 偶然能工作，仍然脆弱 |
| zh-CN | `"隐藏"` | `"个任务"` | `"隐藏 个任务"` | 不自然的间距 + 量词 |
| zh-TW | `"隱藏"` | `"個任務"` | `"隱藏 個任務"` | 同样的问题 |
| ja | `"非表示"` | `"件のタスク"` | `"非表示 件のタスク"` | 完全不通 — 需要数字前缀 |

## 失败原因

不同语言有不同的词序、间距、量词和语法惯例。当句子被拆分成必须在运行时拼接的片段时，译者无法产出自然的结果。

## 正确做法

将每个 locale 键做成**包含名词的完整短语**：
- `en`: `"Show tasks"` / `"Hide tasks"`
- `zh-CN`: `"显示任务"` / `"隐藏任务"`
- `zh-TW`: `"顯示任務"` / `"隱藏任務"`
- `ja`: `"タスクを表示"` / `"タスクを非表示"`

## 相关概念
- [[concepts/web-ui-i18n]] — Web UI 国际化架构

## 相关来源
- [[sources/back-517-i18n-fragmentation-fix]] — BACK-517 修复实现
