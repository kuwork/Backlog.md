## Task Finalization Guide

### Finalization Workflow

1. **Verify all acceptance criteria and Definition of Done items** - Confirm every checklist item is satisfied (use `task_view` to see current status; use `definitionOfDoneCheck/Uncheck` as needed)
2. **Run the Definition of Done checklist** (see below)
3. **Write the Final Summary** - Use `task_edit` (`finalSummary` field) to capture a PR-style summary of what changed and why. Avoid one-line summaries unless the change is trivial; include tests and key scope for reviewers.
4. **Record the files the task changed** - Use `task_edit` (`modifiedFiles` field) with the project-root-relative paths of every file the task changed. The field replaces the whole list, so pass the complete list in one call. Record real changed files only (no guesses, no directories); this list powers modified-file search and the task's Modified Files tab, so future work can find which tasks touched a file.
5. **Confirm the implementation plan is captured and current** - Update the plan in Backlog if the executed approach deviated
6. **Update task status** - Set the status this project's machine declares terminal via `task_edit` (re-read the overview if you are unsure which status that is; the default machine calls it "Done")
7. **Propose next steps** - Never autonomously create or start new tasks

**Note:** Tasks stay in the terminal status until periodic cleanup moves them to completed. Moving to the completed folder (`task_complete` or CLI cleanup) is a batch operation run occasionally, not part of finishing each task.

**Title changes:** if the title was reworded during the work (for example translated or clarified at the end), `task_edit` (`title` field) only updates the frontmatter title — the task file keeps its creation-time name. Rename the file with `mv`, keeping the `<prefix>-<id> - <title-slug>` form (preserve case, spaces become hyphens, drop punctuation), so the filename matches the final title.

**Important:** Do not use `task_archive` for completed work. Archive is only for tasks that should not be completed (duplicate, canceled, invalid).

### Definition of Done Checklist

- Implementation plan exists in the task record (`task_edit` planSet/planAppend) and reflects the final solution
- Acceptance criteria are all checked via `task_edit` (acceptanceCriteriaCheck field)
- Definition of Done items are all checked via `task_edit` (definitionOfDoneCheck field)
- Automated and relevant manual tests pass; no new warnings or regressions introduced
- Documentation or configuration updates completed when required
- Implementation notes capture progress during work via `task_edit` (notesAppend field)
- Modified files record every file the task changed via `task_edit` (`modifiedFiles` field; project-root-relative paths, complete list in one call)
- Final Summary captures the PR-style completion summary via `task_edit` (`finalSummary` field). Include what changed, why, tests run, and any risks/follow-ups when relevant.
- Status transitions to the configured terminal status via `task_edit`

### After Finalization

**Never autonomously create or start new tasks.** Instead:

- **If follow-up work is needed**: Present the idea to the user and ask whether to create a follow-up task
- **If this was a subtask**:
  - Check if user explicitly told you to work on "parent task and all subtasks"
    - If YES: Proceed directly to the next subtask without asking
    - If NO: Ask user: "Subtask X is complete. Should I proceed with subtask Y, or would you like to review first?"
- **If all subtasks in a series are complete**: Update parent task status if appropriate, then ask user what to do next

### Working with Subtasks

- When finalizing a subtask, check all its acceptance criteria individually
- Update subtask status to the configured terminal status via `task_edit`
- Document subtask-specific outcomes in the subtask's notes
- Only update parent task status when ALL subtasks are complete (or when explicitly instructed)

### Comments vs Implementation Notes vs Final Summary

Comments are for task discussion, review questions, and collaboration notes. Implementation notes are for progress logging during execution (decisions, blockers, learnings). The Final Summary is for the PR-style completion summary when the task is done.

Use `task_edit` (notesAppend field) to record:
- Implementation decisions and rationale
- Blockers encountered and how they were resolved
- Technical debt or future improvements identified
- Testing approach and results

These notes help future developers (including AI agents) understand the context.
Do not repeat the same information that is clearly understandable from the code.

Use `task_edit` (`finalSummary`) to write a structured PR-style summary that highlights the key points of the implementation.
