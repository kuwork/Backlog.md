---
title: Migration Skill Installation
labels: [usermanual]
created_date: 2026-10-16 18:20
updated_date: 2026-11-04 00:00
---

# Migration Skill Installation

Backlog.md includes the `task-migration-architect` skill to help AI agents analyze upstream changes in forked projects and complete branch merges in a task-driven way. Use the `backlog migrate install` command to install this skill into supported AI tools with one click. The installation mechanism is the same as [Wiki Skill Installation](03-Wiki%20Skill%20安装.md).

## What Is the Migration Skill

`task-migration-architect` is an Agent Skill that provides the following capabilities:

- **Upstream change analysis**: use `git log` / `git show` to verify upstream changes and assess their impact on the fork.
- **A/B/C classification**: classify upstream differences into direct port, adapted port, and deliberate exclusion.
- **Task-driven branch merging**: turn migration items into backlog tasks and implement and verify them one by one.
- **Exclusion list maintenance**: record upstream changes deliberately excluded by this fork through a project memory file to avoid repeated evaluation.

## Supported AI Tools

| Alias | Corresponding Tool | Skills Directory |
|-------|--------------------|------------------|
| `claude` | Claude Code / Claude Desktop | `.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.codex/skills/` |
| `agents` | Generic agents directory | `.agents/skills/` |

## Installing the Skill

### Install to a Specific Agent

```bash
backlog migrate install claude
```

### Force Overwrite

If the target directory already contains a skill with the same name, use `--force` to overwrite:

```bash
backlog migrate install claude --force
```

Note: `--force` only overwrites skill content files and **does not** overwrite project memory files (see seed-only semantics below).

### Preview Installation

Use `--dry-run` to preview the installation without actually writing files:

```bash
backlog migrate install codex --dry-run
```

## Project Memory File (Seed-Only Semantics)

The skill includes a project memory file `references/current-branch-migration-exclusions.md` for recording the list of upstream changes excluded by this fork. It is **project-private memory** and is handled differently from skill content files:

- Only the template is embedded in the binary (`current-branch-migration-exclusions.template.md` content).
- On first install, a copy of the template is written with the formal file name as a starting point.
- If the target file already exists, it is always skipped—even with `--force` it will not overwrite the list you maintain in the project.

Installation output clearly distinguishes two groups: `Project memory seeded (template; never overwritten)` (newly written seeds this time) and `Project memory kept (already exists)` (memory files preserved because they already exist).

### Exclusion List Bootstrap

If the exclusion list is still an unfilled template after installation, the skill has a built-in bootstrap flow: the AI agent will guide you to fill in the first version of the exclusion list based on the project's actual situation, after which the project maintains it itself. The skill also includes MIGRATION GUIDELINES injection guidance, which can write migration conventions into the project's `AGENTS.md` in an idempotent marker style.

## Installation Mechanism

Same as `wiki install`: skill files are centrally stored in `.agents/skills/task-migration-architect/`, and each agent's skills directory points to this unified location via symbolic links; on Windows, when symbolic link creation fails, it automatically falls back to direct copying. Skill content is embedded into the compiled binary at build time, so installation works in offline environments. See the "Installation Mechanism" section of [Wiki Skill Installation](03-Wiki%20Skill%20安装.md) for details.
