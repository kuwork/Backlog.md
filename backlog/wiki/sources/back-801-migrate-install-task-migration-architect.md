---
title: BACK-801 - migrate install 捆绑 task-migration-architect 技能
labels: [source, cli, skill, migration]
created_date: 2026-10-16 18:20
updated_date: 2026-10-16 18:20
source_path: backlog/tasks/back-801 - Bundle-task-migration-architect-skill-with-seed-only-project-memory-install.md
---

# BACK-801 - migrate install 捆绑 task-migration-architect 技能

**状态**: Done | **标签**: cli, skill, migration | **负责人**: @kimi

`task-migration-architect` 技能此前只存在于本仓库 `.codex/skills/` 下，本任务将其像 llm-wiki-for-backlog 一样嵌入二进制，并新增 `backlog migrate install <agent>` 命令安装到其他项目。核心难点是技能内的 `references/current-branch-migration-exclusions.md` 属于 fork 私有的项目记忆：直接嵌入会把私有记忆泄漏进发布二进制，而安装命令的全覆盖语义又会冲掉用户维护的副本。解法是模板 + seed-only 写入。

## 目标

- 新增 `backlog migrate install <agent>`（claude/codex/agents），支持 `--force` 与 `--dry-run`，安装机制与 `backlog wiki install` 一致
- `current-branch-migration-exclusions.md` 不逐字嵌入二进制；改为嵌入 `.template.md` 模板，安装时以正式文件名仅在缺失时写入，`--force` 也不覆盖
- SKILL.md 增加排除清单缺失/未填充时的 bootstrap 流程，以及 agent 驱动的 MIGRATION GUIDELINES 注入指引（与 wiki 的 WIKI GUIDELINES 注入同模式，marker 幂等）
- 入口指引覆盖 CLI root entry、agent nudge、instructions overview、agent guidelines
- `wiki-install.ts` 实现与行为保持不变

## 实现要点

**嵌入脚本泛化**（`scripts/embed-skills.ts`，替代已删除的 `scripts/embed-wiki-skill.ts`）：

- 按技能配置数组嵌入多个技能，每个技能生成两个导出：`<NAME>_SKILL`（常规内容文件，安装时总是重写）与 `<NAME>_SEED_FILES`（项目记忆种子）
- seed-file 映射（template → target）：`references/current-branch-migration-exclusions.template.md` 的内容以 target 路径 `references/current-branch-migration-exclusions.md` 嵌入；template 与 target 两个本地文件都从 `<NAME>_SKILL` 中排除，私有记忆不进二进制
- llm-wiki-for-backlog 的 seedFiles 为空数组，行为不变

**安装命令**（`src/commands/migrate-install.ts`）：

- 复刻 wiki-install 的机制：中央存储 `.agents/skills/task-migration-architect/` + agent 目录符号链接，Windows 符号链接失败时回退直接复制；`resolveAgent` 直接复用自 `wiki-install.ts`
- 常规文件总是（重）写入；seed 文件用 `existsSync` 判断，已存在则跳过并记入 `seedFilesSkipped`——即使 `--force` 也不覆盖
- 结果格式化区分「Project memory seeded (template; never overwritten)」与「Project memory kept (already exists)」两组输出

**SKILL.md 流程补充**（`.codex/skills/task-migration-architect/SKILL.md`）：

- 排除清单 Bootstrap：目标项目里排除文件缺失或仍是未填充模板时的初始化流程
- MIGRATION GUIDELINES 注入：指引 agent 把迁移规范注入目标项目的 AGENTS.md，marker 幂等，与 wiki 技能的 WIKI GUIDELINES 注入同模式

**入口指引**：`src/ui/root-entry.ts` 新增「Task-driven branch merge:」区块；`src/guidelines/cli-agent-nudge.md`、`src/guidelines/cli-instructions/overview.md`、`src/guidelines/agent-guidelines.md` 同步补指引。

## 验证

- `src/test/migrate-install.test.ts` 8 个用例；连同 wiki-install 与 cli-root-entry 共 27 个测试通过
- `bunx tsc --noEmit` 与 biome check 干净
- 端到端冒烟（临时项目）：首次安装 seed 模板；`--force` 重装保留用户已编辑的记忆文件

## Related Concepts

- [[concepts/embedded-skills]] — 构建时技能嵌入与 Agent 安装机制，本任务将其泛化为多技能 + seed 文件
- [[concepts/upstream-migration]] — 上游迁移 A/B/C 分类策略，task-migration-architect 技能的方法论本体

## Related Sources

- [[sources/wiki-install-task]] — BACK-474 Wiki Install 命令，本任务复刻其安装机制
- [[sources/back-570-wiki-install-hints-cli-banner]] — BACK-570 安装提示全入口可见，本任务入口指引的同模式先例
