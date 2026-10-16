---
title: BACK-792 - 修复带外里程碑变更不达 Web 客户端
labels: [source, bug, web-ui, milestones, live-sync]
created_date: 2026-10-16 01:00
updated_date: 2026-10-16 01:00
source_path: backlog/tasks/back-792 - Fix-out-of-band-milestone-changes-not-reaching-the-web-client.md
---

# BACK-792 - 修复带外里程碑变更不达 Web 客户端

复现：Milestones 页开着不动，CLI 执行 `backlog milestone add "<title>"`，新桶/行只显示代号（如 m-15）而非标题。源自 memo backlog/memos/20261013-2.md。根因不是渲染，而是两个相互独立的缺口：服务器从不监听 `backlog/milestones/`，客户端桶标签只查 `milestoneEntities` 且无兜底。两半都得修。

## 问题

- 服务器只通过其订阅的 ContentStore 广播，而该 store 监听 tasks、completed、documents、decisions、wikis——不含 `backlog/milestones/`。`backlog milestone add` 直接写文件，客户端只收到 `graph-updated`（图谱服务监听所有 markdown）与 `statistics-updated`，`App.tsx` 的 `milestones-updated` 分支永远不进，`milestoneEntities` 一直过期。新 id 的桶之所以出现，仅因某个任务引用了它，`buildMilestoneBuckets` → `getMilestoneLabel` 回退到裸 id（`entity?.title || milestoneId`）。
- 次要症状：标题缺失时刷新页面无效、点进详情却能看到标题。这一不对称是定位线索——`MilestoneDetailsModal` 在实体缺失时按 id 调 `apiClient.fetchMilestone(milestoneId)`，而列表没有这种兜底；`tasks-updated` → `refreshData()` → `refreshTasksData(false)` 的 `withMilestones=false` 意味着里程碑实体永不重新拉取。

## 解决方案

- 修复 A（服务器，`src/server/index.ts`）：新增 `milestoneWatcher` 字段，在 `initializeServices()` 里 `startMemoWatcher()` 旁启动 `watchMilestones(this.core, { onMilestonesChanged: () => this.broadcastDataUpdated("milestones") })`，`stop()` 中关闭。直接复用 TUI 已在用的 `src/utils/milestone-watcher.ts`（含 settle 加双重读取签名去重），不另起第二套 watcher。经 REST API 写里程碑会同时触发自广播与 watcher，但两者都过 `broadcastDataUpdated("milestones")` 的 75ms 防抖，客户端只见一次刷新。
- 修复 B（客户端）：`src/core/milestones.ts` 新增 `collectUnresolvedMilestoneIds(tasks, entity, archived)`（`collectMilestoneIds` 返回的 id 中无已加载实体覆盖者），经 `src/web/utils/milestones.ts` 再导出。`src/web/App.tsx` 新增 `ensureReferencedMilestones(tasksList)`，在 `loadAllData`（新拉实体提交 ref 之后调用，保证比较对象是刚加载的列表）与 `refreshTasksData` 中触发；按 id 逐个拉取（与详情模态框同一请求路径），只增式合并进 `milestoneEntitiesRef`，并用 `attemptedMilestoneFetchRef` 记录已尝试 id，防止任务钉在一个真不存在的里程碑上每次刷新都重拉。
- `buildMilestoneBuckets` / `getMilestoneLabel` 刻意不动：实体真未知时回退 id 是正确行为，修复的方向是让它不再未知。

边界：自愈只覆盖"有任务引用未知里程碑"的情形；无人引用的带外新增里程碑仍需修复 A 的 `milestones-updated` 广播才会出现。

## 验证

每个守卫都经"禁用修复即变红"验证：`src/test/server-milestone-broadcast.test.ts` 直接向 `backlog/milestones/` 写 `m-*.md`（绕过 API 的 CLI 式写入）断言 socket 收到 `milestones-updated`（注释掉 `startMilestoneWatcher()` 即失败）；`src/test/web-milestone-live-add.test.tsx` 三例（带标题里程碑实时出现渲染标题；任务引用 m-9 而实体列表为空时按 id 拉取并显示标题；实体已加载时不发生任何按 id 拉取）；`src/test/milestone-unresolved-ids.test.ts` 单测覆盖 `collectUnresolvedMilestoneIds`。另在真实服务器 + 真实 WebSocket + 真实 `backlog milestone add` 上做过端到端实况复现与验证。`bunx tsc --noEmit` 干净，`bun run check .` 无错误。

## Related Concepts

- [[concepts/live-sync-pattern]] — 本任务把里程碑纳入与 memos 同款的 watcher + 广播 + 原地刷新三件套
- [[concepts/milestones]] — 里程碑管理

## Related Sources

- [[sources/back-696-milestone-popup-live-sync]] — TUI 侧里程碑实时同步，复用同一 milestone-watcher 工具
- [[sources/back-700-content-entity-broadcast-refresh]] — 内容实体变更广播与原位刷新
- [[sources/back-791-milestone-detail-graph-entry]] — 同批里程碑 Web 增强
