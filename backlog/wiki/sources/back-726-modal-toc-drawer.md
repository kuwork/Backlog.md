---
title: BACK-726 - 弹窗 Markdown 大纲抽屉
labels: [source, web-ui, markdown, wiki]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-726 - Modal-markdown-outline-drawer-bookmark-style-TOC-entry-for-task-doc-wiki-preview-modals.md
---

# BACK-726 - 弹窗 Markdown 大纲抽屉

Web UI 的文档、决策、wiki 详情页已有右上角大纲（TocButton + TocContext + utils/toc.ts + hooks/useToc.ts，BACK-638），但所有基于 Modal 的弹窗——任务详情（TaskDetailsModal）、wiki 预览（WikiDetail）、文件预览（FilePreviewModal）——都没有大纲，弹窗内的长 markdown 内容难以导航。

## 实现要点

需求形态是一个书签式标签从弹窗左边缘中部探出，点击后标签隐藏、在弹窗左侧打开一个与弹窗等高的浮动大纲面板；弹窗本身永不改变宽度，避免布局抖动；关闭面板后书签回来。审查后方案从"加宽弹窗"改为该浮动面板形态（用户明确要求）。与 BACK-420（任务内容 TOC，对应 GitHub issue #405）相关但范围不同：本任务专注弹窗内的抽屉交互，复用既有的标题收集与 scrollspy 工具。

实现：从 TocButton 抽出共享的 `useTocTree` hook（`src/web/hooks/useTocTree.ts`）与 `TocRows` 组件，TocButton 重构为消费它们且行为不变；新组件 `TocDrawer.tsx` 实现书签标签 + 浮动面板，条目点击 `scrollIntoView({behavior:'smooth'})`，跳转后抽屉保持打开。关键简化：不给每个弹窗传容器 ref，而是让 Modal 自己收集其滚动容器内的标题——Modal 面板重构为 flex 列、内容 div 为滚动容器（视觉不变），启用该特性只需一个 `toc` 布尔 prop；窄屏（<sm）下面板改为覆盖在弹窗左边缘内侧（内缩 8px）而非外侧停靠。样式：书签为窄条（图标在上、竖排文字在下），面板四角圆润、与弹窗保持 8px 间隙，暗色模式适配。

顺手变更：FilePreviewModal 宽度从 max-w-4xl 提到 max-w-6xl（用户要求）。验证：新增 web-toc-drawer.test.tsx 4 个测试，既有 web-toc.test.tsx 23 个与 43 个弹窗相关测试全过，tsc / biome / build 干净。

## Related Concepts

- [[concepts/file-preview]] — FilePreviewModal 是三个启用大纲的弹窗之一，且宽度在本任务中被加大
- [[concepts/web-ui-features]] — 抽屉交互（不缩放弹窗、浮动停靠、scrollspy）是 Web UI 弹窗组件的通用模式
- [[concepts/markdown-pipeline]] — 大纲基于 markdown 渲染产物的标题层级，依赖渲染管线的标题输出
- [[concepts/toc-scrollspy]] — 书签式大纲抽屉与 scrollspy 模式所属概念

## Related Sources

- [[sources/back-638-header-outline-toc]] — 页面级大纲（TocButton/TocContext）的原始任务，本任务抽取其 useTocTree/TocRows 供弹窗抽屉复用
