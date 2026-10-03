---
title: BACK-735 - Realtime sync for memos
labels:
  - source
  - feature
  - web-ui
created_date: '2026-10-03 01:10'
updated_date: '2026-10-03 01:14'
source_path: backlog/tasks/back-735 - Realtime-sync-for-memos.md
---

# Realtime sync for memos

Memos 是纯 markdown 文件，用户会在 web UI 之外用编辑器、脚本或 CLI 修改它们。没有同步通道时页面一直显示过期列表、必须手动刷新，这直接破坏"写下来就走"的产品承诺。本任务要求 memo 写入与外部编辑都能实时反映到 /memos 页面。

API 写入路径在前置提交中已接好（"memos" 进入 DataUpdatedScope、broadcastDataUpdated 发出 memos-updated 消息、增删改 handler 都已调用广播）。本任务补上缺失的两半。服务端：Memos 刻意在 ContentStore 之外，其目录监视器覆盖不到 backlog/memos/，因此在 initializeServices 中通过 startMemoWatcher() 启动专用的 fs.watch；任何文件变化调用 broadcastDataUpdated("memos")，75ms 防抖合并为一条消息。watcher 在 stop() 中关闭；目录缺失（新项目）非致命，记日志跳过直到首次写入创建目录。watcher 随首次触店 store 的请求启动而非 listen()，与 ContentStore 的 watcher 策略一致，空项目不白付 watcher 成本。

客户端：App.tsx 的 WebSocket 监听新增 memos-updated 分支，以 window 事件转发给 MemosPage（复刻 drafts-updated 模式），因为 memo 状态在页面组件内而非 shell。MemosPage 的 refreshInPlace 回调重新拉取用户当前窗口（第一页加屏上已加载页数），按 id 并入 feed，并刷新日历计数和展开的日子面板；视图、选中日期、已加载页全部保留，不回第一页、不整页刷新。后台刷新失败选择吞掉（仅 console.warn）：正常加载路径会在 loadError 时把整个 feed 换成错误横幅，后台刷新若沿用该路径反而重置视图。

一次 API 写入会触发两次广播（handler 一次、watcher 看到新文件再一次），75ms 防抖加幂等刷新使冗余无害，而这正是外部编辑可用的原因。验证：新增 src/test/server-memo-broadcast.test.ts 用真实 BacklogServer + 真实 WebSocket 证明两条触发路径（API 增删改各发 memos-updated；外部写文件也发且不泄漏 tasks-updated）；web-memos-page.test.tsx 新增 2 个测试覆盖原地刷新与失败不破坏视图。

## Related Concepts
- [[concepts/web-server]] — 服务端广播/websocket 架构，DataUpdatedScope 与防抖广播所在层
- [[concepts/core-architecture]] — ContentStore 快照边界与 memos 作为外部语料的 watcher 补偿设计
- [[concepts/web-ui-features]] — web 前端按事件原地刷新的既有模式（drafts-updated 复刻）
- [[concepts/memos]] — 专用 fs.watch + refreshInPlace 所属的 memos 实时同步
- [[concepts/live-sync-pattern]] — window 事件转发 + 防抖广播 + refreshInPlace 三件套复用模式，本任务是其 memos 落地

## Related Sources
- [[sources/back-733-include-memos-in-global-search]] — 同一里程碑内让 memo 可被全局搜索发现的配套任务
- [[sources/back-736-memos-milestone-acceptance-pass]] — 里程碑最终验收门，验证了外部编辑 websocket 广播（§9.6）
- [[sources/back-700-content-entity-broadcast-refresh]] — ContentStore 实体广播刷新的先例，memos 广播模式与之平行
- [[sources/back-695-drafts-session-live-sync]] — drafts 实时同步的既有实现，memos-updated 转发模式复刻自它
