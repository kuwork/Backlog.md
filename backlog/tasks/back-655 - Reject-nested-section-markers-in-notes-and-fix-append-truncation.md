---
id: BACK-655
title: Reject nested section markers in notes and fix append truncation
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-30 15:23'
updated_date: '2026-09-18 08:04'
labels: []
dependencies:
  - BACK-643
references:
  - 'src/core/backlog.ts:224'
  - 'src/core/backlog.ts:1487'
  - 'src/core/backlog.ts:1700'
  - 'src/markdown/structured-sections.ts:121'
  - 'src/markdown/structured-sections.ts:205'
  - 'src/markdown/structured-sections.ts:316'
  - 'src/markdown/structured-sections.ts:508'
  - 'src/markdown/structured-sections.ts:553'
  - 'src/test/section-marker-safety.test.ts:53'
  - 'src/test/structured-sections-code-fences.test.ts:24'
modified_files:
  - src/core/backlog.ts
  - src/markdown/structured-sections.ts
  - src/test/section-marker-safety.test.ts
  - src/test/structured-sections-code-fences.test.ts
actual_start: '2026-09-18 07:23'
actual_end: '2026-09-18 08:04'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
buildSectionBlock (src/markdown/structured-sections.ts:253) wraps a section payload without reconciling sentinel lines already inside it, so the read-modify-write pattern behind --notes nested the markers: the write reported success while task view showed only the part before the inner end marker, and repeated edits never repaired the file. The same shape of defect sat in the read path, where section extraction stopped at the first end-marker substring, so notes that merely mention the terminator inline were truncated on read and --append-notes persisted that loss.

This task ports the upstream fix. Sentinel handling becomes one line-anchored, depth-aware block scanner, and new section input that carries its own section's marker as a whole line is rejected at the shared core input boundary instead of being wrapped. It also upgrades the fenced-code-block scanner in the same file to the full CommonMark implementation, superseding the simplified scanner landed by BACK-643.

A pre-existing nested-marker file is not rewritten silently: its full interior stays readable, and a clean --notes rewrite repairs it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.50.1..v1.52.0 --grep BACK-660 and git show 3d73793b9 as the implementation reference, together with the fenced-code-block work in git show b2fbf08dc that the scanner upgrade supersedes.
- [x] #2 Section input that contains the target section's own reserved marker as a whole line (description, plan, notes, final summary and their --append-* forms) is rejected before any write with an error naming the marker; the task file on disk stays readable and un-nested.
- [x] #3 Inline marker mentions, indented marker lines (the documented escape hatch), and other sections' markers inside fences remain storable and round-trip byte for byte.
- [x] #4 A notes body that mentions an end marker inline is no longer truncated: --append-notes keeps the existing content whole and the appended text survives task view.
- [x] #5 A pre-existing nested-marker file renders its full interior in task view, and a clean --notes rewrite strips the whole nested region instead of stranding the displaced text above the section header.
- [x] #6 The five sentinel-path regexes in src/markdown/structured-sections.ts are replaced by one line-anchored, depth-aware block scanner shared by extraction, section ranges, insert-position lookup and strip, and tokenizeKnownSentinels is line-anchored the same way so an inline marker can never mask or terminate a section.
- [x] #7 The fenced-code-block scanner in the same file is upgraded to the full CommonMark version (fences indented inside list containers, backtick openers whose info string contains a backtick, raw HTML blocks including comments, CDATA, declarations and processing instructions), replacing the simplified scanner landed by BACK-643; the fence suite goes from 7 of 24 red to 24 of 24 green.
- [x] #8 Regression tests: a new src/test/section-marker-safety.test.ts (11 cases, 9 of the upstream set red before the fix) plus the full 24-case fence suite in src/test/structured-sections-code-fences.test.ts; tsc, biome and the touched sections, parser, serializer and CLI suites are green.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the fenced-code-block scanning region of src/markdown/structured-sections.ts (fork lines 86-182) with the upstream CommonMark implementation (fork 86-182 against upstream 86-252 was the file's only divergence; the remaining 1144 lines are byte-identical), so fences indented inside list containers, backtick openers whose info string contains a backtick, and raw HTML blocks (comments, CDATA, declarations, processing instructions, block tag names) are recognized. The file then lands byte-for-byte on the upstream revision after step 2.
2. Port the upstream sentinel layer: one line-anchored, depth-counted findSentinelBlocks shared by extraction, section ranges, start/end index lookup and strip; line-anchor tokenizeKnownSentinels the same way; delete the five sentinel-path regexes it replaces.
3. Add assertSectionInputHasNoMarkerLines (per-family, whole-line only) and call it from assertSectionInputsSafe at the shared core input boundary: createTaskFromInput and applyTaskUpdateInput, covering description, plan, notes, final summary and the append variants, so CLI, MCP, web server and TUI create all agree. Reject rather than strip: the payload is the durable record and silently altering it is worse than a retryable error. Indenting a marker line by one space stores it as literal text.
4. Leave buildSectionBlock tolerant so pre-existing nested files stay editable, and let repair happen on the next clean rewrite. TUI raw-file editing remains the human escape hatch.
5. Tests: add src/test/section-marker-safety.test.ts and replace the narrow fork fence suite with the full 24-case one plus the three fork-only scenarios it does not cover. CLI cases go through Bun.spawn with an argv array and pass multi-line text using the CLI's documented newline escape, because Bun on Windows truncates a real multi-line argv element to its first line.
6. Verify: bunx tsc --noEmit, bun run check ., both suites plus the sections/parser/serializer/CLI suites, and a revert check that puts the new cases back on red.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline (measured, not assumed): fork's src/markdown/structured-sections.ts was v1.50.1 plus the simplified fence scanner from BACK-643 (+81/-4), and it differed from the upstream revision before the sentinel fix in exactly one region - fork lines 86-182 against upstream 86-252 - with the remaining 1144 lines byte-identical. The upstream 9-case marker suite run against that state gave 8 fail / 1 pass, and the 24-case fence suite gave 17 pass / 7 fail. Two of the seven lost content for real: a fence indented four spaces inside a list item, and its deeper nesting, were not recognised by the simplified scanner's three-space rule, so blank lines inside them were collapsed as prose. The other five only failed to collapse prose blank lines (backtick info strings containing backticks, unterminated-fence scoping, and fence-like lines inside HTML comments and block tags).

Change: the divergent region is replaced by the upstream CommonMark scanner (list-container indentation, the backtick info-string rule, raw HTML block types 1-7), and the sentinel layer is ported from the upstream sentinel fix - one line-anchored, depth-counted findSentinelBlocks shared by extraction, section ranges, start/end lookup and strip, tokenizeKnownSentinels anchored the same way, and the five sentinel-path regexes deleted. src/markdown/structured-sections.ts now matches the upstream revision byte for byte (blob 67d4f74eb). The input boundary guard is new: assertSectionInputHasNoMarkerLines plus assertSectionInputsSafe, called from createTaskFromInput (src/core/backlog.ts:1487) and applyTaskUpdateInput (:1700), covering description, plan, notes, final summary and the append variants, so CLI, MCP, web server and TUI create share it. buildSectionBlock stays tolerant so a pre-existing nested file remains editable.

Behaviour change worth recording: a payload whose fenced example embeds its own section's marker line used to be written as a nested block, and BACK-643's suite asserted that round trip. The line-anchored scanner cannot resolve such a body once written, so the boundary now rejects it (fail closed) and the documented escape hatch is to indent the marker line by one space. That case is replaced by an explicit rejection test in the new suite, and the three fork-only scenarios the upstream fence suite does not cover (replacing an existing notes section, plus the two CommentsManager round trips) were carried over rather than dropped.

Harness finding: Bun on Windows truncates a real multi-line argv element to its first line, for Bun.$ templates and Bun.spawn/spawnSync alike, so CLI cases have to pass multi-line text in the CLI's documented newline escape form. The new suite uses a spawn-based runner and a cliText helper; before that, this platform limit looked like a product bug.

Verification: bunx tsc --noEmit clean; bun run check . 418 files, 0 errors (the 3 assets.ts noNonNullAssertion warnings pre-date this change); fence suite 27 pass (24 upstream plus 3 kept fork cases) and marker suite 11 pass, 38 together; the sections/parser/serializer/CLI set 103 pass / 1 skip; the wider sections, AC, DoD, comments and MCP set 186 pass, with only the 2 atomic-task-edit failures (parallel CLI timeout, web 409 on contention) that reproduce identically on the pre-fix code. Revert check: restoring the pre-fix files puts the fence suite at 20 pass / 7 fail and the marker suite, minus the two guard cases, at 8 fail / 1 pass, matching the pre-fix baseline.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Section input carrying its own section's marker as a whole line is now rejected at the shared core input boundary instead of being wrapped and nested, and section extraction resolves line-anchored, depth-counted boundaries, so notes that merely mention the terminator inline are no longer truncated on read or on append. The same file's fenced-code scanner is upgraded to the full CommonMark implementation, which closes the two content-loss cases where a fence indented inside a list item had its blank lines collapsed.

Measured before: 8 of 9 upstream marker cases red and 7 of 24 fence cases red (2 of them real content loss). After: 11 of 11 and 27 of 27, with src/markdown/structured-sections.ts matching the upstream revision byte for byte (blob 67d4f74eb).

One deliberate behaviour change: a notes payload whose fenced example embeds its own section's marker is now a clear error naming the marker, with one-space indentation as the documented escape hatch, rather than a silent nested block. That is the same reject-not-strip choice the upstream fix makes, and the fork test that asserted the old round trip is replaced by an explicit rejection case.
<!-- SECTION:FINAL_SUMMARY:END -->
