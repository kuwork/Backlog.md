---
type: concept
title: 粘贴为 Markdown
updated: 2026-05-10
---

# 粘贴为 Markdown

Web UI 编辑器中的智能粘贴功能，自动将富文本（Word、Google Docs、网页、Excel）转换为 Markdown，同时支持截图图片的上传与嵌入。

## 组件

- **[[PasteAwareMDEditor]]** — 包装 `@uiw/react-md-editor`，拦截底层 `<textarea>` 的 `onPaste`
- **`handlePasteAsMarkdown`** — 核心转换引擎，位于 `src/web/utils/paste-as-markdown.ts`

## 转换流程

1. 读取剪贴板 `text/html`
2. 无 HTML 时回退到原生粘贴
3. `cleanHtml()` 清理 Word/Excel 特定标记
4. 如提供 `uploadImage` 回调，处理 HTML 中的 `<img>` 标签（data URI 或远程 URL 上传）
5. Turndown 将清理后的 HTML 转为 Markdown
6. 后处理：修正粗体/斜体空白、确保列表标记后有空格
7. 如转换结果与纯文本结构相同，回退到原生粘贴

## Word HTML 清理

| 问题 | 处理方式 |
|---|---|
| 噪声标签 | 移除 `<style>`, `<meta>`, `<link>`, `<script>` |
| `mso-list` 段落 | 检测并替换为 `<ul>/<li>` |
| 内联样式 | 转为语义标签（`font-weight:bold` → `<strong>`） |
| 表格内嵌套列表 | 扁平化为带前缀的段落 |
| 表格首行 | `<td>` → `<th>` 使 GFM 识别表头 |
| Excel `<colgroup>` | 剥离以允许表格识别 |

## Word 文档上传

除剪贴板粘贴外，编辑器还支持直接上传 `.docx` 文件：

- 后端 `mammoth` 将 `.docx` 转为 HTML，提取内嵌图片到 `.temp/`
- 前端复用同一套 `cleanHtml` + Turndown 流水线，保证 paste 与 upload 输出一致
- 详见 [[docx-conversion]]

## 图片粘贴

- 截图直接粘贴为 `image/png` blob → 上传至 `.temp/` → 保存时 promote 到 `paste/`
- Word/网页中的 `<img>`：data URI 提取上传，HTTP(S) URL 由后端安全下载上传
- `file://` 路径被拒绝（浏览器无法读取本地文件）

## 依赖

- `turndown` + `turndown-plugin-gfm`
- `mammoth` — Word 文档解析（`.docx` 上传路径）
