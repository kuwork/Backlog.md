---
title: Claude Agent Guideline 用符号链接保留单一事实来源
created_date: 2026-09-08 17:02
updated_date: 2026-09-08 17:02
labels: [decision]
---

# Claude Agent Guideline 用符号链接保留单一事实来源

## 背景

BACK-605 决定 Claude agent guideline 的分发方式。仓库内有 `.claude/agents/` 作为 agent 定义目录，需要让其他位置也能引用同一份定义。

## 决定

采用 `core.symlinks=true` 并在 checkout 中保留符号链接：`.claude/agents/` 保持单一事实来源，其他引用位置以符号链接指向它。

代价：Windows 上 checkout 需要符号链接支持（开发者模式或提权克隆）。

## 理由

- 单一事实来源消除了双份定义漂移的风险，agent 定义的更新一处生效。
- 相对双份维护，符号链接的 Windows 配置成本是一次性的。

## 被否方案

- **常规文件副本**：被用户明确否决——两份副本需要双份维护，迟早漂移。

## Related

- [[sources/back-605-claude-agent-guideline-symlink-windows]]
- [[concepts/embedded-skills]]
- [[concepts/cli-instructions]]
