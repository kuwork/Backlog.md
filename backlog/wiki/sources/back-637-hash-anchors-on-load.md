---
title: BACK-637 - 保持文档内锚点加载与归一化可用
labels: [source, web-ui, anchors, markdown]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-637 - Keep-in-document-anchors-working-on-load-reload-and-slug-normalization.md
---

# BACK-637 - 保持文档内锚点加载与归一化可用

BACK-536 让文档内 markdown 哈希链接点击时可滚动，但解析出的 URL 只对那一次点击有用——重开或分享都落在页首。本任务先让哈希链接在加载时生效，再修两个后续问题：侧边栏刷新的滚动重置，以及 slug 归一化丢失锚点。

- 新 `src/web/utils/hash-target.ts`：`findHeadingByHashTarget` 从 MermaidMarkdown 抽出，加上 `scrollToHeading()` / `scrollToHashTarget()` 与此前重复的 `HEADING_PREFIX_ID_REGEX`——点击与加载路径共享一份实现
- 新 `src/web/hooks/useHashScroll.ts`，挂载于 `AppContent`：读取 `location.hash`，标题已渲染则立即滚动，否则用 `window.MutationObserver` 监视（3 秒上限），因为内容异步到达；手写的 `#A1` 前缀与 github-slugger slug 都能解析
- 后续 1（侧边栏刷新重置滚动）：`DocumentationDetail` 之前在 docs 数组每次恒等变化时都重载，卸载 markdown 使滚动容器钳回顶部；改用 DecisionDetail 已用的 `handledRouteIdRef` 守卫——加载器现在只对真实的路由 id 变化反应
- 该守卫的行为变化：打开期间不再从磁盘静默重载内容，同时阻止 websocket 刷新时编辑模式被关、进行中的编辑被覆盖
- 后续 2（slug 归一化丢锚点）：DocumentationDetail 与 DecisionDetail 都把裸 id URL 归一化为 slug 形式，经丢弃哈希的 replace 导航；两者现在把 `location.hash` 带进替换
- 环境注记：`MutationObserver` 在 Bun 测试中只在 `window` 上（不在 globalThis）；JSX 属性字符串不处理转义，测试 markdown 必须是 JS 字符串常量；Biome `useExhaustiveDependencies` 加 React Router 的哈希清除使该 hook 只依赖 hash
- 测试：新 `hash-scroll.test.tsx`（5 用例）、`web-documentation-refresh.test.tsx`、`web-decision-hash-scroll.test.tsx`；200+ Web 测试通过

## 验收标准

- 重开或分享哈希 URL 在标题进入 DOM 后滚动到它；人工前缀与 slugger slug 都能解析
- 刷新 docs/decisions 数组既不重载打开的文档也不丢滚动位置；切换 id 仍加载
- 裸 id URL 在文档与决策两侧都经 slug 归一化保留哈希
- 点击行为与无哈希路由不变

## Related Concepts

- [[concepts/markdown-pipeline]] — 锚点解析共享的标题 id 生成
- [[concepts/browser-loading]] — 抵御父组件刷新风暴的 effect 守卫模式

## Related Sources

- [[sources/back-536-in-document-hash-links]] — 本任务扩展到加载时机的原始点击态哈希链接行为
- [[sources/back-598-doc-view-disambiguate-path-title-slug]] — 后续 2 涉及的 slug URL 归一化
- [[sources/back-639-document-fingerprint-reload]] — 用正文指纹细化同一刷新守卫
- [[sources/back-638-header-outline-toc]] — 在此锚点设施上构建的页头目录
