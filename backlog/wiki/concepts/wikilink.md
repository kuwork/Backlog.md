---
title: Wikilink
labels: [concept]
created_date: '2026-06-06 01:00'
updated_date: '2026-06-06 01:00'
---

# Wikilink

Backlog.md wiki 使用 `[[path/to/page]]` 语法作为页面间交叉引用的标准格式。

## 语法规则

- `[[concepts/date-fields]]` — 引用 `wiki/concepts/date-fields.md`
- `[[sources/back-508-cli-description-escapes]]` — 引用 `wiki/sources/back-508-cli-description-escapes.md`
- **不带 `.md` 扩展名**
- **不支持 `|` 管道语法**（与 Obsidian 别名语法不同）

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

Wiki 页面中的 `[[wikilinks]]` 在 Web UI 中被替换为可点击的内部链接（`/wiki/encodedPath`），点击后弹出模态框预览目标页面。

## 与标准 Markdown 链接的区别

| 特性 | Wikilink `[[...]]` | Markdown `[text](path.md)` |
|---|---|---|
| 扩展名 | 省略 `.md` | 需要 `.md` |
| 管道别名 | 不支持 | 不支持（但在表格中需注意转义） |
| 语义 | 内部 wiki 交叉引用 | 通用超链接 |
| Web UI 行为 | 模态框预览 | 依类型判断（本地 URL 别名/外部新标签） |

## Related Sources
- [[sources/wiki-web-ui-task]] — BACK-473 Web UI Wiki 实现
- [[sources/wikilink-markdown-preview-fix]] — BACK-482 Wikilink 与 Markdown 相对链接预览修复
