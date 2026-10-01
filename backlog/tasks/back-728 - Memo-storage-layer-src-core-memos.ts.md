---
id: BACK-728
title: 'Memo storage layer: src/core/memos.ts'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 10:11'
updated_date: '2026-10-01 10:28'
labels: []
milestone: m-10
dependencies: []
modified_files:
  - src/constants/index.ts
  - src/core/memos.ts
  - src/test/memos.test.ts
references:
  - 'src/file-system/operations.ts:2045'
  - 'src/markdown/frontmatter.ts:12'
  - 'src/markdown/serializer.ts:153'
  - 'src/constants/index.ts:4'
documentation:
  - backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md
ordinal: 298400
actual_start: '2026-10-01 10:15'
actual_end: '2026-10-01 10:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Backlog.md can capture tasks, docs and decisions but has nowhere to put a throwaway note: anything worth remembering has to become a task or a doc, which forces an ID scheme, a title and section structure onto content that is really one line jotted down in a meeting. Memos fix that by adding a fifth file-backed entity stored under backlog/memos/.

This task is the storage layer only: one self-contained module, src/core/memos.ts, that owns the memo file format (date+sequence ID YYYYMMDD-N, frontmatter with no title, markdown body) and exposes list / read / create / update / delete plus cursor pagination. Nothing consumes it yet - the HTTP API, CLI, web UI and search integration are follow-up tasks.

Deliberately out of scope: no ContentStore / snapshot integration (memos stay out of the task+wiki snapshot machinery on purpose), no EntityKind change, no routing, no pinned or promote fields.

Implementation notes for the executor: the helper names quoted in doc-20 (readFileUtf8, writeFileUtf8, listMarkdownFiles, ensureDir) do not exist in this repo. Use the idioms already in src/file-system/operations.ts instead: Bun.file(p).text() to read, Bun.write(p, content) to write, new Bun.Glob("**/*.md").scan({ cwd }) to list, and a mkdir(dir, { recursive: true }) in a try/catch mirroring FileSystem.ensureDirectoryExists (operations.ts:2045). Serialize through src/markdown/frontmatter.ts only - never import gray-matter directly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 src/core/memos.ts exports a Memo type carrying id, createdDate, updatedDate, tags, displayTitle, rawContent and path, with no title field
- [x] #2 nextMemoId returns YYYYMMDD-N where N is the highest existing sequence for that date plus one, and restarts at 1 on a new day
- [x] #3 createMemo writes backlog/memos/<id>.md with LF line endings and creates the memos directory when it does not exist
- [x] #4 A file written by createMemo parses back through parseFrontmatter with tags, dates and body intact
- [x] #5 displayTitle is derived from the first non-empty line of the body, falling back to the first 40 characters when the body starts blank
- [x] #6 listMemosPage returns memos sorted by createdDate descending with id as a stable tiebreaker, honours limit and cursor, and returns nextCursor null once the end is reached
- [x] #7 listMemosPage accepts an optional date filter that returns only memos created on that date
- [x] #8 updateMemo replaces the body and bumps updatedDate while preserving id and createdDate; deleteMemo removes the file
- [x] #9 src/test/memos.test.ts covers ID sequencing, pagination boundaries, the date filter and the LF round-trip, and passes via bun test src/test/memos.test.ts
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add MEMOS: "memos" to DEFAULT_DIRECTORIES in src/constants/index.ts (the object starts at line 4) so the memo directory has one declared home.
2. Create src/core/memos.ts as the single owner of the memo file format and all memo IO. Exports: Memo interface, memoDir(root), nextMemoId(root), listMemos(root), listMemosPage(root, opts), getMemo(root, id), createMemo(root, content, tags), updateMemo(root, id, patch), deleteMemo(root, id).
3. Implement IO with the idioms already used in src/file-system/operations.ts: Bun.file(p).text() to read, Bun.write(p, content) to write, new Bun.Glob("**/*.md").scan({ cwd }) to list, and a mkdir(dir, { recursive: true }) wrapped in try/catch mirroring FileSystem.ensureDirectoryExists (operations.ts:2045). Do not invent readFileUtf8/writeFileUtf8/listMarkdownFiles/ensureDir - they do not exist here.
4. Serialize exclusively through parseFrontmatter / stringifyFrontmatter from src/markdown/frontmatter.ts (lines 12 and 18). Never import gray-matter directly. Frontmatter holds id, created_date, updated_date and tags only - no title. Omit tags when the array is empty, following serializeDocument in src/markdown/serializer.ts:153.
5. Stamp dates with the repo-wide idiom new Date().toISOString().slice(0, 16).replace("T", " ") (see src/core/backlog.ts:3716) so memo dates are byte-comparable with task and doc dates.
6. Derive displayTitle from the first non-empty line of the body, falling back to body.trim().slice(0, 40).
7. Sort by createdDate descending with id descending as a tiebreaker; implement cursor pagination as findIndex(cursor) + 1 and return nextCursor null once start + limit reaches the end.
8. Write files with LF endings and exactly one trailing newline: normalize CRLF out of the body before writing, and assert LF in the tests.
9. Add src/test/memos.test.ts: build a scratch project with mkdtemp OUTSIDE the repo and give it a backlog/config.yml so the CLI/core never walks up to the real repo. Cover ID sequencing and day rollover, pagination boundaries, the date filter, update preserving createdDate, delete, and the LF round-trip.
10. Verify: bun test src/test/memos.test.ts, then bunx tsc --noEmit, then bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Bug found in self-review and fixed before commit: listMemos / nextMemoId threw ENOENT when backlog/memos/ did not exist yet (only listMemosPage was guarded, because it called ensureDir). Replaced the read-path ensureDir with a directoryExists guard, so a project that never captured a memo lists as empty and reading no longer creates the directory as a side effect. Covered by the new "treats a project with no memo directory as empty" test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the memo storage layer: src/core/memos.ts is now the single owner of the memo file format.

Changes:
- src/core/memos.ts (new): Memo type plus memoDir / nextMemoId / listMemos / listMemosPage / getMemo / createMemo / updateMemo / deleteMemo. IDs are YYYYMMDD-N (highest per-day sequence + 1), frontmatter carries id / created_date / updated_date / tags and no title, bodies are written with LF endings and exactly one trailing newline.
- src/constants/index.ts: DEFAULT_DIRECTORIES gains MEMOS: "memos".
- src/test/memos.test.ts (new): 15 tests covering id sequencing and day rollover, directory creation, the frontmatter round-trip, displayTitle derivation, newest-first ordering, pagination boundaries, the date filter, update/delete semantics, and the LF contract.

Design notes:
- The helper names quoted in doc-20 section 5.1 (readFileUtf8 / writeFileUtf8 / listMarkdownFiles / ensureDir) do not exist in this repo, so the module uses the idioms already in src/file-system/operations.ts: Bun.file().text(), Bun.write(), Bun.Glob scan, and a mkdir in try/catch mirroring FileSystem.ensureDirectoryExists.
- Memos stay out of ContentStore, EntityKind and the task routes entirely; this task is storage only.

Verification:
- bun test src/test/memos.test.ts -> 15 pass / 0 fail
- bunx tsc --noEmit -> clean
- bun run check . -> no errors
<!-- SECTION:FINAL_SUMMARY:END -->
