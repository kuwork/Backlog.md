---
title: BACK-821 - 文档预览恢复原始 HTML 表格并统一行高
labels: [source, web-ui, markdown]
created_date: 2026-10-28 15:15
updated_date: 2026-10-28 15:15
source_path: backlog/tasks/back-821 - Fix-HTML-table-rendering-and-row-height-in-doc-preview.md
---

# BACK-821 - 文档预览恢复原始 HTML 表格并统一行高

文档预览里的原始 HTML `<table>` 被渲染成字面量文本。根因是 BACK-377 的缓解措施：`sanitizeMarkdownSource` / `sanitizeWithRanges` 把每个 `<letter` 一律转义为 `&lt;`——为了挡住 TypeScript 泛型字符串（`Array<string>`）被当成标签，代价是所有 HTML 都不再是 HTML。改回「全量转义」会重开 BACK-377，于是换成**白名单 + sanitizer 双保险**。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/web/utils/wikiLinks.ts` | 全量转义换成**白名单**：只转义类型字符串形状的尖括号，BACK-377 的保护保留 |
| `src/web/components/MermaidMarkdown.tsx` | 接 `rehype-raw` + `rehype-sanitize`（table-aware schema）：`script`/`onerror` 与危险 `href` 被剥，表格与常规格式标签放行 |
| `src/web/styles/source.css` | `.wmde-markdown table p { margin: 0 }` |
| `src/test/mermaid-markdown.test.tsx` | 表格渲染与 XSS 剥离用例（63/63 通过） |

行高问题的根因与渲染无关：`.wmde-markdown p` 有 `margin-bottom: 10px`，而原始 HTML 表格的每个单元格被包进 `<p>`，GFM 管道表格的单元格不会——同一张表两种行高。CSS 一条规则拉平，不动 DOM 结构。

## 留下的边界

- 原始 HTML 表格里如果单元格自带 `<p>` 包裹，行高仍会比手写紧凑表格高；这是结构与样式的耦合，不是渲染失败。
- sanitizer schema 是**允许列表**：新增需要的标签要在 schema 里显式加入，不会被 rehype-raw 自动放开。

## Related Concepts

- [[concepts/markdown-pipeline]] — 渲染安全策略从「全量转义」改为「白名单 + sanitize」
- [[concepts/file-preview]] — 文档/文件预览的渲染入口
- [[concepts/query-chart-binding]] — 同一渲染树里的图表路由，共用 sanitize 前的源码

## Related Sources

- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — 同一处 `sanitizeMarkdownSource` 的 stray `<` 转义，BACK-377 修复的着陆点
