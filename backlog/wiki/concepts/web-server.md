---
title: Web Server 与浏览器界面
labels: [concept]
created_date: 2026-05-10 00:00
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
| 里程碑 | `/api/milestones/:id` | GET、PUT、DELETE |
| 里程碑 | `/api/milestones/:id/archive` | POST |
| 搜索 | `/api/search` | GET（query、filters、limit） |
| 序列 | `/api/sequences` | GET |
| 序列 | `/api/sequences/move` | POST |
| 统计 | `/api/statistics` | GET |
| 配置 | `/api/config` | GET、PUT |
| 初始化 | `/api/init` | POST |
| 文件内容 | `/api/file-content` | GET（本地文件预览） |
| 资源上传 | `/api/upload` | POST（`?temp=1` 临时上传） |
| 资源提升 | `/api/assets/promote` | POST（`.temp/` → `paste/`） |
| Wiki 树 | `/api/wiki/tree` | GET |
| Wiki 页面 | `/api/wiki/*` | GET |
| Word 转换 | `/api/docx/convert` | POST |

## 实时同步

- **WebSocket**：客户端连接后收到 `tasks-updated` 和 `config-updated` 消息
- **ContentStore 订阅**：`BacklogServer` 订阅 `ContentStore` 的变更事件，自动广播给所有 WebSocket 客户端
- **无缓存策略**：所有 GET/HEAD 响应附加 `no-store` 缓存头，确保浏览器始终获取最新数据

## SPA 路由

所有前端路由（`/tasks`、`/milestones`、`/documentation/*`、`/wiki/*` 等）都回退到 `index.html`，由 React Router 处理客户端路由。`Bun.serve()` 的 `routes` 配置原生支持 SPA fallback。

## 前端技术栈

`src/web/` 目录包含浏览器前端：
- `main.tsx` / `App.tsx`：React 应用入口
- `index.html`：HTML 模板，被 Bun 作为 `HTMLBundle` 导入
- `locales/`：翻译字典（`en.ts` `ja.ts` `zh-CN.ts` `zh-TW.ts`），编译时嵌入二进制
- `contexts/I18nContext.tsx` + `hooks/useI18n.ts`：零依赖国际化层
- 通过 Bun 的 import attributes（`with { type: "file" }`）内联 favicon
