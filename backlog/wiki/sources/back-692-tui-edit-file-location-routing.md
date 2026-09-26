---
title: BACK-692 Resolve the TUI edit key's target by file location instead of status
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - bug
  - drafts
source_path: backlog/tasks/back-692 - Resolve-the-TUI-edit-keys-target-by-file-location-instead-of-status.md
---

# BACK-692 Resolve the TUI edit key's target by file location instead of status

Pressing the TUI edit key on a draft whose frontmatter status drifted away from `Draft` (a normal state after demote/promote, which keep the status) reported "Task DRAFT-1 was not found on this branch." The edit session picked the store from the record's status while every other surface picked it from where the file lives; the fix aligns the edit key with file-location routing.

## Summary

- `Core.editTaskInTui` decides the store from the row's own file location — its directory compared against the drafts directory — before any lookup runs; the status check stays only as a fallback for a row with no usable path, and a bare id keeps the task-store-first order
- Drift is ordinary: demoting copies the file into `backlog/drafts/` without rewriting `status:`, promotion deliberately keeps a non-Draft status, and this repo's own drafts directory held fifteen drifted records — the defect was reachable from the shipped `draft list`
- The mirror shape fixed too: a record under `backlog/tasks/` carrying `status: Draft` now opens the task file instead of being looked up in the drafts store; the fail-closed twin-identity guard is unchanged
- The session reports which store it resolved via `entity: "task" | "draft"` (`TuiTaskEditEntity` exported), and both surfaces name the row from it through `editTargetNoun(entity)`, so a draft row is never reported as a task in read-only, editor-failed, not-found, or marked-modified notices
- The board's edit key gained the missing `ambiguous` branch, rendering the same rename hint the task list shows instead of falling through to "No changes detected"
- Tests: four new cases in the TUI edit-session suite (drifted drafts row, demote-produced row, tasks-store `Draft` row, bare-id edit) asserted on the file that must change; a three-variant × nine-case revert matrix turns exactly the intended cases red; 15 pass in the file

## Acceptance Criteria

- Editing a drafts-store row whose status is not Draft opens and lands in the drafts file; the demote-produced row edits the draft file only
- A tasks-store row carrying `status: Draft` edits the task file instead
- Rows without a usable path keep the old resolution order; twin draft identities still fail closed
- Notices name a draft a draft in both surfaces, and the board renders the ambiguous result with the rename hint

## Related Concepts

- [[concepts/task-identity]] — store routing by file location and fail-closed identity
- [[concepts/cli-tui]] — the edit session and board/task-list notice surfaces
- [[concepts/task-lifecycle]] — demote/promote as the source of drifted draft statuses

## Related Sources

- [[sources/draft-promote-flow-task]] — promote/demote flows that produce status drift
- [[sources/demote-to-draft-action]] — the demote action whose output rows this fix handles
- [[sources/back-693-tui-draft-creation-window]] — reuses the entity-noun helper (moved to `entity-noun.ts`) for the create window's wording
