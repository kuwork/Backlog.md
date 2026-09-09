---
title: BACK-599 Remove gray-matter cache poisoning with a shared no-cache parse wrapper
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - bug
  - markdown
source_path: backlog/tasks/back-599 - Remove-gray-matter-cache-poisoning-with-a-shared-no-cache-parse-wrapper.md
---

# BACK-599 Remove gray-matter cache poisoning with a shared no-cache parse wrapper

gray-matter caches parse results keyed by the input string and returns the same data object, so a caller that mutates its result poisons every later parse of identical content, and a malformed document only throws on the first parse (later parses silently degrade to empty frontmatter). This task introduced a single shared no-cache wrapper and migrated every direct gray-matter call site so the whole defect class is eliminated.

## Summary

- New `src/markdown/frontmatter.ts` is the only module importing gray-matter: `parseFrontmatter(content)` calls `matter(content, {})` and `stringifyFrontmatter(content, data)` calls `matter.stringify(content, data, {})`, so the module-level cache is never read or written and serialization stays byte-identical.
- Migrated call sites: `src/markdown/parser.ts` `parseMarkdown` (dropping its local options-object workaround), all `matter.stringify` calls in `src/markdown/serializer.ts` (serializeTask/Decision/Document/Milestone), config list values and DoD parsing in `src/file-system/operations.ts`, the dynamic gray-matter import in `src/core/backlog.ts` `updateDecisionFromContent` (now a static wrapper import), and `src/commands/wiki-install.ts` `parseSkillMeta`.
- `parseAssigneeConfigValue` deliberately keeps `Bun.YAML.parse`.
- Regression tests in `src/test/markdown.test.ts` prove the former poisoning scenario (mutate a returned result, re-parse identical content, assert pristine results) and fail when the helper is temporarily reverted to a bare `matter()` call.
- Stale test comments advising fixtures to dodge the parse cache were refreshed (`src/test/content-identity.test.ts`).

## Acceptance Criteria

- `src/markdown/frontmatter.ts` is the only gray-matter import site; the parse cache is never read or written; serialization output byte-identical.
- Every direct call site (parser, serializer, operations config/DoD, core dynamic import, wiki-install) migrated to the wrapper.
- Regression tests prove the cache-poisoning scenario now parses correctly.

## Related Concepts

- [[concepts/markdown-pipeline]] — Central frontmatter parse/stringify wrapper that the whole markdown pipeline now routes through.
- [[concepts/core-architecture]] — Elimination of a shared-library cache as a cross-module correctness hazard.

## Related Sources

- [[sources/back-596-fail-closed-document-decision-identity]] — First fixed the same gray-matter cache poisoning locally in parser.ts before this task generalized it into a shared wrapper.
