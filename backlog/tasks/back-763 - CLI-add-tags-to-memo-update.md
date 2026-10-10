---
id: BACK-763
title: 'CLI: add --tags to memo update'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-10 02:07'
updated_date: '2026-10-10 09:14'
labels:
  - cli
  - memo
dependencies: []
references:
  - 'src/cli.ts:5633-5678'
  - 'src/core/memos.ts:245-264'
  - 'src/mcp/tools/memos/handlers.ts:113-125'
  - 'src/server/index.ts:2161-2168'
  - 'src/guidelines/cli-instructions/memos.md:68-72'
priority: medium
ordinal: 325001
actual_start: '2026-10-10 07:08'
actual_end: '2026-10-10 09:14'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memo tags can only be set at creation time. The core layer already supports a tags patch (updateMemo accepts { content?, tags? }), and both MCP memo_update and REST PATCH /api/memos/:id expose tags. Only the CLI is missing it: backlog memo update offers just --content and --append, with no way to change tags.

Practical impact: in a terminal, fixing or adding a tag means deleting and recreating the memo, or hand-editing the markdown file. That is a surprising gap when every other memo surface already supports it, so the CLI should match the semantics those layers implement.

Scope: the CLI command layer in src/cli.ts only. Core, MCP, and REST already implement the required behavior and are the alignment baseline, not part of this change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog memo update <id> --tags meeting,important replaces the tag set and bumps updated_date; the command still prints the updated memo ID
- [x] #2 --tags combines with --content or --append in a single call, updating body and tags together
- [x] #3 Passing only --tags (no --content/--append) is a valid update, not a "No update options provided." error
- [x] #4 Passing --tags with an empty value clears all tags; the memo then reports no tags in memo view and memo list
- [x] #5 backlog memo update --help lists tags in the Input schema and examples, and states how it relates to --content/--append
- [x] #6 The CLI instruction guide src/guidelines/cli-instructions/memos.md documents --tags in its update section with an example
- [x] #7 bunx tsc --noEmit and bun run check . pass
- [x] #8 Tag parsing matches the REST parseTagList rules through parseClearableStringList: trim, drop empties, dedupe after trim (exact match, as REST does); accepts comma-separated or repeated flags; absent means leave tags alone, an explicitly blank value means clear
- [x] #9 CLI tests in src/test/cli-memo-tags.test.ts cover four paths: replace tags, clear with an empty value, --tags with --content, and --tags alone; the new suite and the existing memo suites pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add -t, --tags to backlog memo update in src/cli.ts, with the same multi-value accumulator memo create uses.
2. Parse the value with parseClearableStringList so absent (undefined) means leave tags alone and an explicitly empty value ([]) means clear them.
3. Widen the no-options guard so a tags-only invocation is valid; leave content undefined in that case so updateMemo preserves the body.
4. Update the command help schema (optional tags field + examples) and the CLI instruction guide src/guidelines/cli-instructions/memos.md.
5. Add src/test/cli-memo-tags.test.ts covering replace, clear, --tags with --content, and --tags alone; run tsc, biome, and the memo test suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: new src/test/cli-memo-tags.test.ts passes 8/8; memos, memo-local-day-timezone, mcp-memos and memo-search pass 48/48; cli-list-window passes 17/17. tsc --noEmit and biome check are clean.

Caveat for anyone re-running them: bunfig sets timeout = 10000, but invoking bun test with explicit file paths here falls back to bun's 5s default, and CLI-spawning tests need far more than that on this machine, so every suite has to run with --timeout 60000. Without it the failures are all "beforeEach/afterEach hook timed out" and say nothing about the code.

Implementation: added -t, --tags to backlog memo update in src/cli.ts (multi-value accumulator, parsed with parseClearableStringList so absent means leave the tags alone and a blank value clears them). The no-options guard now accepts a tags-only update, and content stays undefined in that case so updateMemo preserves the stored body.

Definition of Done re-verified: bunx tsc --noEmit exits 0; bun run check . reports 671 files checked with no fixes needed; scoped test suites pass (see Verification above). All three DoD items checked.
<!-- SECTION:NOTES:END -->
