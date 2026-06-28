---
title: Wikilink 别名与属性块使用轻量正则流水线
decision_date: '2026-06-27'
labels:
  - decision
  - wiki
  - wikilink
  - frontend
  - regex
created_date: '2026-06-27 21:00'
updated_date: '2026-06-27 21:00'
---

# Wikilink 别名与属性块使用轻量正则流水线

**背景**: BACK-523 需要让 wiki wikilink 支持富文本别名和 markdown-it-attrs 属性块。

**决定**: 使用轻量级正则流水线处理 `[[...]]` 转换，而不是引入完整的 remark/rehype AST 处理流程。

**理由**:
- `react-markdown` 会剥离或重新包装自定义元素，导致与 `MermaidMarkdown` 现有 `LinkComponent` 集成困难
- 正则流水线足以覆盖别名、属性块和媒体 wikilink 的语法需求
- 保持输出为原始 `<a>` / `<img>` / `<video>` / `<audio>` 标签，可直接由现有组件渲染
- 避免新增重型依赖，减少构建体积与复杂度

**权衡**:
- 正则方案对嵌套/复杂语法的容错性低于完整 AST 解析；当前语法范围有限，风险可控
- 未来若 wikilink 语法大幅扩展，可能需要迁移到基于解析器的方法

**相关实现**:
- `src/web/utils/wikiLinks.ts` 中的 `prepareWikiMarkdown`、`parseWikilinkAttributes`、`buildWikilinkMediaHtml`
- `src/web/components/MermaidMarkdown.tsx` 的 `wikilinkBasePath` prop 与组件注册

## Related Sources
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — BACK-523 实现任务
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — BACK-524 媒体 wikilink

## Related Concepts
- [[concepts/wikilink]] — Wiki 交叉引用语法与行为
- [[concepts/markdown-pipeline]] — Markdown 解析与渲染安全
