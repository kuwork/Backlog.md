---
title: Web Server 与浏览器界面
labels: [concept]
created_date: 2026-05-10 00:00
updated_date: 2026-05-31 01:11
---


# Web Server 与浏览器界面

`src/server/index.ts` 中的 `BacklogServer` 类提供完整的 HTTP API、WebSocket 实时推送和 React SPA 托管。它使用 `Bun.serve()` 作为底层服务器。

## 架构

```
BacklogServer
├── core: Core（enableWatchers: true）
├── contentStore: ContentStore
├── searchService: SearchService
├── server: Bun.Server
├── sockets: Set<ServerWebSocket>
└── configWatcher: 配置变更监视器
```

## API 设计

RESTful API 按资源组织：

| 资源 | 端点 | 方法 |
|---|---|---|
| 任务 | `/api/tasks` | GET（列表）、POST（创建） |
| 任务 | `/api/tasks/:id` | GET、PUT、DELETE |
| 任务 | `/api/tasks/:id/complete` | POST |
| 草稿 | `/api/drafts` | GET |
| 草稿 | `/api/drafts/:id/promote` | POST |
| 文档 | `/api/docs` | GET、POST |
| 文档 | `/api/docs/:id` | GET、PUT |
| 决策 | `/api/decisions` | GET、POST |
| 决策 | `/api/decisions/:id` | GET、PUT |
| 里程碑 | `/api/milestones` | GET、POST |
| 里程碑 | `/api/milestones/:id` | GET、PUT（含日期字段）、DELETE |
| 里程碑 | `/api/milestones/:id/archive` | POST |
| 搜索 | `/api/search` | GET（query、filters、limit） |
| 序列 | `/api/sequences` | GET |
| 序列 | `/api/sequences/move` | POST |
| 统计 | `/api/statistics` | GET（服务端缓存，500ms debounced 自动刷新） |
| 配置 | `/api/config` | GET、PUT |
| 初始化 | `/api/init` | POST |
| 文件内容 | `/api/file-content` | GET（本地文件预览） |
| 资源上传 | `/api/upload` | POST（`?temp=1` 临时上传） |
| 资源提升 | `/api/assets/promote` | POST（`.temp/` → `paste/`） |
| Wiki 树 | `/api/wiki/tree` | GET |
| Wiki 页面 | `/api/wiki/*` | GET |
| Word 转换 | `/api/docx/convert` | POST |

## 实时同步

- **WebSocket**：客户端连接后收到 `tasks-updated`、`config-updated` 和 `statistics-updated` 消息
- **ContentStore 订阅**：`BacklogServer` 订阅 `ContentStore` 的变更事件，自动广播给所有 WebSocket 客户端
- **统计缓存**：`cachedStatisticsResponse` 缓存 JSON 响应，`invalidateStatistics()` 在 ContentStore 变更时触发 500ms debounce，重新计算后广播 `"statistics-updated"`。`handleGetStatistics()` 优先返回缓存，无缓存时即时计算（BACK-503）
- **无缓存策略**：除统计 API 外，所有 GET/HEAD 响应附加 `no-store` 缓存头，确保浏览器始终获取最新数据

## SPA 路由

所有前端路由（`/tasks`、`/milestones`、`/documentation/*`、`/wiki/*` 等）都回退到 `index.html`，由 React Router 处理客户端路由。`Bun.serve()` 的 `routes` 配置原生支持 SPA fallback。

## 前端技术栈

`src/web/` 目录包含浏览器前端：
- `main.tsx` / `App.tsx`：React 应用入口
- `index.html`：HTML 模板，被 Bun 作为 `HTMLBundle` 导入
- `locales/`：翻译字典（`en.ts` `ja.ts` `zh-CN.ts` `zh-TW.ts`），编译时嵌入二进制
- `contexts/I18nContext.tsx` + `hooks/useI18n.ts`：零依赖国际化层
- 通过 Bun 的 import attributes（`with { type: "file" }`）内联 favicon

## 浏览器服务器安全与启动

### 仅绑定回环地址（BACK-558）

`BacklogServer.start()` 默认绑定 `127.0.0.1`，用户界面仍显示/打开 `http://localhost:PORT`。`backlog browser --host <host>` 可显式绑定其他接口（如 `--host 0.0.0.0`）。通配绑定时打印具体 LAN IPv4 地址并提示 API 未认证。

### 浏览器启动命令（BACK-559）

`src/utils/browser-launch.ts` 统一处理浏览器打开：
- 非空 `BROWSER` 环境变量被视为单个可执行路径（去除包裹引号，不 split，不 shell-evaluate），URL 作为独立参数传入
- 否则按平台回退：`open`（macOS）、`cmd /c start`（Windows）、`xdg-open`（Linux）

## 异步加载与实时同步

### bind-first 启动与真实加载指示（BACK-566）

- `start()` 先绑定 Bun 服务器，后台通过 `servicesReadyPromise` 一次性初始化 Core 语料；所有 handler 等待同一 promise，避免重复全量扫描
- WebSocket 推送 `browserLoadingState`（loading/loaded/error），保留最新阶段并发送给迟到连接
- Board/SideNavigation/Layout 显示真实骨架屏/加载阶段/可重试错误面板
- 加载阶段文案通过 `loadingPhases` 本地化，未知消息回退英文

### 广播防抖与 reorder 原子应用（BACK-568）

- `tasks-updated` WebSocket 广播 75ms 防抖，批量更新只发布一次
- Reorder 返回 `changedTasks`，前端通过 `applyReorderedTasks` 原子合并而非全量刷新

## Related Sources

- [[sources/back-558-browser-server-loopback-only]] — 回环绑定
- [[sources/back-559-browser-launch-honor-browser-env]] — BROWSER 环境变量
- [[sources/back-566-browser-async-loading]] — 异步加载指示
- [[sources/back-568-core-browser-task-boundary]] — Core 浏览器边界
