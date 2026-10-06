---
id: BACK-753
title: Referenced by backlinks on document and decision pages
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-06 13:20'
updated_date: '2026-10-06 15:49'
labels:
  - web-ui
dependencies:
  - BACK-614
modified_files:
  - src/web/utils/backlinks.ts
  - src/web/utils/backlinks.test.ts
  - src/web/utils/task-id-links.ts
  - src/web/utils/task-id-links.test.ts
  - src/web/components/BacklinkList.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
parent_task_id: BACK-239
priority: medium
ordinal: 317000
actual_start: '2026-10-06 13:58'
actual_end: '2026-10-06 15:15'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-239 asked for two things: rendering `doc-<n>` / `decision-<n>` in task bodies as links (shipped by BACK-614 and BACK-751), and showing the reverse direction — a "Referenced by" list of tasks on a document or decision page. Only the reverse direction is left.

Implement it entirely on the client: the web app already loads every task into memory, so scan their bodies for references, build a reverse index and render the list on the document and decision detail pages. No new API endpoint, no writes to disk, and no title on the auto-linked references themselves (BACK-239 AC4 is dropped by decision).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A task that mentions a known document or decision ID anywhere in its body appears in a "Referenced by" section on that document or decision page.
- [x] #2 References inside fenced code blocks and inline code spans do not create backlinks, matching the auto-linker, which never links them.
- [x] #3 ID variants resolve like the auto-linker: `doc-1`, `DOC-001`, `#doc-1` and the project prefix form all point at the same document and produce one entry.
- [x] #4 A task referencing the same entity several times appears once, with the number of references shown.
- [x] #5 Backlinks are computed at render time from the in-memory task list: no new API endpoint, no writes to task, document or decision files.
- [x] #6 Entries are sorted by task ID and each row links to the task, reusing the existing unsaved-edit navigation confirmation.
- [x] #7 A task that names a document or decision in its `documentation:` frontmatter field (not only the body) appears in that entity's "Referenced by" list.
- [x] #8 A range (`doc-10~12` or `doc-10~doc-12`) or slash-list (`doc-10/11/12`) in a task's body or `documentation:` field expands into a backlink under every entity in the span.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
- Build a single pure reverse index (`buildBacklinkIndex`) over the tasks already held in memory; the document/decision pages consume it via `findBacklinks`.
- Keep the scan one shared code path: `scanEntityReferences` is reused by both the body and the `documentation:` field, and it already shares the auto-linker's boundary rules.
- Range/slash-list expansion reuses the existing `detectMultiIdToken` + `resolveEntityRangeToken` so the backlink scanner and the render linker stay in lockstep.
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
- `buildBacklinkIndex` now gathers two scan sources per task: the body (code stripped, so code-block references never count) and each entry of `task.documentation` (scanned verbatim — its entries are usually paths/URLs that carry no entity ID, but a `doc-*`/`decision-*` entry there is a deliberate reference).
- `scanEntityReferences` was extended to expand multi-ID tokens: a range (`doc-10~12`, or the full-end form `doc-10~doc-12`) and a slash-list (`doc-10/11/12`) each yield one reference per entity in the span. The whole token is consumed before resuming the scan, so a nested ID (the `doc-12` in `doc-10~doc-12`) is not counted twice.
- The range grammar in `detectMultiIdToken`/`parseMultiIdToken` gained a full-end-ID form (`doc-10~doc-12`) so the user's literal range example resolves; the numeric-end form (`doc-10~12`) remains the primary supported shape. Entities always use the dashed prefix (`doc-10`), so a dashless head like `doc10~` is not a recognized entity form.
- Fail-closed: a range whose endpoints do not both resolve to the same kind, or a slash-list with an unknown entry, contributes no backlink (the whole token is left unresolved rather than partially counted).
- `BacklinkList` renders one inline line, not a heading + list: `Referenced by: N tasks (BACK-1/2/...)`, where the **label** ("Referenced by:") and the **count** ("N tasks") are static muted text, and only the **parenthesized id list** is the clickable trigger (blue link colour, `text-blue-600 dark:text-blue-400 hover:underline`). A leading Heroicons-style link icon (inline `<svg>`, muted `currentColor`) sits before the label, matching the 2×2 metadata grid's per-field icons. The trigger opens BACK-751's `EntityIdRangeDropdown` (portalled dropdown of `ID · title`), so the reader sees each referencing task's title before clicking in. The line returns `null` when empty, so the document/decision header shows no third row at all when there are no backlinks.
- The id list is abbreviated: the **first** id keeps its prefix (`BACK-239`), but every id from the second onward is stripped to the bare number via `stripAnyPrefix` and joined by `/`, so the trigger reads `BACK-239/639/669/670/698`. The dropdown still shows full IDs + titles. A task that references the entity more than once collapses to one row whose count is folded into the dropdown title (`Title (3×)`).
- Layout: on the **document** page the 4-column metadata strip under the title becomes a 2×2 grid, with the backlink line as a third row. On the **decision** page the 4-column metadata strip is kept as-is and the backlink line is simply appended as an extra row (no 2×2 change).
- i18n: the `documents` and `decisions` blocks in all four locales (`en`/`zh-CN`/`zh-TW`/`ja`) now use `referencedBy` (the static label, e.g. "Referenced by:" / "任务引用：" / "任務引用：" / "参照元：") and `referenceCount` (the count phrase, e.g. "5 tasks" / "5个任务" / "5個任務" / "5 件のタスク"). The obsolete `referencedByLine` key was removed.
<!-- SECTION:NOTES:END -->

## Final Summary
<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The document and decision detail pages now show a "Referenced by" line built entirely on the client. Backlinks are sourced from both a task's body and its `documentation:` frontmatter field, and range/slash-list references (`doc-10~12`, `doc-10~doc-12`, `doc-10/11/12`) expand into a backlink under every entity in the span. The scan reuses the auto-linker's boundary rules and the existing multi-ID token resolver, so referenced and referencing stay consistent. The line reads `Referenced by: N tasks (BACK-1/BACK-2/...)`: the label and the count are static muted text, and only the parenthesised id list is the clickable trigger that reuses BACK-751's `EntityIdRangeDropdown` (same link colour, portalled dropdown of `ID · title`, in-app navigation, titles shown before clicking in); the entity count is folded into the dropdown title when a task references it more than once, and the row disappears when there are no backlinks. The document page uses a 2×2 metadata grid with the backlink as a third row; the decision page keeps its 4-column strip and appends the backlink as one extra row. Verified with `bun test` (43 pass across backlinks.test.ts + task-id-links.test.ts + the web `BacklinkList` integration test, which mounts the dropdown and asserts the id/title rows); `bunx tsc --noEmit` and `bunx biome check` are clean on the touched files.
<!-- SECTION:FINAL_SUMMARY:END -->

## Files Changed
- src/web/utils/backlinks.ts — `buildBacklinkIndex` scans body + `documentation:`; adds `collectReferenceText`.
- src/web/utils/task-id-links.ts — `scanEntityReferences` expands range/slash-list tokens; `detectMultiIdToken`/`parseMultiIdToken` accept a full-end-ID range.
- src/web/utils/backlinks.test.ts — new cases for the `documentation:` field, ranges and slash-lists.
- src/web/utils/task-id-links.test.ts — new `scanEntityReferences` multi-ID describe block.
- src/web/components/BacklinkList.tsx — shared backlink list block (new).
- src/web/components/DocumentationDetail.tsx, DecisionDetail.tsx — render `referencedBy` via `BacklinkList`.
- src/web/locales/{en,zh-CN,zh-TW,ja}.ts — `referencedBy` / `referenceCount` strings.
