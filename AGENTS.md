
When you're working on a task, you should assign it yourself: -a @{your-name}

In addition to the rules above, please consider the following:
At the end of every task implementation, try to take a moment to see if you can simplify it.
When you are done implementing, you know much more about a task than when you started.
At this point you can better judge retrospectively what can be the simplest architecture to solve the problem.
If you can simplify the code, do it.

## Simplicity-first implementation rules

- Prefer a single implementation for similar concerns. Reuse or refactor to a shared helper instead of duplicating.
- Keep APIs minimal. Favor load + upsert over load/save/update, and do not add unused methods.
- Avoid extra layers (services, normalizers, versioning) unless there is an immediate, proven need.
- Keep behavior consistent across similar stores (defaults, parse errors, locking). Divergence requires a clear reason.
- Don't add new exported helpers just to compute a path; derive from existing paths or add one shared helper only when reused.


## Commands

### Development

- `bun i` - Install dependencies
- `bun test` - Run all tests
- `bunx tsc --noEmit` - Type-check code
- `bun run check .` - Run all Biome checks (format + lint)
- `bun run build` - Build the CLI tool
- `bun run cli` - Uses the CLI tool directly

### Testing

- `bun test` - Run all tests
- `bun test <filename>` - Run specific test file

### Configuration Management

- `bun run cli config list` - View all configuration values
- `bun run cli config get <key>` - Get a specific config value (e.g. defaultEditor)
- `bun run cli config set <key> <value>` - Set a config value with validation

## Core Structure

- **CLI Tool**: Built with Bun and TypeScript as a global npm package (`npm i -g backlog.md`)
- **Source Code**: Located in `/src` directory with modular TypeScript structure
- **Task Management**: Uses markdown files in `backlog/` directory structure
- **Workflow**: Git-integrated with task IDs referenced in commits and PRs

## Agent POV

- Treat Backlog.md as a shipped CLI/MCP binary that may be used from other repositories where agents cannot inspect this source tree.
- Backlog.md is not a supported JavaScript or TypeScript library API for external consumers. Do not treat exported source symbols, classes, or methods in `/src` as stable public interfaces unless they are explicitly documented in shipped CLI/MCP/instruction surfaces.
- When you decide what another agent can rely on, use only the public surface: MCP workflow resources, MCP tool descriptions/schemas, CLI help, and instruction files shipped with the project.
- Do not assume external agents know internal implementation details, constants, or source-only conventions.
- When reviewing changes, do not ask for compatibility shims just because a source-level method exists or was removed. Only preserve compatibility for behavior that is part of the documented CLI, MCP, config, or instruction contract.
- If a convention matters for agent behavior, document it in the public MCP/instruction surface rather than relying on source-code discovery.

## Code Standards

- **Runtime**: Bun with TypeScript 5
- **Formatting**: Biome with tab indentation and double quotes
- **Linting**: Biome recommended rules
- **Testing**: Bun's built-in test runner
- **Pre-commit**: Husky + lint-staged automatically runs Biome checks before commits

The pre-commit hook automatically runs `biome check --write` on staged files to ensure code quality. If linting errors
are found, the commit will be blocked until fixed.

## Git Workflow

- **Branching**: Use feature branches when working on tasks (e.g. `tasks/back-123-feature-name`)
- **Committing**: Use the following format: `BACK-123 - Title of the task`
- **PR titles**: Use `{taskId} - {taskTitle}` (e.g. `BACK-123 - Title of the task`)
- **Github CLI**: Use `gh` whenever possible for PRs and issues

<!-- BACKLOG.MD GUIDELINES START -->
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

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

- If you encounter duplicate or ambiguous task IDs (e.g., `task-1` and `task-01`), run `backlog doctor` first. Do not rename files or edit frontmatter IDs manually. Apply `backlog doctor --fix` only after reviewing the preview, then use `backlog doctor --commit` to finalize or `backlog doctor --rollback` to undo before committing.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->


<!-- WIKI GUIDELINES START -->

## Wiki Knowledge Base

This project maintains an LLM-managed wiki inside the backlog directory for cross-referencing and compounding knowledge from tasks, docs, and decisions.

### Location
- `backlog/wiki/` — LLM-maintained knowledge base (do not edit manually)
- `backlog/wiki_output/` — Query products and generated artifacts

### Raw Sources (Human Input Layer)
The LLM reads from the following backlog folders as raw input. These are immutable for wiki purposes:
- `tasks/` — Requirements, acceptance criteria, implementation notes
- `docs/` — Documentation, guides, API references
- `decisions/` — ADRs, design choices, rationale
- `drafts/` — Draft ideas, brainstorming notes
- `milestones/` — Milestone definitions, roadmap items
- `archive/` — Archived tasks and records
- `completed/` — Completed task records with final summaries
- `assets/` — Images, diagrams, attachments
- `src/` (or other project source directories) — Project source code, implementation files (optional, when backlog is inside a project repo)

### Wiki Structure (LLM-Maintained Layer)
- `wiki/index.md` — Content catalog; read this FIRST on any operation
- `wiki/log.md` — Append-only chronological log (`## [YYYY-MM-DD HH:mm:ss] {op} | {title}`). The detailed timestamp enables git-aware incremental ingestion.
- `wiki/overview.md` — High-level synthesis of the entire knowledge base
- `wiki/sources/` — One summary per backlog source
- `wiki/concepts/` — Extracted concept articles
- `wiki/entities/` — People, tools, projects, organizations
- `wiki/comparisons/` — Cross-cutting analyses
- `wiki/usermanual/` — Structured user manual (SUMMARY.md-based, mergeable into `manual.md`)

### 页面风格约定 (Page Style Conventions)

自 2026-10-09 起生效；存量页面按 Lint 逐步收敛，新页面必须遵守。

1. **语言**：正文、标题、小节名一律简体中文。英文仅限代码标识符、命令、字段名、文件路径与固有专名（fail-closed、wikilink、hotfix、memo 等不译词）。同一页面不得整段切换语言。
2. **frontmatter 字段顺序固定**：`title`、`labels`、`created_date`、`updated_date`；source 页在 `updated_date` 后加 `source_path`；decision 页允许可选 `description`（一行摘要）；execution/patterns 页允许 `extracted_from`（裸任务 ID 列表，如 `- BACK-757`）。日期一律不加引号（`updated_date: 2026-10-09 22:00`）；labels 一律行内数组（`labels: [concept, graph]`）；不加约定外字段。
3. **title 格式**：source 页 = `BACK-757 - 中文短标题`（实体 ID + 连字符 + 中文短标题；doc/milestone/draft 页同理带各自 ID；顶层文件页如 README 用 `README.md 中文说明` 式，无 ID）。concept / decision / execution / reasoning / patterns / entities 页用中文名词短语、不含 ID。title 永不加引号。
4. **H1**：每页有且仅有一个 H1，逐字等于 frontmatter title（含 ID）。禁止无 H1 或 H1 丢失 ID。
5. **source 页骨架**：H1 → 导语一段（背景+结论）→ `## 问题`（bug）或 `## 目标`（feature）→ `## 解决方案` 或 `## 实现要点` → `## 验证`（有实测数据时）→ Related 小节。已有内容按此归位；禁止导语后没有任何正文小节直接进入 Related；禁止为凑结构凭空造节。
6. **decision 页骨架**：`## 背景` → `## 决定` → `## 理由` → `## 被否方案` → Related。小节名不得使用 Context/Decision 等英文。
7. **execution / patterns 页骨架**：`## 适用场景` → `## 标准步骤` → `## 常见陷阱` → `## Related Sources`（不叫"参考任务"；列表内只放 source 链接）。
8. **Related 小节**：命名只用 `Related Concepts` / `Related Sources` / `Related Entities` / `Related Decisions` / `Related Reasoning`，按此固定顺序；列表项格式 `- [[path/to/page]] — 一句中文说明`；禁止合并为 `## Related`；禁止空 Related 小节。每页至少一个 Related 小节。
9. **wikilink**：正文 prose 中允许别名 `[[target|BACK-543]]`；Related 列表内不用别名；所有跨页引用一律 `[[path]]`（不带 `.md`）。
10. **翻译忠实性**：英文存量页译成中文时保留全部事实、file:line 引用、命令、标识符与 wikilink 原样，不增删内容。
11. **术语对照**（翻译与写作统一）：modal=模态框、watcher=监视器、corpus=语料、terminal status=终态、cross-branch=跨分支、drill-down=钻取、pinboard=钉板、graph=图谱、fallback=回退、acceptance criteria=验收标准、board=看板、plain output=plain 输出。
12. **行尾 LF**；不改动 `wiki_output/`、`index.md`、`overview.md`、`log.md`（由 ingest/lint 流程统一维护）。

### Rules
- **NEVER** write to `tasks/`, `docs/`, `decisions/`, or other backlog source folders during wiki operations
- **NEVER** recursively ingest `wiki/` or `wiki_output/`
- Use `[[wikilinks]]` for all cross-references within the wiki
  - **CRITICAL:** In `index.md` tables, use `[[path/to/file]]` (without `.md`) as the cell value, not standard Markdown links like `[text](path.md)`
  - Example: `| [[sources/task-1-feature]] | Task | Description |` — NOT `| [task-1](sources/task-1.md) | Task | Description |`
  - **CRITICAL:** In page bodies (sources, concepts, entities), Related Concepts / Related Sources / Related Entities sections must also use `[[path/to/file]]`, not `[text](path.md)`
  - Example: `- [[concepts/keyvault]]` — NOT `- [KeyVault](concepts/keyvault.md)`
- Append-only for `wiki/log.md`
- YAML frontmatter on every wiki page at minimum:
  - `title` — page title
  - `created_date` — set on creation (`yyyy-MM-dd HH:mm`)
  - `updated_date` — updated on every save (`yyyy-MM-dd HH:mm`)
  - `labels` — optional array of tags for categorization (e.g. `source`, `concept`, `entity`, `comparison`)
- Filenames: lowercase-with-hyphens

### Operations
- **Ingest** — Read backlog sources, extract concepts/entities, create source summaries, update index/overview/log
  - **Git-aware incremental ingestion**: If the project is a git repo, use `git status --porcelain` and `git log --since="{last_ingest}"` to detect changed files since the last ingestion. Skip files that were already ingested and have not changed. Fall back to full scan if git is unavailable.
- **Query** — Read index, synthesize from compiled wiki, produce chat responses / reports / slides / charts
- **Lint** — Scan for contradictions, orphans, stale claims, missing cross-references
- **Flowback** — Save valuable query results back into the wiki for compounding

<!-- WIKI GUIDELINES END -->
