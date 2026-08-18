---
title: BACK-523 Wiki wikilink 别名与 markdown-it-attrs 支持
labels:
  - source
  - wiki
  - feature
  - frontend
  - wikilink
source_path: backlog/tasks/back-523 - Wiki-wikilinks-alias-support-with-Markdown-HTML-labels-and-markdown-it-attrs.md
created_date: '2026-06-27 21:00'
updated_date: '2026-08-17 23:00'
---

# BACK-523 Wiki wikilink 别名与 markdown-it-attrs 支持

**状态**: Done | **标签**: wiki, feature, frontend | **负责人**: kimi

将 wiki wikilink 从仅支持 `[[path/to/page]]` 的基础形式，扩展到支持富文本别名与属性块注解。

## 新增语法

### 别名语法

`[[target|alias]]` 中的 `alias` 支持 Markdown 行内格式：

- 行内代码：`` [[concepts/wikilink|```code```]] ``
- 粗体 / 斜体 / 删除线
- 任意行内 HTML，例如 `<span style="color: red;">...</span>`

### 属性块语法

markdown-it-attrs 风格的属性块：

- `[[target]]{style="color: red;"}`
- `[[target]]{.some-class #some-id}`
- 任意 `key="value"` 对

## 实现要点

1. **新建 `src/web/utils/wikiLinks.ts`**
   - `resolveWikiPath`：解析目标路径，处理 `wiki/` / `wiki_output/` 前缀，防止重复拼接
   - `prepareWikiMarkdown`：将 `[[...]]` 转换为原始 `<a data-wikilink="true">` 标签
   - 属性解析：支持 `.class`、`#id`、`style`、`key="value"`，属性值 HTML 转义
   - 对 stray `<` 进行转义，避免 React 崩溃（BACK-377 类似问题）

2. **扩展 `MermaidMarkdown.tsx`**
   - 新增可选 `wikilinkBasePath` prop
   - 保持本地 URL 短别名行为（`/wiki/...`）
   - wikilink 通过现有 `LinkComponent` 渲染

3. **应用到非 wiki 上下文**
   - `TaskDetailsModal`、`DocumentationDetail`、`DecisionDetail` 传入 `wikilinkBasePath="index.md"`
   - 使任务、文档、决策正文中的 wikilink 也能被正确解析

4. **未解析链接降级**
   - 路径越出项目根等非法情况渲染为 `<del>alias</del>`

## 验证

- 新增/扩展 `src/test/wiki-links.test.ts`、`src/test/mermaid-markdown.test.tsx`、`src/test/resolve-wiki-path.test.ts`
- 44 个相关测试通过
- `bunx tsc --noEmit` 与 `bun run check .` 通过

## Related Concepts

- [[concepts/wikilink]] — Wiki 交叉引用语法与行为
- [[concepts/markdown-pipeline]] — Markdown 解析、渲染安全与 HTML 转义
- [[concepts/web-ui-features]] — Web UI 渲染能力总览

## Related Sources

- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — BACK-524 媒体 wikilink
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — BACK-525 同步 skill 与 CLI 文档
