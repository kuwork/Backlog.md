---
title: BACK-646 Add Web UI demote-to-draft action
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - drafts
  - i18n
source_path: backlog/tasks/back-646 - Add-Web-UI-demote-to-draft-action.md
---

# BACK-646 Add Web UI demote-to-draft action

The web task popup's demote-to-draft action was fire-and-forget: it used the retrying fetch path (demotion is not idempotent — each attempt allocates a fresh draft id), was not bound to the task identity it started with, and blocked no other writes while running. This task makes the action resilient end to end. Ports the web half of upstream BACK-419.

## Summary

- `src/web/lib/api.ts`: `fetchWithRetry` gained an explicit retry override and a new `fetchWithoutRetry` (zero retries); `demoteTask` moved onto it so a lost response or post-move server error surfaces as the original error instead of a replayed failure
- `TaskDetailsModal.tsx`: a demotion identity (open state, task id, source, branch, draft-vs-task) plus an `activeDemotionRequest` ref and a `demoting` state bind every continuation after an await — a response landing after the popup switched task or closed is dropped instead of closing/refreshing a view it no longer owns
- While demoting: save, complete, archive, promote, comment operations, criteria/DoD toggles, inline metadata are blocked; `d`/`c`/`e`/`p` shortcuts return early; buttons disabled; Escape/close ignored; a second demotion refused; button reads "Demoting…"
- Error split: a network error warns the demotion may have succeeded and refreshes views so the user verifies the drafts list before retrying; a real rejection keeps the server message; on success it dispatches `drafts-updated`, refreshes, then closes — a refresh failure after the move warns instead of closing silently
- Scope decision: upstream's `demotionState` and 409 demotion-conflict classification were not ported because this fork's `FileSystem.loadTask`/`Core.demoteTask` shape makes both branches unreachable; the web-side resilience was ported in full
- i18n keys added across en/ja/zh-CN/zh-TW; `Modal.tsx` header and action row now wrap so the extra action cannot clip at narrow widths
- Tests: new `web-task-details-modal-demote.test.tsx` (5 cases: non-retrying request, stale identity, lost-response warning, blocked state, refresh-and-close); 55-case scoped web run green. Note: tests bridge `CustomEvent` into the jsdom realm because the popup dispatches `drafts-updated` through the bare global

## Acceptance Criteria

- Demotion never auto-retries; the original server error survives
- In-flight demotion is identity-bound; stale continuations are discarded
- All other writes, shortcuts, and closing are blocked during a demotion
- A lost response warns "may have succeeded" and refreshes views; a rejection keeps its message

## Related Concepts

- [[concepts/task-lifecycle]] — demote-to-draft mutation semantics
- [[concepts/web-ui-features]] — task popup action and keyboard-shortcut conventions
- [[concepts/web-ui-i18n]] — four-locale label contract kept for the new strings
- [[concepts/upstream-migration]] — ports upstream BACK-419 (commit 5ba37fca1) with deliberate scope reduction

## Related Sources

- [[sources/demote-to-draft-action]] — the original web demote action this hardens
- [[sources/back-644-web-draft-editing-fix]] — shared `drafts-updated` refresh event for the drafts list
- [[sources/back-571-fail-fast-concurrent-task-edits]] — related in-flight mutation guarding
