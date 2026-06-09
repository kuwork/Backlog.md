---
title: 任务评论
created_date: '2026-06-09 01:35'
updated_date: '2026-06-09 01:35'
labels: [concept, feature, comments, markdown, cli, mcp, web-ui]
---

# 任务评论

Backlog.md 的任务评论是一种结构化、追加式的讨论与审阅机制，允许人类和 AI 代理在任务文件中记录问答、评审意见和上下文注释，而不污染实现备注或最终总结。

## 核心特性

- **有序条目**：每条评论带有稳定序号（`#1`, `#2`…）、创建时间戳和可选作者
- **Markdown 正文**：评论正文支持完整 Markdown 渲染，包括标题、列表、代码块等
- **统一视图**：CLI 纯文本输出、TUI 弹窗、Web UI 任务详情模态框、MCP `task_view` 均展示相同的评论列表
- **搜索参与**：评论文本被纳入任务搜索索引，可通过 `backlog search` 查找含相关评论的任务

## 持久化格式

评论存储在任务 Markdown 的 `## Comments` 章节中，位于 **Implementation Notes** 之后、**Final Summary** 之前：

```markdown
## Comments

<!-- COMMENTS:BEGIN -->

<!-- COMMENT:BEGIN index=1 date="2026-05-31 12:00" author="@sara" -->
建议将 UI 部分拆分到独立 PR。
<!-- COMMENT:END -->

<!-- COMMENT:BEGIN index=2 date="2026-06-01 09:30" -->
已确认后端接口无需变更。
<!-- COMMENT:END -->

<!-- COMMENTS:END -->
```

使用 `<!-- COMMENTS:BEGIN/END -->` 外层包裹和 `<!-- COMMENT:BEGIN/END -->` 个体分隔，确保评论体内的 Markdown 标题不会破坏章节解析。

## 使用方式

### CLI

```bash
backlog task edit back-10 --comment "建议将 UI 部分拆分到独立 PR" --comment-author @sara
```

### MCP

在 `task_edit` 调用中使用 `commentsAppend` 和 `commentAuthor` 字段。

### Web UI

在任务详情模态框的编辑模式下，Comments 区域底部出现作者输入框和评论文本框，点击 **Add comment** 提交。

## 校验规则

- 评论正文和作者均不能包含独立的 `---` 分隔行（保留为评论分隔符）
- 不能包含 `<!-- COMMENT:BEGIN -->` 或 `<!-- COMMENTS:BEGIN/END -->` 等保留标记
- 违反时会在 CLI、MCP 和 Web API 层面返回明确的验证错误

## 与其他字段的区别

| 字段 | 用途 | 典型场景 |
|------|------|---------|
| 评论 | 讨论、审阅、问答 | Code Review 意见、产品追问 |
| Implementation Notes | 执行进度与技术探索 | 调试过程、踩坑记录 |
| Final Summary | PR 式完成摘要 | 实现概述、测试覆盖、关键变更 |

## Related Sources
- [[sources/back-470-task-comments]] — BACK-470 父任务
- [[sources/back-470-1-core-task-comments]] — 核心模型与持久化
- [[sources/back-470-2-cli-mcp-task-comments]] — CLI 与 MCP 暴露
- [[sources/back-470-3-server-web-task-comments]] — Server API 与 Web UI
- [[sources/back-470-4-tui-docs-task-comments]] — TUI 渲染与公共文档
