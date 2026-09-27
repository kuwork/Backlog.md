---
title: BACK-644 Fix web UI draft editing
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - drafts
source_path: backlog/tasks/back-644 - Fix-web-UI-draft-editing.md
---

# BACK-644 Fix web UI draft editing

Editing a draft from the web Drafts page could never be saved: the browser task routes only resolved the task store, so `GET /api/tasks/DRAFT-2` answered 404 and PUT answered 400. The task routes now serve drafts by explicit `DRAFT-` prefix and write through `Core.editTaskOrDraft`, matching MCP semantics. Ports upstream BACK-634.

## Summary

- `src/server/index.ts`: new `isDraftId(taskId)` decides on the prefix (`extractAnyPrefix(taskId) === DRAFT_PREFIX`), never by probing the draft store, so a bare id like `/api/tasks/2` can never silently retarget a same-numbered draft
- `handleGetTask` delegates a `DRAFT-` id to the existing `handleGetDraft` (ambiguous stays 409, missing 404); `handleUpdateTask` pre-checks drafts via `filesystem.loadDraft` and writes via `core.editTaskOrDraft` — a configured non-draft status promotes the draft
- `src/core/backlog.ts`: the non-draft branch of `editTaskOrDraft` now delegates straight to `updateTaskFromInput`, removing a duplicated `fs.loadTask` pre-load and repeated demote branch; id resolution happens once inside that method
- `src/web/App.tsx`: `refreshData` dispatches the shared `drafts-updated` event so the drafts list reloads after any save; the conditional single-path dispatch in `handleSubmitTask` was removed
- `src/web/components/TaskDetailsModal.tsx`: `StatusSelect` lists the record's actual (unconfigured) status first — a draft reads Draft — and the field is disabled for drafts, because promoting belongs to the Drafts page action, not the popup
- Tests: 8 server cases (GET/PUT through a DRAFT- id, promote on configured status, bare numeric id still resolving to the task, unknown draft 404, 409 ambiguity) plus 4 web cases; handlers are called directly because the test server answers 404 for `/api/*` over a real socket in that environment

## Acceptance Criteria

- GET `/api/tasks/<draft id>` returns the draft instead of 404; saving an edit writes the draft file and keeps it a draft
- Setting a configured non-draft status through the task route promotes the draft, matching MCP
- A prefix-less id still resolves to the task; an unknown draft id reports missing
- Drafts list refreshes after save without manual reload; popup status field shows Draft, disabled

## Related Concepts

- [[concepts/task-lifecycle]] — draft promote/demote semantics kept single-sourced
- [[concepts/task-identity]] — prefix-based draft addressing over store probing
- [[concepts/web-server]] — task route handlers extended to the draft store
- [[concepts/upstream-migration]] — ports upstream BACK-634 (commit 583f928d)

## Related Sources

- [[sources/back-642-draft-identity-fail-closed]] — draft finder and 409 ambiguity mapping reused by these handlers
- [[sources/back-535-preserve-unsaved-web-drafts]] — web draft state handling in the same UI
