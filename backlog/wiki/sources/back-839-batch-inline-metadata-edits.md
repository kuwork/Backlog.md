---
title: BACK-839 - 内联元数据批量写入与保存状态
labels: [source, web-ui, task-modal, i18n]
created_date: 2026-11-08 23:05
updated_date: 2026-11-08 23:05
source_path: backlog/tasks/back-839 - Batch-inline-metadata-edits-and-show-a-save-status-indicator.md
---

# BACK-839 - 内联元数据批量写入与保存状态

任务详情弹窗里 references / documentation / modifiedFiles / labels / dependencies 五个列表型字段，原先每次加减 chip 都立刻发一次 PUT。连续操作会撞上 fail-fast 的**单任务文件锁**（约持有 2 秒），用户看到「being modified by another process」409；每次成功写入又扇出两次全量 `/api/search`（`onSaved` + `tasks-updated` 广播），进一步放大风暴；10 秒客户端超时甚至让重试的 PUT 与自己仍在跑的请求相撞。AC/DoD 早在 BACK-818 已有批量防抖，元数据字段没有。

## 做法

- 五个字段各有自己的 trailing timer（`INLINE_META_SAVE_DEBOUNCE_MS` = `CHECKLIST_SAVE_DEBOUNCE_MS` = 1000ms）。`scheduleInlineMetaSave` 把各字段最新值合并进**一个** pending payload，并按字段记录 burst 前的初值作为回滚快照。
- `runInlineMetaFlush` 把整个 payload 倒进**一次** `apiClient.updateTask`；`inlineMetaFlushChainRef` 用 promise 链串行化 flush，杜绝两个元数据 PUT 重叠，从根上消掉自伤型 `ETASKLOCK` 409。乐观更新仍即时发生，失败的 flush 通过 `restoreInlineMetaValues`（与非批量路径共用）复原。
- 卸载时清 timer 并立即 flush pending，与清单行为一致。
- 复用 `Modal` 的 actions 头部槽位放三态 chip：flush 中旋转、成功绿勾、失败红叉；新增 `common.saved` 到四语言字典。

## 边界

status、assignee、priority、milestone、日期、title 等**非列表型**字段保持即时单写。「全量刷新合并」明确不在范围内，留给 BACK-840。浏览器验证需重启 `backlog browser` 让 Bun 重编 HTML bundle。

## 验证

`tsc --noEmit` 干净、`bun run check .` 仅 14 条既有告警；`bun test src/test/web-task-details-modal-*.test.tsx --timeout 30000` 80 通过。新增 burst 合并、卸载 flush、拒绝写入回滚回归测试；`dependency-closure` 测试改为等待超过静默窗口。

## Related Concepts

- [[concepts/web-ui-features]] — 任务详情弹窗与保存状态指示
- [[concepts/web-server]] — 单任务文件锁与广播扇出

## Related Sources

- [[sources/back-818-checklist-batching-broadcast-debounce]] — AC/DoD 批量防抖的原型
- [[sources/back-840-corpus-digest-refresh-skip]] — 承接「全量刷新合并」
