---
title: BACK-476 行内代码 HTML 实体转义修复
labels: [source]
source_path: backlog/tasks/back-208 - Add-paste-as-markdown-support-in-Web-UI.md
created_date: 2026-05-13 23:08
---


# BACK-476 行内代码 HTML 实体转义修复

**状态**: Done | **标签**: web-ui, bug, wiki, markdown | **优先级**: medium

修复 `MermaidMarkdown.tsx` 中 `sanitizeMarkdownSource` 对行内代码和围栏代码块内 `<` 符号的过度转义问题。

## 问题

`sanitizeMarkdownSource` 将 `<` 转义为 `&lt;` 以防止 HTML-like 标签被 Markdown 渲染器解析。但此前未排除代码区域，导致：

- 行内代码 `` `<id>` `` 被渲染为 `&lt;id&gt;`
- 围栏代码块内的 `<` 同样被双重编码

影响范围：wiki 页面、任务详情、文档、决策、文件预览等所有使用 `MermaidMarkdown` 的视图。

## 修复

更新 `sanitizeMarkdownSource` 以收集**受保护范围**：

1. **围栏代码块**：`/```[\s\S]*?```/g`
2. **行内代码**：``/`[^`\n]+`/g``

在 `<` 替换时检查匹配偏移是否落在受保护范围内，若是则保留原始 `<`。

URI/邮箱自动链接豁免（`<mailto:...>`、`<user@example.com>`）对代码区外的匹配继续生效。

## Related Concepts
- [[concepts/markdown-pipeline]] — Markdown 解析与序列化流水线
- [[concepts/web-ui-features]] — Web UI 功能总览

## Related Sources
- [[sources/paste-as-markdown-task]] — BACK-208 粘贴为 Markdown 支持
- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 区域
