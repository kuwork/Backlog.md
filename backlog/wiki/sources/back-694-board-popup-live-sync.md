---
title: BACK-694 - 看板任务弹窗实时同步
labels: [source, tui, live-refresh]
created_date: 2026-09-26 14:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-694 - Keep-the-board-task-popup-in-sync-with-live-task-state.md
---

# BACK-694 - 看板任务弹窗实时同步

看板的任务弹窗是从打开时捕获的记录一次性构建的快照：来自 Web UI、另一个终端或 agent 的编辑让它显示过期内容，complete/archive 键还对着一个可能已不存在的记录待命。弹窗现在被跟踪为看板状态，并由看板现有的监视器供给更新通道驱动。

> **Provenance note:** 两个归档文件也携带 ID BACK-694——`backlog/archive/tasks/back-694 - Add-a-draft-creation-window-to-the-TUI-drafts-session.md` 和 `backlog/archive/tasks/back-694 - Stop-the-drafts-session-crashing-with-a-popup-open-when-the-terminal-is-resized.md`。两者都被 BACK-693（草稿创建窗口、resize 修复）吸收，与本弹窗同步任务无关；本文件是权威的 BACK-694。解析该 ID 时不要混淆。

## 实现要点

- `src/ui/board.ts`：弹窗打开从 enter 处理器抽为 `openTaskPopup(task)`，将弹窗记录为看板状态（`{ taskId, signature, close }`）；一个 `closeOpenPopup()` 取代两对 popupOpen/close，使退出路径不会漂移
- `syncOpenPopup()` 在 `updateBoard` 中运行于编辑器防护旁：离开看板的记录以页脚提示关闭弹窗（措辞经 `entityNoun`，正确命名草稿），内容签名变更则关闭并重新打开，签名不变则 no-op——这使弹窗内编辑后的监视器回显不闪动
- `src/utils/task-watcher.ts`：私有 `taskSignature` 导出为 `taskContentSignature`，使看板与监视器共享"内容已变"的唯一定义（忽略 branch/filePath/lastModified/source）
- 编辑键将其对账后的列表喂给 `updateBoard` 而非赋值 `currentTasks`，因此弹窗内编辑经同一通道刷新，无第二条通道；键盘被对话框占有时到达的刷新经 `popupSyncPending` 延迟，并从 `runWithModalGuard` 冲刷
- 关闭后的焦点经 `restoreSelection` 钳制——必要，因为 `hideEmptyColumns` 可能丢弃弹窗所在的泳道，越界索引会静默杀死导航
- 测试：新 `board-popup-sync.test.ts`（6 个用例）覆盖外部编辑、带提示的外部移除、编辑器路径、回显 no-op（部件身份保留）、对话框焦点延迟，以及真实 Core + 真实监视器的端到端用例；3 变体回滚矩阵固定每个条款；对 BACK-411 的复现确认已修复

## 验收标准

- 弹窗内编辑、外部编辑或外部 complete/archive/delete 无需用户操作即可刷新或关闭弹窗
- 刷新走既有更新通道——无并行通道，无编辑器返回值管道
- 弹窗内编辑后的监视器回显不引起可见的二次重建或闪动
- 移除以可见提示关闭弹窗，并将键盘交还给有效列

## Related Concepts

- [[concepts/cli-tui]] — 看板更新通道、模态框防护与弹窗约定
- [[concepts/task-identity]] — "已变"的内容签名定义
- [[concepts/task-lifecycle]] — 完成/归档作为弹窗关闭事件

## Related Sources

- [[sources/back-555-tui-live-refresh-atomic-writes]] — 本弹窗接入的监视器供给实时刷新管道
- [[sources/back-693-tui-draft-creation-window]] — 同一会话的 TUI 工作；弹窗同步也经 `entityNoun` 解析草稿
- [[sources/back-695-drafts-session-live-sync]] — 原样复用本弹窗同步的草稿会话
