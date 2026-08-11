---
title: BACK-531 短本地链接支持行区间后缀
labels: [source, web-ui, markdown]
created_date: '2026-08-09 00:00'
updated_date: '2026-08-09 00:00'
source_path: backlog/tasks/back-531 - Support-line-range-suffix-on-short-local-links.md
---

# BACK-531 短本地链接支持行区间后缀

渲染后的 Markdown 短本地 URL（如 `/documentation/5`、`/task/42`）现在可附加 `:N-M` 或 `:N` 行区间后缀，定位到指定行。

## 问题

短本地链接无法附加行区间后缀来定位到指定行。

## 解决方案

扩展 `MermaidMarkdown` 的 `parseLocalUrl` 识别尾部 `:N`/`:N-M` 区间并追加到别名（如 `DOC#5:16-27`）。有自定义 Markdown 标签时保留标签，否则用带区间的系统别名。带区间链接通过 `preview://` 打开 FilePreviewModal 并按行区间展示内容。新增服务端 `/api/preview` 与 `fetchPreview` 辅助函数。相对项目文件路径（如 `backlog/docs/...`）不会被误判为短链接。

## 实现位置

- `src/web/components/MermaidMarkdown.tsx`、`DocumentationDetail.tsx`、`TaskDetailsModal.tsx`、`FilePreviewModal.tsx`
- `src/web/lib/api.ts`
- `src/server/index.ts`

## 测试

`src/test/mermaid-markdown.test.tsx`（35 项）、`src/test/server-preview-endpoint.test.ts`。

## Related Concepts
- [[concepts/markdown-pipeline]] — 本地 URL 解析
- [[concepts/web-ui-features]] — 文件预览
- [[concepts/file-preview]] — 本地文件预览

## Related Sources
- [[sources/local-url-short-aliases-task]] — 本地 URL 短别名
