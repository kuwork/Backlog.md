---
title: 钉板归档按钮用 hover-only HTML overlay
labels: [decision, web-ui, memos, webgl]
created_date: '2026-10-05 08:25'
updated_date: '2026-10-05 08:25'
---

# 钉板归档按钮用 hover-only HTML overlay

## 决策内容

BACK-747 的钉板归档按钮采用**仅 hover 时浮现**的 HTML overlay（黑色半透明底 + 图标，静止时便签上没有任何控件），定位用 board 已有的世界坐标=CSS 像素映射，内缩 22px 放在纸内右上角；overlay 挂在 board 容器内部以随容器全屏可见。

## 背景

钉板便签是烘焙进 2D canvas 再由 WebGL 单 quad 绘制的纹理，**没有 DOM 节点**可挂按钮。初版把指针追踪挂在 canvas 的 pointermove/pointerleave 上，指针一移到按钮上就触发 canvas 的 pointerleave，hover 状态丢失、按钮当场消失——控件永远点不到。

## 拒绝方案

- **常驻显示按钮**：钉板的美学前提是"一板干净的便利贴"，常驻控件破坏观感；且每个便签常驻一个 DOM 节点，memo 多时 overlay 数量可观
- **静止时半透明、hover 加深**：仍违背"静止无控件"的简洁取向，作为后续可选项保留
- **按钮挂在 canvas 外（如工具栏）**：失去"归档这张"的空间对应关系，还要处理选中态

## 采纳方案

- 指针追踪从 canvas 移到**容器层**（container 的 pointermove/pointerleave），按钮是容器子节点，指针移入按钮不再触发离开
- 按钮内缩 22px：指针从纸面移到按钮的全程始终悬在便签上，hover 不中断
- `stopPropagation` 拦住按下事件，打开弹窗的点击不被吞
- hover 期间失败给出错误横幅，便签不被移除

提炼的通用做法见 [[execution/webgl-html-overlay-hover-control]]。

## Related Sources

- [[sources/back-747-memo-archiving]] — 本决策的实现任务
- [[sources/back-746-memo-board-webgl-pinboard]] — 钉板视图本身
