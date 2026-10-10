---
title: BACK-591 - TUI 窗口标题含项目名并恢复终端标题
labels: [source, tui]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-591 - Include-project-name-in-TUI-window-titles-and-restore-terminal-title-on-exit.md
---

# BACK-591 - TUI 窗口标题含项目名并恢复终端标题

TUI 窗口标题现在通过共享的 `formatTuiTitle` helper 标识当前项目，退出时恢复之前的终端标题（含 Ctrl-C 及 tmux 下）。管道看板头部打印真实项目名，不再硬编码 'Project'。

- `src/ui/tui.ts`：导出 `formatTuiTitle(view, projectName)` 渲染 `<project> - <view>`，空白名或 'Untitled Project' 占位回退为 `Backlog <view>`，并剥离 C0/DEL/C1 控制字符以防转义序列注入。
- 终端标题恢复：`createScreen` 在 blessed 重命名窗口前压入标题栈（ESC [ 22 ; 0 t）；销毁包装器先清除（ESC ] 0 ; BEL）再弹出（ESC [ 23 ; 0 t），并用 once 守卫防止 blessed 重复销毁事件；tmux DCS 透传经由 `writeTerminalControl`（`src/types/neo-neo-bblessed.d.ts` 新增 `tmux: boolean` 及 ProgramInterface 上的 `write(text)`）。
- `src/ui/board.ts`：`renderBoardTui` 新增 `projectName` 选项；TTY 屏幕标题经由 formatTuiTitle；管道分支对 flat 与 --milestones 生成器均用 `options?.projectName?.trim() || 'Project'`。
- `src/ui/task-viewer-with-search.ts`：读取 `config?.projectName`（两个配置加载分支），三处标题赋值（初始、无结果、选中任务）都经由该 helper。
- Overview TUI 有意不变：fork 的 overview 是无 blessed 屏幕标题的纯文本渲染器（保留 stats-command.test.ts 中 'Project Overview' 断言）。
- 测试：`src/test/tui-window-title.test.ts` 12 个测试；`tui-interactive-editor-handoff.test.ts` 的 readyPatterns 已更新；真实管道冒烟显示 'Project: Backlog.md'。

## 验收标准

- 共享 formatTuiTitle 含回退与控制字符剥离；board 与 task-viewer 标题含项目名；overview 走同一规则（fork 中不适用，已说明理由）；标题压栈/弹栈恢复含 once 守卫与 tmux 透传；管道输出打印真实项目名；测试覆盖以上全部。

## Related Concepts

- [[concepts/cli-tui]] — TUI 屏幕生命周期与标题管理
