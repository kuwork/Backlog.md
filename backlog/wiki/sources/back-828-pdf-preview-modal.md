---
title: BACK-828 - PDF 文档预览模态框
labels: [source, web, docs]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-828 - PDF-document-preview-modal.md
---

# BACK-828 - PDF 文档预览模态框

基于 pdf.js 交付专用 PDF 预览模态框 `PdfPreviewModal`：页面逐页绘制到 canvas；库自托管于 `/vendor/pdf.mjs`、运行时加载（绝不打包），worker 在 `/vendor/pdf.worker.min.mjs`，预览不进初始包。

## 要点

- 含大纲（目录）的 PDF 显示可点击左侧栏，样式复用任务模态框的页内大纲（`TocRows`）：缩进层级、折叠箭头、左侧强调边框、蓝色激活高亮；点击滚动到目标页。
- 全屏填充视口，页面区裁切到模态圆角，无额外边距。
- fit-to-width 经 `ResizeObserver` 计算，侧栏展开/收起都不会触发横向滚动；上限夹在 [0.5, 2.2]，避免超宽窗口放大过猛。
- 全局链接拦截（引用字段 `backlog/...` 路径、正文 `assets/` 链接均可打开本模态框）由 BACK-827 单独交付；本任务只负责模态组件、四个调用方的 pdf 分支、自托管 pdf.js 资源与 pdfjs-dist 依赖。

## 验证

`tsc --noEmit`、biome、`bun scripts/build.ts` 通过；有/无大纲的样本在运行 Web UI 验证。删除了临时态 `DocPdfPreviewModal.tsx`，四个调用方（Layout、TaskDetailsModal、DocumentationDetail、MilestoneDetailsModal）改指 `PdfPreviewModal`。

## Related Concepts

- [[concepts/file-preview]] — 文档预览家族
- [[concepts/web-ui-features]] — 模态框体系

## Related Sources

- [[sources/back-827-project-wide-docx-pdf-preview]] — 引用字段任意路径拦截（正文仅 assets/）与 `/api/raw-file`
- [[sources/back-825-word-document-preview-modal]] — 共用 open/close + z 层契约
