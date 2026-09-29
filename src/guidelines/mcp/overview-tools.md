## Backlog.md Overview (Tools)

Your client is using Backlog.md via tools. Use the following MCP tools to retrieve guidance and manage tasks.

### When to Use Backlog

**Create a task if the work requires planning or decision-making.** Ask yourself: "Do I need to think about HOW to do this?"

- **YES** → Search for existing task first, create if needed
- **NO** → Just do it (the change is trivial/mechanical)

**Examples of work that needs tasks:**
- "Fix the authentication bug" → need to investigate, understand root cause, choose fix
- "Add error handling to the API" → need to decide what errors, how to handle them
- "Refactor UserService" → need to plan new structure, migration path

**Examples of work that doesn't need tasks:**
- "Fix typo in README" → obvious mechanical change
- "Update version number to 2.0" → straightforward edit
- "Add missing semicolon" → clear what to do

**Always skip tasks for:** questions, exploratory requests, or knowledge transfer only.

### Core Workflow Tools

Use this tool to retrieve the required Backlog.md guidance in markdown form:

- `get_backlog_instructions` — Returns workflow guidance. Leave `instruction` empty for the overview, or select `task-creation`, `task-execution`, `task-finalization`, `milestones`, or `drafts`.

The tool returns the same content that resource-capable clients read via `backlog://workflow/...` URIs. The overview response is tool-oriented when `instruction` is omitted or set to `overview`.

**Required: fetch and read the matching guide (`task-creation`, `task-execution`, `task-finalization`) before creating, executing, or finalizing tasks — do not act from this overview alone.** Also read `milestones` before managing milestones and `drafts` before creating, promoting, demoting, or archiving drafts. The guides define the required procedure; skipping them produces inconsistent tasks and metadata.

### Typical Workflow (Tools)

1. **Search first:** call `task_search` or `task_list` with filters to find existing work
2. **If found:** read details via `task_view`; follow execution/plan guidance from the retrieved markdown
3. **If not found:** call `get_backlog_instructions` with `instruction="task-creation"`, then create tasks with `task_create`
4. **Execute & finalize:** call `get_backlog_instructions` with `instruction="task-execution"` or `instruction="task-finalization"` to manage status, plans, notes, and acceptance criteria via `task_edit`
5. **Manage drafts:** call `get_backlog_instructions` with `instruction="drafts"` before creating, promoting, demoting, or archiving drafts
6. **Manage milestones:** call `get_backlog_instructions` with `instruction="milestones"` before creating, editing, removing, or archiving milestones

**Note:** "Done" tasks stay in Done until periodic cleanup. Moving to the completed folder (`task_complete`) is a batch operation run occasionally, not part of finishing each task. Do not use `task_archive` for completed work—archive is only for duplicate, canceled, or invalid tasks.

### Core Principle

Backlog tracks **commitments** (what will be built). Use your judgment to distinguish between "help me understand X" (no task) vs "add feature Y" (create tasks).

### MCP Tools Quick Reference

- `get_backlog_instructions`
- `task_list`, `task_search`, `task_view`, `task_create`, `task_edit`, `task_complete`, `task_archive`
- `task_search` accepts `modifiedFiles` for case-insensitive substring filtering against project-root-relative modified file paths
- `task_list` and `task_search` accept `completed: true` to widen the source corpus with the completed folder; widened rows carry `source: "completed"`. The default reads active tasks only.
- `task_edit` accepts `commentsAppend` and optional `commentAuthor` to append task discussion or review comments; `commentRemove` (array of 1-based indexes) removes specific comments and `commentClear` removes all (cannot be combined with append/remove)
- `task_edit` also supports acceptance criteria operations (`acceptanceCriteriaClear`, `acceptanceCriteriaAdd/Remove/Check/Uncheck`) and task-level Definition of Done operations (`definitionOfDoneAdd/Remove/Check/Uncheck`). For large acceptance-criteria replacements, clear first with `acceptanceCriteriaClear`, then add the replacement list with `acceptanceCriteriaAdd` in a second call.
- Comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters
- `milestone_list`, `milestone_add`, `milestone_edit`, `milestone_remove`, `milestone_archive` — for details read the `milestones` guide via `get_backlog_instructions`
- `document_list`, `document_view`, `document_create`, `document_update`, `document_search`
- `document_create` and `document_update` support docs-directory-relative `path` values such as `guides/setup`; absolute paths and `..` traversal are rejected
- `decision_update` updates a decision's status and/or body by id (`status` alone changes only the status; `content` replaces the body and `appendContent` appends to it); for the full decision workflow read the `decisions` guide via `get_backlog_instructions`
- `definition_of_done_defaults_get`, `definition_of_done_defaults_upsert`

**Definition of Done support**
- `definition_of_done_defaults_get` reads project-level DoD defaults from config
- `definition_of_done_defaults_upsert` updates project-level DoD defaults in config
- `task_create` accepts `definitionOfDoneAdd` and `disableDefinitionOfDoneDefaults` for **exceptional** task-level DoD overrides only
- `task_edit` accepts `definitionOfDoneAdd`, `definitionOfDoneRemove`, `definitionOfDoneCheck`, `definitionOfDoneUncheck` for **exceptional** task-level DoD updates only
- DoD is a completion checklist, not acceptance criteria: keep scope/behavior in acceptance criteria, not DoD fields
- `task_view` output includes the Definition of Done checklist with checked state

**Task images:** place image files under `backlog/assets/` and reference them in task content with `assets/<relative-path>`. Supported formats: png, jpg, jpeg, gif, svg, webp, avif.

**Backlog directory layout:** tasks in `backlog/tasks/`, drafts in `backlog/drafts/`, docs in `backlog/docs/`, decisions in `backlog/decisions/`, assets in `backlog/assets/`, milestones in `backlog/milestones/`, completed in `backlog/completed/`, archive in `backlog/archive/`, wiki in `backlog/wiki/` (LLM-managed, do not edit manually), wiki output in `backlog/wiki_output/`.

**Always operate through the MCP tools above. Never edit markdown files directly; use the tools so relationships, metadata, and history stay consistent.**

## The Project Status Machine (`backlog/config.yml` -> `statuses`)

`statuses` **is** the project's state machine: the columns a task can occupy and, optionally, the moves declared between them. Read it before you set a task's status — never assume `To Do / In Progress / Done`.

**Object form.** Each entry is an object:

```yaml
statuses:
  - name: "To Do"            # the column label; the only required field
    category: active         # initial | active | wip | blocked | done | dropped
    exit: complete           # terminal statuses only: complete | archive
    display: false           # false hides the board column (the status still exists)
    next:                    # optional; the declared moves out of this status
      - to: "Planning"       # required on every transition
        when: "why this move happens"   # human-readable trigger
        ai: allowed          # allowed | allowed_if | propose | forbidden
        if: "condition text" # required when ai: allowed_if
        requires: "..."      # machine-checkable precondition
        evidence: "..."      # what must exist before the move
```

- `category` decides behaviour: `done` / `dropped` are terminal (reaching one stamps the end date), `wip` and `blocked` are work in flight, `initial` is the start.
- `ai` says who may make the move: `allowed` (the AI may move on its own), `allowed_if` (only while `if` holds), `propose` (propose the move and wait for a human), `forbidden` (only a human may move).
- `display: false` keeps a status working while hiding its board column.
- `next` absent means no transitions are declared for that status.

**Legacy form.** A plain string array is still valid and means the project declares no transitions:

```yaml
statuses: ["To Do", "In Progress", "Done"]
```

The last entry is treated as terminal, and a name that normalises to `inprogress` is `wip`; everything else is `active`.

**Changing it on request.** Write the **whole** `statuses` array back and never drop a field you did not mean to change — `category`, `exit`, `display` and every `next` entry must survive. There is no CLI command that sets `statuses` (the CLI refuses it on purpose), so object-form edits go through the settings page editor (Settings -> state machine) or the config file itself. Ask before restructuring a machine, and never set a task to a status the config does not declare.

**Using the machine.** Everything above describes the *format*. The block right below is *this* project's machine, rendered from `backlog/config.yml`, and it outranks any status list you remember from elsewhere or from the defaults. To move a task:

1. Read its current `status` (`task_view`).
2. Look that status up in the block below and read its `next` list - those edges are the only transitions declared out of it.
3. Pick the edge whose `when` describes what actually happened. If none fits, do not move the task: say why and leave the status alone.
4. Obey the edge's `ai` before acting. `forbidden`: only a human may make this move - ask and wait. `propose`: propose it and wait for confirmation. `allowed_if`: the edge's `if` must hold, and `requires` must be satisfiable, before you move. `allowed`: you may make the move yourself.
5. Satisfy `evidence` first when the edge names something (a written comment, a filled field), then write the new status with `task_edit`.
6. The block's "Stop and wait for a human" section collects every edge you may not take alone - never move along one without an explicit human answer.

If the block says the project declares no transitions (a plain string array), there is no edge list to consult: a task may move between any pair of non-terminal statuses, so use the status the user asked for. Never set a status the machine does not list.

{{STATE_MACHINE}}
