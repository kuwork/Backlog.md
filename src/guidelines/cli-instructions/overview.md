## Backlog.md Overview (CLI)

This project uses Backlog.md to track features, bugs, and structured work as tasks.

### When to Use Backlog

Create a task when the work requires planning, decisions, or handoff notes.

Ask: "Do I need to think about HOW to do this?"

- Yes: search for an existing task first, then create one if needed.
- No: do the small mechanical change directly.

Create tasks for work like bug fixes that need investigation, feature work, API changes, refactors, or anything that should be reviewed as a commitment. Skip task creation for questions, explanations, quick lookups, and obvious mechanical edits.

### Start Every Request Here

Use this overview to decide what to read or run next.

Search and read before changing anything:

- `backlog search "query" --plain`
- `backlog task list --status "<todo status>" --plain`
- `backlog task list --status "<active status>" --plain`
- `backlog task list --search "login" --labels frontend,bug --limit 20 --plain`
- `backlog task view {{TASK_ID:123}} --plain`

### Detailed Guides

**Required: read the matching guide below before creating, executing, or finalizing tasks. Do not rely on this overview alone for these actions.** The overview only tells you when to act; the guides define the required procedure, and skipping them produces inconsistent tasks and metadata.

- `backlog instructions task-creation`
  -> Read before creating tasks: how to search, scope, and create tasks
- `backlog instructions task-execution`
  -> Read before planning or updating task work: how to plan, update, and work through tasks
- `backlog instructions task-finalization`
  -> Read before finishing tasks: how to verify, summarize, and finish tasks
- `backlog instructions milestones`
  -> Read before managing milestones: how to create, edit, remove, and archive milestones
- `backlog instructions documents`
  -> Read when creating or updating project documents: doc types, paths, multi-line content, and append rules

Use `backlog <command> --help` before unfamiliar operations. Command help includes input fields, read/write behavior, output shape, and examples.

### Core Principle

Backlog tracks committed work: what will be built, fixed, or changed. Use the CLI for Backlog changes so metadata, file names, relationships, and history stay consistent.

Important: Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use Backlog commands so automatic metadata stays complete.

---

## Backlog Directory Layout

- Markdown task files live under **`backlog/tasks/`** (drafts under **`backlog/drafts/`**)
- Project documentation is in **`backlog/docs/`**
- Project decisions are in **`backlog/decisions/`**
- Local images and assets are in **`backlog/assets/`**
- Milestones are stored as Markdown files in **`backlog/milestones/`**
- Completed tasks are moved to **`backlog/completed/`**
- Archived/canceled/invalid tasks are moved to **`backlog/archive/`**
- LLM-managed wiki knowledge base is in **`backlog/wiki/`** (do not edit manually)
- Wiki query products and generated artifacts go in **`backlog/wiki_output/`**

## ⚠️ CRITICAL: NEVER EDIT TASK FILES DIRECTLY. Edit Only via CLI

**ALL task operations MUST use the Backlog.md CLI commands**

- ✅ **DO**: Use `backlog task edit` and other CLI commands
- ✅ **DO**: Use `backlog task create` to create new tasks
- ✅ **DO**: Use `backlog task edit <id> --check-ac <index>` to mark acceptance criteria
- ❌ **DON'T**: Edit markdown files directly
- ❌ **DON'T**: Manually change checkboxes in files
- ❌ **DON'T**: Add or modify text in task files without using CLI

**Why?** Direct file editing breaks metadata synchronization, Git tracking, and task relationships.

### ❌ WRONG: Direct File Editing

```markdown
# DON'T DO THIS:

1. Open backlog/tasks/task-7 - Feature.md in editor
2. Change "- [ ]" to "- [x]" manually
3. Add notes, comments, or final summary directly to the file
4. Save the file
```

### ✅ CORRECT: Using CLI Commands

```bash
# DO THIS INSTEAD:
backlog task edit 7 --check-ac 1  # Mark AC #1 as complete
backlog task edit 7 --notes "Implementation complete"  # Add notes
backlog task edit 7 --comment "Review question" --comment-author @agent-k  # Add comment
backlog task edit 7 --final-summary "PR-style summary"  # Add final summary
backlog task edit 7 -s "In Progress" -a @agent-k  # Change status and assign
```

## Task Images (Local Assets)

Tasks may include images for screenshots, diagrams, or visual references. Local images are served automatically when using `backlog browser`.

**Storage location:**
- Place image files under the `assets/` folder inside your backlog directory (e.g., `backlog/assets/images/screenshot.png`)

**Supported formats:**
- png, jpg, jpeg, gif, svg, webp, avif

**Markdown syntax in tasks:**
```markdown
![example](assets/images/screenshot.png)
```

**Workflow when adding images to tasks:**
1. Move or copy the image file into the `assets/` folder inside your backlog directory
2. Then add or edit the task content via CLI, referencing the image using the `assets/<relative-path>` path

**Key points:**
- The path in Markdown starts with `assets/` and maps to the backlog directory's `assets/` folder; do **not** include the backlog directory name itself
- When `backlog browser` is running, these files are automatically available at `assets/<relative-path>`
- You can add images to descriptions, implementation notes, or final summaries using the standard CLI commands

## Search Quick Reference

```bash
# Search for tasks about authentication
backlog search "auth" --plain

# Search only in tasks
backlog search "login" --type task --plain

# Search with filters
backlog search "api" --status "In Progress" --plain
backlog search "bug" --priority high --plain

# Find tasks that modified a project file path
backlog search --modified-file src/server/api.ts --plain
```

**Key points:**
- Uses fuzzy matching - finds "authentication" when searching "auth"
- Searches task titles, descriptions, and content
- Also searches `modified_files`; `--modified-file` applies a case-insensitive path substring filter
- Also searches documents and decisions unless filtered with `--type task`
- Always use `--plain` flag for AI-readable output

## Other Useful Commands

```bash
# Archive a task that should not be completed
backlog task archive 42

# Demote a task back to draft
backlog task demote 42

# Project overview and health stats
backlog overview --plain

# Install wiki skill
backlog wiki install claude
```

## Common Issues

| Problem              | Solution                                                           |
|----------------------|--------------------------------------------------------------------|
| Task not found       | Check task ID with `backlog task list --plain`                     |
| AC won't check       | Use correct index: `backlog task view 42 --plain` to see AC numbers |
| Changes not saving   | Ensure you're using CLI, not editing files                         |
| Metadata out of sync | Re-edit via CLI to fix: `backlog task edit 42 -s <current-status>` |
| Broken doc reference | Use project-root-relative paths or URLs, not bare doc IDs (see below) |

### References and Documentation Paths

The `references` and `documentation` fields on a task should point to actual locations, not just short IDs. Use project-root-relative paths or URLs.

❌ **Wrong:**

```bash
backlog task create "Feature" --doc "doc-001"
backlog task edit 42 --ref "doc-001"
```

✅ **Correct:**

```bash
backlog task create "Feature" \
  --doc "backlog/docs/doc-001 - Testing-Style-Guide.md" \
  --ref "src/server/api.ts" \
  --ref "https://github.com/org/repo/issues/123"

backlog task edit 42 \
  --doc "backlog/docs/architecture.md" \
  --ref "backlog/decisions/adr-001 - Use-Postgres.md"
```

## Remember: The Golden Rule

**🎯 If you want to change ANYTHING in a task, use the `backlog task edit` command.**
**📖 Use CLI to read tasks, exceptionally READ task files directly, never WRITE to them.**

Full help available: `backlog --help`
