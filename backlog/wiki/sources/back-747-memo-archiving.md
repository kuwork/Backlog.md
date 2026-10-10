---
title: BACK-747 - memo 归档：原位 rename 到 archive
labels: [source, memos, feature, web-ui]
created_date: 2026-10-05 08:25
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-747 - Memo-archiving-move-a-note-to-backlog-archive-memos.md
---

# BACK-747 - memo 归档：原位 rename 到 archive

Memo 语料只增不减，feed 与钉板上唯一能做的动作是删除。归档把 memo 文件从 `backlog/memos/<id>.md` **原样 rename** 到 `backlog/archive/memos/<id>.md`——id、frontmatter、正文逐字节不动，移动天然可逆（见 [[decisions/memo-archive-rename-not-rewrite]]）。归档后笔记从 feed、日历计数、标签过滤与钉板全部消失。

## 实现要点

- **core**：`src/core/memos.ts` 新增 `memoArchiveDir(root)` 与 `archiveMemo(root, id)`；未知 id 返回 false，目标已存在返回 null（拒绝覆盖），目录按需 mkdir
- **REST**：`POST /api/memos/:id/archive`（字面段注册在 `:id` 参数路由之前）——200 携归档 memo、404 未知 id、409 冲突；成功后照常广播 `memos-updated`
- **卡片菜单**：Archive 项位于 Copy ID 与 Delete 之间，四语种文案；复用 busy 禁用与错误横幅，失败不摘卡
- **钉板**：hover 时便签右上角浮现归档图标按钮——便签是烘焙纹理没有 DOM 节点，按钮是 canvas 上方的 HTML overlay，随容器全屏可见，不吞打开弹窗的点击（见 [[decisions/board-hover-archive-overlay]]）
- **init 修复**：`ensureBacklogStructure()` 补建 `backlog/memos` 与 `archive/memos`，与其余 archive 目录对称，兼修复既有项目缺目录的问题（见 [[decisions/init-memos-dirs-symmetric]]）

显式不做取消归档：无反向动作、无归档视图；因文件是原位 rename，将来加回来无需迁移。

## 验证

tsc / biome 干净；core / REST / init / web 卡片菜单测试全过（合计 128 pass）；headless Chromium 端到端验证 hover 出按钮与归档落盘。

## Related Concepts
- [[concepts/memos]] — Memos 子系统总览（本文档扩展其归档生命周期）
- [[concepts/memo-board]] — 钉板归档按钮的宿主视图

## Related Sources
- [[sources/back-746-memo-board-webgl-pinboard]] — 前置任务：钉板视图，归档按钮挂在它的便签上
- [[sources/back-728-memo-storage-layer]] — memo 独立存储模块，归档实现在其中
- [[sources/back-731-memos-feed-page]] — 信息流卡片菜单的 Archive 项
