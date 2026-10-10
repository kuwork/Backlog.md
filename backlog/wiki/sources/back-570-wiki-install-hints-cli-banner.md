---
title: BACK-570 - wiki 安装提示全入口可见
labels: [source, cli, agent-guidance, wiki]
created_date: 2026-09-08 16:55
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-570 - Add-wiki-install-hints-to-CLI-banner-agent-nudge-and-READMEs.md
---

# BACK-570 - wiki 安装提示全入口可见

让内置的 `backlog wiki install <agent>` 技能安装命令在所有入口可发现。命令已存在（目标：claude / codex / agents，支持 `--dry-run` 和 `--force`），但在 CLI 根入口、agent 指令和两个 README 中都不可见，用户和 agent 从未发现它。

## 实现要点

- 在 `src/ui/root-entry.ts` 的 CLI 根入口横幅新增专门的 `LLM Wiki:` 小节，位于 `Local instructions:` 之后，用 `commandLine("backlog wiki install <agent>", ...)` 展示，与本地工作流指令视觉分隔。
- 在 `src/guidelines/cli-agent-nudge.md` 新增 `Wiki Skill Installation` 小节，列出支持的 agent（claude / codex / agents）和 `--dry-run` / `--force` 选项。
- 在 `README.en.md` 和 `README.md` 的 LLM Wiki Knowledge Base 区域下新增 `Install the Wiki Skill` / `安装 Wiki Skill` 小节。
- 扩展 `src/test/cli-root-entry.test.ts`，断言新小节和命令行在已初始化和未初始化两种根入口输出中都出现（6 个测试通过）。
- 完整运行 `src/test/cli.test.ts` 出现 2 个既有的无关失败（task list limit 分组、doc update 路径）。

## 验收标准

- `src/guidelines/cli-agent-nudge.md` 包含 wiki 技能安装指引。
- `README.md` 和 `README.en.md` 的 wiki 小节包含安装说明。
- 测试断言新的 CLI 横幅行存在。
- CLI 根入口有专门的 LLM Wiki 小节和 `backlog wiki install <agent>`。

## Related Concepts

- [[concepts/cli-entry]] — 根入口横幅是 CLI 命令的主要发现面
- [[concepts/cli-instructions]] — agent nudge 随本地指令面一起发布
- [[concepts/embedded-skills]] — wiki 技能内嵌于二进制、按 agent 安装

## Related Sources

- [[sources/wiki-install-task]] — BACK-474 引入 `backlog wiki install` 命令本身
- [[sources/back-525-update-wiki-skill-and-cli-multi-line-input-docs]] — 相邻的 wiki 技能文档更新
- [[sources/back-521.2]] — 本任务扩展的短 CLI nudge 设计
