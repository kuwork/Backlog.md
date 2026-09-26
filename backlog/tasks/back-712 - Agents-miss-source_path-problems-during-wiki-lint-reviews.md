---
id: BACK-712
title: Agents miss source_path problems during wiki lint reviews
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-25 22:42'
updated_date: '2026-09-26 01:28'
labels: []
dependencies: []
ordinal: 282400
actual_start: '2026-09-26 01:23'
actual_end: '2026-09-26 01:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wiki lint can complete without reporting an error even when an entry's source_path cannot be used to locate its original file. Because the SKILL guidance does not tell agents to validate source resolution independently, agents can accept a clean lint result and leave the indexing defect unfixed. Strengthen the guidance so this class of failure is discovered and resolved during wiki lint work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The SKILL guidance requires wiki lint reviews to validate source_path resolution independently of lint's exit status
- [x] #2 An agent following the guidance detects an unresolvable source_path and traces the failure to the original-file indexing flow
- [x] #3 The guidance directs the agent to fix the underlying indexing issue instead of treating a clean lint run as proof of source integrity
- [x] #4 The existing wiki lint command behavior remains unchanged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the canonical llm-wiki-for-backlog SKILL.md and synchronized the embedded skill module. Added an explicit source back-reference check to wiki lint and ingest mini-lint: agents verify source_path resolution, inspect rename history before classifying a mismatch, update only verified paths, preserve source pages when the source is gone, and escalate ambiguous identifiers instead of guessing. Validation passed: bunx tsc --noEmit; bun run check .; bun test src/test/wiki-install.test.ts (12 pass, 0 fail); the embedded skill matches the canonical SKILL.md. A root-level bun test attempt was stopped after unrelated module-resolution errors from temporary test artifacts under tmp/; the scoped wiki-install test passed.
<!-- SECTION:NOTES:END -->
