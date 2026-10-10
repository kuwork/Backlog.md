---
title: BACK-410 - Cursor AGENTS.md 初始化清理
labels: [source, cli, init, agents, cursor]
created_date: 2026-08-17 23:00
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-410 - Init-keep-Cursor-on-AGENTS.md-and-remove-obsolete-rule-artifacts.md
---

# BACK-410 - Cursor AGENTS.md 初始化清理

清理任务：让 Cursor 保持映射到共享的 `AGENTS.md` init 目标，并移除过时的 Backlog 自有 Cursor 产物。具体包括：移除 `.cursorrules` 特例处理以及 guideline 标记助手（`getMarkers`、`hasBacklogGuidelines`、`wrapWithMarkers`、`stripGuidelineSection`）中的 `fileName` 传参，使所有 guideline 块统一使用 HTML 注释标记；从 `src/guidelines/index.ts` 删除未使用的 `CURSOR_GUIDELINES` 导出；更新 `src/cli.ts` 的 `--agent-instructions` 选项描述/帮助文案，说明 Cursor 写入 `AGENTS.md`；同步四个语言文件中 Web init 的 `AGENTS.md` 选项描述（`agentsMdDesc`），点名 Cursor 是 `AGENTS.md` 用户；并保证重复 init 幂等，保留现有 `AGENTS.md` 内容与用户管理的 `.cursor/rules`。

## 实现要点

上游 BACK-410 后续清理的 fork 改造版。上游的三个新测试未逐字移植，改为补充 fork 风格的测试覆盖。

## 验证

验收标准：

- 选择 Cursor 时绝不创建 `.cursorrules` 或其他 Backlog 自有 Cursor 规则文件。
- 保留现有 `AGENTS.md` 内容；重复 init 保持单一标记块。
- 新增聚焦测试覆盖 CLI init 与本地化 Web init 的 Cursor 文案。
- 类型检查与 Biome 通过。

验证：`bunx tsc --noEmit`、Biome、CLI init 与 Web 初始化测试全部通过。

## Related Concepts

- [[concepts/cli-instructions]] — CLI instruction surface 与 init 行为
- [[entities/ai-agents]] — AI 代理集成选项

## Related Sources

- [[sources/back-521.2]] — 简短 CLI 提示与 init 默认值迁移
- [[sources/back-521.14]] — CLI/MCP 指令指南更新
