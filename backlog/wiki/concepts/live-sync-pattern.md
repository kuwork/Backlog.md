---
title: Web UI 实时同步复用模式
labels: [concept, web-ui, realtime]
created_date: 2026-10-03 01:13
updated_date: 2026-10-09 23:30
---

# Web UI 实时同步复用模式

Web UI 中"外部编辑实时反映到页面"的标准接线模式，三件套：**window 事件转发 + 防抖广播 + refreshInPlace 原地刷新**。memos、drafts、board 等多个 surface 复用同一形状。

## 三件套

### 1. 服务端：防抖广播

- 文件变化（fs.watch 或 ContentStore watcher）调用 `broadcastDataUpdated(scope)`，**75ms 防抖**合并为一条 websocket 消息（如 memos-updated）。
- 不在 ContentStore 快照内的语料（如 memos）不会被 store 事件自动广播，需要专用 watcher 补偿（memos 用 `startMemoWatcher()`，目录缺失非致命、随首次触店 store 的请求启动）；且在快照内的实体每次写操作后 handler 必须显式广播（[[sources/back-735-memos-realtime-sync]]）。
- 冗余无害：一次 API 写入会触发两次广播（handler 一次、watcher 看到新文件再一次），防抖加幂等刷新使冗余无害——而这正是外部编辑可用的原因。

### 2. 客户端：window 事件转发

- App.tsx 的 WebSocket 监听新增对应 scope 的分支，以 **window 事件转发**给页面组件（复刻 drafts-updated 模式），因为状态在页面组件内而非 shell。
- 页面组件用 `window.addEventListener` 接收，scope 字符串进 `DataUpdatedScope` 联合类型。

### 3. 页面：refreshInPlace 原地刷新

- refreshInPlace 回调**重新拉取用户当前窗口**（第一页加屏上已加载页数），按 id 并入现有状态；视图状态、选中项、已加载页全部保留——不回第一页、不整页刷新（[[sources/back-735-memos-realtime-sync]]）。
- 后台刷新失败选择吞掉（仅 console.warn）：正常加载路径遇错会把整个视图换成错误横幅，后台刷新若沿用该路径反而重置视图。

## 复用面

- **memos**：memos-updated → MemosPage，feed 按 id 并入 + 日历计数与展开日子面板刷新（[[sources/back-735-memos-realtime-sync]]）。
- **drafts**：drafts-updated 是同形状的先例（memos-updated 转发模式复刻自它）。
- **board**：ContentStore 实体广播刷新的既有先例（[[sources/back-700-content-entity-broadcast-refresh]]）。

注意区分：TUI 侧的实时同步是另一套机制——fs.watch 经 watcher 会话直接喂 board update funnel（[[sources/back-694-board-popup-live-sync]]、[[sources/back-695-drafts-session-live-sync]]、[[sources/back-696-milestone-popup-live-sync]]），不经 websocket/window 事件。

## Related Concepts

- [[concepts/web-server]] — DataUpdatedScope、broadcastDataUpdated 与 websocket 广播所在层
- [[concepts/web-ui-features]] — 页面组件持有视图状态、App shell 转发事件的组件分层
- [[concepts/memos]] — 本模式在 memos 上的完整落地（专用 watcher 补偿）
- [[concepts/core-architecture]] — ContentStore 快照边界决定哪些语料需要 watcher 补偿

## Related Sources

- [[sources/back-735-memos-realtime-sync]] — 模式的 memos 落地（三件套全貌）
- [[sources/back-700-content-entity-broadcast-refresh]] — ContentStore 实体广播刷新先例
- [[sources/back-695-drafts-session-live-sync]] — drafts-updated 模式来源（TUI 侧 watcher 变体）
