---
title: blessed TUI 真实屏幕测试模式
created_date: '2026-09-26 14:45'
updated_date: '2026-09-26 14:45'
labels: [execution, testing, tui]
extracted_from:
  - "[[sources/back-684-task-detail-popup-backdrop-resize]]"
  - "[[sources/back-677-help-popup-resize-robustness]]"
  - "[[sources/back-678-composer-extreme-terminal-sizes]]"
  - "[[sources/back-687-milestone-board-tui]]"
---

# blessed TUI 真实屏幕测试模式

## 适用场景

为 blessed TUI 组件（弹窗、composer、棋盘）写测试。win32 无真 pty（PTY 套件自我跳过），证据边界是**真实 blessed screen 的渲染几何**而非键盘字节流。

## 标准步骤

1. **真屏幕 + 覆盖尺寸**：`createScreen({ smartCSR: false })` 后 `Object.defineProperty(screen, "width"/"height", { configurable, writable, value })` ——非 TTY 屏幕只报 1x1
2. **TTY 补丁**：组件在非 TTY stdout 下直接 bail（如 `createTaskPopup`），用 `Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })`，finally 里恢复原值
3. **模拟 resize**：改 `mutable.width/height` 后在 screen 上 `emit("resize")`；断言组件注册/注销了 resize 监听（`listeners("resize").length` 前后对比），且 close 后再 resize 不抛
4. **模拟按键**：直接 `widget.emit("keypress", ch, key)` 与 `emit("key <name>")`
5. **几何断言**：读 widget 的 `atop/top/left/width/height`（字符串位置如 `"center"` 要先经 `resolveDimension`/`resolvePosition` 解析）
6. **Teardown**：finally 里 `screen.destroy()`；组件内部的 read 必须先 `endInputRead()` 再销毁 widget——仍在 read 的字段握着 `screen.grabKeys`，之后每次按键（包括宿主 quit）都是死的（BACK-687）

## 常见陷阱

| 陷阱 | 症状 | 修正 |
|---|---|---|
| 不覆盖 width/height | 屏幕报 1x1，布局断言全错 | Object.defineProperty 覆盖（BACK-678 实测基线） |
| 断言创建期的绝对几何 | `top: "center"` 时 `Number(popup.top)` 是 NaN | 走 `applyLayout()` 后再读（BACK-684 的根因） |
| 泄漏 isTTY 补丁 | 后续用例行为漂移 | finally 恢复 |
| resize 监听不注销 | close 后 resize 打到已销毁弹窗 | 断言监听数回到 open 前值（BACK-684/677） |

## 参考任务

- [[sources/back-684-task-detail-popup-backdrop-resize]] — 3 真屏用例 / 25 断言的完整范本
- [[sources/back-677-help-popup-resize-robustness]] — `createPopupChrome.reflow` 模式的测试
- [[sources/back-678-composer-extreme-terminal-sizes]] — 极端尺寸下的几何断言
