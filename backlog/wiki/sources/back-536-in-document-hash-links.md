---
title: BACK-536 修复文档内 markdown 锚点链接
labels: [source, web-ui, markdown, bug]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-536 - Fix-in-document-markdown-hash-links.md
---

# BACK-536 修复文档内 markdown 锚点链接

修复文档内标题链接（`[link](#heading)`）跳出当前视图的问题，并统一标题 ID 生成与上游一致。

## 问题

渲染的 markdown 使用 `<base href="/">`，导致文档内标题链接跳到应用根而非当前文档上下文；标题 ID 生成与上游（github-slugger）不一致。

## 解决方案

- `MermaidMarkdown` 的 LinkComponent 拦截以 `#` 开头的 href，解析为当前 route+query+hash；click 处理器平滑滚动、`history.pushState` 更新 URL、目标缺失时回退整页跳转
- 用 `rehypeHeadingMetadata` 插件替换仅前缀的标题 ID 插件，为所有标题生成 github-slugger ID，使 `#A1`、`#A1: Section Title`、`<#A1: Section Title>` 人类可读锚点仍可解析（含百分号解码与前缀 starts-with 匹配）
- 新增 `normalizeMarkdownHashLinks`（remark/unified）接入文档/决策保存路径，把人类可读 TOC 锚点改写为 github-slugger slug

## 实现位置

- `src/web/components/MermaidMarkdown.tsx`、`DocumentationDetail.tsx`、`DecisionDetail.tsx`
- `src/markdown/hash-links.ts`
- 指南与迁移报告 doc-5 TOC

## 测试

`src/test/mermaid-markdown.test.tsx`（`#A1`、`<#A1: Section Title (details)>` 解析）、`src/test/hash-links.test.ts`。

## Related Concepts
- [[concepts/markdown-pipeline]] — 标题 ID 与锚点
- [[concepts/web-ui-features]] — 文档渲染

## Related Sources
- [[sources/back-536-in-document-hash-links]] — 同主题（上游映射）
