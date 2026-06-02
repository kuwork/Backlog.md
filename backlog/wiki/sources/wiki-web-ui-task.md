---
type: source
title: BACK-473 Web UI Wiki 区域与文件树导航
source_path: backlog/tasks/back-473 - Add-wiki-section-to-web-UI-with-file-tree-navigation.md
updated: 2026-05-10
---

# BACK-473 Web UI Wiki 区域与文件树导航

**状态**: Done | **标签**: web-ui, wiki, feature | **优先级**: medium

在 Web UI 侧边栏添加新的 "Wiki" 区域，位于 "Documents" 下方，显示 `backlog/wiki` 文件夹内容，支持可折叠文件树导航。

## 功能

- 侧边栏 Wiki 树反映 `backlog/wiki/` 实际目录结构，文件夹为可折叠节点，`.md` 文件为叶子项
- 点击 Wiki 文件导航到 `/wiki/:path`，以只读方式渲染 Markdown（复用 Documentation 的渲染管道：`MermaidMarkdown`、MDEditor preview、暗黑模式支持）
- 深度链接支持：直接访问 `/wiki/concepts/core-architecture` 加载正确文件
- 折叠侧边栏状态显示 Wiki 图标按钮，展开侧边栏并打开 Wiki 区域
- Wiki 内容只读，编辑通过 LLM wiki 工作流进行

## 后端 API

- `GET /api/wiki/tree` — 递归遍历 `backlog/wiki/`，跳过 `wiki_output/`，返回嵌套 JSON 树结构（name, path, type: file|directory, children）
- `GET /api/wiki/*` — 读取 Wiki 文件，解析 YAML frontmatter，返回 `{ content, frontmatter }`
- 使用 Bun 原生路由通配符 `/api/wiki/*`（非 `:path`），因为 Wiki 路径是多段的如 `concepts/core-architecture.md`

## 前端实现

- `WikiDetail` 组件（类似 `DocumentationDetail`）用于只读 Markdown 显示
- `WikiTreeItem` 递归 memo 组件：目录渲染为可折叠按钮，文件渲染为 `NavLink`
- `[[wikilinks]]` 在 Markdown 内容中被替换为粗体文本（`**$1**`），因为 `MermaidMarkdown` 通过 `sanitizeMarkdownSource` 净化原始 HTML
- 添加 `WikiTreeNode` 和 `WikiPage` 类型到 `src/types/index.ts`

## 验证

- `bunx tsc --noEmit` passes
- `bunx biome check --files-ignore-unknown=true` passes on all modified files
- `bun test src/test/web` passes (33 tests)
- `bun test src/test/documentation.test.ts` passes (10 tests)
