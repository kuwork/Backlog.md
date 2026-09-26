---
title: milestone 弹窗原地重渲染，而非关闭重开
description: BACK-696 让 milestone 详情弹窗 update-in-place，因为宿主语义绑在 popup 句柄上
labels: [decision, tui, live-refresh]
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
---

# milestone 弹窗原地重渲染，而非关闭重开

## Context

BACK-696 要给 milestone 详情弹窗接上实时同步。任务弹窗（BACK-694）的同步形状可参考，但 milestone 宿主有两个约束让"关掉旧弹窗开个新的"不可用：宿主 `await closed` 决定是否打开编辑表单，替换弹窗会提前 resolve 这个 promise；键盘也按 `popupOpen` 门控，换句柄会丢门控。

## Decision

`createMilestonePopup` 在 `close` 之外返回 `update` 与 `focus`：弹窗**原地**重渲染头部盒与滚动体。宿主把打开的弹窗记为状态（`{ key, id, signature, handle }`），由 `syncOpenPopup()` 驱动——离开列表则带提示关闭、签名变化则重渲染，且两种情况都把键盘焦点交还弹窗（否则棋盘重绘把焦点交给列列表，弹窗悄悄不再响应 Esc/q）。签名未变是 no-op，自己的写入不会引起闪烁。

## Rejected alternatives

- 关闭并按新状态重开弹窗——resolve `closed` promise、破坏编辑表单决策与键盘门控
- 复用任务 watcher 直接 reconcile——milestone 没有 per-record store，刻意用更粗的文件夹级 watcher（同样保留"数量对齐才算读完"与签名去重两条护栏）

## Related Sources

- [[sources/back-696-milestone-popup-live-sync]] — 本决策的落地
- [[sources/back-694-board-popup-live-sync]] — 形状来源（任务弹窗）
- [[sources/back-695-drafts-session-live-sync]] — 同一波为无 watcher 会话补 feed 的工作
