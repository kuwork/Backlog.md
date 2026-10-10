---
title: BACK-738 - memo 卡片复制 ID 与模态背景修复
labels: [source, bug, web-ui]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-738 - Memo-card-menu-copy-ID-action-and-fix-entity-link-modal-losing-the-memos-background.md
---

# BACK-738 - memo 卡片复制 ID 与模态背景修复

两个 MemosPage UX 修复，都落在 memo 卡片 kebab 菜单与实体链接导航上。

## 解决方案

第一项是 Copy ID：每张 memo 卡片的 kebab 菜单（此前只有编辑/删除）新增"复制 ID"项，把 memo id（YYYYMMDD-N）写入剪贴板。实现用 navigator.clipboard.writeText，附隐藏 textarea + execCommand 的不安全上下文回退；确认反馈直接做在菜单项上——标签切换为"已复制"1.2 秒（idCopied 状态 + 超时），菜单随后关闭并复位。

第二项是模态返回 bug：点击 memo 正文内的任务/草稿实体链接时走的是裸 navigate()，没传 backgroundLocation state，于是任务预览模态没有背景位置，关闭后落到任务看板而不是回到 /memos。其他页面（如 App.tsx 的 handleOpenTask）以 `navigate(path, { state: { backgroundLocation: location } })` 打开模态。修复是每个 handler 一行改动：onTaskClick/onDraftClick 传入当前 location 作为 backgroundLocation，App 的 mainRoutes 于是在 /task/:id 模态下保持 MemosPage 挂载（mainLocation = backgroundLocation），handleCloseModal 的 navigate(-1) 落回未被触碰的 feed——滚动位置与选中日期都存活。doc/decision/wiki 路由是整页导航而非模态，刻意不动。AC #3 也据实通过 CLI 改写了措辞以匹配这一边界。

坑点：测试的 setupDom 会在渲染前替换 globalThis.navigator，因此剪贴板 mock 必须在 renderMemos 之后安装。en/ja/zh-CN/zh-TW 四语字典新增 memos.copyId / memos.copied 键。

## 验证

web-memos-page.test.tsx 新增两个测试（剪贴板写入 + 确认标签；任务链接携带 backgroundLocation），全文件 43 通过 0 失败；tsc 与 biome 干净。

## Related Concepts

- [[concepts/web-ui-features]] — SPA 模态 + backgroundLocation 路由模式是 web UI 的既有约定
- [[concepts/web-ui-i18n]] — copyId/copied 文案进入四语字典
- [[concepts/memos]] — memo 卡片菜单与模态返回修复所属的 memos 子系统

## Related Sources

- [[sources/back-737-memos-ui-polish]] — 本任务依赖的前置打磨，kebab 菜单与卡片 UI 由其建立
- [[sources/back-734-memos-knowledge-web-links]] — memo 正文实体链接的接线任务，本任务修复其模态导航的返回行为
