---
title: BACK-655 Reject nested section markers in notes and fix append truncation
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - markdown
  - core
  - cli
  - upstream-migration
source_path: backlog/tasks/back-655 - Reject-nested-section-markers-in-notes-and-fix-append-truncation.md
---

# BACK-655 Reject nested section markers in notes and fix append truncation

`buildSectionBlock` wrapped section payloads without reconciling sentinel lines already inside them, so `--notes` could nest markers — the write reported success while `task view` showed only the part before the inner end marker — and the read path truncated notes that merely mentioned the terminator inline. This task ports the upstream fix: one line-anchored, depth-aware sentinel scanner plus rejection of marker lines at the shared core input boundary, and upgrades the fenced-code scanner to the full CommonMark implementation.

## Summary

- The five sentinel-path regexes in `src/markdown/structured-sections.ts` are replaced by one line-anchored, depth-counted `findSentinelBlocks` shared by extraction, section ranges, start/end lookup, and strip; `tokenizeKnownSentinels` is line-anchored the same way so an inline marker can never mask or terminate a section
- New `assertSectionInputHasNoMarkerLines` + `assertSectionInputsSafe` guard at the shared core input boundary (`createTaskFromInput` / `applyTaskUpdateInput` in `src/core/backlog.ts`) rejects section input carrying its own marker as a whole line, covering description, plan, notes, final summary and the append variants — CLI, MCP, web server, and TUI all share it; reject-not-strip, with one-space indentation as the documented escape hatch
- The fenced-code-block scanner is upgraded to the full CommonMark version (list-container indentation, backtick info strings, raw HTML block types 1-7), superseding the simplified scanner from BACK-643 and closing two real content-loss cases; the file now matches the upstream revision byte for byte (blob 67d4f74eb)
- Deliberate behaviour change: a fenced example embedding its own section's marker line used to round-trip as a nested block; it is now a clear error naming the marker, and BACK-643's round-trip assertion was replaced by an explicit rejection test
- Harness finding: Bun on Windows truncates a real multi-line argv element to its first line, so CLI tests pass multi-line text via the CLI's documented newline escape — the platform limit first looked like a product bug
- Tests: new `src/test/section-marker-safety.test.ts` (11 cases, 9 red pre-fix) plus the full 24-case fence suite (went from 7 of 24 red to all green); `buildSectionBlock` stays tolerant so pre-existing nested files stay readable and repair on the next clean rewrite

## Acceptance Criteria

- Section input containing the target section's own marker as a whole line is rejected before any write, with an error naming the marker
- Inline marker mentions, indented marker lines, and other sections' markers inside fences round-trip byte for byte
- A notes body mentioning an end marker inline is no longer truncated on read or `--append-notes`
- A pre-existing nested-marker file renders its full interior, and a clean `--notes` rewrite strips the nested region
- One shared line-anchored depth-aware scanner replaces the five sentinel regexes; the fence scanner reaches the full CommonMark suite (24/24 green)

## Related Concepts

- [[concepts/markdown-pipeline]] — structured-section sentinel and fence scanning this task rewrites
- [[concepts/upstream-migration]] — ports upstream BACK-660 (3d73793b9) plus the fence work from b2fbf08dc
- [[concepts/task-identity]] — section content is the durable record; fail-closed rejection over silent alteration

## Related Sources

- [[sources/back-530-append-description]] — the append-style section writes whose truncation this fixes
- [[sources/back-537-deterministic-checklist-serialization]] — adjacent structured-section serialization work
