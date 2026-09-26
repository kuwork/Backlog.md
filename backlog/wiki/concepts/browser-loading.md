---
title: 浏览器加载状态
created_date: '2026-08-17 23:00'
updated_date: '2026-09-26 14:45'
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

## 首载守卫与竞态（BACK-661）

服务器在 WebSocket 打开时回放自身 `loaded` 广播，可能在首个 `/api/search` 落地前清除 `isLoading`，导致深链接同步效应用空任务列表匹配 URL 并 `navigate("/")` 抹掉有效链接。修复：新 `hasCompletedFirstLoad` state 在 `loadAllData` 的 `finally` 置位，深链接 effect 以其为守卫与依赖，首载完成后重新运行打开模态框；`isLoading` 仍驱动加载指示器，真正未知 ID 的回退保留。

## Header chip + skeleton 架构（BACK-668/669）

- 加载/索引阶段文案由头部右侧 `BranchIndexingIndicator` chip（`role="status"`，250ms 延迟出现 / 200ms 淡出，附 2px 扫掠轨道）独占展示；`BoardLoadingSkeleton` 幽灵列与 `SideNavigation` 骨架刻意不携带 message prop，避免同一行进度的第二份拷贝
- `hasLoadedDataRef` 门控中段会话骨架：仅首个成功加载前的 `loading` 帧才置 `isLoading`，已加载看板在索引期间保持可交互

## Always-animate 约定（BACK-670）

加载进度是必要反馈而非装饰：移除上游继承的 `motion-reduce:animate-none` / `motion-reduce:hidden`（共 6 处），保证 RDP/VM/ kiosk 等禁用动画的主机上加载环仍旋转；`motion-reduce` 保留给未来的纯装饰动效。每个移除点带 WHY 注释，已在迁移台账登记为刻意分叉。

## 路由守卫与静默重载（BACK-633/637/639）

- `handledRouteIdRef` 守卫：文档/决策详情加载器只对真实的路由 ID 变化响应，WebSocket 刷新不再重挂载正文（顺带修复编辑模式被关闭、进行中的编辑被覆盖）
- 裸 ID URL 归一化为 slug 形式时携带 `location.hash`，避免锚点丢失（637）
- 指纹静默重载（639）：`parseDocument` 盖上 `contentHash`（length + FNV-1a，随 `/api/docs` 下发），与屏幕正文指纹不同时才走 `loadDocContent({silent})` 静默重载——DOM 保持挂载，滚动位置与 hash 锚点存活；编辑模式跳过，失败保留当前正文

## 服务端支撑

- `servicesReadyPromise` 去重 Core 初始化
- 服务器先 `Bun.serve` 绑定，handler 后台等待同一 promise
- 消除空闲 publications 和重复全量扫描

## Related Sources

- [[sources/back-566-browser-async-loading]] — 异步加载指示实现
- [[sources/back-568-core-browser-task-boundary]] — Core 边界与防抖
- [[sources/back-661-deep-link-first-load-guard]] — BACK-661 hasCompletedFirstLoad 首载守卫
- [[sources/back-668-branch-indexing-header-chip]] — BACK-668 header chip 独占进度文案
- [[sources/back-669-initial-loading-skeleton]] — BACK-669 首载骨架屏
- [[sources/back-670-loading-motion-reduce-removal]] — BACK-670 always-animate 约定
- [[sources/back-637-hash-anchors-on-load]] — BACK-637 handledRouteIdRef 守卫与 hash 保留
- [[sources/back-639-document-fingerprint-reload]] — BACK-639 指纹静默重载
