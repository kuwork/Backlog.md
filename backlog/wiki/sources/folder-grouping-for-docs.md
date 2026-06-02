---
title: Web UI 文档文件夹分组 (BACK-423)
source_path: backlog/tasks/back-423 - Add-folder-grouping-for-docs-in-Web-UI.md
labels: [source, web-ui, docs, enhancement]
created_date: 2026-05-22 02:15
updated_date: 2026-05-22 02:15
---

# Web UI 文档文件夹分组 (BACK-423)

为 Web UI 侧边栏中的文档列表添加文件夹树形分组功能，使其与现有的 Wiki 导航体验保持一致。解决 GitHub issue #488。

## 问题

当文档存储在 `backlog/docs/` 的子目录中时，Web UI 侧边栏此前以扁平列表渲染，用户无法查看文件夹结构、展开/折叠分组，或在添加文档之前创建新文件夹。

## 方案概览

一套覆盖后端、API 和前端的完整文档文件夹树系统：

### 后端

- **`DocsTreeNode` 类型** (`src/types/index.ts`)：`{ name, path, type: "file" | "directory", docId?, children? }`
- **`getDocsTree()`** (`src/file-system/operations.ts`)：递归遍历 `backlog/docs/`，构建包含文件和目录的树结构。从 `{id} - {title}.md` 文件名中解析 `docId`。与 `getWikiTree()` 对称设计。
- **`createDocsFolder()`** (`src/file-system/operations.ts`)：在 `backlog/docs/` 下创建目录，使用 `normalizeDocumentSubPath()` 进行路径规范化，并执行目录遍历安全检查。
- **API 端点** (`src/server/index.ts`)：
  - `GET /api/docs/tree` → 返回 `core.filesystem.getDocsTree()` 构建的树
  - `POST /api/docs/folder` → 通过 `core.filesystem.createDocsFolder()` 创建文件夹

### 前端

- **API 客户端** (`src/web/lib/api.ts`)：`fetchDocsTree()`、`createDocsFolder()`
- **状态管理** (`src/web/App.tsx`)：`docsTree` 与 `docs`、`decisions`、`wikiTree` 并行加载
- **SideNavigation** (`src/web/components/SideNavigation.tsx`)：
  - `DocTreeItem`：递归组件，渲染文件夹（支持展开/折叠、文件数量徽标、`localStorage` 持久化 `DOCS_EXPANDED_PATHS_KEY`）和文件（NavLink 到 `/documentation/...`）
  - `DocActionDropdown`：每个文件夹的下拉菜单，支持"新建文件"和"新建文件夹"
  - 区域标题显示文档数量和下拉菜单，替代原先的独立创建按钮
- **新建文档流程** (`src/web/components/DocumentationDetail.tsx`)：支持 `?path` 查询参数 (`/documentation/new?path=<folderPath>`) 预填充目标文件夹路径

## 关键设计决策

### 为何使用独立的 `docsTree` 而非从 `docs` 数组派生

`docs` 数组由 `listDocuments()` 生成，仅包含 `.md` 文件，空文件夹不可见。为支持"不创建文档先创建文件夹"，侧边栏需要包含目录的文件系统遍历。

### 文档树没有独立重命名操作

文档遵循 `{id} - {title}.md` 命名约定。后端的 `saveDocument()` 在用户编辑标题时自动重命名文件并删除旧文件。用户通过编辑文档标题完成重命名。这与 Wiki 页面不同（Wiki 文件名独立于内容，需要独立重命名操作）。

### 树节点标题解析

`getDocsTree()` 从文件名解析文档 ID，但为性能不读取文件内容。前端通过 `docId` 在已加载的 `docs` 数组中查找人类可读标题。查找失败（罕见竞态条件）时回退到净化后的文件名。

### 树视图不使用 `filteredDocs`

原先的扁平列表使用 `filteredDocs`。树视图下，搜索结果仍显示在导航区域上方的统一搜索下拉框中；文档树始终渲染完整的 `docsTree` 以保持文件夹结构。

## 验收标准

- [x] 文档列表按文件夹或 comparable path/type 分组
- [x] 用户可展开和折叠分组，不失去对扁平文档的访问
- [x] 现有文档的创建/查看/编辑行为对未分组文档继续生效

## 相关概念

- [[concepts/web-ui-features]]
- [[concepts/core-architecture]]
- [[concepts/asset-management]]

## 相关来源

- [[sources/web-ui-i18n-task]]
- [[sources/path-autocomplete-task]]
- [[sources/milestone-search-fix]]
