---
title: BACK-684 - 任务详情弹窗背景跟随 resize
labels: [source, tui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-684 - Make-the-TUI-task-detail-popup-backdrop-track-the-popup-on-resize.md
---

# BACK-684 - 任务详情弹窗背景跟随 resize

与 BACK-677 同类缺陷、只隔一个面：`createTaskPopup` 在创建时一次性计算背景的绝对几何（在 `top` 仍是字符串 `"center"` 时从 `Number(popup.top)` 取）且未注册 resize 监听，因此终端 resize 后弹窗重新居中而黑色背景停在陈旧坐标。注：还有一个无关的 Web 看板排序变更被并入了 BACK-682 的记录；本任务文件是 TUI 弹窗那个。

- `src/ui/task-viewer-with-search.ts`：背景以占位几何创建；`applyLayout()` 通道在打开和每次 resize 时从实时屏幕尺寸重算——`top = max(0, popupTop - 1)`、`left = max(0, popupLeft - 2)`，宽/高 = 弹窗尺寸 +4/+2 并截断到屏幕——保留 fork 现有的背景偏移
- `screen.on("resize", onResize)` 在打开期间注册、在 `closePopup` 中 destroy 前移除；关闭键（`Esc/q/C-c`）、focus/blur 边框颜色、头部/正文内容不动
- `src/ui/components/filter-popup.ts`：导出 `resolveDimension` / `resolvePosition`，弹窗复用 blessed 的百分比/居中解析规则而非重复数学
- 新 `src/test/tui-task-detail-popup-resize.test.ts`：3 个真实屏幕用例 / 25 断言——80x24→80x12 收缩与回长断言背景几何与屏内边界、跨关闭的监听注册/移除、关闭后 resize 不抛
- 经 `git stash` 的判别检查：两个 resize 测试在改动前代码上失败（背景陈旧、从未注册监听），关闭键/边框测试保持绿
- 相邻套件绿（tui-documentation、tui-definition-of-done、tui-final-summary、help-popup——15 测试 / 86 断言）；完整 `bun test` 的失败是预先存在的 tmp/ 孤儿与无关套件

## 验收标准

- 弹窗打开时 resize 把它完全 reflow 到屏内，包括矮于默认 80% 高度的终端
- 背景 top 跟随弹窗 top，边缘与弹窗边缘差一行/列内
- resize 监听在关闭时移除；之后的 resize 永不到达已销毁的弹窗
- 回归测试驱动真实屏幕；弹窗内容、关闭键与边框颜色切换不变

## Related Concepts
- [[concepts/cli-tui]] — blessed 弹窗几何与 resize 处理

## Related Sources
- [[sources/back-677-help-popup-resize-robustness]] — 本任务遵循的实现参考，其 `createPopupChrome.reflow` 模式
- [[sources/back-678-composer-extreme-terminal-sizes]] — 实时尺寸弹窗布局修复的同波
- [[sources/back-682-web-positional-batch-drop]] — 来自另一任务的 Web 排序让渡变更被并入本编号 Web 兄弟的记录；交叉引用以避免混淆
