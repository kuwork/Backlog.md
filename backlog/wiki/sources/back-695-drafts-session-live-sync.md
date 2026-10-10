---
title: BACK-695 - 草稿会话实时同步
labels: [source, tui, drafts, live-refresh]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-695 - Keep-the-drafts-session-in-sync-with-live-draft-changes.md
---

# BACK-695 - 草稿会话实时同步

草稿会话通过与任务相同的看板和列表视图渲染草稿，但监视器只监视 tasks 文件夹——实测探针显示重写草稿文件发布了零事件。修复是监视器上的一个会话开关；BACK-694 的弹窗同步本就与会话无关，无需改动。

## 解决方案

- 修复前实测：`watchTasks` 注册在 `backlog/tasks` 并经任务存储读取；重写草稿发布 0 事件，而对同一任务的写入发布 1 事件，因此草稿会话是一张静照，打开的草稿弹窗即使被提升为任务也存活
- `src/utils/task-watcher.ts`：`watchTasks(core, callbacks, initialTasks, options)` 接收 `{ drafts?: boolean }`，并据其选取文件夹（`draftsDir` vs `tasksDir`）与存储（`loadDraft`/`listDrafts` vs `loadTask`/`listTasks`）；settle/重试预算、内容签名、目录对账与移除确认都是共享的——一份实现服务两个会话
- `src/file-system/operations.ts`：在 `tasksDir` 旁新增同步 `get draftsDir()`（异步 `getDraftsDir()` 委托给它），使监视器无需 await 即可选文件夹
- 文件夹快照现在从每个文件名读取前缀，而非假设默认任务前缀——没有这一步，草稿文件夹中的"文件是否还在"检查是空虚的（在本仓库前缀为 `back`，更是如此），不可读草稿可能被误发布为已移除
- `src/ui/unified-view.ts` 传 `{ drafts: options.draftSession === true }`；任务会话继续忽略草稿文件，因此草稿从不出现在任务看板；被提升的草稿干净地离开会话——文件离开文件夹，监视器发布移除，弹窗带提示关闭
- 测试：`task-watcher.test.ts` +4 用例（草稿编辑发布、移除发布、任务会话保持盲视、畸形草稿不发布为移除），`board-popup-sync.test.ts` +1 经真实 `core.promoteDraft` 的端到端用例；3 变体 × 5 用例回滚矩阵，源逐字节还原

## 验收标准

- 进程外草稿变更（CLI、Web UI 或直接文件编辑）无需用户操作即可刷新打开的草稿弹窗与列
- 草稿会话监视草稿文件夹；任务会话继续忽略草稿文件
- 打开弹窗的草稿被提升、删除或归档时以可见提示关闭
- 弹窗内编辑经看板更新通道刷新；未变化的监视器回显保持 no-op

## Related Concepts

- [[concepts/cli-tui]] — 统一视图会话接线与看板更新通道
- [[concepts/task-lifecycle]] — 从草稿会话视角看提升即移除事件
- [[concepts/task-identity]] — 文件夹快照中的前缀感知文件名解析
- [[concepts/live-sync-pattern]] — Web 侧实时同步复用模式（window 事件转发 + 防抖广播 + refreshInPlace）；本任务是 TUI 监视器变体

## Related Sources

- [[sources/back-694-board-popup-live-sync]] — 本任务接入的与会话无关的弹窗同步
- [[sources/back-693-tui-draft-creation-window]] — 监视器开关联接自的 `draftSession` 旗标
- [[sources/back-555-tui-live-refresh-atomic-writes]] — 被扩展到草稿文件夹的监视器架构
