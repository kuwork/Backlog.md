---
title: BACK-643 Preserve consecutive blank lines inside fenced code blocks in notes (issue 930)
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - markdown
source_path: backlog/tasks/back-643 - Preserve-consecutive-blank-lines-inside-fenced-code-blocks-in-notes-issue-930.md
---

# BACK-643 Preserve consecutive blank lines inside fenced code blocks in notes (issue 930)

`task edit --notes` and `--append-notes` normalized section content with a global newline-run collapse, so blank lines inside fenced code blocks were silently rewritten on every edit — code samples did not round-trip. One fence-aware helper now replaces the four normalization sites so fence content survives byte-for-byte while prose keeps collapsing. Ports upstream BACK-637 (issue 930).

## Summary

- New `collapseBlankLines(text)` in `src/markdown/structured-sections.ts`: a single-pass tracker that opens a fence on three or more backticks or tildes indented by at most three spaces, closes on a line repeating the opening character at least as many times with only trailing whitespace, and treats an unterminated fence as protecting the remainder
- Replaced all four newline-run normalizations — the section body extractor, the section block builder, the section strip path, and the comments content writer — so `updateStructuredSections`, `stripSectionInstances`, `stripCommentsSection`, and `updateCommentsContent` share one fence rule with no duplicated logic
- Outside fences behavior is unchanged: runs of two or more blank lines collapse to one, leading blanks are dropped, trailing blanks are left to the caller's existing `.trim()`/`.trimEnd()`
- The helper is plain text scanning, not a Markdown parser: fence state is consulted before any section logic, so a section-marker-shaped line inside a fence stays fence content
- New 8-test suite `src/test/structured-sections-code-fences.test.ts` (backtick/tilde/unterminated fences, section-shaped line in a fence, prose collapse, notes replacement, comments rewrite cycle)
- Verification: 163 pass / 0 fail across 12 scoped markdown/comments/notes suites; tsc and biome clean (a first run showed 9 spurious timeouts from git-init suites needing `--timeout 240000`)

## Acceptance Criteria

- Fenced code blocks (backtick and tilde) with consecutive blank lines survive notes writes and appends byte-for-byte
- An unterminated fence keeps the rest of the section fenced and preserved
- Prose outside fences keeps the existing collapse-to-one normalization
- One shared fence-aware helper serves every normalization site

## Related Concepts

- [[concepts/markdown-pipeline]] — structured section serialization this fence-aware normalization joins
- [[concepts/upstream-migration]] — ports upstream BACK-637 (commit b2fbf08d)

## Related Sources

- [[sources/back-537-deterministic-checklist-serialization]] — adjacent work on stable markdown serialization of section bodies
- [[sources/back-470-task-comments]] — comments parse/rewrite cycle covered by the shared helper
