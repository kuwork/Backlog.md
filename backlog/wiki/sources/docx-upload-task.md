---
type: source
title: BACK-475 Word 文档上传与图片提取
source_path: backlog/tasks/back-475 - Add-Word-(docx)-upload-to-enable-image-extraction-for-pasted-Word-content.md
updated: 2026-05-12
---

# BACK-475 Word 文档上传与图片提取

**状态**: Done | **标签**: web-ui, enhancement, markdown, editor | **优先级**: medium

允许 Web UI 富文本编辑器直接上传 Word 文档（`.docx`），自动转换为 Markdown 并提取内嵌图片到临时目录，保存时通过现有 promote 机制迁移到永久目录。

## 功能

- 文件选择器或拖放上传 `.docx` 文件
- 后端使用 `mammoth` 库将 `.docx` → HTML，前端复用 `cleanHtml` + Turndown 转为 Markdown
- 内嵌图片提取后上传至 `backlog/assets/.temp/`，生成临时 URL
- 图片引用格式：`![alt](/assets/.temp/{uuid}.png)`
- 大文件（>20MB）或损坏文档返回清晰错误
- 专用 API：`POST /api/docx/convert`

## 后端实现

- `src/core/docx-converter.ts` — `convertDocxToMarkdown(buffer, assetManager)`
- `mammoth.convertToHtml()` 的 `convertImage` 回调将每幅图通过 `assetManager.uploadFile(file, true)` 写入 `.temp/`
- 返回 `{ html, images, messages }`，前端统一处理 HTML → Markdown 转换

## 前端统一流水线

为避免后端直接 Turndown 与前端 paste 路径产生差异（复杂表格、列表嵌套等问题），**后端只返回原始 mammoth HTML**，前端 `PasteAwareMDEditor.handleDocxUpload` 调用与 `handlePasteAsMarkdown` 完全相同的 `cleanHtml` + Turndown 流水线：

1. 保证 paste 与 upload 输出一致
2. `cleanHtml` 新增 `keepMedia` 选项，保留仅含 `<img>` 的 `<p>` 元素，防止图片被误清理

## 依赖

- `mammoth` — `.docx` 解析与 HTML 转换
