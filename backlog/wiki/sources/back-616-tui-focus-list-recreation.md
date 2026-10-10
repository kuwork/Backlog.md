---
title: BACK-616 - 修复 applyFilters 重建列表后 TUI 失焦
labels: [source, tui, bug]
created_date: 2026-09-07 05:54
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-616 - Fix-task-list-TUI-losing-keyboard-focus-when-applyFilters-recreates-the-list.md
---

# BACK-616 - 修复 applyFilters 重建列表后 TUI 失焦

用户报告：直接进入 `backlog task list` 渲染出列表但方向键无效，经 `backlog board` 进入再 Tab 切换则正常。用插桩构建诊断（按键日志写入 `tmp/keydebug.log`）：按键事件到达 blessed 且 screen 级按键（Esc）有效，但元素级按键失效——`applyFilters()` 销毁并重建 GenericList 后未重新聚焦新列表，于是任何挂载后的调用（watcher 对账、配置变化）都会悄悄杀死方向键输入。

- `src/ui/task-viewer-with-search.ts`：`applyFilters()` 现在在列表重建间保留焦点——旧 listBox 持有焦点时聚焦新 listBox。
- `src/ui/tui.ts` 加固：`screen.destroy` 仅在每个 screen 首次 destroy 调用时剥离程序级按键监听（blessed 会调用 destroy 两次；第二次剥离可能抹掉存活屏幕刚重绑的监听）。
- 根因区分：board 优先进入掩盖了该 bug，因为 watcher 风暴在任务查看器挂载前已平息。
- 诊断期间出现的卡死数小时的 `git fetch --tags origin` 使用 VS Code 式 spawn 参数，不是 backlog spawn（backlog 自己的抓取在 `src/git/operations.ts` 已有 10s 超时并杀死进程树）。
- 用户在 dist 构建上验证；scoped 套件（readiness、generic-list-selection、boundary navigation、milestone filter）39 个通过。

## 验收标准

- 直接运行 `backlog task list` 在 watcher 更新重建列表后仍接受方向键。
- 焦点在过滤变化与 watcher 更新间保持在列表上。

## Related Concepts

- [[concepts/cli-tui]] — blessed 焦点生命周期、GenericList 重建与 screen 拆卸语义。

## Related Sources

- [[sources/back-615-dependency-readiness-guidance]] — 并发合入；同一详情窗格的 Readiness 行在本任务交接时重新验证。
