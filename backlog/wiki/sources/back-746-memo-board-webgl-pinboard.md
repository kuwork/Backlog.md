---
title: BACK-746 - memo 钉板 WebGL 便利贴视图
labels: [source, web-ui, memos, webgl, feature]
created_date: 2026-10-05 08:25
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-746 - Memo-board-WebGL-sticky-note-pinboard-view.md
---

# BACK-746 - memo 钉板 WebGL 便利贴视图

为 /memos 增加 WebGL 便利贴钉板视图：`?view=board` 进入，board 模式隐藏 composer 与标签行，黑板区域固定不滚动，支持全屏；WebGL 不可用时显示本地化回退文案而非白屏。

## 实现要点

**渲染管线（零新依赖）**：每张便签的完整外观（黄色纸变体、彩色图钉带针尖与投影、卷角、柔和投影、手写风墨迹、日期与标签）一次性烘焙进离屏 2D canvas，再由裸 WebGL 以**一便签一 textured quad** 绘制；纹理按 `memo id + updatedDate` 缓存，编辑单条只重烘该条。

**布局**：FNV-1a(memo id) 哈希驱动确定性变体与落位，重载永不重洗。三层结构——base grid（按便签尺寸等分单元、宽裕间隙）；seam 层（顶对齐贴于上一行文字下方，纸可盖住上一行的日期/标签页脚但绝不遮文字，无空间则留空）；右下角 corner pile（仅当确有 pile 时预留格子，级联成组使错落感越过板缘、被遮便签仍可发现）。纸高随内容增长、不按行数截断；布局、高度估算与烘焙共享 `wrapEstimate`/`memoInkDepth`（CJK ~1em、latin ~0.55em），保留高度永远装得下墨迹。

**交互**：hover 抬起便签并置于顶层；原地按压抬起点击打开共享 MemoCard 弹窗——弹窗渲染在 board 容器内，全屏下仍可见，标题固定为笔记文案标签。d3-zoom 平移缩放与 ensureZoomInterrupt 兜底整体移除，世界坐标即 CSS 像素。

## 验证

tsc / biome 干净；memo-board 16 单测 + web-memos-page/memos 63 测试全过；headless Chromium 端到端验证 hover 抬起与点击开弹窗。

## Related Concepts
- [[concepts/memo-board]] — 钉板视图的渲染、布局与交互模型（本文档为其主要来源）
- [[concepts/memos]] — Memos 子系统总览（本文档扩展其 Web UI 消费面）
- [[concepts/web-ui-features]] — Web UI 页面与视图体系

## Related Sources
- [[sources/back-731-memos-feed-page]] — /memos 信息流基座，钉板与其共存于同一页面
- [[sources/doc-20-memos-integration]] — Memos 集成设计输入稿
- [[sources/back-747-memo-archiving]] — 后续任务：钉板便签的归档按钮即挂在本视图上
