---
title: BACK-820 - 文件预览模态框分离 YAML frontmatter
labels: [source, web-ui, bug]
created_date: 2026-10-23 17:20
updated_date: 2026-10-23 17:20
source_path: backlog/tasks/back-820 - Render-YAML-frontmatter-separately-in-file-preview-modal.md
---

# BACK-820 - 文件预览模态框分离 YAML frontmatter

`FilePreviewModal` 原先把含 YAML frontmatter 的原始文件直接喂给 markdown 渲染器，顶部 `--- … ---` 块显示为破损横线与原文；本任务让它像真正的文档一样呈现。

## 改了什么

| 文件 | 作用 |
|---|---|
| `src/web/utils/frontmatter-extract.ts` | 新增**仅用于展示**的前置 YAML 提取器：正则锚定源文件最开头（`^---\n…\n---\n`），返回 `{ data, content }`，列表项压平进父值；**刻意不引入 gray-matter**，避免膨胀 web 包 |
| `src/web/components/FilePreviewModal.tsx` | 经 `useMemo([content, isMarkdown])` 提取；full markdown 预览把 frontmatter 渲染为 `dl` 元数据面板置于正文之上，只把 body 传给 `MermaidMarkdown` |
| `src/test/frontmatter-extract.test.ts` | 6 例：无 frontmatter、带引号键、列表值、非前置 `---`、CRLF 行尾 |
| `src/web/locales/{en,zh-CN,zh-TW,ja}.ts` | 新增 `filePreview.frontmatter` 标签 |

正文里靠后出现 `---` 不会被误判为围栏（正则锚定开头）；部分/行范围预览与无 frontmatter 文件保持原行为；非 markdown 分支未改动。

## Related Concepts

- [[concepts/file-preview]] — 本地文件预览模态框
- [[concepts/markdown-pipeline]] — frontmatter 剥离与正文渲染

## Related Sources

- [[sources/back-599-gray-matter-no-cache-parse-wrapper]] — 共享 gray-matter 包装根除缓存污染
