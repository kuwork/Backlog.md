---
title: 虚拟列表滚动记忆用 visibleStartIndex 而非 scrollTop
description: BACK-624 定高行下图元索引比像素位置更稳定
labels: [decision, web-ui, search]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# 虚拟列表滚动记忆用 visibleStartIndex 而非 scrollTop

## 背景

搜索对话框要求"从结果进入详情、后退返回后恢复列表位置"。可持久化的位置表示有两种：像素 `scrollTop` 或首个可见行索引。

## 决策

持久化 **`visibleStartIndex`**（虚拟列表首个可见行索引），写入 `location.state` 而非 URL 查询参数。

理由：

- 行高恒定（桌面 56/28、窄屏 64/32），索引与像素可互推，但索引不受"结果集在返回后重新计算、高度变化"的影响
- 越界可确定性降级：`clampRestoreIndex(saved, rowCount)` 对缺失/越界返回 `null`，调用方回退到列表顶部
- 折叠分组会改变行数——索引语义在折叠状态下仍可解释，而像素位置会漂移到无关行

配套：滚动时以 300ms 防抖 `replace` 写回 state；只有 Enter 进入详情才更新，Esc/×/遮罩关闭**不**持久化位置（用户主动放弃搜索结果时不应记住滚动）。

## Related Sources

- [[sources/back-624-global-search-dialog]] — BACK-624 实现
- [[decisions/react-router-history-for-search-dialog]] — 状态放置位置的配套决策
