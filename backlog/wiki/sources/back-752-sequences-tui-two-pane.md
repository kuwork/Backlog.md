---
title: 'BACK-752 - Sequences TUI: two-pane view (sequence sidebar + task list)'
labels:
  - source
  - cli
  - tui
created_date: '2026-10-07 22:50'
updated_date: '2026-10-07 22:50'
source_path: backlog/tasks/back-752 - Sequences-TUI-two-pane-view-sequence-sidebar-task-list-like-the-milestone-list.md
---

# Sequences TUI: two-pane view (sequence sidebar + task list)

`backlog sequence list` 不带 `--plain` 原本是嵌套在带框滚动容器里的纵向堆叠块：每组双层框、两侧各吃两列、光标不滚回视口、首键前无高亮、屏幕标注「read-only」而 `m` 键却在改依赖。`backlog milestone list` 早已用本项目通用布局（可导航侧栏 + 主面板 + 提示行 + 共享任务弹窗）。把 sequences 视图搬到同一形态。范围仅交互视图；`--plain` 文本输出、headless 回退与 `src/core/sequences.ts` 核心分层不变。

- **双面板**：`src/ui/sequences.ts` 重写为两个 blessed 面板——左侧 ` Sequences (N) ` 侧栏（`Unsequenced` + `Sequence 1..N` 带计数），右侧列出聚焦组的任务；每面板单框、行从框内一列起；首帧即高亮（挂载后调一次刷新）；随光标双向滚动；`Tab`/`→`/`←` 切面板
- **move 模式保持三目标**（Unsequenced / Sequence / 两序列间隙），右侧空闲面板用纯函数 `buildMovePreview` 预览 Enter 会写什么（来源组、目标、字段变更：依赖以 join 语义重写、ordinal 锚点、被阻断情形），并注「设置的是层而非层内顺序」
- **崩溃修复**：`refresh()` 与 blessed `select item` 事件互驱导致栈溢出，用 `syncingSelection` 守卫 + 每个 key handler 包 `safe()`；`padToPaneHeight` 清掉萎缩列表遗留行；退出 `screen.leave()/destroy()/releaseSharedProgram()`
- **纯函数**：`buildSequenceRows`/`buildMoveTargets`/`moveTargetLabel`/`buildMovePreview` 导出，便于无终端断言；`m` handler 同步设目标并绘制，await 快照到达后再精修，避免按键被回滚
- **验证**：伪 TTY 捕获渲染回文本（120x40 与 120x14）——单框、首帧光标可见、14 行窗口下滚 14 步右侧滚动、move 模式重标侧栏、`q` 干净退出；`sequences-view.test.ts` 13 pass；sequence 套件（核心+视图）658 pass / 0 fail；`--plain` 输出不变

## Related Concepts

- [[concepts/cli-tui]] — TUI 渲染与 blessed 面板惯例
- [[concepts/search-sequences]] — 序列计算与分层模型
- [[concepts/tui-theme-adaptive]] — TUI 主题自适应（焦点面板黄色边框）

## Related Sources

- [[sources/back-554-document-sequences-command-in-cli-instructions]] — sequences 命令的 CLI instructions 文档
- [[sources/back-709-dependency-closure-query]] — 依赖闭包/序列邻接（move 目标的依赖重写语义）
