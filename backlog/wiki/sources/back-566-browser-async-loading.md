---
title: BACK-566 - 浏览器异步稳定加载指示
labels: [source, web-ui, server, performance]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-566 - Make-browser-task-loading-asynchronous-idle-stable-and-loading-indicator-driven.md
---

# BACK-566 - 浏览器异步稳定加载指示

浏览器启动改为围绕单一共享 Core 语料的异步空闲稳定模式，加载指示由 Core 进度阶段真实驱动。

## 实现要点

- `src/server/index.ts`：引入去重的 `servicesReadyPromise`；`start()` 先绑定服务器再等待服务；处理器 await 共享 promise；新增 `browserLoadingState`（loading/loaded/error）并经 WebSocket 发布 `publishBrowserLoadingState`；为迟到连接保留最新阶段。
- `src/core/backlog.ts`：`getContentStore` 将 Core `loadTasks` 进度传入 ContentStore 加载器。
- `src/core/content-store.ts`：`taskLoader` 接受进度回调。
- `src/utils/browser-loading-state.ts`：`BrowserLoadingState` 类型 + `parseBrowserLoadingState`。
- `src/web/App.tsx`：WebSocket `onmessage` 将 loading/loaded/error 解析为 `isLoading`/`loadingMessage`/`loadError` 并传给 Layout/BoardPage。
- `src/web/components/Board.tsx`：显示带加载阶段的骨架面板或可重试的错误面板。
- `src/web/components/SideNavigation.tsx`：保持挂载，显示计数骨架与加载阶段；折叠态提供错误/重试入口。
- `src/web/components/Layout.tsx`：转发加载阶段/错误/重试。
- 四个语言文件新增 `loadingPhases` 键；`src/utils/loading-messages.ts` 将 Core 进度模式映射到这些键，英语为回退。

Fork 适配：不做读取时刷新指纹（由 watcher 驱动广播），不移植纯协议层的请求所有权机制，看板已完成/已归档过滤留给 BACK-260。

## Related Concepts

- [[concepts/web-server]] — 服务器与 WebSocket 行为
- [[concepts/web-ui-features]] — Web UI 视图与状态
- [[concepts/browser-loading]] — 浏览器加载状态模型

## Related Sources

- [[sources/back-568-core-browser-task-boundary]] — Core 浏览器任务边界
