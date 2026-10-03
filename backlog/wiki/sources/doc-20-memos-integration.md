---
title: doc-20 - 快速笔记：Memos 集成
labels:
  - source
  - web-ui
  - design
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
---

# doc-20 快速笔记：Memos 集成

快速笔记（设计输入稿，非正式 PRD），目标是把 Memos 的「极简捕获 + 日历」能力以**最轻改动**搬进 Backlog.md：新增与 `document/decision` 同构的轻实体 `memo`，存储/API/搜索/渲染全部挂既有管线，不碰 Kuzu 图谱核心、状态机与既有实体读写契约。

核心设计：`backlog/memos/*.md` 独立目录（不复用强制 `doc-NNN` 的 doc 通道），ID 为 `YYYYMMDD-N`（当日最大号 +1，无锁），一般无标题（卡片标题由正文首行派生）；新核心模块 `src/core/memos.ts` 约 60 行，复用 `file-system/operations.ts` 与 `markdown/frontmatter.ts`，不接 content-store 重量级体系。`/api/memos*` 路由镜像 `/api/docs`；`/memos` 单页双模式——信息流（Quick Capture 复用 `PasteAwareMDEditor`、时间倒序、IntersectionObserver 无限滚动）⇄ 日历（月历热力、点日就地展开当日面板、共享 `selectedDate`），不引第三方日历库。

杀手锏是知识网互联：memo 正文裸写 `task-123`/`doc-001` 经 `TaskIdIndexContext` 实体索引自动链接、`[[wiki/path]]` 经 wikiLinks 解析——**出站引用零新解析代码**，把 Memos 的"死胡同笔记"变成知识网的可生长节点（注意 `[[...]]` 仅表示 wiki 路径，无实体括号语法）。memo → task 提升通道**本期不做**（定位轻笔记，衔接靠任务里引用 memo 编号/URL）。全局搜索接入 `search-service.ts`（新增 `type=memo`），WS 广播 `memos-updated`，另新增轻量 `memo` CLI 子命令。实施分 M0（数据层+API）/M1（信息流页）/M2（日历）/M3（搜索+互联+广播），每期独立可用。

## Related Concepts
- [[concepts/web-ui-features]] — /memos 页面、信息流/日历双模式与 SideNavigation 入口
- [[concepts/paste-as-markdown]] — Quick Capture 复用 PasteAwareMDEditor 的粘贴图片/文件能力
- [[concepts/wikilink]] — memo 出站引用的两套既有链接机制（裸实体 ID + [[wiki/path]]）
- [[concepts/spotlight-search]] — memo 进入全局 /api/search 与 SearchDialog
- [[concepts/memos]] — 本文档定义的快速笔记子系统总览（存储、双模式页面、知识网出站链接）

## Related Sources
- [[sources/back-709-dependency-closure-query]] — 文中引用 `task-back-709` 的依赖端点思路作为复用先例
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — wikiLinks `[[path|alias]]` 解析机制的既有来源
