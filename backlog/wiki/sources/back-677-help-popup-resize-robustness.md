---
title: BACK-677 - TUI 帮助弹窗适配 resize 与换行
labels: [source, tui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-677 - Make-the-TUI-help-popup-robust-to-resize-and-wrapped-lines.md
---

# BACK-677 - TUI 帮助弹窗适配 resize 与换行

TUI 帮助弹窗从不调用其弹窗外壳已返回的 `reflow` 辅助函数，因此终端 resize 后，背景悬在重新居中的弹窗下方，弹窗高度冻结在打开时的尺寸，滚动上界按逻辑快捷键数而非渲染（换行后）行数计算。本任务让弹窗按实时终端尺寸自布局，并从渲染器实际绘制的内容派生滚动界。

- `src/ui/components/help-popup.ts`：`getHelpPopupHeight` 截断到终端高度（`Math.min(screen.height, preferred)`），弹窗永不高于屏幕；宽度与页脚文本提升为 `HELP_POPUP_WIDTH` / `getHelpText(scrolls)`，布局通道可重建两者
- `openHelpPopup` 从 `createPopupChrome` 取 `reflow`，并新增 `getMaxScrollOffset`、`applyLayout`（重算高度 → reflow 外壳，重锚背景 → 渲染 → 把 `childBase` 截断到实测界 → 用实测页脚再 reflow 一次）和 `onResize`，注册在 `screen.on("resize")` 并在关闭路径移除
- 滚动界来自视口 `getScrollHeight()` 减可见高度，而非快捷键计数；`scrollBy` 读取当前界而非打开时计算的界；30x24 下换行的描述现在能滚动到最终渲染行
- `src/ui/components/filter-popup.ts`：`ScrollableViewport` 声明 `getScrollHeight(): number`——仅类型层，可滚动框已实现它
- 实测复现 80x24 → 80x12：之前弹窗 `top: -4, height: 21`，背景冻结在 `top: 0, height: 23`；之后弹窗 `top: 1, height: 10`，背景 `top: 0, height: 12`
- 测试：`src/test/help-popup.test.ts` 8 测试 / 48 断言，3 个驱动真实屏幕，每个新断言先对照改动前代码与背景重定位回退确认为红；十一个相邻 TUI 套件绿
- ID 注：BACK-677 与无关的迁移台账条目撞号；fork 保留分配的编号，台账行留给单独簿记

## 验收标准

- 弹窗打开时 resize 会 reflow：高度跟随视口，即使低于五行下限，边框与帮助行也留在屏内
- 背景跟随弹窗（top 跟随弹窗 top，底部差一行内），而不是停留在绘制时的几何
- 滚动界在 resize 时按渲染行重算；offset 截断；页脚提示仅在内容真的溢出时显示；换行内容在 30x24 能滚到最后一行
- resize 监听在弹窗关闭时移除；四个帮助上下文保留快捷键列表与 `escape/q/Q/?` 关闭键

## Related Concepts
- [[concepts/cli-tui]] — blessed TUI 弹窗外壳与 resize 处理
- [[concepts/tui-theme-adaptive]] — 同面相邻的 TUI 渲染工作

## Related Sources
- [[sources/back-563-tui-intent-first-composer]] — 任务 composer 是另一个已在 resize 时 reflow 的 `createPopupChrome` 调用方
- [[sources/back-565-tui-theme-adaptive-scroll]] — 同一辅助函数上的早期 TUI 滚动/渲染工作
