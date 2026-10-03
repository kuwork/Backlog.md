---
id: BACK-745
title: Gate memo search corpus refreshes behind a stat signature
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-03 14:37'
updated_date: '2026-10-03 15:41'
labels:
  - core
dependencies: []
priority: medium
ordinal: 311400
actual_start: '2026-10-03 14:37'
actual_end: '2026-10-03 15:01'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every SearchService memo refresh does a full glob scan and re-reads every memo file (listMemos), and handleStoreEvent triggers refreshMemos unconditionally on ANY store change — contradicting the design decision that memos stay out of the ContentStore snapshot (memos can become the most numerous entity, so the O(N) IO cost grows linearly). Borrow BACK-744's filesSignature (name+size+mtime+ctime): 1) compare the memo directory signature before reloading; when unchanged, skip the full read and only reset the TTL clock; 2) route store-event refreshes through the same gate (signature check + 500ms corpus TTL) instead of unconditional full reloads; 3) extract filesSignature into src/utils for sharing with watch-json.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Loader is not invoked when the signature is unchanged; the TTL clock still resets
- [x] #2 Store events no longer trigger an unconditional full memo reload
- [x] #3 A signature change (create, edit, delete) is picked up by the next refresh
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation:
- Extracted filesSignature from src/commands/watch-json.ts into shared src/utils/files-signature.ts (watch-json re-exports; existing import sites untouched).
- src/core/memos.ts: new memosSignature(root) — one-level stat pass over backlog/memos/ (name+size+mtime+ctime, BACK-744 scheme).
- src/core/search-service.ts: SearchService takes an optional third constructor arg memosSignature; refreshMemos() compares the signature against the last load and skips the full read when unchanged (TTL clock still resets so aged-out searches do not hammer the disk). handleStoreEvent now routes through refreshMemosWhenStale() (signature + 500ms TTL gate) instead of unconditional refreshMemos.
- src/core/backlog.ts: injects memosSignature at the SearchService construction point.
- Tests (src/test/memo-search.test.ts, +4): unchanged signature skips the loader; signature change surfaces a new memo; a deleted memo drops from the index; store events (task saves) do not reload a fresh corpus.
Verification: bunx tsc --noEmit clean; scoped memo-search + watch-json tests 20 pass / 1 pre-existing skip; full bun test 3387 pass with 1 pre-existing failure in claude-agent-install.test.ts that also fails on a clean HEAD stash (unrelated). bun run check . reports ~20 pre-existing CRLF format errors in files untouched by this task.
<!-- SECTION:NOTES:END -->
