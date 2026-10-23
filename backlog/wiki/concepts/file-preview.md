---
title: 本地文件预览
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-10-23 17:20
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

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能集，含任务详情弹窗集成点
- [[concepts/markdown-pipeline]] — frontmatter 剥离与正文渲染
