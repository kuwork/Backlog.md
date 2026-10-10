---
title: WebGL canvas 上挂 HTML 控件的模式
labels: [execution, webgl, web-ui]
created_date: 2026-10-05 08:25
updated_date: 2026-10-09 23:30
extracted_from:
  - BACK-746
  - BACK-747
---

# WebGL canvas 上挂 HTML 控件的模式

Canvas 渲染的场景里给单个图形元素挂控件（按钮、菜单）的标准做法，从 Memo 钉板的归档按钮提炼（[[sources/back-746-memo-board-webgl-pinboard]]、[[sources/back-747-memo-archiving]]）。

## 标准步骤

1. **控件是 overlay，不是节点**：WebGL 绘制的图形没有 DOM，控件用绝对定位的 HTML 元素盖在 canvas 上方，按世界坐标→CSS 像素的映射换算位置
2. **指针追踪挂在容器层，不挂 canvas**：canvas 的 pointerleave 在指针移入 overlay 时触发，hover 状态当场丢失、控件消失。容器的 pointermove/pointerleave 把 overlay 视为自身子树，追踪不中断
3. **按钮内缩进图形边界**：指针从图形移动到控件的全程保持在图形 hover 区域内，任何中间坐标都不触发离开
4. **控件放进全屏元素内部**： fullscreen 只显示全屏元素的子树，overlay 在容器外会在全屏时消失
5. **按下事件 stopPropagation**：控件上的 click/pointerdown 不得冒泡到 canvas，否则一个动作触发两个行为（如归档同时打开弹窗）
6. **失败要回滚视觉状态**：动作失败时显示错误横幅、不摘元素；成功后由数据驱动移除

## 常见陷阱

- 合成 pointermove 扫全板能验证渲染逻辑，但**必须再用真实鼠标路径复验一次**（headless Chromium 的 CDP Input.dispatchMouseEvent）——合成事件与真实指针在 hover 链上的行为可能存在差异。
- hover-only 控件的"指针移动到控件上"这一步最容易断：追踪层级、内缩距离、transition 延迟三处都要检查
- 截图验证对 WebGL 页面不可靠（headless 可能黑屏），以 DOM 断言（`data-testid`、cursor 样式）为准

## Related Sources

- [[sources/back-746-memo-board-webgl-pinboard]] — BACK-746 memo 钉板 WebGL 实现
- [[sources/back-747-memo-archiving]] — BACK-747 memo 归档功能
