## 📈 v1.53.10-CN Release Notes

> 上一个版本：[v1.53.9-CN](https://github.com/kuwork/Backlog.md/releases/tag/v1.53.9-CN)
>
> 🚀 这个版本把"在浏览器里看 Office 文档"和"在文档里查 Access 库"两件事真正落地了：Web 界面现在能内联预览并（部分）编辑 Word / PDF / PPTX / XLSX，点链接就开、不再下载；同时新增 `mdb-query` 围栏块，可在 Markdown 里直接对 `.mdb`（含 GBK 中文）跑实况 SQL 查询，并和 sqlite/duckdb/cypher 一样支持就地改语句。顺手修掉了裸 URL 紧贴中文被吞的渲染 bug，并把四个预览模态框和四个查询块的国际化文案收口。

### ✨ 新功能

- 📄 **应用内 Office 文档预览（Word / PDF / PPTX / XLSX）**：四个专用模态框，点**引用字段**（任务/里程碑/文档元数据里写的 `backlog/...` 路径）链接即打开预览，不再触发下载（引用字段的路径拦截与字节端点由 BACK-827 交付）。
  - **Word**：`DocPreviewModal`（docx-editor）真实分页 A4 页面，默认只读，Edit 进入编辑态可写回源文件（BACK-825）。
  - **PDF**：`PdfPreviewModal`（pdf.js 自托管 `/vendor/pdf.mjs`、运行时加载不进初始包），逐页 canvas 绘制，含可点击大纲侧栏（BACK-828）。
  - **PPTX**：`PptxPreviewModal`（`@aiden0z/pptx-renderer`，Apache-2.0），只读高保真还原富文本/形状/图表/SmartArt/公式，带缩略图目录与 WPS 式全屏放映（BACK-829）。
  - **XLSX**：`XlsxPreviewModal`（Univer），高保真还原字体/填充/边框/对齐/合并/列宽/行高/数字格式；查看+编辑双模式，保存用**原地 OOXML 补丁**只重写被改工作表的 `<sheetData>` 与 `<mergeCells>`，其余条目逐字节拷贝（BACK-830）。
- 🔗 **引用字段可预览任意路径的 Office 文件**：docx/pdf 此前只在 `/assets/*` 下的链接开模态框。现在**元数据/引用字段**里写的 `backlog/...` 项目相对路径（如 `backlog/docs/report.pdf`）也会经新增的原始字节端点 `GET /api/raw-file` 打开预览（镜像 `/api/file-content` 但返回字节 + content-type，拒绝路径穿越、限定 `backlog/` 数据目录内）。注意：**正文（描述/评论/笔记/文档 Markdown）里的链接只支持 `assets/...` 约定**（映射到 `backlog/assets/`），正文里写 `backlog/...` 前缀不会被拦截、会落到浏览器 404。不可预览的 Office 格式（如 `.doc`）改为**提示转成 `.docx`** 而非静默让浏览器加载（BACK-827 / 826）。
- 🗄️ **MDB（Access）实况查询块 `mdb-query`**（里程碑 m-18）：新增 `mdb-query` 围栏块，Access 库经 `mdb-reader` 载入内存 SQLite（`PRAGMA query_only=ON`）后由 `runSqliteQuery` 执行，复用 sqlite-query 的渲染内核（table/list/value 三视图、网格、分页）（BACK-832 / m-18）。
  - **GBK 解码修复**：`lizheng.mdb` 以 GBK（CP936）字节存文本，`mdb-reader` 按 latin1 还原因乱码，`mdb-query` 入库前按 GBK 字节级还原成正确中文。
  - 支持跨表 JOIN 与完整 SQL 面；Web 端 CSV 导出（与 sqlite/duckdb/cypher 同级）。
  - 四道 fail-closed 安全闸门：扩展名白名单（`.mdb`/`.accdb`）、只读 SQL 校验、`query_only` pragma、源路径逃逸拒绝。
  - 验收样本 `doc-33` 用真实 `lizheng.mdb`（87 张表、31 张有数据）。
- ✏️ **实况查询块内联 SQL 编辑器**：四个块（sqlite-query / duckdb-query / mdb-query / cypher-query）阅读视图展开查询面板后，首行右端出现编辑入口，就地改语句（BACK-833）。
  - 语法高亮编辑器（Prism token 衬透明 textarea，主题感知），带 Save / Test / Discard 三个动作 + Format 按钮（仅 SQL 引擎，原地重排缩进不写文件）。
  - Test 跑改动后语句但**不写盘**，坏编辑在碰文件前可见；Save 写回源 `.md` 并立即重跑；测过的草稿跨分页/刷新/导出持续。
  - 写回走新端点 `POST /api/query-block/save`：路径守卫 + `.md` 白名单，按整段围栏体定位、只重写 `sql`/`query` 字段、原子写。

### 🐞 修复

- 🔗 **裸 URL 紧贴中文被 autolink 吞掉**：任何经 `MermaidMarkdown` 渲染的笔记与 Markdown，若裸 `http(s)://` URL 紧贴 CJK 正文或全角标点，会渲染成一条错误超长链接、还把紧跟的 `[text](dest)` 链接的 `[` 吃掉（BACK-824）。
  - 新增 `linkifyBareUrls(source)`（`src/web/components/MermaidMarkdown.tsx`）预处理把裸 URL 包成显式 `[url](url)`；URL 体在遇到空白、`<>` `]`、引号/反引号、CJK 汉字（U+4E00–U+9FFF）、全角/CJK 标点（U+3000–U+303F、U+FF01–U+FF5E）处硬截断，正文永不被吞；负向回顾跳过已位于 `](…)` 内的 URL，并复用 `getMarkdownCodeRanges` 保护代码块/行内代码。回归用例已补（mermaid-markdown 测试 63→64）。

### 🧹 行为调整

- 🌐 **四个文档预览模态框本地化**：切到英文后 DOCX/PPTX/XLSX/PDF 四个预览框仍全中文（约 60 行 CJK 硬编码）。本版把所有用户可见文案移入字典，四语言（en / zh-CN / zh-TW / ja）补全，`TranslationDict` 派生于 `en.ts` 缺键即编译错误（BACK-831）。文档内容、文件名、docx-editor 自带 UI 不在范围。
- 🧩 **合并四个查询块 i18n 字典为共享基**：sqlite/duckdb/cypher/mdb 四个近同字典（约 31 个相同键）合并为各自 locale 里的单一 `queryBlock` 基对象并只覆盖 `title`；保留四把键、无组件或类型改动，字符串值逐字节一致，净减约 355 行重复文案（BACK-834）。

### 🧩 怎么用

**预览 Office 文档**：
- **引用字段**（任务/里程碑/文档等元数据里写的 `backlog/...` 路径）：点链接即打开对应模态框，覆盖项目任意路径；`.docx` 与 `.xlsx` 可在框内编辑并写回源文件。
- **正文**（描述/评论/笔记/文档 Markdown 里的链接）：只支持 `assets/...` 约定（即 `backlog/assets/` 目录）下的文件；写 `backlog/...` 前缀的正文链接不会被拦截、会落到浏览器 404。
- 点击 `.doc` 等不可预览格式会弹提示建议转 `.docx`。

**在文档里查 Access 库**：

````markdown
```mdb-query
source: backlog/assets/lizheng.mdb
sql: SELECT g_YanXing, COUNT(*) AS n FROM g_YanXing GROUP BY g_YanXing
view: table
```
````

- `source` 一律按项目相对路径解析、不接受前导 `/`；`sql` 为单条只读 SELECT/WITH；`view` 取 `table`/`list`/`value`（默认 table）；可加 `id:` 供同文档 `echarts` 块 `fromQuery:` 引用（机制同 BACK-814）。
- 结果上限 500 行，超出截断并提示；分页模式豁免（每页最大 1000 行）。
- 阅读视图的查询面板展开后点编辑入口即可就地改 SQL；Test 试跑不落盘，Save 写回并重跑。

**关掉预览模态框的本地化**：随活动语言自动切换（en/zh-CN/zh-TW/ja），无需额外配置。

### ⚠️ 需要注意

- 📊 **XLSX 编辑写回有边界**：仅 `.xlsx`/`.xlsm`；编辑器内的**格式改动（粗体/填充/列宽/行高）不写回**（无 Univer style→cellXfs 映射）；图表、数据透视、迷你图、条件格式、图片、绘图**不渲染但跨保存保留**；编辑器内新增工作表不写回。值与新公式可往返。
- 🗄️ **MDB 不支持 `copy_to`**：Access 不能就地写，服务端拒；仅 duckdb-query 支持 `copy_to`。MDB 与 sqlite/duckdb 一样**无 CLI / MCP 查询入口**（保持现状）。
- ✏️ **内联编辑器写回需要源 `.md` 可写**：写回按整段围栏体原子替换 `sql`/`query` 字段，要求该体在文档内唯一且被围栏包裹。
- 🔗 **裸 URL fix 只作用于 `MermaidMarkdown` 渲染路径**：直接手写 `[url](url)` 的链接不受影响；代码块/行内代码内的 URL 受 `getMarkdownCodeRanges` 保护、不会被改写。

### ⬆️ 升级说明

- ✅ **直接升级，无需迁移**：无配置文件与缓存格式变更。新增的 `/api/raw-file`、`/api/mdb/*`、`/api/query-block/save` 等端点随服务启动自动可用。
- 📦 前端引入 docx-editor、pdf.js、pptx-renderer、Univer、sql-formatter 等依赖（部分运行时加载、不进初始包；XLSX 预览会多引入约 1.9 MB Univer 二进制），`bun run build` 已通过。
- 🗄️ 验收样本 `lizheng.mdb` 以项目相对路径 `backlog/assets/lizheng.mdb` 随仓库提供，`mdb-query` 块无需自备数据即可实跑。

### 🐞 已知问题

- 无新增已知问题。v1.53.9 中「图谱引擎 macOS 初始化失败、Cypher 检索不可用」已由 v1.53.9 修复（BACK-823）；本版本聚焦文档预览与 MDB 实况查询，未引入新的功能性缺陷。
