---
title: TUI / 编辑器集成模式
labels: [pattern, tui, terminal, editor]
created_date: 2026-05-27 00:00
updated_date: 2026-05-27 00:00
---

# TUI / 编辑器集成模式

在 blessed TUI 中安全地启动外部交互式编辑器（vim、neovim、Helix、nano），并在编辑器退出后完整恢复 TUI 状态，是 Backlog.md 中高频出现且极易回退的复杂操作。

## 适用场景

- 为 TUI 看板/列表/序列视图添加快捷键打开编辑器
- 新增终端编辑器支持（如 Helix）
- 修复编辑器退出后终端状态异常（方向键乱码、屏幕残留、光标隐藏）
- 从 `spawnSync` 迁移到异步 spawn API（如 Bun.spawn）

## 标准步骤

| 顺序 | 动作 | 关键实现细节 |
|---|---|---|
| 1 | **添加快捷键** | 在看板/列表/弹窗的 key handler 中绑定 `E` 或 `Shift+e` |
| 2 | **解析编辑器** | 优先级：`config.defaultEditor` → `EDITOR` 环境变量 → 平台默认（notepad / nano / vi） |
| 3 | **挂起 TUI** | `screen.suspend()` 保存事件监听器、清除屏幕缓冲区、恢复终端原始状态 |
| 4 | **重置终端序列** | 发射 `\u001b[?1l`（关闭 DECCKM）、`\u001b>`（DECKPNM 数字键盘模式）、恢复光标可见 |
| 5 | **异步启动编辑器** | 使用 `Bun.spawn([editor, filePath], { stdio: 'inherit' })` 并等待 `proc.exited` |
| 6 | **恢复 TUI** | `screen.resume()` 恢复事件监听器、强制重绘、发射 resize 事件 |
| 7 | **重新加载数据** | 读取修改后的文件，刷新当前视图状态 |
| 8 | **集成测试** | 覆盖 stdio 继承、退出码处理、参数传递、终端序列重置 |

## 常见陷阱

| 陷阱 | 示例 | 预防 |
|---|---|---|
| **`spawnSync` 破坏 TTY** | BACK-168：vim 在 `spawnSync` 下无法获得终端控制 | 必须使用异步 `Bun.spawn` + `await proc.exited` |
| **Bun shell `.quiet()` 致命** | BACK-202：迁移到 `$` shell API 时加了 `.quiet()`，编辑器无法交互 | 交互式程序绝不使用 `.quiet()` |
| **TUI 未挂起导致输入冲突** | BACK-220：blessed 仍在监听键盘事件，与 vim 争抢输入 | 必须调用 `screen.suspend()` 并保存/恢复所有事件监听器 |
| **终端 keypad 模式泄漏** | BACK-350：blessed 设置了 application cursor mode，vim 退出后方向键发送错误序列 | 在 spawn 前显式发射 `\u001b[?1l` 和 `\u001b>` |
| **编辑器路径解析优先级错误** | 某次回归修改了解析顺序，导致 `EDITOR` 被忽略 | 将解析逻辑集中为 `resolveEditor()` 单一函数，所有入口复用 |
| **跨分支任务误编辑** | TUI 中按 `E` 打开了来自其他分支的只读任务 | 编辑前检查 `task.branch`，只读任务弹出提示而非打开编辑器 |

## 终端序列速查

| 序列 | 作用 | 何时发送 |
|---|---|---|
| `\u001b[?1l` | 关闭 DECCKM（应用光标模式） | 编辑器启动前 |
| `\u001b>` | DECKPNM（数字键盘模式） | 编辑器启动前 |
| `\u001b[?25h` | 显示光标 | TUI 恢复后 |
| `\u001b[c` | 请求终端识别（触发 resize） | TUI 恢复后 |

## 参考任务

- [[sources/back-490-overview-command-task]] — BACK-490 中 TUI 使用直接 ANSI 输出而非 blessed 盒子，属于 TUI 渲染策略的变体
- [[sources/back-489-health-indicators-task]] — BACK-489 的 Web 统计页与 TUI 无直接关联，但 health 数据在 TUI 中的展示遵循同样的跨表面消费模式
