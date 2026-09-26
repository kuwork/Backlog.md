---
title: BACK-673 Show local time in the web UI with the UTC value on hover
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - dates
source_path: backlog/tasks/back-673 - Show-local-time-in-the-web-UI-with-the-UTC-value-on-hover.md
---

# BACK-673 Show local time in the web UI with the UTC value on hover

Web surfaces already rendered stored timestamps in the viewer's local timezone, but no surface exposed the canonical stored value behind the rendering. This task adds the missing half of upstream BACK-677: the stored UTC value in the element `title` attribute, marked `(UTC)`, on every web date render.

## Summary

- One shared helper extended rather than a parallel module: `src/web/utils/date-display.ts` gained `storedUtcHoverTitle(value)` and both display helpers now return `StoredDateDisplay` (`{ text, title? }`); `text` is byte-identical to previous output, so nothing on screen changes
- The hover title is the raw stored string plus `(UTC)` — never re-formatted from the parsed `Date` — so it matches the Markdown record and CLI/TUI/MCP output verbatim
- Correctness trap handled: date-only values (`yyyy-mm-dd`), empty and unparsable values carry no title at all, so no hover claims a time the record does not have
- New `StoredDate.tsx` renders `{ text, title }` as a span for every call site: task details modal, task list, task card, milestones page/rows/modal, drafts list, cleanup preview, statistics; documentation/decision details and gantt actual start/end keep their own text but take the hover from the same helper
- The two components carrying duplicate local date formatters (CleanupModal, Statistics) lost them to the shared helper, normalizing to the shared medium-date/short-time shape
- Scope deliberately limited to the hover: no visible copy relabelled, CLI/TUI/MCP/`--plain` untouched (they never carried a UTC marker), `src/utils/date-utc.ts` API unchanged; date-only dueDate/planned columns stay hover-free on purpose
- Tests derive expectations from the runtime timezone instead of pinning `process.env.TZ` (bun shares one process across files); revert probes red for dropping the title, the date-only guard, and the parse check

## Acceptance Criteria

- Every web date-time render exposes the stored value with `(UTC)` marker in `title`; visible text unchanged in viewer-local timezone
- Date-only, empty and unparsable values carry no title
- Text and title come from one shared path via `StoredDate`; duplicated per-component formatters removed
- Compact/relative labels keep their wording and carry the same hover when the value has a time
- CLI, TUI, MCP and plain output untouched; timezone-independent tests with revert probes

## Related Concepts

- [[concepts/date-fields]] — stored-UTC / display-local convention and date-only values this hover encodes
- [[concepts/web-ui-features]] — surfaces routed through the shared `StoredDate` component
- [[concepts/upstream-migration]] — partial port of upstream BACK-677, scoped to the missing half

## Related Sources

- [[sources/timezone-handling-fix]] — earlier timezone rendering work this task builds on
- [[sources/back-506-cli-utc-conversion-fix]] — CLI-side UTC handling left deliberately untouched
- [[sources/milestone-actual-dates-task]] — milestone date fields among the routed surfaces
