---
title: TOC 条目读渲染后 DOM，而非解析 markdown 源
description: BACK-638 大纲条目来自渲染产物的 heading id 与 data-heading-text
labels: [decision, web-ui, content-viewer]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# TOC 条目读渲染后 DOM，而非解析 markdown 源

## Context

阅读页大纲需要与页内锚点一一对应的条目。renderer 会为重复标题加后缀、为 CJK 标题生成特殊 id——任何在 markdown 源上重算锚点的做法都必须精确复制 renderer 的 slug 算法。

## Decision

TOC 条目取自渲染后的 DOM（heading id + `data-heading-text`），因此重复标题后缀与 CJK 标题**总是**与 renderer 的锚点一致；嵌套按"最近的更浅前驱"挂接，因为标题层级可能跳级。页面通过 `usePageToc(contentRef, content)` 发布标题；编辑中发布 `null`，按钮自然隐藏。滚动监听（scrollspy）只在面板打开时运行，避免页面滚动重渲染头部。

## Rejected alternatives

- 解析 markdown 源重建 slug 算法——renderer 升级或边缘 case（重复、CJK、HTML 标题）时必然失配
- 常驻右侧栏——占走正文列宽，未提交即被移除；浮动面板保持正文全宽

## Related Sources

- [[sources/back-638-header-outline-toc]] — 本决策的落地
- [[sources/back-637-hash-anchors-on-load]] — 锚点基础设施来源
- [[sources/back-536-in-document-hash-links]] — 共享的 activateHashTarget 行为
