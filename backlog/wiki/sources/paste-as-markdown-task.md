---
title: BACK-208 粘贴为 Markdown 支持
labels: [source]
source_path: backlog/tasks/back-208 - Add-paste-as-markdown-support-in-Web-UI.md
created_date: 2026-05-10 00:00
---


# BACK-208 粘贴为 Markdown 支持

**状态**: Done | **标签**: web-ui, enhancement, markdown | **负责人**: @kimi

在 Web UI 的任务和文档编辑器中实现富文本粘贴自动转换为 Markdown，支持从 Word、Google Docs、网页等来源无缝粘贴。

## 两阶段实现

**Phase 1（Done）**: 文本、表格、列表、加粗/斜体/下划线、链接的转换。
**Phase 2（Done）**: 图片 — 从剪贴板提取并保存到 `backlog/assets/paste/`，生成 `![alt](/assets/paste/...)` 链接。

## 核心架构

- **[[PasteAwareMDEditor]]** — 包装 `@uiw/react-md-editor`，拦截底层 `<textarea>` 的 `onPaste` 事件。
- **`handlePasteAsMarkdown`** — 核心粘贴处理器，检测剪贴板上的富文本 HTML，清理 Word 垃圾标记，通过 Turndown 转换为 Markdown，在光标处插入。

## 关键技术

**Word HTML 清理 (`cleanHtml`)**
1. 移除噪声标签（`<style>`, `<meta>`, `<link>`, `<script>`, `<colgroup>`, `<col>`）
2. **转换 `mso-list` 段落为 `<ul>/<li>`** — Word 将项目列表编码为 `<p style="mso-list:...">`，需在清理内联样式前检测并替换为真实列表元素
3. 移除所有 `class` 属性
4. 将内联样式转换为语义标签（`font-weight:bold` → `<strong>`，`italic` → `<em>`，`underline` → `<u>`）
5. 移除 `style` 属性、`<o:p>`、空元素
6. 将表格单元格内的列表扁平化为段落（Markdown 表格不能嵌套块级元素）
7. 递归展开表格单元格内的非内联元素，保留 `<br>` 作为段落分隔
8. 将首行 `<td>` 转换为 `<th>`，使 `turndown-plugin-gfm` 识别表头

**Turndown 配置**
- `turndown` + `turndown-plugin-gfm` 支持 GFM 表格、删除线、任务列表
- 自定义规则 `keepBr` — 强制 `<br>` 输出为原始 HTML（Turndown 默认 `  \n` 会破坏 Markdown 表格行）

**智能粘贴检测**
- 剪贴板无 HTML 时回退到原生粘贴
- 清理后的 HTML 转换出的 Markdown 与纯文本结构相同时，回退到原生粘贴（避免无意义的转换）

**依赖**
- `turndown` 7.2.4
- `turndown-plugin-gfm` 1.0.2
- `@types/turndown`

## 图片粘贴与提升机制（Phase 2）

**设计目标**: 避免用户在粘贴图片但未保存时，`assets/` 中积累孤立图片。

**粘贴流程（截图工具）**
1. 用户粘贴截图（`image/png` 在剪贴板上，无 HTML）
2. `PasteAwareMDEditor` 拦截，读取 `clipboardData.items`
3. `POST /api/upload?temp=1` — 后端保存到 `backlog/assets/.temp/{uuid}.png`
4. 返回 `/assets/.temp/{uuid}.png`
5. 插入 Markdown: `![image](/assets/.temp/{uuid}.png)`
6. 预览通过现有 `/assets/*` 路由工作

**保存流程（promote）**
1. 用户点击"保存"
2. 前端扫描 Markdown 中的 `/assets/.temp/` 引用
3. `POST /api/assets/promote { urls: [...] }`
4. 后端将文件从 `.temp/` 移动到 `paste/`
5. 返回 URL 映射，前端替换 Markdown 中的 URL 后再调用正常保存 API

**清理**: 服务器启动时异步运行 `cleanupTempAssets()`，删除超过 **30 分钟** 的 `.temp/` 文件。

## 安全考虑（远程 URL 下载）

- 协议白名单：仅 `http:` 和 `https:`
- 主机黑名单：阻止 `localhost`、`127.0.0.1`、`::1` 和私有 IP 范围
- 重定向限制：最多 3 跳
- Content-Type 验证：响应必须以 `image/` 开头
- 大小限制：响应体超过 20 MB 中止下载
- 超时：30 秒 fetch 超时

## Bugfixes（2026-05-09）

- **Excel 表格粘贴未转换**: Excel 用 `<colgroup><col>` 包装表格，Turndown GFM 规则无法识别。修复：`cleanHtml` 现在剥离这些标签。
- **Excel 粘贴丢失截图**: Excel 同时在剪贴板放置 `text/html`（表格）和 `image/png`（截图）。修复：`handlePasteAsMarkdown` 返回 Markdown 字符串，`PasteAwareMDEditor` 接收后追加任何独立图片 blob。
- **Word `file://` 图片引用**: Word 复制图片为本地文件路径，浏览器无法读取，后端也拒绝 `file://` 访问。当前行为：静默移除 `file://` `<img>` 标签。用户可直接粘贴截图（Win+Shift+S）。

## 后续修复

- [[sources/wiki-pasted-images-promote-fix]] — BACK-488 修复 wiki 页面保存时未复用 temp → paste 图片迁移逻辑的问题。Wiki 编辑器已使用 `PasteAwareMDEditor` 支持图片粘贴，但 `WikiDetail.tsx` 的 `handleSave` 遗漏了 promote 步骤，现已补齐。
