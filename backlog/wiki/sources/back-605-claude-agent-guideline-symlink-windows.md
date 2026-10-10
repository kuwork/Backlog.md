---
title: BACK-605 - Windows 下 Claude agent 指南符号链接修复
labels: [source, bug, infra, windows]
created_date: 2026-09-08 17:30
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-605 - Fix-Claude-agent-guideline-checkout-on-Windows-via-symlink-capable-config.md
---

# BACK-605 - Windows 下 Claude agent 指南符号链接修复

`src/guidelines/project-manager-backlog.md` 以符号链接提交，指向 `../../.claude/agents/project-manager-backlog.md`。在不支持符号链接的 Windows 检出（`core.symlinks=false`）上它物化为一个包含链接目标路径的纯文本文件，于是 `CLAUDE_AGENT_CONTENT` 变成路径字符串，installClaudeAgent 内容测试在每次 Windows 全量运行中失败。本任务通过启用支持符号链接的检出修复降级，而非替换该链接。

- 根因：git 在 Windows 上把提交的符号链接物化为保存目标路径的文本文件，内嵌的指南内容成了路径字符串而非 agent 定义。
- 第一种方案（已回退）：用普通文件副本（git 模式 100644）替换符号链接，使任意检出可用；被用户否决，决定保留单一事实来源。
- 最终方案：为本仓库设置 `git config core.symlinks=true` 并经 `git checkout` 恢复符号链接；在开发机上（开发者模式）解析为真实 agent 内容。
- 验证：`bun test src/test/claude-agent-install.test.ts` 4/4 通过；`bun run build` 干净，内嵌二进制包含完整 agent 内容（字符串匹配）。
- 接受的权衡：检出现在需要符号链接支持（Windows 开发者模式或提升权限克隆）；`core.symlinks=false` 会再次降级该链接。

## 验收标准

- claude-agent-install 内容测试在 Windows 上通过。
- 本仓库已设置 `core.symlinks=true`，符号链接在 Windows 上解析为真实 agent 内容；检出需要符号链接支持（开发者模式或提升权限克隆）。

## Related Concepts

- [[concepts/embedded-skills]] — 嵌入构建二进制的指南/agent 内容必须经受检出与构建解引用。
- [[concepts/ci-platform-contracts]] — Windows 检出环境假设（符号链接支持）作为隐性 CI 契约。

## Related Sources

- [[sources/back-410-cursor-agents-md-cleanup]] — 本仓库已提交的 agent 指令文件前序工作。
