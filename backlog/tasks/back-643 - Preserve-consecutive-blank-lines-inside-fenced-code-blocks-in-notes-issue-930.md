---
id: BACK-643
title: >-
  Preserve consecutive blank lines inside fenced code blocks in notes (issue
  930)
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-22 12:02'
updated_date: '2026-09-16 09:59'
labels:
  - cli
dependencies: []
references:
  - src/markdown/structured-sections.ts
  - src/test/structured-sections-code-fences.test.ts
modified_files:
  - src/markdown/structured-sections.ts
  - src/test/structured-sections-code-fences.test.ts
priority: high
actual_start: '2026-09-16 09:40'
actual_end: '2026-09-16 10:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Writing implementation notes that embed a code sample silently rewrites the sample: `task edit --notes` and `--append-notes` normalize section content with a global newline-run collapse, so every run of two or more blank lines anywhere in the body is reduced to one — including blank lines inside a fenced code block. A note that carries a shell snippet, a diff or an aligned sample does not round-trip: what is written back is not what the user wrote, and each later edit of the section loses more of the original spacing.

Expected: content inside a fenced code block survives a notes write byte-for-byte, while prose outside fences keeps the current normalization (runs of two or more blank lines collapse to one). A fence is three or more backticks or tildes indented by at most three spaces, closed by a line that repeats the opening character at least as many times and carries nothing but whitespace afterwards; an unterminated fence protects everything that follows it. One shared fence-aware helper serves every normalization site so no caller can drift from the rule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-637 and git show b2fbf08d as implementation reference.
- [x] #2 Notes containing fenced code blocks (backtick and tilde) with two or more consecutive blank lines survive a notes write and an append byte-for-byte.
- [x] #3 An unterminated fence keeps the rest of the section fenced, so blank lines after the last opener are preserved.
- [x] #4 Prose outside fences keeps the current normalization: runs of two or more blank lines collapse to one.
- [x] #5 One shared fence-aware helper serves updateStructuredSections, stripSectionInstances, stripCommentsSection and updateCommentsContent, with no duplicated fence logic.
- [x] #6 bunx tsc --noEmit, bun run check . and the scoped markdown and comments suites pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - One fence-aware blank line collapse

- 1.1 Add `collapseBlankLines(text)` to `src/markdown/structured-sections.ts`: a single-pass tracker that opens a fence on three or more backticks or tildes indented by at most three spaces, closes it on a line repeating the opening character at least as many times with only whitespace after it, and treats an unterminated fence as protecting the remainder of the text.
- 1.2 Collapse only the blank line runs that sit outside a fence: a run becomes a single blank line, leading blank lines are dropped and trailing ones are left to the caller, so the `.trim()` / `.trimEnd()` behaviour each call site already applies stays unchanged.

### Phase 2 - Route every normalization site through the helper

- 2.1 Replace the four newline-run normalizations in `src/markdown/structured-sections.ts` — the section body extractor, the section block builder, the section strip path and the comments content writer — with calls to the helper.
- 2.2 Leave `restoreLineEndings` and the CRLF handling untouched; the helper only ever receives and returns the LF body.

### Phase 3 - Verification

- 3.1 Add `src/test/structured-sections-code-fences.test.ts` covering a backtick fence, a tilde fence, an unterminated fence, a section-shaped line inside a fence, prose collapse outside fences, replacement of an existing notes section and a comments parse and rewrite cycle.
- 3.2 Run `bunx tsc --noEmit`, biome on the touched files and the scoped markdown / comments / notes suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- `src/markdown/structured-sections.ts`: added `collapseBlankLines`, a single-pass fence-aware replacement for the four newline-run normalizations — the section body extractor, the section block builder, the section strip path and the comments content writer. A fence opens on three or more backticks or tildes indented by at most three spaces, closes on a line repeating the opening character at least as many times with only whitespace after it, and an unterminated fence protects the remainder of the text. Blank line runs outside a fence still collapse to one; leading blank lines are dropped and trailing ones are left to the caller, so the `.trim()` / `.trimEnd()` each call site already applies is unchanged.
- `src/test/structured-sections-code-fences.test.ts`: new suite of 8 tests — backtick fence, tilde fence, unterminated fence, section-shaped line inside a fence, prose collapse outside fences, replacement of an existing notes section, comments parse and rewrite cycle, and comment prose collapse.

### Verification

- `bunx tsc --noEmit` clean; biome clean on both touched files; `bun run check .` reports 411 files with only the 3 pre-existing non-null assertion warnings in `src/core/assets.ts`.
- 163 pass / 1 skip / 0 fail across 12 scoped suites: structured-sections-code-fences, implementation-notes, implementation-notes-append, append-implementation-notes, append-implementation-plan, comments, final-summary, cli-final-summary, markdown, acceptance-criteria, acceptance-criteria-manager, update-task-description. The skip is the pre-existing PTY test.
- A first run with the default test hook timeout reported 9 failures, all `timed out after 5000ms`, in suites that initialise a git repository under `tmp/`, which takes about 30s on this drive; re-running with `--timeout 240000` gives 0 failures. Not related to this change.

### Notes for review

- The helper is plain text scanning, not a Markdown parser: it tracks fence state only to decide where a blank line run may collapse. A line that looks like a section marker inside a fence stays fence content because fence state is consulted before any section logic.
- Section bodies are still trimmed by the pre-existing `.trim()` / `.trimEnd()` at each call site, so trailing blank lines at the very end of a section are dropped exactly as before; only blank lines inside a fence are preserved.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fenced code blocks in notes now round-trip byte-for-byte: one fence-aware helper replaced the four global newline-run normalizations in `src/markdown/structured-sections.ts`, so blank lines inside a fence survive a notes write, an append and a comments rewrite, while prose outside fences still collapses to a single blank line. Covered by a new 8-test suite; the type check, biome and 12 scoped suites are clean.
<!-- SECTION:FINAL_SUMMARY:END -->
