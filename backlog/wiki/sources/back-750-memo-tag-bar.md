---
title: BACK-750 - memo 标签历史条与 #topic# 语法
labels: [source, enhancement, web-ui, memos]
created_date: 2026-10-07 22:50
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-750 - Memo-tag-bar-single-line-topic-syntax.md
---

# BACK-750 - memo 标签历史条与 #topic# 语法

重构 memos 标签 UI 为可折叠多行「标签历史」条（flex-wrap 流，折叠时裁到一行、激活标签置前、chevron + max-height 动画），外加每张 memo 卡片底部可点击的标签行（镜像过滤高亮）；后续把条头整行去掉，使整体成为单行（切换按钮内联在 chip 流末尾），pill 只显示裸标签不带 `#`。

随 BACK-751 合并进来，正文语法统一为闭合 `#topic#` 形式（无迁移、frontmatter `tags` 不动），由 composer 自动补全面板与 overlay `topic` token 支撑，闭合 topic 渲染为一整段而非孤立彩色井号。最后把激活过滤带入钉板便签弹窗、正文内联 `#topic#` chip（激活时蓝色）、以及烘焙便签墨迹 chip（常态淡色、激活浅蓝）。

## 实现要点

- **标签条**：`MemosPage.tsx` 移除 `TagFilter` 下拉，新增 `TagHistory`（多行流、折叠单行、active-first 重排、max-height + chevron 动画）；去掉条头行
- **卡片行**：`MemoCard.tsx` 新增 `activeTags?` 与底部可点击标签行（裸标签、case-insensitive 高亮）
- **话题语法**：`extractInlineTags` 与 `INLINE_TAG_PATTERN` 改 `/#([^\s#`]+)#/g`，渲染 `match[0]`；`# heading` 与 `PR #268` 不再被误判为话题
- **composer overlay**：`topic-highlight.ts` 在两个 refractor 实例的 `title` 之前注入 `topic` token，`.topic-aware` 作用域隔离；`useTopicAutocomplete`/`TopicAutocompleteMenu` 复用实体补全的 caret 定位

## 验证

涉及套件 99 pass / 0 fail；memo-board 30 pass（run 拆分/放置/激活标记/话题整段）；渲染 `MermaidMarkdown`/`MemoCard` 的套件 260 pass

## Related Concepts
- [[concepts/memos]] — Memos 子系统与标签语义
- [[concepts/memo-board]] — 钉板（激活过滤与烘焙 chip 的宿主）
- [[concepts/markdown-pipeline]] — 内联标签/话题的渲染管线

## Related Sources
- [[sources/back-731-memos-feed-page]] — 信息流卡片的标签菜单起点
- [[sources/back-746-memo-board-webgl-pinboard]] — 钉板视图，激活 chip 落在其便签墨迹上
- [[sources/back-751-auto-link-entity-id-ranges]] — 合并进本任务的话题语法与补全（其 ticket 已归档）
