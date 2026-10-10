---
title: BACK-672 - 侧边栏 wiki 树标题与文件名排序开关
labels: [source, web-ui, wiki, sidebar, sorting]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-672 - Add-title-and-file-name-sort-toggles-to-the-web-sidebar-wiki-tree.md
---

# BACK-672 - 侧边栏 wiki 树标题与文件名排序开关

侧边栏 wiki 树渲染服务端原始文件系统顺序且总是打印文件名，尽管每个 wiki 页都有 frontmatter `title`。本任务把 BACK-667 文档树排序开关移植到 wiki 小节——并扩展完全不带标题的树负载。

- 先补数据缺口：`GET /api/wiki/tree` 只返回 `{name, path, type}`；`handleGetWikiTree` 现在经纯辅助函数 `withWikiPageTitles` 从 content store 的内存 wiki 语料合并 `WikiTreeNode.title`（无逐页磁盘重读），store 未就绪或页面未知时回退文件名
- `wikiPageTitle` 与搜索语料和页面头部同一规则：非空 frontmatter `title`，否则无目录无扩展名的文件名
- 与文档树不同，打印标签跟随所选列：`wikiNodeLabel(node, column)` 在 Title 模式返回标题、File name 模式返回文件名（无 `.md`），列表总是打印它所排序的字段；`WikiTreeItem` 因此接收当前列
- `sortWikiTree` 镜像 `sortDocsTree`：文件夹永远按名称方向在前，页面跟随所选列，每层独立排序，输入树永不被改动；比较用 `localeCompare(..., { numeric: true, sensitivity: "base" })`
- 排序开关标记从 `renderDocsSortButton` 提取为共享 `renderSortButton`，两个小节渲染同一控件；`DocsSortDirection` 改名共享 `SortDirection`，连带改名含类型名的状态 setter（在存活前抓到）
- 头部布局修复经实测：wiki 头部较长的标签在默认 320px 侧边栏换行；开关加 `whitespace-nowrap`、三个小节头部加 `flex-wrap gap-y-1`，操作簇可落到第二行
- 测试：`wiki-titles.test.ts`（7）、`web-side-navigation-wiki-sort.test.tsx`（7）、`server-wiki-tree-endpoint.test.ts`（2）；11 个回退探针红；实测显示 360 个文件全带标题

## 验收标准

- 树负载每个文件节点带 frontmatter 的 `title`，文件名兜底；文件夹无标题
- wiki 头部在新建页按钮左侧渲染 Title/File name 开关，标题升序默认
- 行标签跟随所选列；文件夹在每个层级按名称方向在前
- 点击未激活列从升序重启，点击激活列翻转；无语料页在标题模式打印文件名
- 四种语言带标签/tooltip；开关在 320px 侧边栏保持单行

## Related Concepts
- [[concepts/web-ui-features]] — 与文档小节共享的侧边栏树约定
- [[concepts/wikilink]] — 树浮出的 wiki 页身份与标题
- [[concepts/web-server]] — 负载扩展的 `/api/wiki/tree` 端点

## Related Sources
- [[sources/back-667-sidebar-docs-sort-toggles]] — 本任务移植并经共享 `renderSortButton` 推广的模式（批次兄弟）
- [[sources/back-674-decisions-sort-toggles]] — 补齐三小节排序覆盖的后续（批次兄弟）
- [[sources/wiki-web-ui-task]] — 树所属的 wiki Web UI
