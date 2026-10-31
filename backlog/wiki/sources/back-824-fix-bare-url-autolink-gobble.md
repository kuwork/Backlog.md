---
title: BACK-824 - 修复裸 URL 紧贴中文被 autolink 吞掉
labels: [source, web, markdown]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-824 - Fix-bare-URL-autolink-gobble-in-markdown-notes.md
---

# BACK-824 - 修复裸 URL 紧贴中文被 autolink 吞掉

任何经 `MermaidMarkdown` 渲染的笔记与 Markdown，若裸 `http(s)://` URL 紧贴 CJK 正文或全角标点，会渲染成一条错误超长链接——URL 把后续文字一路吞到下一个 `[`，既产出错误链接，又把紧跟的 `[text](dest)` 链接的 `[` 吃掉变成破损字面文本。

## 根因

GFM `autolink-literal` 对裸 URL 贪婪链接。URL 紧贴 CJK 文字 / 全角标点时，会一直吞到下一个 `[`，形成一条巨型 `<a>`。这也是早先的 `:range` 冒号修复单独看不出效果的原因——冒号修复只在 autolink 吞食被移除后才生效，因为吞食把它的症状掩盖了。

## 改了什么

新增 `linkifyBareUrls(source)`（`src/web/components/MermaidMarkdown.tsx`）：预处理把裸 URL 包成显式 `[url](url)`。边界规则：URL 体在遇到空白、`<>` `]`、引号/反引号、CJK 汉字（U+4E00–U+9FFF）、全角/CJK 标点（U+3000–U+303F、U+FF01–U+FF5E）处硬截断，正文永不被吞。负向回顾 `(?<![(\s])` 跳过已位于链接目标 `](…)` 内的 URL，复用 `getMarkdownCodeRanges` 保护代码块/行内代码。

管线顺序：`linkifyBareUrls(source)` → `encodeLocalFileLinkDestinations(processed)` → `sanitizeRawHtmlAngleBrackets(encoded, …)`（非 wiki）/ `prepareWikiMarkdown(processed, …)`（wiki），两条路径都得到相同处理。

## 验证

`bunx tsc --noEmit` 干净；`bun test src/test/mermaid-markdown.test.tsx` 63 → 64（新增回归用例：裸 URL 紧贴 CJK 后接 `[text](dest)`）。完整 unified 管线（remark-parse + remark-gfm + remark-rehype + rehype-sanitize + SAFE_HTML_SCHEMA）验证渲染正确。

## Related Concepts

- [[concepts/markdown-pipeline]] — 渲染与序列化流水线，裸 URL 预处理在其中的位置
- [[concepts/file-preview]] — 同源渲染树里的文件预览

## Related Sources

- [[sources/back-821-raw-html-table-doc-preview]] — 同一渲染链上的原始 HTML 表格修复
