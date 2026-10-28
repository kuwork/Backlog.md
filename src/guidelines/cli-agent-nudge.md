<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**At the beginning of each conversation in this project, run `backlog instructions overview` before answering or taking action. Re-read it only if you have not read it yet in the current conversation.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Use the detailed guides when needed:
- `backlog instructions task-creation` for creating or splitting tasks
- `backlog instructions task-execution` for planning and implementation workflow
- `backlog instructions task-finalization` for completion and handoff
- `backlog instructions milestones` for creating, editing, removing, and archiving milestones
- `backlog instructions documents` for creating, updating, listing, and viewing project documents (including live `sqlite-query` / `duckdb-query` / `cypher-query` blocks)
- `backlog instructions decisions` for creating or listing decisions
- `backlog instructions drafts` for creating, promoting, demoting, or archiving drafts
- `backlog instructions graph` for running Cypher graph queries from the CLI
- `backlog instructions memos` for capturing or managing memos (quick notes, stdin capture, listing, updating, deleting)

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

### Wiki Skill Installation

Backlog.md includes an LLM-managed wiki under `backlog/wiki/`. To enable wiki operations for the current agent, install the bundled `llm-wiki-for-backlog` skill:

- `backlog wiki install claude` — Claude Code / Claude Desktop
- `backlog wiki install codex` — OpenAI Codex CLI
- `backlog wiki install agents` — Generic agents directory

Use `--dry-run` to preview the operation and `--force` to overwrite an existing installation. After installing, refer to the skill guide for ingestion, query, lint, and flowback workflows.

### Migration Skill Installation

For projects that fork an upstream repository and merge changes selectively, task by task, install the bundled `task-migration-architect` skill:

- `backlog migrate install claude` — Claude Code / Claude Desktop
- `backlog migrate install codex` — OpenAI Codex CLI
- `backlog migrate install agents` — Generic agents directory

The installer seeds `references/current-branch-migration-exclusions.md` (project-owned migration memory) from a template only when missing; it is never overwritten, even with `--force`. After installing, fill in the template before running migration analysis — the skill's bootstrap flow handles this.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

- If you encounter duplicate or ambiguous task IDs (e.g., `task-1` and `task-01`), run `backlog doctor` first. Do not rename files or edit frontmatter IDs manually. Apply `backlog doctor --fix` only after reviewing the preview, then use `backlog doctor --commit` to finalize or `backlog doctor --rollback` to undo before committing.

</CRITICAL_INSTRUCTION>
