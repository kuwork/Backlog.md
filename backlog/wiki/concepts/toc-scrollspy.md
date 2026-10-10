---
title: 模态框 TOC 抽屉与 scrollspy
labels: [concept, web-ui]
created_date: 2026-10-03 01:13
updated_date: 2026-10-09 23:30
---

# 模态框 TOC 抽屉与 scrollspy

Web UI 长 markdown 内容的导航模式：一个从弹窗左边缘探出的**书签式大纲抽屉**，配合 scrollspy 当前章节高亮。页面级大纲（TocButton + TocContext，BACK-638）先行，本模式解决的是 Modal 类弹窗（任务详情、wiki 预览、文件预览）没有大纲的问题。

## 书签抽屉形态

- 书签式标签从弹窗左边缘中部探出，点击后标签隐藏、在弹窗左侧打开与弹窗等高的浮动大纲面板；**弹窗本身永不改变宽度**（避免布局抖动），关闭面板后书签回来。审查后从"加宽弹窗"改为该浮动面板形态（[[sources/back-726-modal-toc-drawer]]）。
- 共享件：`useTocTree` hook + `TocRows` 组件（从 TocButton 抽出）；新组件 `TocDrawer.tsx`。条目点击 `scrollIntoView({behavior:'smooth'})`，跳转后抽屉保持打开。
- 不给每个弹窗传容器 ref：Modal 面板重构为 flex 列、内容 div 为滚动容器，启用该特性只需一个 `toc` 布尔 prop。
- 窄屏（<sm）下面板覆盖在弹窗左边缘内侧（内缩 8px）而非外侧停靠。

## scrollspy 高亮

- `useActiveTocId` 跟踪当前章节；MermaidMarkdown 渲染器用 github-slugger 生成稳定页内锚点（CJK 安全、重复标题自动加后缀）。
- 关键 bug 教训：`findScrollContainer` 必须从内容元素**自身**开始找滚动容器（模态框里可滚动的就是内容容器本身），否则监听的是 window 滚动、永远不高亮（[[sources/back-420-task-content-toc-scrollspy]]）。
- 滚动到底部时激活最后一个条目；点击已可见条目时 pin 住高亮直到下一次真实滚动；位置规则跳过未选中的 tab。

## 任务内容的分区大纲

任务详情模态框的大纲按**任务分区**组织而非扁平标题：各分区卡片（Description、References、Documentation、Modified Files、AC、DoD、Plan、Notes、Comments、Final Summary）打上 `id` + `data-toc-section`，`collectSectionedTocItems` 把每个已渲染分区作为一级条目、内部标题嵌套其下；未渲染的分区不出现，无声明分区的页面回退为扁平收集（doc/wiki/decision 页不受影响）。TabButton 的 `tocLabel` prop 把 References/Documentation/Modified Files 注册为独立大纲条目，点击先切 tab 再滚动（[[sources/back-420-task-content-toc-scrollspy]]）。

## 浮动模式双阈值（BACK-739）

窗口很窄时模态面板接近全宽，外侧停靠的书签页签和 18rem 抽屉会渲染到屏幕之外。`useLeftGap` hook 实时测量面板左边缘与视口左边缘的间距（挂载与 resize 时），两个阈值决定渲染模式（[[sources/back-739-toc-drawer-floating-mode]]）：

- 间距 **≥300px**：保持原有外侧停靠模式，行为逐字节不变。
- 间距 **<300px**：切换悬浮模式——抽屉绝对定位浮在模态内容上方、对齐面板左边缘，150ms 左滑入动画；不渲染关闭按钮（点击大纲条目即关）；其余区域由半透明 backdrop（`bg-black/30`，fade-in）压暗，点击也关闭。
- 间距 **<36px**：书签页签移入面板左边缘内，保证入口可达。

## Related Concepts

- [[concepts/web-ui-features]] — Modal 组件体系与 SPA 路由模式
- [[concepts/markdown-pipeline]] — github-slugger 标题锚点与渲染管线
- [[concepts/file-preview]] — 启用大纲的三个弹窗之一（FilePreviewModal）

## Related Sources

- [[sources/back-726-modal-toc-drawer]] — 书签抽屉的引入
- [[sources/back-420-task-content-toc-scrollspy]] — 分区大纲与 scrollspy 修复
- [[sources/back-739-toc-drawer-floating-mode]] — 双阈值浮动模式
