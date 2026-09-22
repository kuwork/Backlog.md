---
id: BACK-666
title: Show and edit modified files in the web task modal
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-15 13:12'
updated_date: '2026-09-20 00:25'
labels: []
dependencies: []
references:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/PathAutocomplete.tsx
  - src/web/locales/en.ts
  - src/test/web-task-details-modal-modified-files.test.tsx
modified_files:
  - src/web/components/TaskDetailsModal.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/web-task-details-modal-modified-files.test.tsx
  - src/test/web-task-details-modal-documentation.test.tsx
actual_start: '2026-09-19 18:59'
actual_end: '2026-09-19 22:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `modifiedFiles` field is already carried end to end — the markdown parser and serializer, `backlog task edit --modified-file`, plain and JSON output, the TUI task viewer, the MCP tools and web search all read it — but the web task modal never showed it: a task found by a `modifiedFiles:` search opened with no trace of the paths that matched, and a path could only be changed from the CLI.

The modal gains that surface, laid out the way the two metadata lists next to it already work. References, Documentation and Modified Files become three tabs of one panel instead of three stacked sections, so the new list takes over the area the References list already occupied and the modal does not grow by another card.

Which tab is open first follows the task's state: a finished task is opened for the paths it touched, so Modified Files leads there, while a task still under way reads the strip left to right with References first. An empty list yields to the next one either way, and References is the fallback when nothing is filled. Clicking a tab overrides that default for the open modal. The rule reads the lists the panel renders rather than the saved task, so an unsaved edit that fills or empties a list is followed as well, and a caption whose list is empty shows no count: the strip reads `References(5) Documentation Modified Files(12)`, not a row of `(0)`s.

The Modified Files tab reuses the References implementation: the same monospace path chip that opens the file preview, and the same add form (path autocomplete in the input, duplicate rejection, per-row remove on hover). The one deliberate difference is that a modified file is always a path from the project root, so the URL branch is dropped: an `http(s)://` value is neither suggested by the input nor accepted by the form, and never renders as an external link.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.50.1..v1.52.0 --grep BACK-633` and `git show d0d41ccfb` for reference; the fork keeps the upstream state wiring but replaces its separate stacked section with the tabbed panel, so do not copy the upstream section markup.
- [x] #2 References, Documentation and Modified Files render as three tabs of a single metadata panel; the panel's title strip is the tab strip and only the active tab's body is rendered.
- [x] #3 The tab opened on load follows the task's state - Modified Files first when the record is finished, References first while it is under way - and opens the first filled list in that order, falling back to References when every list is empty; clicking a tab overrides the default.
- [x] #4 Modified file rows reuse the References row rendering — a monospace path chip that opens the file preview in the modal — with no URL branch: an `http(s)://` entry is never rendered as an external link.
- [x] #5 The Modified Files add form reuses the References form (path autocomplete suggestions, duplicate rejection, Add button) and refuses URL input: submitting an `http(s)://` value adds nothing.
- [x] #6 Cross-branch tasks and completed-corpus tasks render the three lists without add or remove controls, matching the existing References gating.
- [x] #7 New i18n keys exist in en, zh-CN, zh-TW and ja for the Modified Files tab, its empty hint and its remove control, and the component holds no hardcoded user-facing string.
- [x] #8 A new test file covers the modified file list, the state-driven default tab (a finished task with both lists opens on Modified Files and still reaches References from the strip, a finished task whose file list is empty falls back to References, a task under way with both lists opens on References), the URL rejection and tab switching; the existing modal tests that assumed stacked References and Documentation sections are updated for the tabbed layout.
- [x] #9 Every new or updated case was confirmed to fail when the corresponding change is reverted: dropping the state check so References leads for every status fails the finished-task cases, and letting Modified Files lead for every status fails the under-way cases.
- [x] #10 Each tab caption carries its list length in parentheses - `References(5)`, `Modified Files(12)` - reading the same state the panel renders, so the count follows an unsaved add or remove; a list with no entries shows the bare caption, with no `(0)`.
- [x] #11 The default is computed from the lists the panel renders rather than from the saved task, so the rule follows an unsaved edit that fills or empties a list, and a click pins a tab only for the task it was made on.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the i18n keys first (`taskDetails.section.modifiedFiles`, `taskDetails.noModifiedFiles`, `taskDetails.removeModifiedFile`) to en, zh-CN, zh-TW and ja in the same change as the component edit: `TranslationDict` is derived from `en`, so a key that lands without its three siblings fails the type check.
2. Turn the two stacked cards in `src/web/components/TaskDetailsModal.tsx` (References, Documentation) into one panel with a tab strip, keeping the existing `SectionHeader` styling for the strip so the panel still reads as the neighbouring sections do. The References and Documentation bodies move into their tabs unchanged.
3. Add the Modified Files tab body: rows cloned from the References rows minus the URL branch, and the add form reusing `PathAutocomplete` with URL values rejected on submit.
4. Drive the tab from a `metadataTab` state seeded by `metadataTabPriorityFor(isDone)` - Modified Files first on a finished task, References first otherwise, the first filled list in that order and References as the fallback - with a null override, so the default keeps following the status and the lists while a click pins the user's choice for the open modal.
5. Wire `modifiedFiles` through the modal's existing plumbing: `buildTaskDetailsFormState`, the refresh-preserving form sync, the task-switch reset, `handleInlineMetaUpdate`, and the create-mode entry check that already counts references.
6. Tests: update `src/test/web-task-details-modal-documentation.test.tsx`, which asserts both sections render at once, and add `src/test/web-task-details-modal-modified-files.test.tsx` for the list, the default tab per status, the empty fallback, the URL rejection, tab switching and the read-only gating.
7. Revert-verify in two halves: revert the tab panel alone and the modified tab alone, confirm the new cases fail in each state, then restore.
8. Gates: `bunx tsc --noEmit`, `bun run check .`, and the scoped modal test files; then restart the source server and check the tabbed modal and the default tab on a real task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Layout

- References, Documentation and Modified Files are three tabs of one panel in `src/web/components/TaskDetailsModal.tsx`, replacing the two stacked cards the modal had. The strip carries `role="tablist"`/`role="tab"` and the body `role="tabpanel"`, and only the active tab's body is rendered, so the new list cannot push Acceptance Criteria and the fields below it out of reach.
- The tab on open is derived from the task's state and the lists the panel renders: `metadataTabPriorityFor(isDone)` puts Modified Files first for a finished record and References first otherwise, the first filled list in that order opens, and References is the fallback when everything is empty. A `metadataTab` state of `null` means "follow the task", so the rule also re-runs when an unsaved edit fills or empties a list or the status changes; clicking a tab pins it, and the pin is cleared when the task identity changes or the modal reopens. The first cut keyed the default off the status, a leftmost-filled variant replaced it, and the request then settled back on the state-driven order with the lists as the tie-breaker.
- The section caption reads `Modified Files`, with the empty hint and the row
  button following it (`No modified files`, `Remove modified file`): the strip is a row of noun phrases beside `References` and
  `Documentation`, and a verb-object caption would make the row button sound like it both removes and modifies
  a file. The more literal sentence-style rendering is heavier in a caption that also carries a
  count. The row button names the modified file rather than the file alone for the same reason: the x drops the entry from the task's list and never
  touches the file on disk, which the shorter wording would misstate.
- Each tab caption carries its list length in parentheses (`References(5)`, `Modified Files(12)`), read from the same state the panel renders, so the count follows an unsaved add or remove rather than the saved task. A list with no entries shows the bare caption — no `(0)` — so the strip does not fill up with zeros. The count is a `font-normal tabular-nums` span beside the label, so it de-emphasises itself against the semibold caption in both themes without a second colour.

Modified Files tab

- Rows are cloned from the References rows: the monospace path chip opens the file preview. The URL branch is dropped, because a modified file is always a path from the project root.
- The add form reuses `PathAutocomplete`, so it offers the same path suggestions the References form does, and refuses URLs on submit through a module-local `looksLikeUrl` that matches any `scheme://`, not only http/https.
- `modifiedFiles` runs through the modal's existing plumbing: `buildTaskDetailsFormState`, the refresh-preserving sync, the task-switch reset, `handleInlineMetaUpdate`, and the create-mode entry check that already counted references.

Divergences from the ported implementation

- The ported version shipped a third stacked card with hardcoded English strings and a `max-h-64` scrollable list. This fork routes every user-facing string through i18n, and bounds the footprint with the tab panel instead: the file list is not height-capped, exactly like the References list beside it. A cap, if it is ever needed, belongs on all three lists at once.
- The ported version deliberately kept `modifiedFiles` out of `handleSave`. Here it is sent together with references and documentation, because the create form sends those and a path added while creating would otherwise be lost.

Verification

- Live check against the source server with headless Chrome: BACK-666 (Done, 4 references and 7 modified files) opens on Modified Files(7) with 7 rows in the panel, and clicking References opens References(4); BACK-664 (Done, 5 references and 12 modified files) opens on Modified Files(12) - it opened on References before the state-driven rule; BACK-438 (To Do, 3 references, nothing else) opens on References(3) with the other two captions bare, no `(0)`; every caption matched its task's stored lists (`References(4) Documentation Modified Files(7)`), the panel's row count matched the caption on every tab, and a click still overrides the rule for the open task.
- The Chinese captions were re-checked on the source server with `locale: "zh-CN"` in `backlog/config.yml`: the
  strip reads `References(4) Documentation Modified Files(7)` on BACK-666 and opens on the file tab with seven rows whose remove button
  reads `Remove modified file`, and BACK-438 (To Do) shows the bare
  `Modified Files` caption with the `No modified files` hint once the tab is clicked.
- The deep link paints the modal before the corpus arrives, so the first frame shows References and the strip settles on Modified Files once the task loads. That is the rule re-evaluating rather than a stale choice.
- Tests: the new `src/test/web-task-details-modal-modified-files.test.tsx` (18 cases) uses the repository's `createRoot` + `act` harness with a stubbed `fetch`, and `web-task-details-modal-documentation.test.tsx` selects the tab it asserts on. Probes: forcing References to lead for every status fails the finished-task cases (2) and letting Modified Files lead for every status fails the under-way cases (2); restoring a content-only order fails the finished-task case; deriving the default from the saved task instead of the rendered lists fails the follow-the-edit case; always rendering the count span fails 6 cases (the earlier probes still hold - tab panel revert 16/17, Modified-only revert 7, caption span always-on 8). Both tab files match captions by label prefix, so an assertion never depends on the count.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web task modal now shows the `modifiedFiles` field and lets it be edited inline, closing the last surface gap for a field the markdown parser, the CLI, the TUI task viewer, the MCP tools and web search already read.

References, Documentation and Modified Files became three tabs of one panel instead of three stacked cards, so the new list takes over the area the References list already occupied. Which tab opens follows the task's state - Modified Files first on a finished record, References first while a task is under way, an empty list yielding to the next one and References as the fallback when everything is empty - and a click overrides the default for the open modal. Each caption carries its list length - `References(5)`, `Modified Files(12)` - from the state the panel renders, so the count tracks unsaved edits, while an empty list shows the bare caption with no `(0)`.

The Modified Files tab mirrors the References implementation — the same path chip that opens the file preview, and the same add form with path suggestions — minus the URL branch, so an `http(s)://` value is never suggested, accepted or rendered as an external link. Read-only records (cross-branch, completed corpus) show the lists without any control, as the sibling lists do.

Verified live against the source server: BACK-664 (Done, 5 references and 12 paths) and BACK-666 (Done, 3 and 7) open on Modified Files with the caption matching the rows the panel renders, BACK-438 (To Do, 3 references) opens on References with the two empty captions bare, path suggestions appear while typing, a URL submission adds nothing while a repository path adds its chip, and every caption matched both the task's stored lists and the rows the panel rendered. Covered by a new 18-case test file plus the updated documentation cases; the probes are listed in the notes. Gates: `bunx tsc --noEmit` clean, `bun run check .` clean, 78 modal cases pass across the ten `web-task-details-modal-*` files and `web-milestone-timestamps`.
<!-- SECTION:FINAL_SUMMARY:END -->
