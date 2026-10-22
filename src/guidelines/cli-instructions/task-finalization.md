## Task Finalization Guide

Use this guide when implementation is done and you are ready to hand off the task.

### Finalization Workflow

1. Verify all acceptance criteria:
   - `backlog task view {{TASK_ID:123}} --plain`
   - `backlog task edit {{TASK_ID:123}} --check-ac 1`
2. Verify Definition of Done items:
   - `backlog task edit {{TASK_ID:123}} --check-dod 1`
3. Run relevant automated checks and note results.
4. Update implementation notes if important context changed:
   - `backlog task edit {{TASK_ID:123}} --append-notes "Validation passed: bun test ..."`
5. Write a concise final summary:
   - `backlog task edit {{TASK_ID:123}} --final-summary "Implemented project-wide search in the CLI.\n\nChanges:\n- Added fuzzy matching across tasks, docs, and decisions\n- Added --plain output for AI consumers\n- Updated tests and docs\n\nVerification:\n- bun test src/test/search.test.ts\n- bun run check ."`
6. Record the files the task changed:
   - `backlog task edit {{TASK_ID:123}} --modified-file src/server/api.ts --modified-file src/web/App.tsx`
   - Use project-root-relative paths and repeat the flag once per file. The flag replaces the whole list, so pass every changed file in a single edit — a later edit with only one path drops the rest.
   - Record real changed files only (no guesses, no directories). This list powers `backlog search --modified-file` and the task's Modified Files tab, so future work can find which tasks touched a file.
7. Confirm the implementation plan is captured and current:
   - If the executed approach deviated from the recorded plan, update it so the task reflects what was actually built:
     - `backlog task edit {{TASK_ID:123}} --plan "Revised plan\n1. ...\n2. ..."` — replace the whole plan
     - `backlog task edit {{TASK_ID:123}} --append-plan "Extra step added during implementation"` — append a step
8. Mark the task with the configured terminal status:
   - Inspect accepted statuses if needed: `backlog task edit {{TASK_ID:123}} --help`
   - `backlog task edit {{TASK_ID:123}} -s "<terminal status>"`

Tasks in the terminal status stay there until periodic cleanup moves them to completed. Do not archive completed work.

### Title Changes and File Names

If the title was reworded during the work (for example translated or clarified at the end), `-t` only updates the frontmatter title — the task file keeps its creation-time name. Rename the file yourself with `mv`, keeping the `<prefix>-<id> - <title-slug>` form (preserve case, spaces become hyphens, drop punctuation), so the filename matches the final title:

```bash
mv "backlog/tasks/task-42 - Old-title.md" "backlog/tasks/task-42 - New-title-slug.md"
```

### Definition of Done Checklist

Confirm:

- The implementation plan exists and matches the final solution.
- Acceptance criteria are checked.
- Definition of Done items are checked.
- The task uses the configured terminal status.
- Relevant tests or checks pass.
- Documentation/configuration updates are complete when required.
- Implementation notes contain useful decisions or validation results.
- Modified files record every file the task changed (`--modified-file`, project-root-relative, full list in one edit).
- Final summary explains what changed, why, and how it was verified.

### Comments, Notes, and Final Summary

- Comments are for discussion and review questions.
- Implementation Notes are for progress, decisions, blockers, and validation details.
- Final Summary is the concise completion summary.

Commands:

```bash
backlog task edit {{TASK_ID:123}} --comment "Ready for review" --comment-author @your-name
backlog task edit {{TASK_ID:123}} --append-notes "Chose approach A because ..."
backlog task edit {{TASK_ID:123}} --final-summary "Implemented ..., verified with ..."
```

Use `\n` inside quoted strings for line breaks. The same works for `--desc`, `--plan`, `--notes`, `--append-notes`, `--comment`, and `--final-summary`.

### Follow-up Work

Do not create or start follow-up tasks without user approval. If follow-up work is needed, describe it and ask the user how to proceed.
