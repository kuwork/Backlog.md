---
title: 'BACK-749 - Pinboard notes: fixed height with ellipsis truncation on overflow'
labels:
  - source
  - enhancement
  - web-ui
  - memos
created_date: '2026-10-07 22:50'
updated_date: '2026-10-07 22:50'
source_path: backlog/tasks/back-749 - Pinboard-notes-fixed-height-with-ellipsis-truncation-on-overflow.md
---

# Pinboard notes: fixed height with ellipsis truncation on overflow

Memo 钉板（`/memos?view=board`）原本让每张便签的纸随 memo 长度增长（`estimateNoteHeight` 返回 `Math.max(min, inkDepth + reserve)`），长 memo 产生高便签。评审后期望统一固定高度、填满纸张、溢出裁剪为省略号，形成整齐的软木板网格。

- **固定高度**：`estimateNoteHeight` 恒定返回新常数 `NOTE_HEIGHT`（150px）；`inkBottomOf` 钳制到固定底边
- **纯函数布局**：新增 `layoutInkLines(memo, maxWidth, top, bottom, measureWidth)`，把粗体标题 + 正文铺进固定带，逐字符贪心裁剪直到 `measureWidth(`${trimmed}…`, fontSize, bold) <= maxWidth`，追加省略号并置 `truncated`
- **绘制**：`drawNote` 改为消费 `layoutInkLines`（注入 `ctx.measureText`），标题/正文间留 4px 间隙；移除内联 `memoInkLines`/`wrapEstimate`；`approxInkWidth` 供无 canvas 的单测复用
- **验证**：memo-board 套件 19 pass / 0 fail；scoped biome 干净

## Related Concepts

- [[concepts/memo-board]] — 钉板视图与便签烘焙纹理
- [[concepts/memos]] — Memos 子系统总览

## Related Sources

- [[sources/back-746-memo-board-webgl-pinboard]] — 前置任务：WebGL 钉板，本任务的固定高度落在它的便签上
- [[sources/back-747-memo-archiving]] — 同期钉板生命周期（归档）
- [[sources/back-728-memo-storage-layer]] — memo 独立存储模块
