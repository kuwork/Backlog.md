---
title: BACK-753 - 文档/决策页 Referenced by 反向链接
labels: [source, web-ui]
created_date: 2026-10-07 22:50
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-753 - Referenced-by-backlinks-on-document-and-decision-pages.md
---

# BACK-753 - 文档/决策页 Referenced by 反向链接

BACK-239 要两件事：在任务正文把 `doc-<n>`/`decision-<n>` 渲染为链接（已由 BACK-614、BACK-751 交付），以及反方向——在文档/决策页显示「Referenced by」任务列表。仅剩反方向。

完全在客户端实现：Web 应用已把全部任务载入内存，扫描其正文引用、建反向索引、在文档/决策详情页渲染列表。无新 API、无磁盘写入、自动链接的引用本身无标题（BACK-239 AC4 经决策移除）。

## 实现要点

- **反向索引**：`buildBacklinkIndex` 汇总每任务两处扫描源——正文（剥离代码，故代码块引用不计）与 `documentation:` 前字段（逐条扫描）；`scanEntityReferences` 复用自动链接器的边界规则，并扩展多 ID token：区间 `doc-10~12`/全端点 `doc-10~doc-12` 与斜杠列表 `doc-10/11/12` 各在跨度内每个实体产生一条反向链接（整体 token 消费完再续扫，避免嵌套 ID 重复计数）
- **渲染**：`BacklinkList` 渲染单行内联——`Referenced by: N tasks (BACK-1/BACK-2/...)`，标签与计数静态灰字，仅括号内 id 列表为可点击触发器（复用 BACK-751 的 `EntityIdRangeDropdown`，同链接色、portal 下拉显示 `ID · 标题`、in-app 导航、点击前显示标题）；引用多次折叠为一行、计数并入下拉标题（`Title (3×)`）；空时返回 `null` 不占第三行
- **布局**：文档页 4 列元数据条变 2×2 网格、反向链接作第三行；决策页保持 4 列并追加为额外一行
- **i18n**：四语种 `referencedBy`/`referenceCount`，移除废弃 `referencedByLine`

## 验证

`bun test` 43 pass（backlinks + task-id-links + `BacklinkList` 集成，挂载下拉断言 id/标题行）；`tsc`/`biome` 在改动文件干净

## Related Concepts
- [[concepts/wikilink]] — 自动链接与反向链接的双向语义
- [[concepts/markdown-pipeline]] — 引用扫描与边界规则

## Related Sources
- [[sources/back-614-entity-id-auto-link-autocomplete]] — 正向自动链接（本文为其反方向）
- [[sources/back-751-auto-link-entity-id-ranges]] — 复用同一多 ID token 解析器
- [[sources/back-739-toc-drawer-floating-mode]] — 同期 Web UI 文档/决策页改进
