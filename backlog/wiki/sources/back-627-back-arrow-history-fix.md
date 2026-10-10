---
title: BACK-627 - 修复钻取后返回箭头残留历史条目
labels: [source, web-ui, routing, bug]
created_date: 2026-09-13 01:12
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-627 - Fix-back-arrow-leaving-stale-history-entry-after-drill-down-in-web-UI.md
---

# BACK-627 - 修复钻取后返回箭头残留历史条目

模态框返回箭头是压栈而不是弹栈。从背景页钻取到 BACK-614 再钻到依赖 BACK-511 后，历史为 `[bg, 614, 511]`、模态栈为 `[614]`；点击箭头又把父任务 URL 压栈一次（`[bg, 614, 511, 614]`），留下未消费的 `/task/511`。随后的关闭（经 `handleCloseModal` 的 `navigate(-1)` 的 X/遮罩）就落在 `/task/511` 上并重新打开子模态框，每钻一级就多关一次。

- 修复在 `src/web/App.tsx` `handleBack`：把父任务 URL 的 push 换成 `navigate(-1)`
- 正确性论证：每次钻取恰好压一个历史条目并追加一个 `taskHistory` 项，所以弹掉当前条目即可恢复浏览器历史栈与模态栈之间文档化的 1:1 不变量（`handleCloseModal` 本就依赖它）
- 返回箭头行为现在与浏览器返回按钮路径完全一致
- 直接加载的边界情形保留：没有 `backgroundLocation` 打开的模态框仍回退到 `navigate("/", { replace: true })`
- 验证序列：`bg → 614 → 511` 钻取，箭头弹回 614，X 单次 `navigate(-1)` 回到 `bg`；反复钻取/返回循环保持一致
- 验证：`bunx tsc --noEmit`、`bun run check`（仅既有 warning）、`bun test src/web`（84 通过）、`bun run build`

## 验收标准

- 钻取后返回箭头恰好弹一个条目；不留重复的 `/task/<child>` 条目
- 箭头返回后，X/遮罩/Escape 一步回到背景页
- 反复的钻取/返回序列保持历史与模态栈 1:1

## Related Concepts

- [[concepts/spotlight-search]] — 暴露该缺陷的 `/search` 背景层，共享同一套关闭语义
- [[concepts/web-ui-features]] — 模态框钻取导航约定

## Related Sources

- [[sources/back-624-global-search-dialog]] — BACK-624 修复了返回 `/search` 时同类 push/replace 累积
- [[sources/back-505]] — BACK-505 引入的钻取栈与返回箭头
- [[sources/stable-task-modal-urls-task]] — BACK-509 模态叠路由 URL 层
