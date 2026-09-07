---
id: BACK-614
title: Auto-link entity IDs in web markdown with input-side insert-link hint
status: Done
assignee:
  - '@Kimi Code CLI'
  - '@kimi'
created_date: '2026-08-07 21:10'
updated_date: '2026-09-07 02:53'
labels:
  - web-ui
dependencies:
  - BACK-511
references:
  - src/web/utils/task-id-links.ts
  - src/web/contexts/TaskIdIndexContext.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/DependencyInput.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/App.tsx
priority: medium
due_date: '2026-09-07'
planned_start: '2026-09-07'
planned_end: '2026-09-07'
actual_start: '2026-09-06 23:06'
actual_end: '2026-09-07 02:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Background

Entity IDs written directly into web UI markdown content (task description, plan, notes, comments, final summary, as well as documents and decisions) render as plain text; following a reference requires manually copying the ID and searching for it.

## Scope

Covers all entities in the BACK-511 short-alias system (depends on BACK-511; link targets share the same singular route family as its alias mapping):

| Entity | Bare ID example | Link target | 511 alias |
|--------|-----------------|-------------|-----------|
| Task | BACK-123 | /task/123 | TASK#:id |
| Document | doc-9 | /documentation/9 | DOC#:id |
| Decision | decision-1 | /decisions/1 | Decisions#:id |
| Draft | DRAFT-104 | /draft/104 | DRAFT#:id |
| wiki | patterns/cross-surface | /wiki/patterns/cross-surface | WIKI#:path |

The wiki `[[wikilink]]` syntax is already handled by the existing wikiLinks module and is out of scope; this task covers all other bare ID forms. BACK-239 (docs/decisions back-references) should be able to extend this task's index mechanism, so the design must leave room for that.

## Functional requirements

1. **Render-side fail-closed auto-linking**: in all markdown display fields, bare IDs that match a known entity render as links; unknown IDs stay plain text; when the index is empty nothing is linkified at all.
2. **Input-side insert hint (autocomplete menu below the caret)**: in markdown text inputs, after the user stops typing for 200 ms (debounce), the entity short-name **prefix** immediately before the caret, bounded on the left by a space (or line start), is prefix-matched against the known entity index (**no need to type the full ID**); matching candidates are **sorted by ascending ID**, and an "insert link" menu with the **first 5 in ascending order** pops up below the caret; **ArrowUp/ArrowDown select a candidate, Enter confirms** and inserts a space-padded markdown link at that position (e.g. `␣[BACK-123](/task/123)␣`); **with a single candidate, Enter inserts directly** without arrow-key selection; typing other characters refreshes the candidates or cancels the menu without interfering with normal typing.
3. **Zero-padding-aware prefix matching**: prefix comparison of numeric IDs must strip leading zeroes and match by numeric prefix — typing `BACK-1` matches `BACK-1`, `BACK-14`, `BACK-010` (numeric 10), `BACK-0012` (numeric 12), and other tasks whose numeric body starts with 1; typing `BACK-01` is equivalent to `BACK-1`; the same applies to documents (doc-9), drafts (DRAFT-104), etc.; entities with canonical collisions are still excluded as ambiguous (fail-closed) and never appear as candidates.
4. **Wiki path prefix hints**: wiki paths are prefix-matched against the loaded wiki page corpus by plain string lexicographic order (no zero-padding concerns); candidates take the first 5 in dictionary order, with arrow-key selection and Enter confirmation, and a single candidate inserts on Enter alone; triggered by "space + text"; misses are cached per candidate string so the same candidate is not re-checked before the corpus updates, avoiding per-keystroke hit lookups.
5. **Clickable dependency chips**: dependency chips in the task details sidebar are route links when the target task exists, and stay plain text when it does not exist or is ambiguous.
6. **Unsaved-edits guard**: when edit/create mode has unsaved content, any leave-type link inside the modal (chips, auto-links) asks for confirmation first; same-page anchors and new-tab clicks are exempt.

## Technical notes

- The canonical entity index covers tasks + documents + decisions + drafts, shared by the input side and the render side; the index is built from the corpus App has already loaded, with no new API calls; canonical collisions (e.g. BACK-1 vs BACK-01) are dropped as ambiguous, fail-closed.
- Detection happens at the markdown AST layer (remark plugin): inline code and fenced code blocks are structurally excluded, existing links keep their original target, and boundary rules reject tails of longer identifiers/paths (my-task-123, BACK-1.md, etc.).
- Input-side detection is caret-position aware: the token immediately before the caret, bounded on the left by whitespace or line start, is extracted as the prefix candidate; numeric IDs are matched by numeric prefix with leading zeroes stripped (zero-padding aware), with up to 5 candidates per entity kind sorted by ascending ID; the menu supports arrow-key selection and Enter confirmation, a single candidate inserts on Enter directly; while the menu is open, Enter and arrow keys are intercepted and all other keys pass through and refresh or close the menu.
- Input-side lookups use negative caching: misses (and hits) are remembered per candidate string, so keystrokes and debounce ticks never re-check the same candidate; the whole cache is invalidated when the wiki corpus or task corpus changes.
- Case, zero-padding, and prefix variants are all canonicalized to the canonical ID through the same resolution mechanism, and link hrefs always use the canonical ID.

## Constraints

- Candidate lookup for autocomplete is a standalone read-only prefix query over the in-memory canonical index and **must not affect the sorting logic or return order of existing list endpoints (such as /api/search)**; query parameters, sort fields, and pagination behavior of list endpoints must not change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-593 and git show 5cc69b6 as implementation reference.
- [x] #2 Bare task IDs that match a known task render as links to /task/<id> in web markdown fields (description, plan, notes, comments, final summary, documents, decisions)
- [x] #3 Task IDs inside inline code spans and fenced code blocks are not linkified
- [x] #4 Non-task tokens such as UTF-8, ISO-8601 and v1.2.3, and longer identifiers whose tail looks like a task ID such as my-task-123, are not linkified
- [x] #5 Task IDs inside existing markdown links keep their original link target
- [x] #6 Dependency chips in the task details sidebar link to the referenced task
- [x] #7 Web component tests cover linking, code-block exclusion, non-task tokens, dependency chip links, and all entity types (task/doc/decision/draft/wiki)
- [x] #8 Following a task link from the task details modal with unsaved edits asks for confirmation before leaving, for both dependency chips and auto-linked IDs in markdown
- [x] #9 Bare entity IDs left untransformed on the input side are covered by the render-side fail-closed auto-linker as a fallback, and the input side and render side share the same canonical entity index
- [x] #10 Auto-linking covers all BACK-511 short-alias entity routes: task → /task/:id, document → /documentation/:id, decision → /decisions/:id, draft → /draft/:id, wiki path → /wiki/:path, all using the singular route family
- [x] #11 Bare entity IDs of documents, decisions, and drafts are auto-linked to the corresponding entity in markdown content via the fail-closed index; unknown IDs stay plain text; canonical resolution (case/zero-padding/prefix variants) uses the same mechanism as task IDs
- [x] #12 In markdown text inputs, after the user stops typing for 200 ms, the entity short-name prefix before the caret bounded on the left by a space (or line start) — without typing the full ID — is prefix-matched against the known entity index; matching candidates are sorted by ascending ID and an "insert link" menu with the first 5 in ascending order pops up below the caret; ArrowUp/ArrowDown select a candidate, Enter confirms and inserts a space-padded markdown link at that position; a single candidate inserts on Enter directly; typing other characters refreshes the candidates or cancels the menu
- [x] #13 Prefix matching of numeric IDs is zero-padding aware: the numeric body is compared by numeric prefix after stripping leading zeroes (typing BACK-1 matches BACK-1, BACK-14, BACK-010, BACK-0012, and other tasks whose numeric body starts with 1; BACK-01 is equivalent to BACK-1); entities with canonical collisions are excluded as ambiguous and never appear as candidates
- [x] #14 Wiki paths are prefix-matched against the loaded wiki page corpus by plain string lexicographic order, with the first 5 candidates in dictionary order, arrow-key selection, Enter confirmation, and single-candidate insert on Enter; triggered by "space + text"; missed candidates are cached per candidate string and not re-checked before the corpus updates
- [x] #15 Autocomplete candidate lookup is a standalone read-only prefix query over the in-memory canonical index; it does not affect the sorting logic or return order of existing list endpoints and does not change their query parameters, sort fields, or pagination behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Adaptation strategy

- Before starting, read references/current-branch-migration-exclusions.md to confirm the new web UI behavior does not conflict with or overwrite existing customizations (gantt route, stats page, wikiLinks).
- Links uniformly use the current branch's singular route family (/task/:id, /documentation/:id, /decisions/:id, /draft/:id, /wiki/:path), keeping the same mapping as BACK-511 short aliases.
- Link conversion happens primarily on the input side (the insert hint materializes the link into the source text), with the render-side fail-closed auto-linker as the fallback for historical and untransformed content; both sides share the same canonical entity index; hit lookups (especially wiki paths) use negative caching and are not re-checked per keystroke.
- Candidate lookup is a standalone read-only prefix query over the in-memory index; it does not plug into or modify the sorting logic or return order of existing list endpoints.

### Key implementation steps

- 1. Add src/web/utils/task-id-links.ts: canonical entity index (tasks + documents + decisions + drafts, collisions dropped), zero-padding-aware ascending prefix query (numeric body compared by numeric prefix with leading zeroes stripped, top 5 per entity kind by ascending ID; wiki paths top 5 by string lexicographic order; implemented as a standalone read-only query over the index that does not affect existing list endpoint sorting), and a remark AST link plugin (structural exclusion of inline/fenced code, skipping existing link subtrees, boundary rules).
- 2. Add src/web/contexts/TaskIdIndexContext.tsx: build the index from the corpus App has already loaded via useMemo, distribute through React Context, shared by input and render sides, with no new API calls.
- 3. Modify src/web/components/MermaidMarkdown.tsx: attach the remark plugin (rebuilt via useMemo when the index changes); matched display fields become links with canonical-ID hrefs.
- 4. Modify src/web/components/DependencyInput.tsx: chips are resolved through the same canonical index; matches become react-router links, misses/ambiguities stay plain text.
- 5. Modify src/web/components/TaskDetailsModal.tsx: capture-phase click guard on the content area — when edit/create mode has unsaved content (including comment-only drafts and any filled field in create mode), leave-type links ask for confirmation first; same-page anchors, new-tab clicks, and non-http protocols are exempt.
- 6. Modify src/web/App.tsx: wrap the route tree with TaskIdIndexProvider so the index updates automatically as the corpus changes over WebSocket.
- 7. Add the input-side autocomplete menu: markdown editors debounce 200 ms and extract the token before the caret bounded on the left by whitespace/line start as the prefix candidate (full ID not required); numeric IDs go through zero-padding-aware prefix matching (numeric prefix with leading zeroes stripped, BACK-01 equivalent to BACK-1), with top 5 candidates per entity kind by ascending ID; the wiki corpus is prefix-matched by string lexicographic order with top 5 (triggered by "space + text", misses cached per candidate string, whole cache invalidated on corpus update); candidate lookup is read-only over the in-memory index and does not call or change existing list endpoint sorting; an "insert link" menu pops up below the caret with arrow-key selection and Enter confirmation inserting a space-padded markdown link, a single candidate inserts on Enter directly, other keys pass through and refresh or close the menu; candidate validation shares the same index as the render side.
- 8. Component test coverage: link hits, code-block exclusion, non-task tokens, long-identifier boundaries, chip hits/misses, all entity types (task/doc/decision/draft/wiki), unsaved guard (chip/body anchor/comment draft/create mode), input-side menu (zero-padding-aware prefix matching, candidates top 5 ascending, arrow-key selection, Enter confirmation, single-candidate direct Enter, refresh/cancel on continued typing, surrounding spaces), regression verification that candidate lookup does not affect existing list endpoint sorting, wiki path negative caching (misses not re-checked, cache invalidated after corpus update); then bunx tsc --noEmit, bun run check ., and the full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation record (2026-09-06, branch tasks/back-614-entity-auto-link, three parallel subagents)

### Completed

- Render-side core: added src/web/utils/task-id-links.ts (canonical entity index: tasks + documents + decisions + drafts, collisions dropped; zero-padding-aware ascending prefix query top 5; wiki paths lexicographic top 5; remark AST link plugin with singular routes and structural code-block exclusion) and src/web/contexts/TaskIdIndexContext.tsx; wired into MermaidMarkdown and DependencyInput chips (Link to /task/<canonical ID>), plus the App.tsx provider (wikiPaths flattened from the existing wikiTree).
- Unsaved guard: capture-phase click guard on the TaskDetailsModal content area (isDirty ∥ comment draft ∥ any filled field in create mode; same-page anchors/modifier keys/non-http exempt). Adaptation notes: the fork has no taskType; the create-mode status default is always present and would make the guard always-on, so it was excluded in favor of the fork-specific documentation field.
- Input-side autocomplete: added src/web/hooks/useEntityAutocomplete.ts (200 ms debounce, token extraction before the caret, negative cache keyed by candidate string and invalidated wholesale with the index reference, mirror-div caret coordinates, IME composition neither intercepted nor triggers the menu) and src/web/components/EntityLinkAutocomplete.tsx (listbox menu with TASK/DOC/DECISION/DRAFT/WIKI kind badges); wired into all PasteAwareMDEditor surfaces; DecisionDetail's bare MDEditor was replaced with PasteAwareMDEditor (also gaining paste support); the TaskDetailsModal comment box is wired (relative container + callback ref).

### Key trade-offs

- The fork's canonicalTaskId lived in src/utils/task-path.ts and pulls in node:path/core, which breaks the web build when imported directly; it was extracted into the pure module src/utils/task-id.ts with task-path.ts re-exporting it — a single implementation with zero behavior change.
- @uiw/react-md-editor v4 drops textareaProps.ref; the textarea is obtained via wrapper querySelector + MutationObserver.
- Insert-link replaces only the token itself; the left whitespace boundary stays in the source, yielding exactly one leading space naturally.

### Verification status

- bunx tsc --noEmit: 0 errors.
- New/extended tests: task-id-links 24, entity-link-autocomplete 22, chips 4, modal guard 6, mermaid-markdown +8, all passing; the modal suites are 32/32 green.
- Full bun test re-run in progress; the first full run's 81 failures were traced to Windows parallel interference (each failing file passes in isolation).
- bun run build succeeds (web browser graph has no node dependency leakage).

### Remaining at the time of writing

- Full-suite re-run confirmation and live browser spot-check (backlog browser verifying auto-links and menu interaction).
- Register AC items one by one and fill in the Final Summary.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migrated and extended the upstream task-ID deep-link capability: bare entity references in web UI markdown now auto-link on the render side (fail-closed) and get a prefix autocomplete on the input side that materializes the link in one keystroke.

### Render side

- Added src/web/utils/task-id-links.ts: canonical entity index (tasks + documents + decisions + drafts, collisions dropped) + zero-padding-aware ascending prefix query (top 5 per kind, wiki paths lexicographic) + remark AST link plugin; hit targets use the singular route family (/task, /documentation, /decisions, /draft), inline code and fenced code blocks are structurally excluded, existing links keep their original target, boundary rules reject tails of longer identifiers/paths, and an empty index links nothing.
- Added src/web/contexts/TaskIdIndexContext.tsx (index built via useMemo from the corpus App already loaded, effective automatically on WebSocket updates, no new API); wired into all MermaidMarkdown display fields.
- DependencyInput dependency chips resolve through the same index; matches become react-router Links to /task/<canonical ID>, misses/ambiguities stay plain text.

### Input side

- Added src/web/hooks/useEntityAutocomplete.ts + src/web/components/EntityLinkAutocomplete.tsx: 200 ms debounce extracts the token before the caret (left boundary whitespace/line start), prefix matching (zero-padding aware, BACK-01≡BACK-1; falls back to wiki path prefix when the token contains "/" or matches no entity ID), listbox menu below the caret takes the first 5 by (kind, ascending ID); arrow keys select, Enter confirms and inserts a space-padded markdown link, a single candidate inserts on Enter directly, continued typing refreshes/cancels, Escape closes, IME composition is neither intercepted nor opens the menu; candidate negative cache is keyed by token and invalidated wholesale when the index reference changes.
- Wired into PasteAwareMDEditor (all markdown editing surfaces) and the TaskDetailsModal comment box; DecisionDetail's bare MDEditor was also switched to the shared wrapper.

### Unsaved-edits guard

Capture-phase click guard on the TaskDetailsModal content area: in edit/create mode, when isDirty, a comment draft, or any filled field in create mode (including the fork-specific documentation field) exists, leave-type links inside the modal (chips, body anchors) ask for confirmation first; same-page anchors, modifier-key new-tab clicks, and non-http protocols are exempt; declining blocks both native anchors and react-router Links.

### Key adaptations and fixes

- The fork's canonicalTaskId lived in src/utils/task-path.ts and depends on node:path/core (importing it would break the web build); it was extracted into the pure module src/utils/task-id.ts with task-path.ts re-exporting — zero behavior change.
- @uiw/react-md-editor v4 drops textareaProps.ref; the inner textarea is obtained via wrapper querySelector + MutationObserver.
- Fixed global pollution in the entity-link-autocomplete tests (an unreverted fetch mock and JSDOM window caused 81 unrelated failures in the full run): original values are captured before the first overwrite and restored in afterAll.

### Verification

- bunx tsc --noEmit: 0 errors; bun run check . passes (only the 3 pre-existing warnings in src/core/assets.ts); full bun test 2126 pass / 0 fail / 13 skip.
- 64 new tests: task-id-links 24, entity-link-autocomplete 22, chips 4, modal guard 6, mermaid-markdown +8.
- Live browser verification (backlog browser): BACK-511/BACK-239 in the BACK-614 description render as /task/ links, doc-9 as a /documentation/ link, a nonexistent BACK-123 stays plain text; dependency chips are real route links; typing BACK-51 in edit mode pops the ascending candidates BACK-510..514 after a pause, and arrow-key selection + Enter inserts [BACK-512](/task/BACK-512) (space-padded); with unsaved description edits, clicking a dependency chip shows "Discard unsaved changes and leave this task?" and staying keeps the page.

### Notes

Per plan, bare wiki paths are not auto-linked on the render side (bare strings are not recognizable, fail-closed); wiki coverage is provided by the input-side prefix hints; completed tasks are not in the index (following the existing corpus scope).

### Post-review fixes (in-task corrections)

- **De-prefixed generated link hrefs**: entityHref now uses stripAnyPrefix and generates bare numeric paths `/task/506`, `/documentation/001` (zero-padding preserved per the BACK-511 example), `/decisions/1`, `/draft/104`, aligning with BACK-511's `/task/:id ↔ TASK#:id` mapping; full-ID path resolution (`/task/BACK-123`) is unchanged and existing links are not migrated. The input side resolves the entity's stored original ID via resolveEntityReference for the href (link text still uses the canonical key); the hand-written href in DependencyInput chips was de-prefixed likewise.
- **Menu selection persistence**: fixed arrow-key selection being reset to the first candidate by the keyup-triggered debounced re-evaluation — evaluate() preserves selectedIndex when the candidate array is identical (same token cache reference); also fixed the menu reopening after Escape via the trailing keyup (re-evaluation is suppressed after Escape until the next input/click).
- **Verification updates**: the four related test files pass 103+24; added an entity-href zero-padding assertion and 2 menu regression tests (arrow-key selection across keyup, no reopen after Escape); full bun test 2129 pass / 0 fail / 13 skip; live verification: BACK-511 in the BACK-614 description renders as `/task/511` and clicking it reaches task 511; typing BACK-506 in edit mode and pressing Enter inserts `[BACK-506](/task/506) `.
<!-- SECTION:FINAL_SUMMARY:END -->
