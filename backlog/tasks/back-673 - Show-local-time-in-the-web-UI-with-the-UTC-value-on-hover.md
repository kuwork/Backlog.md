---
id: BACK-673
title: Show local time in the web UI with the UTC value on hover
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-02 17:01'
updated_date: '2026-09-20 07:39'
labels: []
dependencies: []
references:
  - src/web/utils/date-display.ts
  - src/web/components/StoredDate.tsx
  - src/web/utils/date-display.test.ts
  - src/test/web-stored-date.test.tsx
modified_files:
  - src/web/utils/date-display.ts
  - src/web/utils/date-display.test.ts
  - src/web/components/StoredDate.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/TaskList.tsx
  - src/web/components/TaskCard.tsx
  - src/web/components/MilestoneTaskRow.tsx
  - src/web/components/MilestonesPage.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/components/DraftsList.tsx
  - src/web/components/CleanupModal.tsx
  - src/web/components/Statistics.tsx
  - src/web/components/GanttView.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/test/web-stored-date.test.tsx
priority: medium
actual_start: '2026-09-20 07:21'
actual_end: '2026-09-20 07:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Web surfaces in this fork already render stored timestamps in the viewer local timezone (formatStoredUtcDateForDisplay / formatStoredUtcDateForCompactDisplay in src/web/utils/date-display.ts). What no web surface exposes is the canonical value behind that rendering: no date carries a tooltip, and every other surface prints the stored value unlabelled, so a reader cannot tell which clock a rendered date belongs to.

This task adds the missing half (upstream BACK-677 / PR #992): put the canonical stored UTC value in the element title attribute, marked as UTC, so hovering a timestamp that reads 2026-09-02 19:01 locally shows 2026-09-02 17:01 (UTC).

Scope is deliberately limited to the hover. The visible rendering stays exactly as it is today, no visible web copy is relabelled, and the CLI, TUI, MCP and --plain surfaces are untouched: they keep printing the stored value verbatim, exactly as they do now (they never carried a UTC marker).

One correctness trap: many stored dates are date-only, such as created_date 2025-07-26, with no time component at all. Those carry no hover, so no tooltip claims a time the record does not have.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.50.1..v1.52.0 --grep BACK-677` and `git show bbcc5bc0f`, and confirm against this fork which half is still missing before porting anything: local-time rendering already exists in src/web/utils/date-display.ts, so only the hover is in scope.
- [x] #2 Every web surface that renders a stored date-time exposes the canonical stored value in the element title attribute with the (UTC) marker: hovering a timestamp whose visible text is 2026-09-02 19:01 shows 2026-09-02 17:01 (UTC).
- [x] #3 No visible copy is relabelled and no value changes which clock it is rendered in: date-time values keep rendering in the viewer local timezone, date-only values keep their current rendering, and the duplicated per-component date formatters in the cleanup preview and the statistics task preview are replaced by the shared helper.
- [x] #4 Date-only values (yyyy-mm-dd), empty values and unparsable values carry no title at all, so no hover claims a time the record does not have.
- [x] #5 Text and title come from one shared path instead of per-component formatting: the existing src/web/utils/date-display.ts helpers return { text, title } and one small component renders them for every call site (task details modal, task list, task card, milestones page, milestone task row, milestone details modal, drafts list, cleanup preview, statistics); the surfaces that show the stored string itself (documentation and decision details) and the gantt table actual start/end columns take the same hover title directly from the shared helper while keeping their own text.
- [x] #6 The compact/relative label (today / yesterday / Nd ago) keeps its current wording, and it carries the same hover when the value has a time.
- [x] #7 CLI, TUI, MCP and --plain output are untouched and keep printing the stored value verbatim as they do today, and src/utils/date-utc.ts keeps its current API.
- [x] #8 Tests cover the hover on a date-time, its absence for date-only and unparsable values, and the compact label; expectations are derived from the runtime timezone or are otherwise timezone-independent, so no test depends on the machine zone.
- [x] #9 bunx tsc --noEmit, bun run check . and the touched suites pass, and each new case was first confirmed red against the reverted change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - One shared hover helper (AC #2, #4, #6)

- 1.1 Extend src/web/utils/date-display.ts instead of adding a parallel module: formatStoredUtcDateForDisplay and formatStoredUtcDateForCompactDisplay return { text, title }.
- 1.2 text keeps today output verbatim: toLocaleString for date-time values, toLocaleDateString for date-only values, and the relative label for the compact variant.
- 1.3 title is built from the raw stored string (the value as written in the Markdown), never by re-formatting the parsed Date, so the hover matches the CLI/TUI/MCP output verbatim: stored value plus the (UTC) marker.
- 1.4 Omit title when the value has no time component (DATE_ONLY_REGEX), is empty, or fails parseStoredUtcDate; keep the current passthrough for unparsable input.
- 1.5 Keep storedUtcToDateTimeLocal and the re-exports used by the forms unchanged.

### Phase 2 - One render component (AC #2, #5)

- 2.1 Add src/web/components/StoredDate.tsx: renders a span carrying title when there is one, and a plain span otherwise.
- 2.2 Route every web stored-date render through it and drop the remaining per-component formatting: TaskDetailsModal (created / updated / due / comment dates), TaskList (compact created column and due), TaskCard (due), MilestoneTaskRow (compact created), MilestonesPage (created / updated / actual start / actual end / last updated), MilestoneDetailsModal (created / updated), DraftsList (created / updated), CleanupModal (preview dates, its local formatDate helper), Statistics (its formatDate helpers and the createdDate/updatedDate fallback), DocumentationDetail (createdDate), DecisionDetail (date).
- 2.3 Leave surrounding copy and layout alone: only the date node becomes StoredDate; where a label already prefixes the value (Created: ...) the prefix stays.
- 2.4 Date-only call sites keep their visible output and go through the same component, so the no-hover rule lives in one place.

### Phase 3 - Keep the other surfaces untouched (AC #3, #7)

- 3.1 No CLI, TUI, MCP or plain-output change, and no change under src/utils/date-utc.ts.
- 3.2 No visible label rename: the web UI never rendered a Due (UTC) label, so nothing needs to become Due:, and any locale string that mentions UTC stays as it is.

### Phase 4 - Tests and verification (AC #8, #9)

- 4.1 Extend src/web/utils/date-display.test.ts: hover present with the (UTC) marker for a date-time, absent for date-only / empty / unparsable values, and the compact label keeps its text with the hover on the absolute fallback.
- 4.2 Add component coverage asserting both the visible text and the title attribute of a rendered timestamp, with the timezone pinned through a beforeAll/afterAll helper that saves and restores process.env.TZ (bun shares one process across test files).
- 4.3 Prove the guards by reverting each one: drop the title, add a title to date-only values, and remove it from one call site; each must turn the matching case red.
- 4.4 Gates: bunx tsc --noEmit, bun run check . and a scoped bun test over the touched web suites; report any pre-existing failure separately instead of working around it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Phase 1 - Shared hover helper (done)

- `src/web/utils/date-display.ts`: added `storedUtcHoverTitle(value)`, which returns the stored value with the `(UTC)` marker only when the record has a time component and parses (`DATE_TIME_REGEX` + `parseStoredUtcDate`). Both display helpers now return `StoredDateDisplay` (`{ text, title? }`); `text` is byte-identical to the previous output, so nothing on screen changes. `storedUtcToDateTimeLocal` and the re-exports are untouched.
- The title is the value as stored (not re-derived from the parsed Date), so the hover matches the Markdown record and what the CLI/TUI/MCP print.
- Date-only, empty and unparsable values get no title from any path: `formatStoredUtcDateForDisplay` only attaches one inside the date-time branch, and `formatStoredUtcDateForCompactDisplay` only on the relative/absolute branches of a value that has a time.

### Phase 2 - One render component (done)

- New `src/web/components/StoredDate.tsx` renders `{ text, title }` as a span and nothing else; `compact` switches to the relative helper and accepts an explicit `now` for deterministic tests.
- Routed through it: TaskDetailsModal (created, updated, comment dates), TaskList (compact created column), TaskCard (relative age label keeps its wording, now titled), MilestoneTaskRow (compact created), MilestonesPage (actual start, actual end, last updated), MilestoneDetailsModal (created, updated), DraftsList (created, updated), CleanupModal (preview dates) and Statistics (task preview dates).
- The two components that carried their own duplicate date formatter (CleanupModal, Statistics task preview) lost it and now share the helper, so their arrangement normalises to the shared medium-date/short-time shape (for example 07:01 PM becomes 7:01 PM in en-US). No label or other copy changed.
- Surfaces that show the stored string itself keep that text and take the hover from the same helper: DocumentationDetail (created date) and DecisionDetail (date). The gantt table's actual start/end columns also take the title from the helper while keeping their compact M/D HH:MM rendering, so the fork's gantt layout is untouched (exclusion list section 3).
- TaskCard's due-date cell and the gantt's planned columns stay hover-free on purpose: dueDate/plannedStart/plannedEnd are date-only in this fork, so there is no time to name.

### Phase 3 - Other surfaces untouched (done)

- No change under src/cli.ts, src/ui, src/formatters, src/mcp or src/utils/date-utc.ts. The CLI, TUI, MCP and --plain output keep printing the stored value verbatim; those surfaces never carried a UTC marker, so nothing was added there.
- No visible label rename was needed: the web UI never rendered a `Due (UTC)` label, and no locale string mentions UTC.

### Phase 4 - Tests (done, gates pending)

- `src/web/utils/date-display.test.ts`: the existing cases were adapted to the new shape and three new blocks cover the hover title (present for a date-time, absent for date-only / empty / unparsable), the title on both display helpers, and the compact relative label keeping its hover. 24 cases pass across the two date files.
- New `src/test/web-stored-date.test.tsx` renders the component in jsdom and asserts the visible text plus the `title` attribute for a timestamp, the absence of `title` for a date-only / empty / unparsable value, and the compact label with an explicit reference time.
- Timezone: the new component expectations are derived from the runtime zone through the same Intl options the helper uses, so the suite stays timezone-independent without pinning process.env.TZ (a deliberate simplification of plan item 4.2; the pinned-zone approach is unnecessary here because the hover value is timezone-independent and any zone-dependent text is computed in-test).
- Revert probes, all confirmed red for the intended cases: (a) making `storedUtcHoverTitle` always return undefined turned the 6 hover-asserting cases red; (b) dropping the date-only guard made the three no-time-to-claim cases red; (c) dropping the parse check made the unparsable case red.
<!-- SECTION:NOTES:END -->
