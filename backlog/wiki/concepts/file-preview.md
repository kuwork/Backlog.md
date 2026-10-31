---
title: 本地文件预览
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-10-28 15:25
---

# 本地文件预览

Web UI 中点击本地文件路径即可在模态框中预览文件内容的功能，支持语法高亮和行号显示。

## 使用场景

- 任务 References 中的 `src/server/index.ts`
- Documentation 中的 `CLI-INSTRUCTIONS.md`
- Markdown 内容（Description、Plan、Notes、Final Summary）中的本地路径链接

## 路径规则

- 始终相对于**项目根目录**（包含 `backlog/` 的目录）
- 使用相对路径，如 `src/server/index.ts`
- 绝对路径不支持
- 目录遍历（`../`）被 API 拒绝

## 行范围

支持 `path:lineStart-lineEnd` 语法，如 `src/server/index.ts:35-39`：
- 正确计算偏移行号（CSS `counterReset`）
- 非代码文件回退到正常链接行为

## 技术实现

**后端**
- `GET /api/file-content` 解析路径和可选行范围
- 拒绝目录遍历（`..`、绝对路径）
- 返回 `{ content, path, lineRange, totalLines, isMarkdown }`

**前端**
- `FilePreviewModal` 组件
- 代码文件：检测语言扩展名 → `MDEditor.Markdown` 包装在围栏代码块中
- Markdown 文件：`MermaidMarkdown` 渲染
- 行号：CSS `counter-increment` + `counterReset` 支持部分范围
- 异步点击处理：先验证文件存在性，再打开预览或回退到浏览器链接

## 集成点

- `MermaidMarkdown` 的自定义 `a` 组件通过 `isExternalLink()` 区分 URL 与本地路径
- `TaskDetailsModal` 在 References、Documentation 和所有 Markdown 区域传递 `onFileClick`

## YAML frontmatter 元数据面板（BACK-820）

`FilePreviewModal` 原先把含 YAML frontmatter 的原始文件直接喂给 markdown 渲染器，顶部 `--- … ---` 块显示为破损横线与原文。现新增**仅用于展示**的提取器 `src/web/utils/frontmatter-extract.ts`（正则锚定源文件最开头，返回 `{ data, content }`，**刻意不引入 gray-matter** 以控制 web 包体积），full markdown 预览把前置 YAML 渲染为 `dl` 元数据面板置于正文之上，只把 body 传给 `MermaidMarkdown`。

- 正文里靠后出现 `---` 不会被误判为围栏（正则锚定开头）；部分/行范围预览与无 frontmatter 文件保持原行为；非 markdown 分支未改动。
- 四语言 `filePreview.frontmatter` 标签（en/zh-CN/zh-TW/ja），6 例单测覆盖无 frontmatter、带引号键、列表值、非前置 `---`、CRLF 行尾。

## 原始 HTML 表格恢复渲染（BACK-821）

文档预览里手写的 `<table>` 曾经只能看到标签原文——源码预处理的全量转义把所有 `<` 变成 `&lt;`（BACK-377 为挡 TypeScript 泛型字符串而加）。BACK-821 改为**只转义类型字符串形状的尖括号**，并给渲染器接 `rehype-raw` + table-aware `rehype-sanitize`（剥 `script`/`onerror`/危险 `href`），因此原始 HTML 表格与 GFM 管道表格一样正常渲染，XSS 面仍被允许列表挡住（细节见 [[concepts/markdown-pipeline]]）。

行高差异另有一条 CSS 修复：`.wmde-markdown p` 的 `margin-bottom` 作用在原始 HTML 单元格内的 `<p>` 包装上，`source.css` 用 `.wmde-markdown table p { margin: 0 }` 拉平，GFM 表格不受影响。

## Office 文档预览模态框（BACK-825~831）

文档预览从「文本/Markdown/代码」扩展到**原生 Office 文档**：点链接在专用模态框中预览，而非下载。需注意路径解析按链接上下文区分——**引用字段**（元数据里的 `backlog/...` 路径）可预览项目任意路径；**正文**（`.wmde-markdown` 描述/评论/笔记）里的链接只支持 `assets/...` 约定（映射到 `backlog/assets/`），写 `backlog/...` 前缀的正文链接不会被拦截、会落到浏览器 404。

- **引用字段任意路径 + 原始字节端点**：BACK-827 加同源守卫与 `GET /api/raw-file`（项目相对路径取字节 + content-type，穿越守卫限 `backlog/` 内，`Cache-Control: no-store`）；该端点服务于引用字段携带的 `backlog/...` 路径，正文 `assets/` 链接仍走既有静态 `/assets/*` 路由。
- **Word（`.docx`）**：`DocPreviewModal`（BACK-825）基于 docx-editor，真实分页 A4；默认只读、Edit 进编辑态（工具栏/标尺/页边距参考线）、Save 经 `POST /api/docx/save` 写回；头部显式模式徽章（只读灰 / 编辑蓝）；四语言自构建 zh-TW/ja 覆盖包；docx-editor 代码分割。
- **PDF**：`PdfPreviewModal`（BACK-828）基于自托管 pdf.js（运行时加载、不打包），逐页 canvas；有大纲时左侧可点击目录栏（复用任务模态框 `TocRows` 视觉）；fit-to-width + 全屏圆角裁切。
- **PPTX**：`PptxPreviewModal`（BACK-829）基于 `@aiden0z/pptx-renderer`（Apache-2.0，OOXML→HTML/SVG 高保真，窗口化挂载）；缩略图目录跳转 + WPS 式边缘全屏放映；仅只读（无编辑 API）。
- **XLSX/XLSM**：`XlsxPreviewModal`（BACK-830）基于 Univer 开源 sheets 预设，唯一带编辑/写回的双模式：查看态只读网格（公式显缓存值），编辑态显功能区/公式栏；保存为**原地 OOXML 补丁**（只重写 `<sheetData>`/`<mergeCells>`，其余条目逐字节拷贝），`POST /api/xlsx/save` 原子写；值与新公式往返，编辑器内格式改动不写回。
- **不可预览格式提示**（BACK-826）：`.doc`/`.ppt`/`.xls` 家族等非可预览 Office 链接被拦截并弹非阻塞 toast 建议转 `.docx`/`.pdf`，而非让浏览器下载；修饰键/`target=_blank` 仍开新标签。
- **本地化**（BACK-831）：四个预览模态框约 60 行 CJK 字面量移入字典——通用动词从 `common` 读、`fullscreen`/`exitFullscreen` 提升（promote）到 `common`、预览专用文案进 `preview` 命名空间；XLSX 额外把 Univer 工作台映射到应用语言包。

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能集，含任务详情弹窗集成点
- [[concepts/markdown-pipeline]] — frontmatter 剥离与正文渲染
- [[concepts/query-chart-binding]] — 同一渲染树里的图表路由

## Related Sources

- [[sources/back-820-file-preview-frontmatter]] — frontmatter 元数据面板
- [[sources/back-821-raw-html-table-doc-preview]] — 原始 HTML 表格恢复渲染与行高统一
- [[sources/back-825-word-document-preview-modal]] — Word 预览与内联编辑模态框
- [[sources/back-826-non-previewable-office-notice]] — 不可预览 Office 链接提示
- [[sources/back-827-project-wide-docx-pdf-preview]] — 引用字段任意路径预览（正文仅 `assets/`）与 `/api/raw-file`
- [[sources/back-828-pdf-preview-modal]] — PDF 预览模态框
- [[sources/back-829-pptx-preview-modal]] — PPTX 预览模态框
- [[sources/back-830-xlsx-preview-modal]] — XLSX 高保真布局预览与写回
- [[sources/back-831-localize-preview-modals]] — 四模态框本地化
