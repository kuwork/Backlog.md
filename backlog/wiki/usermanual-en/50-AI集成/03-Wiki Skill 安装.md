---
title: Wiki Skill Installation
labels: [usermanual]
created_date: 2026-05-12 00:00
updated_date: 2026-11-04 00:00
---

# Wiki Skill Installation

Backlog.md includes the `llm-wiki-for-backlog` skill to help AI agents understand and maintain the project knowledge base. Use the `backlog wiki install` command to install this skill into supported AI tools with one click.

## What Is the Wiki Skill

`llm-wiki-for-backlog` is an Agent Skill that provides the following capabilities:

- **Build knowledge base**: automatically generate a structured wiki from project backlog content.
- **Incremental ingestion**: compile new tasks, documents, and decisions into cross-referenced knowledge pages.
- **Query and report**: answer project-related questions based on wiki content.
- **Health check**: scan for contradictions, orphan pages, and missing references in the knowledge base.

After installation, AI agents can directly reference the skill's guide during sessions and perform wiki-related operations more accurately.

## Supported AI Tools

| Alias | Corresponding Tool | Skills Directory |
|-------|--------------------|------------------|
| `claude` | Claude Code / Claude Desktop | `.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.codex/skills/` |
| `agents` | Generic agents directory | `.agents/skills/` |

## Installing the Skill

### Install to a Specific Agent

```bash
backlog wiki install claude
```

This command writes the built-in skill files into the agent's skills directory. The installation result shows the skill name, description, and trigger words.

### Force Overwrite

If the target directory already contains a skill with the same name, or the directory is occupied by another skill, use `--force` to overwrite:

```bash
backlog wiki install claude --force
```

### Preview Installation

Use `--dry-run` to preview the installation without actually writing files:

```bash
backlog wiki install codex --dry-run
```

## Installation Mechanism

### Unified Storage and Symbolic Links

Skill files are centrally stored in `.agents/skills/llm-wiki-for-backlog/` at the project root. Each agent's skills directory uses a **symbolic link** pointing to this unified location:

```
.agents/skills/llm-wiki-for-backlog/     ← actual files
.claude/skills/llm-wiki-for-backlog/    ← symbolic link
.codex/skills/llm-wiki-for-backlog/     ← symbolic link
```

The benefits of this design are:
- Updating the skill only requires modifying one place.
- Multiple agents share the same skill content.
- File duplication and version inconsistency are avoided.

### Windows Compatibility

Creating directory symbolic links on Windows requires administrator privileges or developer mode to be enabled. When symbolic link creation fails, the command automatically **falls back to direct copying** of files into the agent's actual directory and logs a warning.

### Skill Source

Skill content is embedded into the compiled binary at build time:

- **Canonical source**: `.codex/skills/llm-wiki-for-backlog/SKILL.md`
- **Embedded artifact**: `src/skills/embedded/llm-wiki-for-backlog.ts`
- **Build-time generation**: `scripts/embed-wiki-skill.ts` packages the skill files as a TypeScript module.

This means the compiled `backlog` binary can install the skill even without network access or the source repository.

## Updating the Skill

After upgrading Backlog.md, the built-in skill content may have been updated. Re-run the install command to overwrite to the latest version:

```bash
backlog wiki install claude --force
```

It is recommended to check and update installed skills after each Backlog.md upgrade (the method for upgrading the CLI itself is in the "Upgrade Backlog.md" section of [Installation & Initialization](../00-快速开始/01-安装与初始化.md)).

## Post-Installation Workflow

After installing the skill, AI agents can maintain the project wiki according to the `llm-wiki-for-backlog` conventions. It is not RAG—it does not re-derive knowledge on every query. Instead, it **incrementally compiles** backlog sources into a persistent, interlinked wiki, with knowledge accumulating over time. The four agent-side operations are:

| Operation | Description |
|-----------|-------------|
| Ingest | Read backlog sources such as `tasks/`, `docs/`, `decisions/`, generate source summary pages, concept pages, and entity pages, and update `index.md` / `overview.md` / `log.md`; when git is available, perform incremental ingestion based on changes since the last ingest. |
| Query | Read `wiki/index.md` first, synthesize answers from the compiled wiki, and write products (reports, etc.) to `wiki_output/`. |
| Lint | Scan for contradictions, orphan pages, stale claims, and missing cross-references. |
| Flowback | Save valuable query results back into `wiki/` to let knowledge compound. |

**Maintenance boundaries** (consistent with the WIKI GUIDELINES in AGENTS.md):

- `wiki/` is fully maintained by the LLM—human-readable and browsable, but do not edit by hand; hand edits will be overwritten by the next ingest and break interlink consistency.
- Backlog source directories (`tasks/`, `docs/`, etc.) are **read-only** for wiki operations.
- Ingest never recursively processes `wiki/` or `wiki_output/` itself.
- `wiki/log.md` is append-only; all cross-page references use wikilinks (`[[path/to/page]]`, without `.md`).

## Related

- [Migration Skill Installation](04-Migration%20Skill%20安装.md) — install the `task-migration-architect` skill (`backlog migrate install`) for upstream change analysis and task-driven branch merging.
