---
title: BACK-698 - Web 视图原地刷新替代全量重载
labels: [source, web-ui, performance, live-refresh]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-698 - Update-web-views-in-place-instead-of-full-reload-on-data-changes.md
---

# BACK-698 - Web 视图原地刷新替代全量重载

每次服务器广播都重建整个客户端存储——每次广播十个端点的突发，拖拽时触发两次，卡片移动感觉像页面重载。单卡重排序路径早已展示正确形态（手术式应用返回任务，无重新获取）；本任务将其推广为标准刷新：获取搜索语料并原地对账，仅在增量更新不可信处保留全量重载。

## 实现要点

- 新 `src/web/utils/reconcile.ts`：`deepEqual`（键序无关，undefined 键等于缺失）与 `reconcileById`（未变记录保持其对象，未变列表保持其数组）——正是这个身份把回显广播变成状态 no-op
- 服务器（`src/server/index.ts`）：`broadcastTasksUpdated` 变为 `broadcastDataUpdated(scope)`，待处理作用域在既有 75 ms 防抖内保持最宽；里程碑 update/remove/archive 端点传里程碑作用域，create 端点——过去什么都不发布——现在广播，因此 API 创建的里程碑到达每个客户端
- 客户端（`src/web/App.tsx`）：存储列表（tasks、docs、decisions、milestone 实体、已归档里程碑）镜像在 ref 中，使刷新无需重订阅 WebSocket effect 即可对账；`applySearchResults` 对账进 ref；新 `refreshTasksData(includeMilestones)` 获取 `/api/search`（作用域时附加 milestone 实体），并仅当任务 ID 集合变化或计划未 settled 时重新获取重复修复计划
- 全量重载保留为回退：首次加载、配置变更、持续的加载错误、被取代的更宽请求或获取失败——共享请求 id 使较晚的全量加载胜出；连接恢复路径复用同一增量入口而非自己的 fetch-and-apply 副本；`applyReorderedTasks` 写穿同一 ref，使手术式与刷新路径不会漂移
- `TaskDetailsModal`：依赖与草稿选择器仅在弹窗打开时预加载——过去每次广播为选项花两个请求，而弹窗打开前没人读它们
- 验证：`web-in-place-refresh.test.tsx`（10 个 jsdom 用例，每例固定请求集）、`server-milestone-broadcast.test.ts`、`reconcile.test.ts`；真实机器 headless-Chrome 测量——一次外部编辑 = 1 个请求（`/api/search`），一次拖拽 = reorder POST + 2 次语料搜索，基线为每次拖拽两次的 13 请求 10 端点突发；6 变体 × 12 用例回滚矩阵；46 个 web 套件（412）与 22 个服务器文件（107）通过

## 验收标准

- 编辑、移动或外部文件变更原地更新看板与列表视图——无加载壳，不重新获取状态、配置、草稿、wiki 树或文档树
- 里程碑变更走自己的广播，刷新里程碑实体与语料，含 API 创建的里程碑
- 全量重载保留为首次加载、配置变更与刷新失败的回退；重连使用共享入口
- 身份跨刷新保持：未变记录保持其对象，未变列表保持其数组

## Related Concepts

- [[concepts/web-ui-features]] — 存储形状、看板/列表渲染与模态框约定
- [[concepts/web-server]] — 广播协议与防抖作用域合并
- [[concepts/browser-loading]] — 首次加载 vs 增量刷新的分工

## Related Sources

- [[sources/web-ui-sort-optimization]] — 早期的 Web 渲染性能工作
- [[sources/back-700-content-entity-broadcast-refresh]] — 将该作用域+对账模式扩展到文档、决策与 wiki
- [[sources/back-540-content-store-stale-refresh-guard]] — 广播所反映的存储侧新鲜度
