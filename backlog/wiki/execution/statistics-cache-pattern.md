---
title: 统计缓存实现模式
labels: [execution, pattern, cache, websocket]
created_date: 2026-05-31 01:11
updated_date: 2026-05-31 01:11
extracted_from:
  - BACK-503
---

# 统计缓存实现模式

## Scenario

Web UI Statistics 页面需要展示大量计算数据（任务状态分布、优先级分布、健康指标、热力图）。每次页面加载或切换标签页都重新计算会导致明显的加载延迟。同时，用户可能通过 CLI 或其他途径修改任务，页面需要自动感知变化并刷新。

## Pattern

### 服务端三层缓存

```
ContentStore 变更 ──► invalidateStatistics() ──► 500ms debounce
                                                    │
                                                    ▼
                              recomputeAndBroadcastStatistics()
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              cachedStatisticsResponse      broadcast "statistics-updated"
                    │                               │
                    ▼                               ▼
            handleGetStatistics()              客户端 WebSocket
            (优先返回缓存)                         监听事件
```

**关键设计点：**
1. **`invalidateStatistics()` 必须在所有 ContentStore 事件中被调用** — 包括 `"ready"` 和非 ready 事件。如果只监听非 ready 事件，初始化阶段的任务加载不会触发缓存失效。
2. **`statisticsDirty` 守卫** — `recomputeAndBroadcastStatistics()` 开头检查 `statisticsDirty`，防止过期计时器触发重复计算。
3. **计算期间二次变更检测** — 如果 `recomputeAndBroadcastStatistics()` 执行期间有新变更发生（`statisticsDirty` 被重新设为 true），计算完成后再次调用 `invalidateStatistics()` 安排下一轮。
4. **`cachedStatisticsResponse = null` 在 invalidate 时立即执行** — 确保在 debounce 窗口期内到达的请求不会返回旧缓存。

### 客户端双缓存

```
首次加载 ──► localStorage.getItem('backlog-statistics') ──► 瞬时渲染
                    │                                         │
                    ▼                                         ▼
            API 请求 (后台)                              WebSocket "statistics-updated"
                    │                                         │
                    ▼                                         ▼
            localStorage.setItem(...) ◄────────────────── 触发 fetchStatistics(true)
```

**关键设计点：**
1. **localStorage 作为 L1 缓存** — 用户刷新页面或重新打开浏览器时，先展示上次缓存的数据，后台静默拉取最新数据。
2. **WebSocket 事件双监听** — 同时监听 `"statistics-updated"`（服务端主动推送）和 `"tasks-updated"`（300ms debounce 兜底），确保不会因为遗漏某个事件而 stale。

## Common Pitfalls

- **Debug 日志阻塞事件循环** — `getTaskStatistics()` 中遗留的 `console.log` 会在处理数百个任务时输出数百行日志，严重阻塞 Bun 事件循环，导致 API 无响应。生产代码中必须移除热点路径的 debug 日志。
- **App.tsx 覆盖 locale** — `loadAllData()` 无条件调用 `setLocale(configData.locale)` 会覆盖用户在 Settings 中的手动选择。修复：仅 `isFirstLoad` 时同步。

## Reference Tasks
- [[sources/task-completion-heatmap-task]] — BACK-503 完整实现
