---
title: BACK-482 修复 Wikilink 与 Markdown 相对链接预览
labels: [source]
source_path: backlog/tasks/back-482 - Fix-wikilink-and-Markdown-relative-link-preview-in-wiki-pages.md
created_date: 2026-05-22 00:00
updated_date: 2026-05-22 00:00
---

# BACK-482 修复 Wikilink 与 Markdown 相对链接预览

**状态**: Done | **标签**: web-ui, bug, wiki | **优先级**: medium

## 问题描述

点击包含 `..` 的 wikilink（如 `[[../developer-notes/security-gotchas]]`）会弹出 "Failed to fetch wiki page" 错误。后端 `readWikiPage()` 将原始相对路径视为 `wikiRoot`-relative，导致 containment check 拒绝合法的父目录引用。

此外，wiki 页面中的标准 Markdown 相对链接（如 `[子任务与依赖](10-任务管理/03-子任务与依赖.md)`）会跳转到错误 URL，无法预览。

## 关键实现

### 后端：readWikiPage 安全边界扩展

- `src/file-system/operations.ts`：
  - `readWikiPage(pagePath, rootDir?)` 新增可选 `rootDir` 参数，默认仍为 `wiki/`
  - 保持向后兼容：内部调用（如 `listWikiPages`）不受影响

- `src/server/index.ts`：
  - `handleGetWikiPage()` 智能路由：
    - 路径以 `wiki/` 开头 → 去掉前缀后用默认 `wikiRoot` 读取
    - 其他路径 → 先尝试 `wikiRoot`，失败后 fallback 到 `backlogDir`（支持 `wiki_output/` 等同级目录）
  - 安全：写操作（save/create/rename）仍限制在 `wiki/` 内

### 前端：路径解析辅助函数

- `src/web/components/WikiDetail.tsx`：
  - `resolveWikiPath(currentPagePath, linkPath)`：
    - 将当前页面视为位于 `wiki/` 下进行相对解析
    - 返回项目根目录相对路径（如 `wiki/developer-notes/security-gotchas` 或 `wiki_output/reports/feature-opportunities`）
    - 绝对路径返回 `null`（前端拒绝）
    - 逃出项目根目录返回 `null`
  - `resolveMarkdownLink(currentPagePath, linkPath)`：
    - 基于当前页面路径解析标准 Markdown 相对链接（无 `wiki/` 前缀）
    - 支持 `./`、`../`、普通相对路径

### 渲染时路径解析

- `WikiDetail` 的 `sanitizedContent`：
  - `[[wikilinks]]` 替换为 `/wiki/encodedPath` 前先用 `resolveWikiPath` 解析
  - 非法链接（返回 `null`）渲染为删除线 `~~text~~`

- `WikiLinkPreview` 的 `previewContent`：
  - 同样解析 wikilink，非法链接渲染为纯文本

### 点击拦截器

- `WikiDetail`（主页面）：
  - 拦截 `/wiki/` 开头的 wikilink → 解析路径 → `setPreviewPath()` 打开预览模态框
  - 拦截所有 wiki 页面中的相对 Markdown 链接 → `resolveMarkdownLink` 解析 → `setPreviewPath()`
  - URL 编码的 `href` 先 `decodeURIComponent` 再解析

- `WikiLinkPreview`（预览模态框内）：
  - 同样拦截 wikilink 和相对 Markdown 链接
  - 使用 `useNavigate()` 做 SPA 导航并关闭模态框，避免整页刷新

## 验证

- `bun test src/test/resolve-wiki-path.test.ts` → 10 pass
- `bun test src/test/filesystem.test.ts` → 67 pass
- `bunx tsc --noEmit` → 无新增错误
- `bun run check` → 无新增警告

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能
- [[concepts/web-server]] — Web Server 与浏览器界面
- [[concepts/markdown-pipeline]] — Markdown 解析与序列化流水线
