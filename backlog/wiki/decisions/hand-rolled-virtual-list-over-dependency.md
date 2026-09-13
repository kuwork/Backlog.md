---
title: 搜索对话框手写定高虚拟列表而非引入虚拟化库
description: BACK-624 以恒定行高换取零新依赖
labels: [decision, web-ui, search, dependencies]
created_date: '2026-09-13 01:12'
updated_date: '2026-09-13 01:12'
---

# 搜索对话框手写定高虚拟列表而非引入虚拟化库

## 背景

搜索结果可能上千条，需要窗口化渲染。

## 决策

手写 `VirtualList`（约 130 行）而非引入 `react-window` 等库：

- **恒定行高是前提**：桌面 item 56 / header 28，窄屏 item 64 / header 32；两种视口模式各自常量，因此前缀和 + 二分查找即可完成窗口计算，无需动态测量
- 需要的能力全部可手写：`offsets[]` 前缀和、`overscan = 4`、`resetKey` 重置、`scrollRowIntoView` 命令句柄、`onVisibleStartChange` 回调
- 零新依赖符合 fork 对编译产物体积与供应链面的约束（同类取舍见 [[decisions/no-external-gantt-library]]）

## 代价与边界

- 行高变化（如窄屏两行布局）必须按模式整套切换，不允许行内自由换行——这是 AC 里显式写死的约束（"No free text wrapping inside rows"）
- 若未来需要动态行高（例如多行摘要），本实现需要重写测量层

## Related Sources

- [[sources/back-624-global-search-dialog]] — BACK-624 实现
