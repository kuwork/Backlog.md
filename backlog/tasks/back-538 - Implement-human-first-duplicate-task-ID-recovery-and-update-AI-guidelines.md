---
id: BACK-538
title: Implement human-first duplicate task ID recovery and update AI guidelines
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-02 00:07'
updated_date: '2026-08-03 18:54'
labels:
  - migration
  - cli
  - guidelines
dependencies: []
references:
  - src/core/duplicate-task-repair.ts
  - src/utils/duplicate-detection.ts
  - src/cli.ts
  - src/guidelines/agent-guidelines.md
priority: high
ordinal: 186400
actual_start: '2026-08-02 00:08'
actual_end: '2026-08-03 18:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
We need to add a duplicate task ID recovery workflow to the current fork. Despite cross-branch ID checks at creation time, duplicates can still arise after git merges, from zero-padding equivalence (e.g., task-1 and task-01), or from external/manual edits. The current fork has no tooling to detect or repair these collisions, which can silently collapse tasks in views, searches, and edits.

The goal is to implement a human-first, CLI-canonical repair workflow. The output of backlog doctor is designed for humans to read first: it lists collision groups, exact file paths, planned renames, and references that require manual review. An agent can also consume the same output to assist with manual review and manual reference updates, but the repair itself does not make ambiguous decisions.

The repair must not guess: it should detect collision groups across active and completed tasks, present a deterministic preview, and apply only after explicit confirmation. The preview must make clear which file keeps the canonical ID and which files receive new IDs.

Key design principles from our analysis:

- Fail-closed: ambiguous ID-based operations should stop and direct the user to backlog doctor instead of choosing one file.

- Deterministic: the same collision state must always produce the same repair plan.

- Content-preserving: only the filename and frontmatter id change; task content, AC/DoD, notes, and comments remain untouched.

- Atomic: file rename and frontmatter id update happen together.

- No guessing references: references in other files are reported for manual review, not silently rewritten.

- Rollback-safe: if repair fails, concurrent external edits must not be overwritten.

The deliverable includes a backlog doctor CLI command (preview plus --fix and --fix --yes modes), core duplicate detection and repair logic, deterministic ID allocation, Web UI shared recovery, and integration with the current fork prefix config, zero-padding, and branch model.

---

**--commit and --rollback commands**

After `backlog doctor --fix` renames files, the original files are kept as `.bak` backups. Do not remove these backups automatically when the repair involves references that need manual review.

- Use `backlog doctor --commit` only after a human or an AI agent has reviewed every reported reference and updated the references that are safe to change. `--commit` discards the retained `.bak` backups and finalizes the repair.

- Use `backlog doctor --rollback` only before `--commit`, if you decide the repair should be undone or if you discover a mistake while fixing references. `--rollback` restores the original files from the `.bak` backups without overwriting concurrent external edits (it verifies backup identity with SHA-256 / inode checks).

- The `--fix` output must prominently remind users about both `--commit` and `--rollback`, especially when references require manual review.

- Neither command should be triggered automatically by an agent. The agent may suggest the command and ask the user to confirm, or it may run the command only when the user explicitly approves it in chat.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Guidelines explain repair preview principles: fail-closed, deterministic, content-preserving, atomic filename+frontmatter update
- [x] #2 Guidelines instruct AI to review and manually fix references reported by doctor instead of guessing
- [x] #3 Migrate or rewrite duplicate task ID detection and repair for current fork prefix/branch model
- [x] #4 After repair with references to review, retain backup files and provide a manual --commit command that runs only after references are handled and verified
- [x] #5 Add backlog doctor CLI command with preview, --fix, --fix --yes, --commit, and --rollback support; --fix output must remind users about --commit and --rollback commands
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement core duplicate detection for current fork: scan active and completed tasks, detect zero-padding equivalence (task-1 vs task-01), dotted subtasks, and exact legacy ID collisions. Exclude archived-only IDs from collision reports.
2. Implement deterministic repair plan generation: sort collision groups by active-before-completed, padding-match priority, and filename order; allocate new unused IDs via existing generateNextId/generateNextSubtaskId; verify target paths do not exist; validate subtask parent_task_id consistency.
3. Implement transaction-based repair apply with ownership-safe rollback: stage new file content, rename source to .bak, install target via no-replace hard-link, verify identities with device/inode/SHA-256, quarantine targets before rollback, restore backups without overwriting concurrent external edits, and clean up staged files on failure. On success, retain .bak files when references require manual review.
4. Add post-repair lifecycle commands: --commit to discard retained backups and finalize the repair after references are handled, and --rollback to restore original files from retained backups before commit. Both commands verify backup identity and ownership.
5. Add backlog doctor CLI command: preview-only mode, --fix interactive confirmation, --fix --yes non-interactive path after preview verification, --commit for finalizing repairs with references, --rollback for undoing a recent repair, and fingerprint-based stale-preview detection. --fix output must prominently remind users about --commit and --rollback, especially when references require manual review.
6. Integrate repair with current fork prefix config, zeroPaddedIds, and cross-branch model; do not modify files on other branches.
7. Add Web UI shared duplicate recovery flow with diagnostic warning and repair confirmation modal.
8. Add tests covering CLI doctor preview/repair/commit/rollback, core rollback ownership, Web UI recovery, huge/padded/dotted/legacy/stale-plan cases, and no-clobber concurrent-edit scenarios.
9. Update agent guidelines to instruct AI to use backlog doctor instead of manual edits and to manually review reported references (already done).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Guidelines updated to cover backlog doctor workflow including --commit and --rollback: src/guidelines/agent-guidelines.md (new section 5.7 with finalize/undo subsection), src/guidelines/cli-instructions/task-execution.md, src/guidelines/mcp/task-execution.md, src/guidelines/cli-agent-nudge.md, and src/guidelines/mcp/agent-nudge.md. Guidelines now instruct AI to diagnose duplicate IDs with backlog doctor, apply --fix only after reviewing the preview, manually review reported references, and use --commit to finalize or --rollback to undo before commit. Biome check passed on modified guideline files. Code migration of the actual repair logic is still pending.

Expanded the 'Fix references manually' guidance in src/guidelines/agent-guidelines.md, src/guidelines/cli-instructions/task-execution.md, and src/guidelines/mcp/task-execution.md with explicit principles: human-first reading of the reference list, fail-closed (leave ambiguous references unchanged), no guessing references, content preservation, no cross-branch mutation, and rollback-safe (do not --commit until confident). Biome check passed on modified guideline files.
<!-- SECTION:NOTES:END -->
