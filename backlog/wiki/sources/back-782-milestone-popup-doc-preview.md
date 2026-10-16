---
title: BACK-782 - 里程碑弹窗本地文档预览
labels: [source, web-ui, bug, milestones]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-782 - Support-documentation-preview-in-the-milestone-popup.md
---

# BACK-782 - 里程碑弹窗本地文档预览

里程碑详情弹窗把本地（非 URL）documentation 条目渲染为无交互文本，无法在应用内打开；而任务弹窗早已支持点击条目预览文件。本任务将里程碑弹窗对齐任务弹窗：本地条目变为可点击的预览控件，打开共享的应用内文件预览，http(s) 条目保持外链。基于 [[sources/back-619-milestone-documentation-field|BACK-619]] 引入的里程碑 documentation 字段。

## 问题

根因：`MilestoneDetailsModal` 把非 URL documentation 条目渲染为惰性 span（一个带样式的 label），而 `TaskDetailsModal` 渲染为接线了 `FilePreviewModal` 的按钮，里程碑弹窗因此没有任何预览入口。

## 解决方案

镜像任务弹窗的做法：新增 `previewPath` 状态与一个 `FilePreviewModal` 兄弟组件；本地条目改为 `title=Click to preview` 的按钮（复用共享的 `taskDetails.clickToPreview` 文案）；外部 URL 保持 `target=_blank` 锚点。预览在切换到其他里程碑时重置（沿用既有 reset effect），并以 `isOpen` 门控，保证不会比弹窗活得更久；documentation 为空时保留原占位提示。顺带修复：既有 web-milestone-timestamps 的 remove-entry 用例用 `docRow.querySelector(button)` 定位删除控件，条目变成按钮后会误匹配，改为按 title 定位删除控件。

## 验证

新增 `src/test/web-milestone-details-modal-documentation.test.tsx`（3 个用例，断言条目是可点击预览控件且对其路径发出 file-content 请求）；tsc、biome 干净；里程碑/任务 documentation 测试套件共 23 个用例全绿。

## Related Concepts
- [[concepts/file-preview]] — 共享的应用内文件预览（FilePreviewModal）
- [[concepts/milestones]] — 里程碑管理与详情弹窗

## Related Sources
- [[sources/back-619-milestone-documentation-field]] — 里程碑 documentation 字段的引入（本任务的依赖前置）
- [[sources/back-724-milestone-modal-fetch-fallback-fix]] — 同一 MilestoneDetailsModal 组件的回退填充修复
