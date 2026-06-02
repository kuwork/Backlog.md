---
title: BACK-467 本地文件预览与语法高亮
labels: [source]
source_path: backlog/tasks/back-467 - Add-local-file-preview-with-syntax-highlighting-and-line-numbers.md
created_date: 2026-05-10 00:00
---


# BACK-467 本地文件预览与语法高亮

**状态**: Done | **标签**: enhancement, web-ui | **负责人**: kuwork | **优先级**: medium

为 Web UI 添加本地文件预览功能，允许用户点击任务 References、Documentation 和 Markdown 内容中的本地文件路径，直接在模态框中查看文件内容。

## 路径语义

路径始终相对于项目根目录（包含 `backlog/` 的目录）解析。用户应使用相对路径，如 `src/server/index.ts` 或 `CLI-INSTRUCTIONS.md`。不支持绝对路径，尝试遍历到项目根目录之上（`../`）会被 API 拒绝。

## 功能特性

- 代码和 Markdown 文件的完整内容查看
- 通过 MDEditor.Markdown 与 Prism 实现语法高亮
- CSS 计数器渲染行号
- 部分行范围支持（如 `src/server/index.ts:35-39`），偏移行号正确
- 从文件扩展名检测语言
- 文件不存在时回退到正常链接行为

## 实现

**后端**
- `GET /api/file-content` 路由读取项目根目录内的本地文件
- 解析可选行范围（`file:lineStart-lineEnd`）
- 解析路径并拒绝目录遍历
- 返回文件内容、路径、行范围、总行数和 markdown 标志

**前端**
- `FilePreviewModal` 组件：从扩展名检测语言，代码文件通过 `MDEditor.Markdown` 包装在围栏代码块中渲染，Markdown 文件用 `MermaidMarkdown` 渲染
- CSS 计数器行号，支持 `counterReset` 部分范围偏移
- `MermaidMarkdown` 添加 `onFileClick` prop，自定义 `a` 组件区分 URL 和本地路径
- `TaskDetailsModal` 中 References 和 Documentation 的本地路径渲染为可点击按钮

**关键文件**
- `src/server/index.ts`
- `src/web/components/FilePreviewModal.tsx`
- `src/web/components/MermaidMarkdown.tsx`
- `src/web/components/TaskDetailsModal.tsx`
- `src/web/lib/api.ts`
- `src/web/styles/style.css`
