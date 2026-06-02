---
title: BACK-473 Web UI Wiki 区域与文件树导航
labels: [source]
source_path: backlog/tasks/back-473 - Add-wiki-section-to-web-UI-with-file-tree-navigation.md
created_date: 2026-05-10 00:00
updated_date: 2026-05-20 21:30
---


# BACK-473 Web UI Wiki 区域与文件树导航

**状态**: Done | **标签**: web-ui, wiki, feature | **优先级**: medium

在 Web UI 侧边栏添加新的 "Wiki" 区域，位于 "Documents" 下方，显示 `backlog/wiki` 文件夹内容，支持可折叠文件树导航。

## 原始任务范围（BACK-473）

- 侧边栏 Wiki 树反映 `backlog/wiki/` 实际目录结构，文件夹为可折叠节点，`.md` 文件为叶子项
- 点击 Wiki 文件导航到 `/wiki/:path`，渲染 Markdown（复用 Documentation 的渲染管道：`MermaidMarkdown`、MDEditor preview、暗黑模式支持）
- 深度链接支持：直接访问 `/wiki/concepts/core-architecture` 加载正确文件
- 折叠侧边栏状态显示 Wiki 图标按钮，展开侧边栏并打开 Wiki 区域
- 后端 API：`GET /api/wiki/tree`（文件树）、`GET /api/wiki/*`（读取页面）

## 后续演进（代码迭代）

BACK-473 完成后，Wiki Web UI 经历了多轮功能增强，**已超越原始任务的"只读"定位**：

### 在线编辑

- `WikiDetail` 组件支持**全文在线编辑**：标题、正文、labels 均可修改
- 使用 `PasteAwareMDEditor` 作为编辑器，支持富文本粘贴转 Markdown
- 保存时调用 `PUT /api/wiki/*` 更新文件，自动同步 frontmatter（`title`、`updated_date`、`labels`）
- 未保存变更检测（`hasChanges`），提供 Save / Cancel 操作
- 保存成功后显示 `SuccessToast` 通知

### Wikilink 交互与预览

- `[[wikilinks]]` 在渲染时被替换为**可点击的内部链接**（`/wiki/encodedPath`），而非粗体文本
- 点击 wikilink 不直接跳转，而是弹出**预览模态框**（`WikiLinkPreview`），异步加载目标页面内容
- 预览模态框包含页面路径、渲染后的 Markdown 内容，支持关闭
- 这一设计避免了频繁页面跳转，保持浏览上下文

### 文件管理（侧边栏操作）

- 侧边栏文件/文件夹 hover 显示 `+` 下拉菜单，支持：
  - **创建文件**：在指定目录下新建 `.md` 文件，自动导航到新页面
  - **创建文件夹**：新建目录节点
  - **重命名**：修改文件或文件夹名称，若当前正在浏览被重命名的页面，自动导航到新路径
- 调用 `POST /api/wiki`（创建）、`PATCH /api/wiki/*`（重命名）后端 API
- 目录折叠状态持久化到 `localStorage`

### 后端 API 扩展

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/api/wiki/tree` | 递归文件树 |
| GET | `/api/wiki/*` | 读取页面（content + frontmatter）|
| PUT | `/api/wiki/*` | 更新页面（content、title、labels）|
| POST | `/api/wiki` | 创建页面或文件夹 |
| PATCH | `/api/wiki/*` | 重命名页面或文件夹 |

### 前端技术细节

- `WikiTreeItem` 递归 memo 组件，目录渲染为可折叠按钮，文件渲染为 `NavLink`
- 使用 `localStorage` 持久化各目录的展开/折叠状态（`wikiExpandedPaths`）
- 文件数量统计（`countWikiFiles`）显示在每个目录节点旁
- 与 Documentation/Decisions 区域一致的视觉风格（chevron、hover、active 状态）

## 验证

- `bunx tsc --noEmit` passes
- `bunx biome check --files-ignore-unknown=true` passes on all modified files
- `bun test src/test/web` passes (33 tests)
- `bun test src/test/documentation.test.ts` passes (10 tests)

## Related Concepts

- [[concepts/web-ui-features]] — Web UI 功能总览
- [[concepts/web-server]] — Web Server 与浏览器界面
- [[concepts/markdown-pipeline]] — Markdown 解析与序列化流水线
- [[concepts/asset-management]] — 资源管理与临时文件提升
