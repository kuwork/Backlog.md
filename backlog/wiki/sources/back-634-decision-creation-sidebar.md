---
title: BACK-634 - 启用侧边栏创建决策
labels: [source, web-ui, decisions, i18n]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-634 - Enable-decision-creation-from-the-web-sidebar.md
---

# BACK-634 - 启用侧边栏创建决策

Decisions 侧边栏创建按钮被注释掉，且其引用的处理器已不存在，因此即使 BACK-633 启用了编辑，`/decisions/new` 仍不可达。按钮背后还藏着第二个缺口：创建分支只保存标题，默默丢弃输入的正文。本任务把两者都接上。

- `SideNavigation.tsx`：被注释的块变成真正的加号按钮，调用 `navigate('/decisions/new')`，经现有 `t.nav.createDecision` 键标注（en、zh-CN、zh-TW、ja 已有），悬停样式与邻近加号按钮一致
- `DecisionDetail.tsx` 创建分支：`apiClient.createDecision(title)` 之后归一化输入正文、经 `apiClient.promoteAssets` 提升 `/assets/.temp` 图片，非空时以 `apiClient.updateDecision` 持久化正文
- 空正文仍产生默认 Context/Decision/Consequences 模板，与之前一致；导航、刷新与成功 toast 未动
- 在真实浏览器中验证：按钮打开创建表单；以标题 + 正文 + 粘贴图片创建时三者全部存下（图片提升到 `assets/paste`）并导航到新决策的 slug URL
- 测试：`web-side-navigation-loading.test.tsx` 与 `cli-doc-decision-board.test.ts` 共 17 通过

## 验收标准

- 侧边栏 Decisions 头部显示本地化的加号按钮，打开 `/decisions/new`
- 创建同时持久化输入的标题与正文，不再丢弃正文
- 空正文仍产生默认小节模板
- 正文中的临时粘贴图片在存储前提升；应用导航到新决策并刷新列表

## Related Concepts

- [[concepts/web-ui-features]] — 跨分区共享的侧边栏创建入口
- [[concepts/web-ui-i18n]] — 复用现有 `t.nav.createDecision` 键
- [[concepts/asset-management]] — 创建路径上的临时图片提升

## Related Sources

- [[sources/back-633-decision-editing-web-ui]] — 紧接其前启用的同一界面编辑半边
- [[sources/back-632-decision-image-promotion]] — 扩展到创建路径的提升模式
- [[sources/back-635-decision-status-editing]] — 随后对创建/编辑的决策做状态编辑
