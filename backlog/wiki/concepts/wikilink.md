---
title: Wikilink
labels: [concept]
created_date: 2026-06-06 01:00
updated_date: 2026-11-08 23:05
---

# Wikilink

Backlog.md wiki 使用 `[[path/to/page]]` 语法作为页面间交叉引用的标准格式。

## 基础语法

- `[[concepts/date-fields]]` — 引用 `wiki/concepts/date-fields.md`
- `[[sources/back-508-cli-description-escapes]]` — 引用 `wiki/sources/back-508-cli-description-escapes.md`
- **不带 `.md` 扩展名**

## 别名语法（BACK-523）

`[[target|alias]]` 支持丰富的别名内容：

- 行内代码：`` [[concepts/wikilink|```code```]] ``
- Markdown 格式：粗体、斜体、删除线
- 任意行内 HTML：`<span style="color: red;">...</span>`

未解析的别名渲染为 `<del>alias</del>`。

## 属性块语法（BACK-523）

markdown-it-attrs 风格的属性块：

- `[[target]]{style="color: red;"}`
- `[[target]]{.some-class #some-id}`
- 任意 `key="value"` 对

属性值在写入 HTML 前会进行 HTML 转义。

## 媒体 wikilink（BACK-524）

Obsidian 风格的媒体嵌入：

```markdown
![[assets/photo.png]]
![[assets/demo.mp4|caption]]
![[assets/audio.mp3]]
![[assets/photo.png|alt|200x300]]
```

- 图片复用现有 lightbox 预览
- 视频渲染为 `<video controls>`
- 音频渲染为 `<audio controls>`（不支持尺寸）
- 尺寸 `W`、`WxH`、`0xH` 仅对图片和视频生效

支持的扩展名：

| 类型 | 扩展名 |
|---|---|
| 图片 | png, jpg, jpeg, gif, svg, webp, avif, bmp, ico |
| 视频 | mp4, webm, ogv, mov, mkv |
| 音频 | mp3, wav, ogg, m4a, flac, aac, opus, wma |

## 使用场景

### index.md 表格

```markdown
| [[sources/back-508-cli-description-escapes]] | Task | Description |
```

### 页面正文 Related 章节

```markdown
## Related Concepts
- [[concepts/date-fields]] — 日期字段语义与格式
```

### Web UI 渲染

Wiki 页面中的 `[[wikilinks]]` 在 Web UI 中被替换为可点击的内部链接（`/wiki/encodedPath`），点击后弹出模态框预览目标页面。别名与属性块通过 `src/web/utils/wikiLinks.ts` 解析并生成原始 `<a>` 标签；媒体 wikilink 生成 `<img>` / `<video>` / `<audio>` 并通过 `MermaidMarkdown` 注册组件渲染。

### 知识图谱 LinksTo 边（BACK-714）

正文 `[[wikilink]]` 被图谱解析为 `LinksTo` 引用边：相对 wiki 根与引用页双重解析，剥离 alias（`[[target|alias]]`）与 heading（`#anchor`）部分，**唯一命中才成边**（零或多个候选只记录到 `unresolvedLinks` 报告）。未链接的提及不是图谱事实；frontmatter `relations` 字段与语义边表按设计忽略（doc-15 延期）。详见 [[concepts/kuzu-graph]]。

## wiki 页的相对引用与链接分流（BACK-837）

wiki 页原先以 wiki 目录内相对的 `page.path` 作 Markdown 渲染基准，`../` 会被统一 join 判为项目根逃逸、塌成死 `#` 锚点。现在 `/api/wiki/:path` 派生 `projectPath` 与 `wikiRoot`（持久化的 `path` 不变），渲染器据此分流：join 后**仍在 wiki 根内且是 markdown-ish 目标**（无扩展名 / `.md` / `.markdown`）走 `/wiki/<page>:range`，其余（docs、decisions、assets、图片、Office）保持项目文件 URL，打开共享的文件 / Office 预览。没有 `wikiRoot` 时行为与 [[concepts/relative-reference-resolution]] 的两阶段解析完全一致。

**wikilink 与显式 `/wiki/...` Markdown 链接按来源分流**，这是最容易搞混的一条：

| 来源 | 行为 |
|---|---|
| `[[...]]` wikilink（带 `data-wikilink="true"`） | 内联 `WikiLinkPreview` 弹窗，支持 `:N-M` 只加载对应行 |
| 显式 Markdown `[x](/wiki/concepts/asset-management)` | **SPA 导航**切换页面，不弹窗 |
| 带 `:N-M` 的链接（任意来源） | 一律留弹窗 —— wiki 路由没有行范围段，导航到 `/wiki/page:3-8` 会 404 |

`WikiDetail` 原有的两个 DOM 级 click handler（先于 React 委派 handler 运行，造成 `/task/` 双重导航、`/wiki/` 既导航又弹窗、带范围文档链接丢范围）已删除，全页与弹窗统一走 `useMarkdownLinkPreview`，仅以 `onWikiClick` 覆盖 wiki 分支；`parseLocalUrl` 接受 `/decision/:id` 作为 `/decisions/:id` 别名。

**编辑器侧**：`PasteAwareMDEditor` 接 `wikilinkBasePath`，注册幂等 `wikilink` overlay token、注入 `createRemarkWikilink` 预览插件；wiki / 文档 / 决策 / 任务 / 里程碑 / memo 六个表面启用，与既有的 `mdlink` overlay 并存。带空格目标用 `encodePath` 每段先解码一次再编码，避免 `%20` → `%2520`。

## 与标准 Markdown 链接的区别

| 特性 | Wikilink `[[...]]` | Markdown `[text](path.md)` |
|---|---|---|
| 扩展名 | 省略 `.md` | 需要 `.md` |
| 管道别名 | 支持富文本别名 | 不支持 |
| 属性块 | 支持 `{...}` | 不支持 |
| 媒体嵌入 | `![[...]]` | 不支持 |
| 语义 | 内部 wiki 交叉引用 | 通用超链接 |
| Web UI 行为 | 内联 wiki 弹窗，支持 `:N-M` 局部加载 | 本地文件/Office 开共享预览；实体链接导航或开区间预览；显式 `/wiki/...` 走 SPA 导航 |

## Related Sources
- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 实现
- [[sources/wikilink-markdown-preview-fix]] — BACK-482 Wikilink 与 Markdown 相对链接预览修复
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — BACK-523 别名与属性块
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — BACK-524 媒体 wikilink
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — BACK-525 skill 文档同步
- [[sources/doc-15-wiki-knowledge-graph-relation-design]] — doc-15 wikilink → LinksTo 边的解析规则
- [[sources/back-714-knowledge-graph-ingest]] — BACK-714 LinksTo 边生成实现
- [[sources/back-751-auto-link-entity-id-ranges]] — 渲染侧区间/斜杠列表多 ID 自动链接与 portal 下拉
- [[sources/back-753-referenced-by-backlinks]] — 文档/决策页的「Referenced by」反向链接
- [[sources/back-837-wiki-relative-references-entity-links]] — wikiRoot 分流、范围预览与编辑器高亮
- [[sources/back-836-decision-relative-reference-resolution]] — 共享点击契约的来源
- [[sources/m-19-fix-relative-reference-resolution]] — 所属里程碑

