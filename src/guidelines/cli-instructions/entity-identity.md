## Entity IDs and Exact Source Selection (CLI)

Use the existing task, document, and decision commands to change an entity ID or title. There is no separate `rename` command and no additional dry-run workflow.

| Entity | View an exact source | Update ID, title, or other metadata |
|--------|----------------------|-------------------------------------|
| Task | `backlog task view [taskId] [--source-path <path>] [--plain]` | `backlog task edit [taskId] [--id <newId>] [--source-path <path>] [--title <title>] [other edit flags]` |
| Document | `backlog doc view [docId] [--source-path <path>] [--plain]` | `backlog doc update [docId] [--id <newId>] [--source-path <path>] [--title <title>] [other update flags]` |
| Decision | `backlog decision view [decisionId] [--source-path <path>] [--plain]` | `backlog decision update [decisionId] [--id <newId>] [--source-path <path>] [--title <title>] [other update flags]` |

### Choose the Source

There are three source-selection modes:

1. **ID only** keeps all existing ID forms and aliases, such as `1`, `doc-1`, `decision-1`, and the configured task prefix.
2. **Source path only** reads the old ID from the selected file's frontmatter. The positional ID may be omitted.
3. **ID plus source path** checks both before writing. Equivalent forms such as `1` and `doc-1` are accepted; a mismatch fails with `SOURCE_MISMATCH`.

`--source-path` is a project-relative Markdown path inside the selected entity's directory. Tasks may be selected from `backlog/tasks/` or `backlog/completed/`; documents from `backlog/docs/`; decisions from `backlog/decisions/`. Absolute paths, paths outside those directories, and non-Markdown files are rejected. Do not put a file path into the positional ID argument.

```bash
# ID-only updates: bare IDs are normalized automatically; the title and other omitted fields stay unchanged
backlog task edit BACK-1 --id 10           # → BACK-10, using the configured task prefix
backlog doc update doc-1 --id 10           # → doc-10
backlog decision update decision-1 --id 10 # → decision-10
# Prefixed target IDs such as BACK-10, doc-10, and decision-10 are also accepted.

# Change the ID together with a title or another supported field
backlog task edit BACK-1 --id BACK-10 --title "New task title" -s "In Progress"
backlog doc update doc-1 --id doc-10 --title "New document title" -p guides
backlog decision update decision-1 --id decision-10 --title "New decision title" --status accepted

# Select an exact file without supplying the old ID
backlog task view --source-path "backlog/tasks/BACK-1 - Old-Title.md" --plain
backlog doc update --source-path "backlog/docs/guides/doc-1 - Old-Title.md" --id doc-10
backlog decision update --source-path "backlog/decisions/decision-1 - Old-Title.md" --id decision-10

# Supplying both is also valid when the IDs are equivalent
backlog doc update 1 --source-path "backlog/docs/guides/doc-1 - Old-Title.md" --id doc-10
```

### Duplicate Old IDs

An ID-only lookup fails closed with `AMBIGUOUS_ID` and lists the matching candidates when equivalent old IDs occur in more than one file. Use `--source-path` to select exactly one candidate. Only the selected source is renamed or has its frontmatter identity changed; other files that share the old ID are left unchanged.

```bash
backlog task edit --source-path "backlog/tasks/BACK-1 - Selected-Task.md" --id BACK-10
backlog doc update --source-path "backlog/docs/PRDS/doc-1 - Selected-Doc.md" --id doc-10 --title "New Title"
backlog decision update --source-path "backlog/decisions/decision-1 - Selected-Decision.md" --id decision-10
```

Inspect the candidate list before choosing a path.

#### When to choose `doctor` or `--source-path`

| Situation | Choose | Why |
|-----------|--------|-----|
| You need to inspect duplicate task/draft IDs or reported dependency defects across the project. | `backlog doctor` | It previews collision groups, planned task/draft repairs, and references that need review without changing files. |
| You want to normalize duplicate task/draft IDs through the reviewed repair lifecycle. | `backlog doctor`, then `backlog doctor --fix` | The repair is deterministic and retains backups until `backlog doctor --commit`; use `backlog doctor --rollback` before committing if you need to undo it. |
| You already know which task, document, or decision file you want to view or update. | `--source-path` | It selects exactly that file and leaves other files with the same old ID unchanged. |
| Duplicate document or decision IDs need a one-file update. | `--source-path` | `doctor` does not repair document or decision IDs. |
| You only need to change one task's ID and deliberately preserve another task with the same old ID. | `task edit --source-path` | This is a single-entity identity update, not a backlog-wide duplicate repair. |

Use `backlog instructions task-execution` for the complete `doctor` preview, fix, reference-review, commit, and rollback workflow. Do not run `doctor --fix` merely to select a file for a routine ID or title change.

### Filename and Reference Updates

ID and title changes use the same rename plan as title-only changes. The CLI updates the source frontmatter and sanitized filename, then synchronizes matching references in the same operation:

- Relative Markdown links are resolved from each referencing file's own directory.
- Task `documentation`, `references`, and `modified_files` paths, milestone `documentation`, and Wiki `source_path` values are updated when they match the old project-relative path.
- Exact task IDs in `dependencies`, `references`, and `parent_task_id` follow a task ID change. References in active, completed, and draft tasks are included.
- `/task/:id/:title`, `/documentation/:id/:title`, and `/decisions/:id/:title` links update their ID and sanitized title segments when they match the old entity route.
- A missing `backlog/wiki/` directory is skipped and is not created.
- Ordinary bare-ID prose, unrelated links, protected code content, and unrelated metadata are not blindly rewritten.

Conflicts are detected before installation. Existing rename-plan concurrency checks, no-replace installation, rollback, and auto-commit scope apply to the source, destination, and changed references.

### Task-Specific Rules

- `--id` and `--source-path` are single-task options and cannot be used with multiple task IDs.
- Target IDs are checked against active and completed tasks.
- A subtask may change its final number only within the same parent and hierarchy level. Use the existing parent/reparent workflow to change parents.
- A task with children cannot change its ID directly.
- Changing a task into a Draft while also changing its ID is rejected; use the independent demote workflow.
- `draft edit --id` is not part of this interface, although draft references to an updated task ID are synchronized.

### Errors and Fallback

| Diagnostic | Meaning |
|------------|---------|
| `AMBIGUOUS_ID` | More than one file matches the supplied old ID; select a source path or repair the duplicates. |
| `SOURCE_MISMATCH` | The positional ID and the selected file's frontmatter ID are not equivalent. Nothing is updated. |
| `ID_CONFLICT` | The target ID is already used by another entity. |
| `PATH_CONFLICT` | The target filename already exists. |
| `HIERARCHY_CONFLICT` | A task ID change would alter its parent, level, or a parent with children. |

Prefer the CLI so the ID, filename, and references remain consistent. If an automatic rename fails because of an environment or filesystem problem, you can fall back to `mv` and then repair the source frontmatter and affected references manually. Review the resulting diff before committing.

The MCP interface exposes the same identity updates through `newId` and exact source selection through `sourcePath` on task, document, and decision update/view tools. It does not add a cross-branch rename operation.
