---
title: Memo 钉板视图（WebGL 便利贴）
labels:
  - concept
  - memos
  - webgl
  - web-ui
created_date: '2026-10-05 08:25'
updated_date: '2026-10-05 08:25'
---

# Memo 钉板视图（WebGL 便利贴）

/memos 页面的第二种视图：把 memo 渲染成钉在黑板上的黄色便利贴。`?view=board` 直达，与信息流/日历三态共存于同一页面组件。

## 视图切换与容器

- board 模式隐藏 composer 与标签行，黑板填满容器且**永不滚动**；全屏切换接管的是 board 容器本身
- WebGL 上下文不可用时渲染本地化回退文案（四语种），不白屏
- 世界坐标即 CSS 像素；**没有平移缩放**（d3-zoom 与 ensureZoomInterrupt 兜底已整体移除）

## 渲染管线

每张便签一条管线，零新运行时依赖：

1. 离屏 2D canvas 一次性烘焙完整外观——纸变体、彩色图钉（针尖 + 投影）、卷角、柔和投影、手写风墨迹、日期、标签
2. 上传为纹理，裸 WebGL 以**一个旋转 quad** 绘制该便签
3. 纹理缓存键 `memo id + updatedDate`，编辑单条只重烘该条

便签本身没有 DOM 节点——这是钉板所有控件（hover 归档按钮、弹窗）都必须以 overlay 形式挂在容器上的根本原因（实践提炼见 [[execution/webgl-html-overlay-hover-control]]）。

## 确定性三层布局

落位由 `FNV-1a(memo id)` 哈希驱动，重载永不重洗：

- **base grid**：按便签尺寸等分单元，宽裕间隙
- **seam 层**：顶对齐贴于上一行文字下方；纸可盖住上一行的日期/标签页脚，但**绝不遮文字**；无空间则留空
- **corner pile**：右下角格子，仅当确有 pile 时预留（无 pile 不留空格）；级联成组，错落感作为一个整体越过板缘，被遮便签仍可发现

纸高随内容增长、不按行数截断。布局、高度估算与烘焙三方共享 `wrapEstimate` / `memoInkDepth` 字符宽度估算（CJK ~1em、latin ~0.55em），保证保留高度永远装得下墨迹。

## 交互

- **hover**：便签抬起并置于顶层，右上角浮现归档按钮（[[decisions/board-hover-archive-overlay]]）
- **点击**：原地按压、原地抬起的点击打开共享 MemoCard 弹窗；弹窗渲染在 board 容器内部，全屏下仍可见

## Related Concepts

- [[concepts/memos]] — Memos 子系统总览
- [[concepts/web-ui-features]] — Web UI 页面与视图体系

## Related Sources

- [[sources/back-746-memo-board-webgl-pinboard]] — 本视图的唯一实现来源
- [[sources/back-747-memo-archiving]] — hover 归档按钮与钉板的集成
