---
id: BACK-510
title: Fix wiki page switch not exiting edit mode
status: Done
assignee: []
created_date: '2026-06-04 15:43'
updated_date: '2026-06-05 05:59'
labels:
  - web-ui
  - bug
  - wiki
dependencies: []
priority: medium
ordinal: 168400
actual_start: '2026-06-05 05:50'
actual_end: '2026-06-05 05:59'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a user is in edit mode on a wiki page and clicks another wiki page in the sidebar, the app does not exit edit mode properly. Instead of switching to view mode for the new page, it remains in edit state and shows the new page content in the editor, which is confusing and unintended.

Expected behavior: switching to a different wiki page should always exit edit mode and display the new page in read-only view mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Switching to another wiki page from the sidebar exits edit mode
- [x] #2 The new wiki page is displayed in read-only view mode, not edit mode
- [x] #3 Any unsaved edits are discarded (with confirmation if needed, or silently for now)
- [x] #4 The edit toggle button state reflects view mode after page switch
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Plan
1) Inspect `src/web/components/WikiDetail.tsx` to understand how edit mode state (`isEditing`) is managed and how page switching is handled via `wikiPath`.
2) Identify the `useEffect` that triggers on `wikiPath` changes and add `setIsEditing(false)` to reset edit mode before loading the new page.
3) Run scoped tests and verify the fix manually via code review (no dedicated React component tests exist).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Summary: Added `setIsEditing(false)` in the `useEffect` that responds to `wikiPath` changes in `WikiDetail.tsx`. This ensures that switching to a different wiki page always exits edit mode, discards unsaved changes, and displays the new page in read-only view mode.

File changed: `src/web/components/WikiDetail.tsx` (line 242).

Tests: `bun test resolve-wiki-path` passes. No React component-level tests exist in the project.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
