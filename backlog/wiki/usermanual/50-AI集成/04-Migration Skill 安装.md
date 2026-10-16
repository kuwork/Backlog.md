---
title: Migration Skill 安装
labels: [usermanual]
created_date: 2026-10-16 18:20
updated_date: 2026-10-16 18:20
---

# Migration Skill 安装

Backlog.md 内置 `task-migration-architect` skill，帮助 AI 代理在 fork 项目中分析上游变更并按任务驱动的方式完成分支合并。通过 `backlog migrate install` 命令，可将该 skill 一键安装到支持的 AI 工具中。安装机制与 [Wiki Skill 安装](03-Wiki%20Skill%20安装.md) 一致。

## 什么是 Migration Skill

`task-migration-architect` 是一个 Agent Skill，提供以下能力：

- **上游变更分析**：用 `git log` / `git show` 查证上游改动，评估对 fork 的影响
- **A/B/C 分类**：把上游差异分类为直接移植、适配移植、刻意排除三档
- **任务驱动的分支合并**：把迁移条目落成 backlog 任务，逐个实施与验证
- **排除清单维护**：通过项目记忆文件记录本 fork 刻意排除的上游变更，避免重复评估

## 支持的 AI 工具

| 别名 | 对应工具 | Skills 目录 |
|------|---------|------------|
| `claude` | Claude Code / Claude Desktop | `.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.codex/skills/` |
| `agents` | 通用 Agents 目录 | `.agents/skills/` |

## 安装 Skill

### 安装到指定 Agent

```bash
backlog migrate install claude
```

### 强制覆盖

如果目标目录已存在同名 skill，使用 `--force` 覆盖：

```bash
backlog migrate install claude --force
```

注意：`--force` 只覆盖 skill 内容文件，**不会**覆盖项目记忆文件（见下文 seed-only 语义）。

### 预览安装

使用 `--dry-run` 预览安装操作，不实际写入文件：

```bash
backlog migrate install codex --dry-run
```

## 项目记忆文件（seed-only 语义）

该 skill 带有一份项目记忆文件 `references/current-branch-migration-exclusions.md`，用于记录本 fork 排除的上游变更清单。它属于**项目私有记忆**，处理方式与 skill 内容文件不同：

- 二进制中只嵌入模板（`current-branch-migration-exclusions.template.md` 的内容）
- 首次安装时以正式文件名写入一份模板副本，作为起点
- 目标文件**已存在时一律跳过**——即使加 `--force` 也不会覆盖你在项目中维护的清单

安装输出会明确区分两组结果：`Project memory seeded (template; never overwritten)`（本次新写入的种子）与 `Project memory kept (already exists)`（已存在而被保留的记忆文件）。

### 排除清单 Bootstrap

如果安装后排除清单仍是未填充的模板，skill 内置了 bootstrap 流程：AI 代理会引导你根据项目实际情况填充首版排除清单，之后由项目自行维护。skill 还包含 MIGRATION GUIDELINES 注入指引，可把迁移规范以幂等 marker 的方式写入项目的 `AGENTS.md`。

## 安装机制

与 wiki install 相同：skill 文件集中存储在 `.agents/skills/task-migration-architect/`，各 Agent 的 skills 目录通过符号链接指向该统一位置；Windows 上符号链接创建失败时自动回退为直接复制。skill 内容在构建时嵌入编译后的二进制，离线环境也能安装。细节见 [Wiki Skill 安装](03-Wiki%20Skill%20安装.md) 的「安装机制」一节。
