---
title: BACK-574 - 决策命令与双栏交互浏览器
labels: [source, migration, cli, tui, decisions]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-574 - Add-decision-list-view-and-update-commands-with-task-list-style-interactive-browser.md
---

# BACK-574 - 决策命令与双栏交互浏览器

将 CLI 决策面从单一的 `backlog decision create` 扩展为完整的 `list`/`view`/`update` 命令，外加镜像任务列表交互模式的双栏决策浏览器。同时加固共享的 blessed TUI program 以支持顺序屏幕，修复关闭查看器后的 PowerShell/VS Code 挂起。

## 实现要点

- `backlog decision list` 枚举决策，支持 `--plain` 和 `--json` 模式；JSON 使用版本化信封 `{ schemaVersion: 1, kind: "decision-list", decisions: [...] }`；空日志打印 `No decisions found.`；非 TTY 默认 plain。
- `backlog decision view <decisionId>` 打印 frontmatter 和 markdown 正文，TTY 模式默认打开可滚动查看器，否则 `--plain`。
- `backlog decision update <decisionId>` 支持 `--content`（替换正文）和可重复的 `--append-content`（追加块）；两者都经共享 `processCliEscapes()` helper 接受字面 `\n` 转义；复用 `core.updateDecisionFromContent()` 做结构化小节解析（Context / Decision / Consequences / Alternatives）。
- 新的 `src/ui/decision-list-viewer.ts`：双栏浏览器，参照任务列表交互模型——左栏 `Decisions (N)`，右栏原始 markdown 详情，`←/→` 切换栏，`↑/↓/j/k` 导航或滚动，活动栏边框变黄、失焦恢复，底部帮助栏。
- `src/ui/tui.ts` 的 TUI 加固：新增 `releaseSharedProgram()` 在顺序屏幕间清理共享 blessed program；`scrollableViewer()` 在 Windows 上禁用鼠标跟踪，新增显式滚动键（`PgUp/PgDn/Home/End`），打开时调用 `screen.enter()`、关闭时调用 `screen.leave()` + `releaseSharedProgram()`，终端尺寸不可用时回退 plain 输出。
- 指南注册：`src/ui/components/help-popup.ts` 新增 `decision-list` 帮助上下文；`src/mcp/workflow-guides.ts` 新增 `CLI_DECISIONS_GUIDE`/`MCP_DECISIONS_GUIDE` 导出并在 `WORKFLOW_GUIDE_KEYS`/`INSTRUCTION_GUIDE_KEYS` 中加入 `"decisions"`，使 `backlog instructions decisions` 对 CLI 和 MCP agent 可用。
- 测试在 `src/test/cli-doc-decision-board.test.ts`（create `--plain`、list plain/json/empty、view、update）和 `src/test/cli-json-output.test.ts`（信封、互斥输出模式）。

## 验收标准

- `decision list` 支持 `--plain`/`--json`，空日志报告 `No decisions found.`；`decision view` 和 `decision update`（`--content`/`--append-content` 带字面 `\n`）可用。
- 交互列表打开双栏浏览器，匹配任务列表交互模型（栏切换、vim 键、黄色活动边框、帮助栏）。
- TTY 经 `releaseSharedProgram()`、终端状态恢复、禁用鼠标跟踪和 plain 回退处理 Windows/PowerShell/VS Code。
- CLI 和 MCP 决策指南已更新；测试覆盖 list/view/update。

## Related Concepts

- [[concepts/cli-tui]] — 双栏浏览器与共享 blessed program 生命周期
- [[concepts/json-output]] — 版本化决策列表 JSON 信封契约
- [[concepts/cli-instructions]] — 在指令系统注册的新 decisions 指南

## Related Sources

- [[sources/back-521.7]] — 确立"CLI 面对齐 MCP"模式的里程碑 CLI 对齐工作
- [[sources/back-562-stable-json-output]] — 决策列表信封遵循的稳定 JSON 契约
