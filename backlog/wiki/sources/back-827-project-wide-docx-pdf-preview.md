---
title: BACK-827 - 项目任意路径的 docx 与 pdf 预览
labels: [source, web, docs]
created_date: 2026-10-31 23:53
updated_date: 2026-10-31 23:53
source_path: backlog/tasks/back-827 - Project-wide-docx-and-pdf-preview-for-any-project-path.md
---

# BACK-827 - 项目任意路径的 docx 与 pdf 预览

应用内 Word（`.docx`）与 PDF 预览此前只在 `/assets/*` 下的链接打开模态框（那是唯一提供二进制字节的静态路由）。Markdown/代码文件早已经 `MermaidMarkdown.onFileClick` + `/api/file-content` 按项目相对路径全局预览。本任务让 docx/pdf 也走同一条默认路径：点击项目内任何同源 `.docx`/`.pdf` 链接都打开预览模态框，而非仅限于 `backlog/assets`。

## 要点

- 字节按文件的项目相对路径（如 `backlog/docs/report.pdf`）经新增原始字节端点 `GET /api/raw-file` 获取，镜像 `/api/file-content` 但返回字节 + content-type。
- Word 写回继续用项目相对路径，因此非 `/assets/` 文件也能编辑。
- 外部（跨源）docx/pdf 链接留给浏览器；修饰键/`target=_blank`/download 仍开新标签；不可预览 Office 类型仍弹提示。

## 安全

`/api/raw-file` 拒绝路径穿越、限定在 `backlog/` 数据目录内，content-type 映射（docx、pdf、常见图片）。`/assets/*` 静态路由保留给未被拦截的默认资源（图片）。同源守卫把外部链接挡在应用外。`/api/raw-file` 用 `Cache-Control: no-store` 并缓冲可保存的 Office 类型，避免重开预览时读到旧内容、也避免服务器持有待替换文件上的读句柄（Windows 重命名会失败）。

## Related Concepts

- [[concepts/file-preview]] — 文档预览家族与同源守卫
- [[concepts/web-server]] — 原始字节端点

## Related Sources

- [[sources/back-825-word-document-preview-modal]] — Word 预览/编辑模态框
- [[sources/back-828-pdf-preview-modal]] — PDF 预览模态框
- [[sources/back-829-pptx-preview-modal]] — PPTX 预览模态框（复用本拦截器）
- [[sources/back-830-xlsx-preview-modal]] — XLSX 预览模态框（复用本拦截器）
