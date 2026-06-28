---
title: Wikilink
labels: [concept]
created_date: '2026-06-06 01:00'
updated_date: '2026-06-27 21:00'
---

# Wikilink

Backlog.md wiki 使用 `[[path/to/page]]` 语法作为页面间交叉引用的标准格式。

## 基础语法

- `[[concepts/date-fields]]` — 引用 `wiki/concepts/date-fields.md`
- `[[sources/back-508-cli-description-escapes]]` — 引用 `wiki/sources/back-508-cli-description-escapes.md`
- **不带 `.md` 扩展名**

## 别名语法（BACK-523）

`[[target|alias]]` 支持丰富的别名内容：

- 行内代码：`` [[demo|```code```]] ``
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

## 与标准 Markdown 链接的区别

| 特性 | Wikilink `[[...]]` | Markdown `[text](path.md)` |
|---|---|---|
| 扩展名 | 省略 `.md` | 需要 `.md` |
| 管道别名 | 支持富文本别名 | 不支持 |
| 属性块 | 支持 `{...}` | 不支持 |
| 媒体嵌入 | `![[...]]` | 不支持 |
| 语义 | 内部 wiki 交叉引用 | 通用超链接 |
| Web UI 行为 | 模态框预览 | 依类型判断（本地 URL 别名/外部新标签） |

## Related Sources
- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 实现
- [[sources/wikilink-markdown-preview-fix]] — BACK-482 Wikilink 与 Markdown 相对链接预览修复
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — BACK-523 别名与属性块
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — BACK-524 媒体 wikilink
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — BACK-525 skill 文档同步
