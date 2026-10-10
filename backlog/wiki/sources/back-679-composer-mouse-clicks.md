---
title: BACK-679 - TUI 任务 composer 支持鼠标点击
labels: [source, tui]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-679 - Support-mouse-clicks-in-the-TUI-task-composer.md
---

# BACK-679 - TUI 任务 composer 支持鼠标点击

TUI composer 中的鼠标点击移动了焦点但从不进入读取状态：前一个控件保留黄色高亮，键入的字符无处可去。本任务让全部四个 composer 字段的点击都走现有的 `focusField`/`readInput` 转换，承重的细节是点击处理器的 `return false`，它阻止 blessed 的祖先链 autofocus 重新聚焦同一部件并使其自失焦。

- 根因两层：文本字段有 `inputOnFocus: false` 且无点击处理器；选择器处理器绕过 `focusField` 且未切断冒泡，因此 blessed 的 `screen.focused` setter（`_focus(el, old)` 无条件发出 `old.emit("blur")`）第二次 blur 该部件，`readInput` 的 blur 处理器把 `_reading` 翻回 false——之后的 Escape 在 blessed 内抛 `TypeError: done is not a function`
- `src/ui/components/task-composer.ts`：Title / Description / Status / Priority 点击处理器经一个循环汇入 `focusField` 并 `return false` 切断冒泡；选择器旧的仅 picker 处理器删除（composer 无 Type 选择器）
- 修复后（100x30 下经真实分发路径 `program.emit("mouse", ...)` 从渲染出的 `lpos` 中心实测）：被点字段唯一高亮、`_reading=true` 且有光标，键入文本立即落入，重复点击活跃 Title 追加，Status/Priority 打开其完整已配置 picker 并在确认后恢复焦点
- 新 `src/test/tui-task-composer-mouse.test.ts`：4 用例 / 33 断言；回退矩阵（整改动 / 去掉 `return false` / 选择器绕过 `focusField`）产生一致的红项
- 记录测试辅助坑：逃出 teardown 的异常掩盖真实失败并级联 `Cannot switch a node's screen`，因此 `withComposer` 把 teardown 包进 try/catch 并总是销毁屏幕
- 证据边界：`createScreen` 在 `process.platform !== "win32"` 时才启用鼠标，因此证据是部件级真实分发路径而非 PTY 鼠标事件
- ID 注：BACK-679 与迁移台账条目重复；保留编号，台账簿记按先问规则推迟

## 验收标准

- 点击文本字段使其唯一高亮、处于带光标的读取状态，后续击键落入其中；先前高亮的控件明显失去高亮
- 重复点击已活跃字段保持读取状态并追加输入
- 点击 Status/Priority 打开带完整已配置选项集的 picker，确认后焦点返回
- 测试钉住 `return false` 的冒泡切断（移除即红）；键盘导航、操作按钮、持久化与布局不变

## Related Concepts
- [[concepts/cli-tui]] — 修复依赖的 blessed focus/readInput 机制

## Related Sources
- [[sources/back-678-composer-extreme-terminal-sizes]] — 同波同级 composer 任务，同一真实屏幕证据方法
- [[sources/back-587-repair-tui-task-composer-ux]] — 早期 composer UX 修复
