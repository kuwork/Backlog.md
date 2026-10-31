---
title: BACK-829 - PPTX 文档预览模态框
labels: [source, web, docs]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-829 - PPTX-document-preview-modal.md
---

# BACK-829 - PPTX 文档预览模态框

基于 `@aiden0z/pptx-renderer`（Apache-2.0）交付只读 PPTX 预览模态框 `PptxPreviewModal`：把 OOXML 解析成 HTML/SVG DOM，高保真还原富文本、形状、图片、表格、二维图表、SmartArt、公式、渐变、OOXML 颜色继承；幻灯片窗口化挂载（`IntersectionObserver`），大文档也流畅。

## 要点

- 三件套：查看器、缩略图目录（跳转）、边缘全屏放映模式（WPS 式导航）。
- 复用 BACK-827 的项目任意路径链接拦截器打开模态框；从 `.pptx` 不可预览集合中移除。
- 缩略图目录列出每张幻灯片（缩放预览 +「幻灯片 N」标签），点击跳转主视图；`onSlideChange` 驱动激活高亮与页码计数。
- 放映模式用 `createPortal(document.body)` 的 `fixed inset-0` 覆盖层、无工具栏：单页 `renderSlideToContainer` + fit-to-contain，重测于 resize。导航镜像 WPS：→↓Space PageDown Enter/滚轮下/左键=下一页；←↑PageUp Backspace/滚轮上=上一页；Home/End=首/末；Esc 或浮动「退出」按钮退出；左下角提示自动变暗。

## 实现

- `PptxViewer.open(buffer, container, { zipLimits, listOptions:{windowed:true}, onSlideChange })`；窗口化解析挂载。
- zip 上限：从 RECOMMENDED_ZIP_LIMITS 起步并抬高单条目/总量/媒体天花板，使含嵌入视频或大图的文档能预览而非触发 32 MiB zip-bomb 上限。
- 每页 API `renderThumbnailToContainer`/`renderSlideToContainer` 返回调用方持有的 `SlideHandle`，不再需要时须 `dispose()`。
- 占位清理：`hideEmptyPictures()` 隐藏渲染器对「无图像数据」图片画的虚线灰框，避免模板形状遮挡幻灯片。

## 边界

- 仅只读预览：pptx-renderer 无编辑 API。库 Apache-2.0、仅浏览器；npm 入口经打包器解析 JSZip 与 ECharts。
- 验证：tsc/biome/`bun run build` 通过，真实多页 deck 在运行 UI 验证。

## Related Concepts

- [[concepts/file-preview]] — 文档预览家族
- [[concepts/web-ui-features]] — 模态框与门户覆盖层

## Related Sources

- [[sources/back-827-project-wide-docx-pdf-preview]] — 复用其链接拦截器
- [[sources/back-830-xlsx-preview-modal]] — 同族电子表格预览
