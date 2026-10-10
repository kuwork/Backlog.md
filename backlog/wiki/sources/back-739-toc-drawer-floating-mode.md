---
title: BACK-739 - TOC 抽屉窄屏悬浮模式
labels: [source, web-ui]
created_date: 2026-10-03 01:10
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-739 - TOC-drawer-float-over-the-modal-when-the-outside-dock-would-leave-the-screen.md
---

# BACK-739 - TOC 抽屉窄屏悬浮模式

BACK-726 引入的模态大纲抽屉停靠在面板左边缘外侧（`sm:right-full`）。窗口很窄时模态面板接近全宽，书签页签（`-translate-x-full`）和 18rem 的抽屉都会渲染到屏幕左边缘之外而不可见。

## 解决方案

方案：实时测量面板左边缘与视口左边缘的间距（挂载和 resize 时），用两个阈值决定渲染模式——间距 ≥300px 保持原有停靠模式，<300px 切换为悬浮模式：抽屉以绝对定位浮在模态内容上方、对齐面板左边缘，带 150ms 左滑入动画，圆角两侧保留；不渲染关闭按钮，点击任意大纲条目即关闭；其余模态区域由半透明 backdrop（`bg-black/30`，fade-in）压暗，点击 backdrop 也关闭。间距 <36px 时书签页签移入面板左边缘内，保证入口可达。

关键实现点：`TocDrawer.tsx` 新增 `useLeftGap` hook 跟踪间距；测试标记 `data-toc-mode` / `data-toc-tab` / `data-toc-backdrop`（backdrop 用真实 button 保持键盘可达）；动画 keyframes（`toc-drawer-slide-in`、`toc-backdrop-fade-in`）加在 `source.css`；停靠模式行为逐字节不变。

测试涟漪处理：`web-task-toc.test.tsx` 的 `getBoundingClientRect` stub 原本 left: 0，会强制进入悬浮模式，改为 left: 500 以保持停靠场景覆盖。新增 `web-toc-drawer.test.tsx` 6 个用例（模式标记、无关闭按钮、条目点击关闭、backdrop 点击关闭、停靠时无 backdrop、页签移入）。

## 验证

TOC 相关套件 48 pass，tsc/biome 干净。

## Related Concepts

- [[concepts/web-ui-features]] — 模态 TOC 抽屉属于 Web UI 组件体系的一部分
- [[concepts/toc-scrollspy]] — TOC 抽屉的停靠/悬浮双阈值渲染模式所属概念
