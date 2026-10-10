---
title: BACK-638 - 页头大纲按钮与浮动折叠目录
labels: [source, web-ui, content-viewer, toc]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-638 - Add-a-header-outline-button-with-a-floating-foldable-TOC-for-documentation-decisions-and-wiki-pages.md
---

# BACK-638 - 页头大纲按钮与浮动折叠目录

阅读页面需要一种既不占常驻栏、也不随滚动消失的大纲。本任务在页头（主题切换左侧）放入一个大纲按钮，在内容上方浮动一个可折叠目录，经四轮迭代完成：浮动面板、折叠、再到主控全部折叠。

- 新 `src/web/contexts/TocContext.tsx`（`TocProvider` + `usePageToc`）：正在阅读的页面发布其渲染 DOM 的标题；插槽仅在页面仍拥有它时于卸载时清空，因为替换页先挂载
- 新 `src/web/components/TocButton.tsx`：页面未发布标题时不渲染任何内容（也覆盖编辑态）；面板锚在按钮下方，选中、Escape 与外部 mousedown 时关闭，宽度钳到视口
- DocumentationDetail、DecisionDetail 与 WikiDetail 经 `usePageToc(contentRef, isEditing ? null : content)` 注册，保持完整内容宽度；早期的右侧粘性栏在提交前已移除
- 条目来自渲染 DOM（标题 id + `data-heading-text`），重复标题后缀与 CJK 标题总能匹配渲染器的锚；嵌套把每个条目挂到最近的更浅前驱条目，因为标题层级可能跳级
- 折叠：拥有子树的条目获得 chevron；超过 20 条的目录打开时更深的层级折叠；当前小节所在分支自动展开，scrollspy 高亮保持可达
- 主控：面板头部两态的全部折叠/展开，无分支目录不显示；显式全部折叠设置 `foldAllRef` 标志，抑制滚动驱动的自动展开直到读者再次交互（一次 CDP 运行显示全部折叠后 1 行 vs 无守卫滚动后 18 行）
- Scrollspy 仅在面板打开时运行，页面滚动不会重渲染页头；条目与文档内锚链接共享 `activateHashTarget`
- i18n：目录标题、chevron 与 expand-all/collapse-all 标签覆盖 en、zh-CN、zh-TW、ja；测试：`web-toc.test.tsx` 增至 23 用例，149 个 Web 测试通过，含 720px 视口的 CDP 验证

## 验收标准

- 文档、决策与 wiki 阅读视图把标题发布给页头大纲按钮；无标题及编辑时隐藏
- 面板浮于内容上方（保持完整正文宽度），条目按层级缩进，点击滚动并更新 URL 哈希，scrollspy 高亮当前小节
- 长目录打开时折叠顶层以下；当前小节分支自动展开；主控折叠/展开全部，手动全部折叠在滚动下存活
- 中文标题解析到正确标题 id；面板在 Escape 与外部点击时关闭

## Related Concepts

- [[concepts/web-ui-features]] — 阅读页镶边与 scrollspy 约定
- [[concepts/web-ui-i18n]] — 跨四语的标签新增
- [[concepts/markdown-pipeline]] — 目录消费的渲染 DOM 标题 id

## Related Sources

- [[sources/back-637-hash-anchors-on-load]] — 本功能所基于的锚点设施（`hash-target.ts`、`useHashScroll`）
- [[sources/back-536-in-document-hash-links]] — 共享的 `activateHashTarget` 滚动/哈希行为
