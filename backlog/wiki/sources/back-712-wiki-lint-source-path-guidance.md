---
title: BACK-712 - agent 在 wiki lint 中漏检 source_path 问题
labels: [source, wiki, agent-guidance]
created_date: 2026-09-26 14:14
updated_date: 2026-10-09 23:30
source_path: backlog/tasks/back-712 - Agents-miss-source_path-problems-during-wiki-lint-reviews.md
---

# BACK-712 - agent 在 wiki lint 中漏检 source_path 问题

wiki lint 可以带着指向空处的 `source_path` 干净退出，而 agent 不做独立检查就接受了干净结果。本任务强化 `llm-wiki-for-backlog` SKILL 指南，使这类缺陷在 lint 工作中被捕获并修复。

## 解决方案

- 更新权威版 `llm-wiki-for-backlog` SKILL.md 并同步内嵌技能模块；wiki lint 命令自身行为不变
- 为 lint 与 ingest 迷你 lint 新增显式的源回链检查：agent 必须独立于 lint 退出状态验证 `source_path` 解析，分类失配前查重命名历史，只更新已验证的路径，源消失时保留 source 页，标识歧义时上报而非猜测
- 指南要求修复底层索引问题，而不是把 lint 干净运行当作源完整性的证明
- 验证：`tsc` 与 `bun run check .` 无告警；`wiki-install.test.ts` 12 通过；内嵌技能与权威 SKILL.md 一致（一次根级 `bun test` 尝试因无关 tmp/ 产物被中止）

## 验收标准

- SKILL 指南要求独立于 lint 退出状态验证 source_path 解析
- 照做的 agent 能发现不可解析路径并追溯到索引流程，修复根因
- 现有 wiki lint 命令行为不变

## Related Concepts

- [[concepts/embedded-skills]] — 本次更新的权威 SKILL.md + 内嵌模块对
- [[concepts/cli-instructions]] — 指南所属的面 agent 指令面

## Related Sources

- [[sources/wiki-install-task]] — 其安装负载包含此 SKILL.md 的 wiki 技能安装流程
