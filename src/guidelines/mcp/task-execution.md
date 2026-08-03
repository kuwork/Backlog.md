## Task Execution Guide

### Planning Workflow

> **Non-negotiable:** Capture an implementation plan in the Backlog task _before_ writing any code or running commands. The plan must live in the task record prior to implementation and remain up to date when you close the task.

1. **Mark task as In Progress** via `task_edit` with status "In Progress"
2. **Assign to yourself** via `task_edit` with assignee field
3. **Review task description, acceptance criteria, references, and documentation** - Check the description for outcome and any local code context, review acceptance criteria to confirm scope and success conditions, check `references` for external links/issues, and check `documentation` for design docs or API specs before planning
4. **Draft the implementation plan** - Think through the approach, review code, identify key files
5. **Present plan to user** - Show your proposed implementation approach
6. **Wait for explicit approval** - Do not start coding until user confirms or asks you to skip review
7. **Record approved plan** - Use `task_edit` with planSet or planAppend to capture the agreed approach in the task
8. **Document the agreed breakdown** - In the parent task's plan, capture the final list of subtasks, owners, and sequencing so a replacement agent can resume with the approved structure

**IMPORTANT:** Use tasks as permanent storage for everything related to the work. You may be interrupted or replaced at any point, so the task record must contain everything needed for a clean handoff.

### Planning Guidelines

- Keep the Backlog task as the single plan of record: capture the agreed approach with `task_edit` (planSet field) before writing code
- Use `task_edit` (planAppend field) to refine the plan when you learn more during implementation
- Verify prerequisites before committing to a plan: confirm required tools, access, data, and environment support are in place
- Keep plans structured and actionable: list concrete steps, highlight key files, call out risks, and note any checkpoints or validations
- Ensure the plan reflects the agreed user outcome and acceptance criteria; if expectations are unclear, clarify them before proceeding
- When additional context is required, review relevant code, documentation, or external references so the plan incorporates the latest knowledge
- Treat the plan and acceptance criteria as living guides - update both when the approach or expectations change so future readers understand the rationale
- If you need to add or remove tasks or shift scope later, pause and run the "present → approval" loop again before editing the backlog; never change the breakdown silently

### Working with Subtasks (Planning)

- If working on a parent task with subtasks, create a high-level plan for the parent that outlines the overall approach
- Each subtask should have its own detailed implementation plan when you work on it
- Ensure subtask plans are consistent with the parent task's overall strategy

### Execution Workflow

- **IMPORTANT**: Do not touch the codebase until the implementation plan is approved _and_ recorded in the task via `task_edit`
- The recorded plan must stay accurate; if the approach shifts, update it first and get confirmation before continuing
- If feedback requires changes, revise the plan first via `task_edit` (planSet or planAppend fields)
- Work in short loops: implement, run the relevant tests, and immediately check off acceptance criteria with `task_edit` (acceptanceCriteriaCheck field) when they are met
- Log progress with `task_edit` (notesAppend field) to document decisions, blockers, or learnings
- Use `task_edit` (`commentsAppend` with optional `commentAuthor`) for task discussion, review questions, or handoff notes that are not part of the execution log
- Comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters
- Keep task status aligned with reality via `task_edit`

### Task Field Quick Reference

Use `task_edit` to modify these fields:

| What You Want to Change | MCP Field(s) |
|-------------------------|--------------|
| Title | `title` |
| Status | `status` |
| Assignee | `assignee` (array) |
| Labels | `labels` (array) |
| Due Date | `dueDate` |
| Planned Start/End | `plannedStart` / `plannedEnd` |
| Actual Start/End | `actualStart` / `actualEnd` |
| Description | `description` |
| Append Description | `descriptionAppend` |
| Add AC | `acceptanceCriteriaAdd` |
| Clear all AC | `acceptanceCriteriaClear` |
| Check/Uncheck AC | `acceptanceCriteriaCheck` / `acceptanceCriteriaUncheck` |
| Remove AC | `acceptanceCriteriaRemove` |
| Add DoD | `definitionOfDoneAdd` |
| Check/Uncheck DoD | `definitionOfDoneCheck` / `definitionOfDoneUncheck` |
| Remove DoD | `definitionOfDoneRemove` |
| Plan | `planSet` / `planAppend` / `planClear` |
| Notes | `notesSet` / `notesAppend` / `notesClear` |
| Comment | `commentsAppend` with optional `commentAuthor` |
| Final Summary | `finalSummary` / `finalSummaryAppend` / `finalSummaryClear` |
| Dependencies | `dependencies` |
| References | `references` / `addReferences` / `removeReferences` |
| Documentation | `documentation` / `addDocumentation` / `removeDocumentation` |
| Modified Files | `modifiedFiles` |
| Milestone | `milestone` |

### Acceptance Criteria and Definition of Done Operations

**Acceptance Criteria edit semantics:**

- `acceptanceCriteriaAdd` is additive. `task_edit` has no full-list replacement field for acceptance criteria; use clear-then-add instead.
- For small or index-specific changes, use `acceptanceCriteriaRemove`, `acceptanceCriteriaCheck`, or `acceptanceCriteriaUncheck`.
- For large replacements (especially when acceptance criteria are still unchecked), use `acceptanceCriteriaClear` to atomically remove all criteria, then call `task_edit` again with `acceptanceCriteriaAdd` to add the replacement list. `acceptanceCriteriaClear` cannot be combined with `acceptanceCriteriaSet`, `acceptanceCriteriaAdd`, `acceptanceCriteriaRemove`, `acceptanceCriteriaCheck`, or `acceptanceCriteriaUncheck` in the same call.
- If the MCP fields cannot express the exact change, editing the task Markdown file directly is a fallback.

- `acceptanceCriteriaAdd` accepts multiple items in one call
- `acceptanceCriteriaCheck` / `acceptanceCriteriaUncheck` / `acceptanceCriteriaRemove` accept arrays of 1-based indices
- Mixed incremental operations can be combined in a single `task_edit` call
- `definitionOfDoneAdd` / `definitionOfDoneCheck` / `definitionOfDoneUncheck` / `definitionOfDoneRemove` work the same way for task-level DoD items

### Handling Scope Changes

If new work appears during implementation that wasn't in the original acceptance criteria:

**STOP and ask the user**:
"I discovered [new work needed]. Should I:
1. Add acceptance criteria to the current task and continue, or
2. Create a follow-up task to handle this separately?"

**Never**:
- Silently expand the scope without user approval
- Create new tasks on your own initiative
- Add acceptance criteria without user confirmation

### Staying on Track

- Stay within the scope defined by the plan and acceptance criteria
- Update the plan first if direction changes, then get user approval for the revised approach
- If you need to deviate from the plan, explain why and wait for confirmation

### Working with Subtasks (Execution)

- When user assigns you a parent task "and all subtasks", work through each subtask sequentially without asking for permission to move to the next one
- When completing a single subtask (without explicit instruction to continue), present progress and ask: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- Each subtask should be fully completed (all acceptance criteria met, tests passing) before moving to the next

### Duplicate Task ID Recovery

If task IDs are ambiguous or duplicated (for example `task-1` and `task-01` coexist, or a merge produced two files with the same numeric ID), do not rename files or edit frontmatter IDs directly. Use the CLI repair workflow through a terminal tool:

1. Run a preview diagnosis:
   ```bash
   backlog doctor
   ```
2. Review the planned file renames, frontmatter updates, and the list of references that require manual review.
3. Apply only when the preview is safe and unambiguous:
   ```bash
   backlog doctor --fix
   # or, after explicit verification:
   backlog doctor --fix --yes
   ```
4. After the repair runs, manually review and update the reported references in tasks, docs, decisions, or code. Follow these principles while fixing references:
   - **Human-first**: read the reported path, line, and context before changing anything. The list is for human review; an agent may assist but must not make ambiguous decisions.
   - **Fail-closed**: if a reference is ambiguous, leave it unchanged and report it to the user for confirmation. Do not guess.
   - **No guessing references**: only replace an old ID with the new canonical ID when you are certain the reference points to the repaired task.
   - **Content preservation**: only change the reference ID itself; do not rewrite surrounding text or formatting.
   - **No cross-branch mutation**: only edit files in the current working directory. Report cross-branch references instead of editing them.
   - **Rollback-safe**: backups are retained until `--commit`; if you make a mistake, run `--rollback` before `--commit`.
5. Finalize or undo once references are handled:
   ```bash
   backlog doctor --commit   # finalize the repair and discard retained backups
   backlog doctor --rollback # undo the repair before commit
   ```

The repair preserves all task content and only changes the filename and frontmatter `id`. It is atomic, deterministic, and rollback-safe.

### Finalizing the Task

When implementation is finished, follow the **Task Finalization Guide** (`backlog://workflow/task-finalization`) to finalize your work. This ensures acceptance criteria are verified, implementation is documented, and the task is properly closed.
