---
title: Word 文档转换
labels: [concept]
created_date: 2026-05-12 00:00
---


# Word 文档转换

Backlog.md Web UI 支持将 Microsoft Word（`.docx`）文件上传并转换为 Markdown，同时提取内嵌图片。该功能是对 [[concepts/paste-as-markdown]] 的延伸，共享同一套 HTML 清理与 Turndown 转换流水线。

## 架构

```
用户选择 .docx
    ↓
POST /api/docx/convert (multipart/form-data)
    ↓
mammoth.convertToHtml(buffer, { convertImage })
    ↓
提取图片 → assetManager.uploadFile(image, isTemp=true) → .temp/
    ↓
返回 { html, images[], messages[] }
    ↓
前端 cleanHtml(html, { keepMedia: true }) + Turndown
    ↓
插入编辑器
    ↓
保存时 POST /api/assets/promote → 图片从 .temp/ 迁移到 paste/
```

## 关键设计决策

**后端不直接输出 Markdown**
早期实现让后端直接调用 Turndown，但 mammoth 生成的 HTML 包含复杂表格、列表嵌套时与前端 paste 路径处理不一致。最终方案：后端只负责 `.docx` → HTML + 图片提取，Markdown 转换统一在前端完成。

**`keepMedia` 选项**
`cleanHtml` 默认会移除没有 textContent 的空标签。Word 中的图片常被包裹在 `<p><img>...</p>` 中，该 `<p>` 没有文本内容，会被误删。`keepMedia: true` 保留包含媒体元素的标签。

## API

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/docx/convert` | POST | 接收 `.docx` 文件，返回 HTML、图片列表和警告消息 |

## 错误处理

- 非 `.docx` 扩展名 → 400
- 解析失败/文件损坏 → 400 带可读错误消息
- 单张图片超大小限制 → 可在响应中警告或整体失败（策略可配置）
