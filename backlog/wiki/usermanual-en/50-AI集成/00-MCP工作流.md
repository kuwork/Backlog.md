---
title: MCP Workflow
labels: [usermanual]
created_date: 2026-05-07 00:00
updated_date: 2026-11-04 00:00
---

# MCP Workflow

Backlog.md integrates deeply with AI coding assistants through the Model Context Protocol (MCP). MCP is a standardized protocol that allows AI agents to directly invoke Backlog.md's functional tools without users manually typing CLI commands. With MCP, AI can read, create, and manage tasks like a human developer, enabling true collaborative project management.

## What Is MCP Integration

In the traditional approach, AI assistants could only learn Backlog.md's CLI commands from instruction files and then execute shell commands on their own. This had two problems:

- AI had to parse shell output, which was error-prone.
- When command execution failed, AI had difficulty accurately determining the cause.

MCP integration fundamentally changes this model. AI agents call Backlog.md's tool functions directly through a standardized protocol, with structured parameters and return values, greatly improving reliability. The Backlog.md MCP server runs locally and communicates with AI clients via stdio, exposing no network ports.

## Spec-Driven Workflow

A Spec-Driven workflow is recommended for collaborating with AI: break large requirements into small tasks and implement them step by step. The process is divided into four steps.

### Step 1: Describe the Idea

Describe the feature you want to build or the problem you want to solve to the AI agent. The AI will help you break the idea into multiple small tasks, each with a clear description and acceptance criteria. Tasks should be small enough to be completed in a single conversation.

Example conversation:

> I want to add user authentication to the project. Please break it into executable tasks, each with acceptance criteria.

### Step 2: One Task at a Time, One Task per PR

Each agent session handles only one task. This constraint offers three benefits:

- More focused context and better AI understanding.
- Each task corresponds to an independent Pull Request, making code review easier.
- If something fails, only a single task needs to be redone, without affecting a large amount of code.

Before starting a new task, have the AI read the current task details:

```bash
backlog task <id> --plain
```

### Step 3: Write the Implementation Plan Before Coding

Before implementing code, have the AI study the current codebase, then write an Implementation Plan and write it into the task via CLI:

```bash
backlog task edit <id> --plan "1. Study existing code structure
2. Design interfaces
3. Implement core logic
4. Add tests"
```

The implementation plan ensures the proposal reflects the current state of the codebase and prevents AI from developing based on outdated assumptions. After writing the plan, it is recommended to confirm with team members before starting coding.

### Step 4: Implement and Verify

The AI agent writes code according to the implementation plan. After completion, perform the following verification steps:

- Review AI-generated code to confirm it follows project standards.
- Run the test suite to ensure no existing functionality is broken.
- Run lint checks to keep code style consistent.
- Check acceptance criteria item by item to confirm they are all satisfied.
- Update the task status to Done.

```bash
backlog task edit <id> --check-ac 1 --check-ac 2 --check-ac 3
backlog task edit <id> -s Done
```

## Restart Loop When Unsatisfied

If the AI's implementation does not meet expectations, do not keep spinning in the same session. The correct approach is:

1. Clear the old plan, notes, and final summary in the task.
2. Refine the task description and acceptance criteria based on lessons learned.
3. Start a new AI session and rerun the entire process.

The restart loop avoids context pollution and lets the AI re-examine the requirement with a clearer perspective.

## MCP Tool Capability List

After connecting via MCP, the AI agent can call **33 tools**, categorized by domain as follows (required parameters are marked (required)).

### Tasks (7)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `task_create` | Create a new task | `title` (required), `description`, `status`, `priority`, `assignee`, `labels`, `milestone`, `dependencies`, `acceptanceCriteria`, `parentTaskId`, `dueDate` / `plannedStart` / `plannedEnd` |
| `task_list` | List tasks with multi-dimensional filtering | `status` / `statusExcluded` (single value or array), `assignee` / `unassigned`, `milestone`, `labels`, `search`, `ready` (only ready-to-start), `completed` (include completed corpus), `offset` / `limit` |
| `task_search` | Search by title/description | `query`, `status`, `priority`, `modifiedFiles`, `completed`, `offset` / `limit` |
| `task_view` | View task details | `id` (required) |
| `task_edit` | Edit metadata, plan/notes/comments, dependencies, acceptance criteria, task-level DoD | `id` (required), `status`, `planSet` / `planAppend` / `planClear`, `notesSet` / `notesAppend` / `notesClear`, `commentsAppend`, `finalSummary`, `acceptanceCriteriaCheck` / `acceptanceCriteriaUncheck`, `definitionOfDoneAdd` |
| `task_archive` | Archive a task (soft delete; frees ID and automatically cleans references) | `id` (required) |
| `task_complete` | Complete cleanup: move terminal-status task to completed/ | `id` (required) |

### Documents (5)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `document_list` | List documents, supports substring filtering | `search`, `offset` / `limit` |
| `document_view` | View document metadata and body | `id` (required) |
| `document_create` | Create a document (optional docs subdirectory path) | `title`, `content` (required), `type`, `path`, `tags` |
| `document_update` | Update content/title/metadata | `id`, `content` (required), `title`, `appendContent`, `type`, `path`, `tags` |
| `document_search` | Fuzzy search documents | `query` (required), `offset` / `limit` |

### Milestones (5)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `milestone_list` | List milestone files and milestone values on tasks | `offset` / `limit` |
| `milestone_add` | Create a new milestone | `name` (required), `description`, `actualStart` / `actualEnd`, `documentation` |
| `milestone_edit` | Rename / change dates / change description | `from`, `to` (required), `updateTasks`, `dueDate` / `plannedStart` / `plannedEnd` |
| `milestone_remove` | Remove a milestone, optionally clean task references | `name` (required), `taskHandling` (`clear` / `keep` / `reassign`), `reassignTo` |
| `milestone_archive` | Archive a milestone | `name` (required) |

### Memos (5)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `memo_list` | List memos (newest first) | `date`, `tags`, `offset` / `limit` |
| `memo_view` | View full memo text | `id` (required) |
| `memo_create` | Create a memo | `content` (required), `tags` |
| `memo_update` | Replace (`content`) or append (`append`) body; one of the two required | `id` (required), `content` / `append`, `tags` |
| `memo_delete` | Delete a memo | `id` (required) |

Memo tools share the same ID scheme (`YYYYMMDD-N`) and file format with the CLI and Web. See [Memos](../70-快速笔记/00-Memos简介.md) for details.

### Decisions (2)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `decision_list` | List decisions, supports status/keyword filtering | `status` (`proposed` / `accepted` / `rejected` / `superseded`), `search`, `offset` / `limit` |
| `decision_update` | Update decision status or body | `id` (required), `content` / `appendContent`, `status` |

### Definition of Done (2)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `definition_of_done_defaults_get` | Read project default DoD checklist | none |
| `definition_of_done_defaults_upsert` | Replace project default DoD checklist (inherited by new tasks) | `items` (required, no commas) |

### Workflow (1)

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `get_backlog_instructions` | Get workflow guide (markdown); overview automatically renders the current project's full state machine at the end: state table, categories, transition edges, terminal-status table | `instruction` (`overview` / `task-creation` / `task-execution` / `task-finalization` / `milestones` / `documents` / `decisions` / `drafts` / `memos` / `graph`) |

### Graph (6)

Tools for querying the task relationship graph and managing user databases. Graph tools use a **one-shot switch model**: each call goes through the full `open → query → close` cycle (`default` derived graph reuses snapshots already written by the Web UI `GraphService`), without keeping a `GraphService` resident in the MCP process, so it does not rebuild the corpus at startup or slow down MCP server startup.

| Tool | Capability | Key Parameters |
|------|------------|----------------|
| `graph_query` | Execute read-only Cypher query against the specified graph database (write keywords such as CREATE/MERGE/SET/DELETE are rejected directly), `readOnlyHint: true` | `db` (required, `default` or user database name), `statement` |
| `graph_schema` | Output database schema: node tables and properties (name/type/primary key), relationship tables and endpoints | `db` (required) |
| `graph_list_databases` | List all available databases (`default` derived graph + user databases) with name, kind, node/edge counts | none |
| `graph_describe_database` | Return description, timestamp, and per-table row/edge counts for a single database | `db` (required) |
| `graph_create_database` | Create a user graph database (write operation, `destructiveHint: true`; no content is written without confirmation) | `name`, `description`, `acknowledged: true` (all required) |
| `graph_import_csv` | Import CSV into a user database: by default imports as nodes (missing tables created with inferred types, primary-key idempotent updates); add `rel`/`from`/`to` to switch to relationship import (endpoints matched but not created); files are validated as a whole before opening the database, `destructiveHint: true` | `db`, `csv` (required), `node` / `map` / `header` / `rel` / `from` / `to` |

The accompanying `graph` guide volume (`backlog instructions graph` / `backlog://workflow/graph`) covers parameters for the six tools and Cypher / CSV usage.

### List Paging

All MCP list tools uniformly support `offset` + `limit` paging, returning structured results through a unified envelope:

```json
{ "items": [], "total": 128, "offset": 0, "limit": 50, "hasMore": true }
```

- `task_list`, `task_search`, `document_search`, `document_list`, `milestone_list`, `memo_list`, and `decision_list` all follow this envelope; text output additionally appends a CLI-style `Showing X-Y of N items` hint.
- `hasMore` / `total` let the agent determine whether the list is complete and loop through pages accordingly—no more silent truncation.
- `task_list` pages by the ordered sequence of status buckets and then re-renders by bucket; bucket order is unchanged. The unconfigured / archived diagnostic sections of `milestone_list` are excluded from paging, ensuring warnings are not lost.

## MCP Resources and Prompts

The Backlog.md MCP server registers the following workflow resources with the client; AI agents can actively read them during a session:

| Resource URI | Content Description |
|--------------|---------------------|
| `backlog://workflow/overview` | Workflow overview: when to create tasks and basic flow; `get_backlog_instructions` returns this volume by default. |
| `backlog://workflow/task-creation` | Task creation guide: how to search, scope, and create tasks. |
| `backlog://workflow/task-execution` | Task execution guide: how to plan, update, and advance tasks. |
| `backlog://workflow/task-finalization` | Task finalization guide: how to verify, summarize, and complete work. |
| `backlog://workflow/milestones` | Milestone guide: create, edit, remove, and archive milestones. |
| `backlog://workflow/documents` | Document management guide: create, update, list, and view project documents. |
| `backlog://workflow/decisions` | Decision guide: create and list decisions, including output modes and status handling. |
| `backlog://workflow/drafts` | Draft guide: create, promote, demote, and archive drafts. |
| `backlog://workflow/memos` | Memo guide: create, list, view, update, and delete quick memos. |
| `backlog://workflow/graph` | Graph guide: parameters for the six graph MCP tools, Cypher queries, and CSV import usage. |
| `backlog://init-required` | Fallback resource for uninitialized projects: how to initialize Backlog.md in this directory. |

AI agents read `backlog://workflow/overview` first when connecting or encountering uncertain scenarios to get contextual guidance. The CLI-side `backlog instructions <volume>` corresponds one-to-one with the above volumes; see [Agent Instruction Files](02-代理指令文件.md).

## Security Features

Backlog.md's MCP implementation is secure by design:

- **stdio-only transport**: AI clients and the MCP server communicate only through standard input/output, do not listen on any network port, and cannot be accessed externally.
- **localhost-only runtime validation**: Web UI and other services bind to local addresses by default.
- **Pure protocol wrapper**: the MCP layer contains no business logic; all operations are ultimately handled by the Core layer, sharing the same data validation rules as the CLI and Web UI.
- **Roots discovery mechanism**: the MCP client sends a list of workspace root directories, and Backlog.md automatically looks for valid projects in those directories. The normal startup path also follows changes in client workspace roots; when none is found, it falls back to a minimal-functionality mode exposing only `init`-related tools.
- **Fixed project root**: to lock to a fixed directory (for example global `~/.backlog`), start with `--cwd` or the `BACKLOG_CWD` environment variable; the server will then not follow client workspace roots.

## Frequently Asked Questions

**Codex cannot connect to the Backlog.md MCP server**
- Symptom: Codex reports MCP server startup failure or timeout.
- Common cause: the local `backlog` command resolves to a stale/corrupted `dist/backlog` binary.
- Solution:
  1. Rebuild the project (`bun run build`).
  2. Use the current Codex command format: `codex mcp add backlog -- backlog mcp start`.
  3. Test `backlog mcp start` separately to confirm it starts normally.

**Shared MCP server writes to the wrong project**
- Symptom: in user-level or shared-server scenarios, tasks created by AI appear in the wrong directory.
- Cause: older server versions parsed the project root only once at startup.
- Solution: upgrade to the latest version; to fix the directory, use `backlog mcp start --cwd <path>`.
