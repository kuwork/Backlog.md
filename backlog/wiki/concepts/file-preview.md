---
title: 本地文件预览
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-11-10 00:27
---

# 本地文件预览

Web UI 中点击本地文件路径即可在模态框中预览文件内容的功能，支持语法高亮和行号显示。

## 使用场景

- 任务 References 中的 `src/server/index.ts`
- Documentation 中的 `CLI-INSTRUCTIONS.md`
- Markdown 内容（Description、Plan、Notes、Final Summary）中的本地路径链接

## 路径规则（BACK-835 后）

完整契约见 [[concepts/relative-reference-resolution]]，这里只列与预览直接相关的部分。

- **元数据字段**（`--ref` / `references`、`modifiedFiles`、文档路径、查询块 `source`）：始终相对**项目根目录**（含 `backlog/` 的目录），如 `src/server/index.ts`。
- **Markdown 正文的 href/src**：相对**所在文档所在目录**解析，渲染期 join 成站点绝对 URL，服务端按「项目根 → 数据目录 → assets」有序候选表兜底。
- **包含边界是项目根**：多级 `../` 只要结果仍在根内就允许，可到达 `src/`、`quickstart/`、`scripts/` 等与数据目录同级的兄弟目录；越界在渲染期与服务端各拒一次，符号链接 realpath 逃逸同样拒绝。
- 以 `/` 开头的目标属于 URL / 路由层，永不参与 join（`/documentation/26:10-50`、`/quickstart/report.pdf`）；外链、`#` 锚点、实体短链原样放行。
- 既有的 `assets/...` 链接、粘贴的 `/assets/paste/...` 图片无需内容迁移；自定义数据目录名被自动尊重。

> 历史注记：BACK-827 时期「正文只认 `assets/...`、写 `backlog/...` 会 404、raw-file 守卫限数据目录内、`../` 一律拒绝」是当时的真实行为，BACK-835 起已失效。

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

文档预览从「文本/Markdown/代码」扩展到**原生 Office 文档**：点链接在专用模态框中预览，而非下载。BACK-835 之后路径解析不再按「引用字段 vs 正文」分两套：正文里的本地链接按所在文档 join，可到项目根内任意兄弟目录；`/api/raw-file` 的守卫也从数据目录放宽到项目根，因此正文链接到 `quickstart/`、`scripts/` 下的 docx/pdf 同样能在应用内预览。

- **原始字节端点**：BACK-827 引入同源守卫与 `GET /api/raw-file`（项目相对路径取字节 + content-type，`Cache-Control: no-store`），BACK-835 把守卫放宽到项目根并与 `/api/file-content` 共用 `readProjectAsset` 解析器（5MB 上限、扩展名 + MIME 白名单、排除 `.git`/`.env`/`.temp`、svg/html attachment disposition）。`/assets/*` 静态路由保留给未被拦截的默认资源。
- **Word（`.docx`）**：`DocPreviewModal`（BACK-825）基于 docx-editor，真实分页 A4；默认只读、Edit 进编辑态（工具栏/标尺/页边距参考线）、Save 经 `POST /api/docx/save` 写回；头部显式模式徽章（只读灰 / 编辑蓝）；四语言自构建 zh-TW/ja 覆盖包；docx-editor 代码分割。
- **PDF**：`PdfPreviewModal`（BACK-828）基于自托管 pdf.js（运行时加载、不打包），逐页 canvas；有大纲时左侧可点击目录栏（复用任务模态框 `TocRows` 视觉）；fit-to-width + 全屏圆角裁切。
- **PPTX**：`PptxPreviewModal`（BACK-829）基于 `@aiden0z/pptx-renderer`（Apache-2.0，OOXML→HTML/SVG 高保真，窗口化挂载）；缩略图目录跳转 + WPS 式边缘全屏放映；仅只读（无编辑 API）。
- **XLSX/XLSM**：`XlsxPreviewModal`（BACK-830）基于 Univer 开源 sheets 预设，唯一带编辑/写回的双模式：查看态只读网格（公式显缓存值），编辑态显功能区/公式栏；保存为**原地 OOXML 补丁**（只重写 `<sheetData>`/`<mergeCells>`，其余条目逐字节拷贝），`POST /api/xlsx/save` 原子写；值与新公式往返，编辑器内格式改动不写回。
- **不可预览格式提示**（BACK-826）：`.doc`/`.ppt`/`.xls` 家族等非可预览 Office 链接被拦截并弹非阻塞 toast 建议转 `.docx`/`.pdf`，而非让浏览器下载；修饰键/`target=_blank` 仍开新标签。
- **本地化**（BACK-831）：四个预览模态框约 60 行 CJK 字面量移入字典——通用动词从 `common` 读、`fullscreen`/`exitFullscreen` 提升（promote）到 `common`、预览专用文案进 `preview` 命名空间；XLSX 额外把 Univer 工作台映射到应用语言包。

## Office 页范围与工作表范围（BACK-838）

Office 链接可带可选 `:range` 后缀，`parseOfficeLink` 把 `<path>.<ext>:<token>` 拆成干净路径、文件种类和 `pages` / `sheets` 范围。

| 文件 | 合法 token | viewer 行为 |
|---|---|---|
| docx / pptx / pdf | `:P1`、`:P1-P4` | docx 定位 `.layout-page`（带重试挺过迟到重排）；pptx 投影 clamp 后的 slide 窗口并用 `MutationObserver` 隐藏窗口外懒挂载节点；pdf 只渲染窗口内页，越界 clamp 并把实际页数回报徽标 |
| xlsx / xlsm | `:p1`、`:p1-p4`、`:表名` | 序号 / 名字 token 都先解析成 `FWorksheet` 再 `setActiveSheet`（该 API 要 id 而非名字），其余 tab 保持可点 |
| 其它文本 | `:3-7` | 仍是**纯文本行范围** |

**`P` 前缀是强制的**：去掉它会让文档夺走 `:1-4` 已有的文本行含义；`doc-35` 的两条裸数字反例就是守这条边界。`splitTarget` 按扩展名决定是否接受 token，避免 `report.docx:P1-P4` 被当成不透明 URI scheme 塌成死 `#` 锚点。`officeRangeLabel` 统一四个 viewer 与内联嵌入的徽标，四语言文案在 `preview.shared` / `preview.xlsx`。

指向 Office 的 Markdown **图片**（`![]()`）由 `OfficeEmbedInline` 在 `<figure>` 内嵌同一 viewer，图注为干净文件名 + 范围徽标，`alt` 降级为 tooltip 以免重复；非 Office 图片仍走 lightbox。最后一公里在 `Layout.tsx` 的 document 级 capture-phase 拦截器：它先于所有 Markdown handler 并 `stopPropagation`，必须走 `parseOfficeLink` 把范围从字节 URL 与标题里剥离，否则每个范围链接都 404 且标题与徽标重复。

## PPTX 幻灯片本地媒体归一化（BACK-845）

`@aiden0z/pptx-renderer@1.4.0` 只从 `ppt/media/` 收集图片（`rv()` 只登记该前缀，`gs()` 也把关系目标重写到那里），而 PowerPoint 允许把图片放在幻灯片本地的 `ppt/slides/media/`。这类 deck 的图片全部落到 "No image data" 占位再被 `hideEmptyPictures()` 隐去——**与 SVG 格式无关**，渲染器本就支持 svg → blob `<img>`。

`PptxPreviewModal` 现在在 fetch 到 `arrayBuffer` 之后、`PptxViewer.open` 之前调 `src/web/utils/pptxMediaNormalize.ts`：用 JSZip 把偏离路径的媒体迁到 `ppt/media/<碰撞安全唯一名>`，重写所有 `*_rels/*.rels` 的 `Target` 相对路径，再重新打包；没有偏离路径的媒体时**原样返回同一个 buffer**，标准 deck 零开销。磁盘上的 pptx 从不修改，公开 `open()` 也不转发 `mediaResolver`，所以只能在内存层做。长期正解是上游让索引器认识 slide-local 目录。

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能集，含任务详情弹窗集成点
- [[concepts/markdown-pipeline]] — frontmatter 剥离与正文渲染
- [[concepts/query-chart-binding]] — 同一渲染树里的图表路由
- [[concepts/relative-reference-resolution]] — 路径基准、边界与点击契约
- [[concepts/web-server]] — try_files 与共享解析器

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
- [[sources/back-835-unify-relative-reference-resolution]] — 路径契约重写
- [[sources/back-838-office-page-sheet-ranges]] — Office 范围链接
- [[sources/doc-35-office-link-check]] — 四格式验收 fixture
- [[sources/back-845-pptx-slide-local-media]] — PPTX 非标准媒体路径的内存归一化
- [[sources/back-844-korean-web-ui-locale]] — 五种语言下 DOCX / XLSX 预览的语言包接线
