---
title: BACK-661 - 深链首次加载完成前不回退看板
labels: [source, web-ui, deep-links, browser-loading]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-661 - Keep-task-deep-links-from-falling-back-to-the-board-before-the-first-load.md
---

# BACK-661 - 深链首次加载完成前不回退看板

打开任务深链会落到看板而不是任务模态框。服务端会在 WebSocket 打开时重放自己的 `{"type":"loaded"}` 广播，在浏览器首次 `/api/search` 仍在进行时清除了 `isLoading`——深链同步 effect 随后把 URL id 与空任务列表匹配，`navigate("/")` 抹掉了有效链接。fork 本地修复（上游没有 `taskIdFromUrl`）。

- 用 headless Chrome + CDP 复现，3/3，冷/热服务端均复现：`loaded` 重放约 780ms 到达，首次 `/api/search`（4.7MB、347 任务）约 1019ms 才完成；用永不打开的 WebSocket 做因果检查，URL 保持完好
- 是时序问题而非新代码：重放来自 BACK-566，防护来自 BACK-509；变化在于首次 search 负载增长到约 0.8s，且 WebSocket 握手被启动请求延迟，两者发生碰撞——较小的仓库里 search 会赢下竞态
- 修复：新增 `hasCompletedFirstLoad` 状态，在 `loadAllData` 的 `finally` 中设置；深链 effect 以它为守卫并列为依赖，首次加载完成时重新运行（`src/web/App.tsx:349`、`:412`、`:520`、`:580`）
- 实测的微妙点：仅 ref 的守卫保住了 URL 但永远不会打开模态框——`loadAllData` 在标记加载完成前会等待 `/api/tasks/duplicate-ids`（比 search 慢），因此 `/api/search` 之后的渲染是该 effect 看到的最后一次依赖变化，之后的 ref 翻转不会再触发它；`hasLoadedRef` 单独保留，因为 `loadAllData` 会同步读取它
- 未改动：`isLoading` 仍由 `loading`/`loaded`/`error` 帧驱动加载指示器（BACK-566 设计），首次加载后真正未知 id 仍回退 `/`
- 测试在 JSDOM 中挂载真实 `App`，使用缓慢的首次 search、立即的 `loaded` 帧和延迟的 duplicate-id 预览；在未修改守卫与仅 ref 守卫下均红；通过 headless Chrome + CDP 在真实浏览器验证（`dialog=true`，URL 保持）

## 验收标准

- 即使服务端 `loaded` 广播先于首次 `/api/search` 完成，已有任务的深链也会打开其模态框，URL 不变
- 等待是响应式的：首次加载完成后 effect 重新运行并打开模态框，尽管 `duplicate-ids` 在 search 之后才完成
- 首次加载后真正未知的 id 仍回退 `/`；`isLoading` 继续驱动加载指示器
- 自动化测试复现该竞态，在未修改守卫与仅 ref 守卫下均失败

## Related Concepts
- [[concepts/browser-loading]] — 发生碰撞的服务端加载广播与本浏览器首次加载状态
- [[concepts/web-ui-features]] — 深链模态框路由约定

## Related Sources
- [[sources/back-566-browser-async-loading]] — 在竞态根源引入 WebSocket `loaded` 重放
- [[sources/stable-task-modal-urls-task]] — 深链 effect 服务的稳定任务 URL 设计
- [[sources/back-664-dependency-input-completed-predecessors]] — 同一 App 级导航回退机制，为已完成记录扩展
