## Milestones

Milestones group tasks by iteration, version, or release cycle. They are stored as Markdown files in `backlog/milestones/` and differ from `tasks/` (specific work items).

Use Backlog.md public interfaces for milestone creation, listing, and archival so IDs, frontmatter, paths, and task relationships stay consistent.

> **Important**: Assigning a milestone name to a task via `--milestone` only records the name on the task file; it **does not create a milestone file**. To create a milestone with an ID and metadata, you must explicitly add it first using `milestone add`, then assign tasks to it.

### CLI Usage

The CLI supports adding, editing, removing, listing, and archiving milestones.

```bash
# Add a new milestone file explicitly (saved under backlog/milestones/)
backlog milestone add "Release 2.0" -d "Ship the v2.0 release"

# Edit a milestone (title, description, dates)
backlog milestone edit "Release 2.0" -t "Release 2.1" -d "Updated scope"
backlog milestone edit "Release 2.0" --due-date 2026-06-15
backlog milestone edit "Release 2.0" --planned-start 2026-06-01 --planned-end 2026-06-10
backlog milestone edit "Release 2.0" --clear-due-date --clear-planned-start --clear-planned-end

# List active milestones (shows completion ratio)
backlog milestone list

# Include completed milestones
backlog milestone list --show-completed

# Plain text output (AI-friendly)
backlog milestone list --plain

# Remove a milestone and clear, keep, or reassign its tasks
backlog milestone remove "Release 2.0"
backlog milestone remove "Release 2.0" --task-handling keep
backlog milestone remove "Release 2.0" --task-handling reassign --reassign-to "Release 3.0"

# Archive a completed milestone
backlog milestone archive "Release 2.0"
```

Archiving removes the milestone from the active list, moves its file to the archive folder, and unbinds its tasks (tasks are not deleted).

**Assigning tasks to milestones:**

```bash
# At creation
backlog task create "Feature X" -m "Release 2.0"

# Edit an existing task
backlog task edit 7 --milestone "Release 2.0"

# Clear milestone assignment
backlog task edit 7 --clear-milestone
```

The `-m` / `--milestone` option supports fuzzy matching by title, ID (e.g. `m-2`), or numeric alias (e.g. `2`).

**Board grouping by milestone:**

```bash
backlog board --milestones
```

### Key Rules

- Milestone files live under `backlog/milestones/`; archived milestones move to `backlog/archive/milestones/`.
- Milestone IDs follow the `m-N` format and are auto-assigned at creation.
- Archiving unbinds tasks but does not delete them; tasks revert to the unassigned pool.
- Prefer CLI or MCP APIs over ad-hoc file writes so frontmatter and metadata remain valid.
