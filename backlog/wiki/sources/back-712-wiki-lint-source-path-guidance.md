---
title: BACK-712 Agents miss source_path problems during wiki lint reviews
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - wiki
  - agent-guidance
source_path: backlog/tasks/back-712 - Agents-miss-source_path-problems-during-wiki-lint-reviews.md
---

# BACK-712 Agents miss source_path problems during wiki lint reviews

Wiki lint could exit clean while an entry's `source_path` pointed nowhere, and agents accepted the clean result without checking source resolution independently. This task strengthened the `llm-wiki-for-backlog` SKILL guidance so this failure class is caught and fixed during lint work.

## Summary

- Updated the canonical `llm-wiki-for-backlog` SKILL.md and synchronized the embedded skill module; the wiki lint command's own behavior is unchanged
- New explicit source back-reference check for lint and ingest mini-lint: agents must verify `source_path` resolution independently of lint's exit status, inspect rename history before classifying a mismatch, update only verified paths, preserve source pages when the source is gone, and escalate ambiguous identifiers instead of guessing
- The guidance directs fixing the underlying indexing issue rather than treating a clean lint run as proof of source integrity
- Validation: `tsc` and `bun run check .` clean; `wiki-install.test.ts` 12 pass; embedded skill matches the canonical SKILL.md (a root-level `bun test` attempt was stopped over unrelated tmp/ artifacts)

## Acceptance Criteria

- SKILL guidance requires validating source_path resolution independently of lint exit status
- An agent following it detects unresolvable paths and traces them to the indexing flow, fixing the root cause
- Existing wiki lint command behavior unchanged

## Related Concepts

- [[concepts/embedded-skills]] — the canonical SKILL.md + embedded module pair this updates
- [[concepts/cli-instructions]] — agent-facing instruction surface the guidance belongs to

## Related Sources

- [[sources/wiki-install-task]] — the wiki skill installation flow whose payload includes this SKILL.md
