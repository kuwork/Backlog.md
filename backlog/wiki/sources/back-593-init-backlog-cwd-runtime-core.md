---
title: BACK-593 - init 遵循 BACKLOG_CWD 并统一 core 构造
labels: [source, cli, tui]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-593 - Make-init-honor-BACKLOG_CWD-and-route-TUI-operations-through-shared-core-with-runtime-cwd.md
---

# BACK-593 - init 遵循 BACKLOG_CWD 并统一 core 构造

`init` 与若干 TUI/工具路径直接读 `process.cwd()`，绕过共享的运行时 cwd 解析：当 BACKLOG_CWD 钉住一个项目时，在另一目录运行 `init` 会静默重新初始化错误的看板，且每次按键都会绑定到进程目录并丢弃一个临时启用 watcher 的 Core。现在唯一的 Core 构造路径是 `createRuntimeCore()` 工厂，init 走共享运行时流程。

- `src/cli.ts`：从 `requireProjectRoot()` 拆出 `requireRuntimeCwd()`（一条解析路径，覆盖无效 override 时统一报错 + exit 1）；init handler 改等待它而非 `process.cwd()`，覆盖 git 检测、Core 构造、重复 init 探测、agent 指令文件、MCP 提示、配置向导与补全安装。
- `src/core/backlog.ts`：新增 `createRuntimeCore(options?)`——解析运行时 cwd，经 `findBacklogRoot()` 向上查找，无项目时保留解析出的目录（对库调用方优雅降级，绝不退出），对无效 override 走 fail-closed。
- `src/ui/board.ts`：`renderBoardTui` 接受 `core?: Core`；记忆化的 `getCore()` 闭包支撑全部八个变更点（create persist、编辑器、details complete/archive、reorder move、board-key complete/archive、hideEmptyColumns 切换），替换所有裸 `new Core(process.cwd(), { enableWatchers: true })`。
- 各视图透传已有 core（unified-view、simple-unified-view、enhanced-views）；`task-viewer-with-search.ts` 回退到 `createRuntimeCore({ enableWatchers: true })`；零散点对齐：`src/utils/status.ts`、两处 `src/utils/task-path.ts` 回退点、`src/completions/data-providers.ts`（放弃本地 createCore，改为基于工厂的 `withCore`）。
- 全仓搜索确认不再存在 `Core(process.cwd())` 构造；全量测试 1968 pass / 14 个预先存在的不相关失败，已通过 HEAD 基线 worktree 确认。

## 验收标准

- init 端到端指向 BACKLOG_CWD 钉住的目录；无效 override 以统一信息非零退出；createRuntimeCore 存在且优雅降级；无接口从 process.cwd() 构造 Core；测试覆盖 init 钉住、工厂用例及一次 TUI 变更落入钉住项目。

## Related Concepts

- [[concepts/core-architecture]] — Core 构造与运行时 cwd 解析
- [[concepts/cli-tui]] — TUI 各视图与看板 handler 的 core 透传

## Related Sources

- [[sources/back-590-hide-empty-board-columns]] — 获得共享 core 的看板变更/持久化路径
