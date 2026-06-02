---
title: 本地文件预览
labels: [concept]
created_date: 2026-05-10 00:00
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
