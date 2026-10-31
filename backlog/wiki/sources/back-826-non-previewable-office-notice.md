---
title: BACK-826 - 非可预览 Office 链接改为提示而非加载
labels: [source, web]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-826 - Notice-for-non-previewable-office-file-links-instead-of-loading.md
---

# BACK-826 - 非可预览 Office 链接改为提示而非加载

全局 `/assets/*` 链接拦截器只对 `.docx`/`.pdf` 打开预览模态框；其它扩展名（如 `.doc`）静默回退到浏览器默认行为（导航或下载），无任何反馈。本任务让已知但无法预览的 Office 格式被拦截、阻止默认行为并弹非阻塞提示（toast），建议转成 `.docx`，而不是让浏览器加载或下载。

## 要点

- `binaryOfficeFile` 枚举不可预览 Office 扩展（`isNonPreviewableOffice`），保留 `isBinaryOfficeFile` 给可预览集合。
- `Layout` 拦截器：可预览 → 打开模态框（既有）；不可预览 Office → `preventDefault` + 提示 toast；其余 → 保留浏览器默认。
- 保持既有行为：`.docx`/`.pdf` 仍开模态框；修饰键点击与 `target=_blank`/download 仍开新标签。
- 提示四语言本地化（`filePreview.unsupportedType`）。

## 根因

`Layout.tsx` 对 `.docx`/`.pdf` 之外的链接提前 return，`kindFromName` 已返回 unsupported 但从未被这些链接走到。本任务与 BACK-825 是分离关注点，不改 docx/pdf 主路径。

## Related Concepts

- [[concepts/file-preview]] — 文档预览家族的边界处理
- [[concepts/web-ui-features]] — toast 基础设施

## Related Sources

- [[sources/back-825-word-document-preview-modal]] — Word 预览/编辑模态框
- [[sources/back-827-project-wide-docx-pdf-preview]] — 引用字段任意路径预览（正文仅 assets/）
