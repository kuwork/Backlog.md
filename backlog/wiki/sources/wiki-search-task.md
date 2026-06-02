---
title: BACK-481 将 Wiki 纳入 Web 搜索范围
labels: [source]
source_path: backlog/tasks/back-481 - Add-wiki-to-web-search.md
created_date: 2026-05-22 00:00
updated_date: 2026-05-22 00:00
---

# BACK-481 将 Wiki 纳入 Web 搜索范围

**状态**: Done | **标签**: web-ui, search, wiki, enhancement | **优先级**: medium

Web UI 左上角搜索框原先仅支持 task、document、decision 三类结果。Wiki 页面虽有独立路由 `/wiki/*`，但未被 `SearchService` 索引，导致用户无法通过统一搜索栏找到 wiki 内容。

本任务将 wiki 页面纳入搜索索引与 Web 搜索 UI，支持 `type:wiki <keyword>` 语法过滤。

## 关键实现

### 类型定义扩展

- `src/types/index.ts`：
  - `SearchResultType` 新增 `"wiki"`
  - 新增 `WikiSearchResult` 接口（`id`、`title`、`path`、`type`）

### 数据层：FileSystem 批量加载

- `src/file-system/operations.ts`：
  - 新增 `listWikiPages()`：递归遍历 `backlog/wiki/`，读取所有 `.md` 文件并解析 frontmatter
  - 返回 `WikiPage[]` 数组供 ContentStore 消费

### 缓存层：ContentStore 集成

- `src/core/content-store.ts`：
  - `ContentSnapshot` 新增 `wikis: WikiPage[]`
  - 初始化时调用 `listWikiPages()` 加载 wiki 数据
  - 新增 wiki 文件监视器（`FSWatcher`），文件变更时刷新缓存并广播 `"wikis"` 事件
  - 与 tasks/documents/decisions 共用同一套快照/事件管道

### 搜索层：SearchService 索引

- `src/core/search-service.ts`：
  - 新增 `WikiSearchEntity`（`title`、`bodyText`、`fileName`、`path`、`type`）
  - 标题解析优先级：`frontmatter.title` → 文件名去 `.md`
  - Fuse.js 索引增加 `fileName` 键（weight 0.25），支持按文件名搜索
  - 监听 ContentStore `"wikis"` 事件，自动重建索引

### 服务端与 CLI

- `src/server/index.ts`：`/api/search` 允许 `type=wiki` 过滤
- `src/cli.ts`：`--type wiki` 被识别，但 CLI 纯文本输出故意跳过 wiki 结果（TUI 无 wiki 查看器）

### Web 搜索 UI

- `src/web/components/SideNavigation.tsx`：
  - 导入 `WikiSearchResult`，新增 wiki 图标（书本图标）
  - 渲染 wiki 结果时显示标题与路径
  - 点击后导航到 `/wiki/${path}`

## 验证

- `bun test src/test/search-service.test.ts` → 6 pass
- `bun test src/test/server-search-endpoint.test.ts src/test/cli-search-command.test.ts` → 22 pass
- `bunx tsc --noEmit` → 无新增类型错误
- `bun run check --write` → 3 文件自动格式化，无 lint 错误

## Related Concepts

- [[concepts/search-sequences]] — 搜索与序列
- [[concepts/web-ui-features]] — Web UI 功能
- [[concepts/core-architecture]] — 核心架构与数据流
