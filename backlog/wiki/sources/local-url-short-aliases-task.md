---
title: BACK-511 Markdown 本地 URL 短别名渲染
labels: [source, feature, web-ui, markdown]
created_date: '2026-06-05 15:19'
updated_date: '2026-06-05 15:19'
source_path: backlog/tasks/back-511 - Render-local-URLs-as-short-aliases-in-markdown-content.md
---

# BACK-511 Markdown 本地 URL 短别名渲染

将 Markdown 内容中的同源本地 URL 渲染为可读短别名，提升可读性同时保持点击导航能力。

## 别名规则

| URL 模式 | 别名 |
|---|---|
| `/documentation/:id/:title` | `DOC#:id` |
| `/decisions/:id/:title` | `Decisions#:id` |
| `/task/:id/:title` | `TASK#:id` |
| `/draft/:id/:title` | `DRAFT#:id` |
| `/wiki/:path` | `WIKI#:path` |

- 仅转换同源 URL，外部 URL 保持不变
- 标题 slug 为装饰性，不影响别名生成
- 任务 ID 解析保持前缀无关

## 实现

- `MermaidMarkdown.tsx` 新增 `parseLocalUrl()`，返回 `{ type, alias }`
- 新增 `onDocClick`、`onDecisionClick`、`onWikiClick`、`onDraftClick` props
- 所有消费者（TaskDetailsModal、DocumentationDetail、DecisionDetail、WikiDetail、FilePreviewModal）统一接入

## 相关决策
- 添加 `#` 前缀守卫，防止 heading anchor 被误识别为本地 URL

## Related Concepts
- [[concepts/web-ui-features]] — Web UI Markdown 渲染
- [[concepts/markdown-pipeline]] — Markdown 解析流水线
