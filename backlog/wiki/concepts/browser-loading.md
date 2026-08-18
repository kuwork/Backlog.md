---
title: 浏览器加载状态
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels: [concept, web-ui, server, performance]
---

# 浏览器加载状态

浏览器界面在 Core 语料初始化期间显示真实加载状态，而不是白屏或空数据。

## 三态模型

`browserLoadingState` 通过 WebSocket 推送：
- `loading`：附带来自 Core 加载阶段的本地化消息
- `loaded`：语料就绪
- `error`：初始化失败，可重试

最新状态保留并发送给迟到连接。

## UI 行为

- Board：骨架屏 + 当前阶段文本；错误时显示重试面板
- SideNavigation：保持挂载，计数显示骨架，阶段文本可见
- Layout：透传 loading/error/onRetry
- 加载阶段通过 `loadingPhases` 本地化字典翻译，未知消息回退英文

## 服务端支撑

- `servicesReadyPromise` 去重 Core 初始化
- 服务器先 `Bun.serve` 绑定，handler 后台等待同一 promise
- 消除空闲 publications 和重复全量扫描

## Related Sources

- [[sources/back-566-browser-async-loading]] — 异步加载指示实现
- [[sources/back-568-core-browser-task-boundary]] — Core 边界与防抖
