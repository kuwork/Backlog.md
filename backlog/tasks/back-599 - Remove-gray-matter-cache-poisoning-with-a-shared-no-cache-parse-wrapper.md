---
id: BACK-599
title: Remove gray-matter cache poisoning with a shared no-cache parse wrapper
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-08 15:56'
updated_date: '2026-08-26 07:27'
labels: []
dependencies: []
modified_files:
  - src/markdown/frontmatter.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/file-system/operations.ts
  - src/core/backlog.ts
  - src/commands/wiki-install.ts
  - src/test/markdown.test.ts
  - src/test/content-identity.test.ts
priority: medium
actual_start: '2026-08-26 06:39'
actual_end: '2026-08-26 07:27'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
gray-matter caches parse results keyed by the input string and hands back the same data object: a caller that mutates its result poisons every later parse of identical content, and a malformed document only throws on the first parse so later parses look like empty frontmatter. The codebase still has multiple direct gray-matter call sites (including a dynamic import inside core and the fork-specific wiki-install command). Introduce one shared no-cache frontmatter parse helper and migrate every call site to it so the whole defect class is gone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-608 and git show 7d4e96b as implementation reference.
- [x] #2 src/markdown/frontmatter.ts is the only module importing gray-matter; parseFrontmatter passes an options object so the gray-matter parse cache is never read or written, and stringifyFrontmatter keeps serialization output byte-identical.
- [x] #3 Every direct gray-matter call site is migrated to the shared helper: src/markdown/parser.ts parseMarkdown, all matter.stringify calls in src/markdown/serializer.ts, config/DoD parsing in src/file-system/operations.ts, the dynamic import in src/core/backlog.ts updateDecisionFromContent (converted to static import of the wrapper), and src/commands/wiki-install.ts.
- [x] #4 Regression tests in src/test/markdown.test.ts prove the former cache-poisoning scenario now parses correctly (mutate a returned result, re-parse identical content, assert pristine results); stale test comments telling readers fixtures must dodge the parse cache are refreshed.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - Shared no-cache wrapper

- 1.1 Add src/markdown/frontmatter.ts as the only module that imports gray-matter
- 1.2 parseFrontmatter(content) calls matter(content, {}) and returns { data, content }
- 1.3 stringifyFrontmatter(content, data) calls matter.stringify(content, data, {}) so serialization output stays byte-identical

### Phase 2 - Migrate all call sites

- 2.1 src/markdown/parser.ts: parseMarkdown goes through parseFrontmatter
- 2.2 src/markdown/serializer.ts: every matter.stringify goes through stringifyFrontmatter
- 2.3 src/file-system/operations.ts: config list and DoD parsing go through the wrapper (parseAssigneeConfigValue keeps Bun.YAML.parse)
- 2.4 src/core/backlog.ts: updateDecisionFromContent drops its dynamic gray-matter import in favor of a static import of the wrapper
- 2.5 src/commands/wiki-install.ts: skill frontmatter reads go through the wrapper

### Phase 3 - Regression tests and cleanup

- 3.1 Add regression tests in src/test/markdown.test.ts: mutate returned data/content, re-parse identical content, assert pristine results at helper and parseMarkdown/parseTask level; verify they fail against a bare matter() call, then restore
- 3.2 Refresh stale test comments telling readers fixtures must have distinct bodies to dodge the parse cache (src/test/content-identity.test.ts, src/test/cli-doctor.test.ts)
- 3.3 bunx tsc --noEmit, bun run check ., targeted tests then full suite
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### What changed

- Added src/markdown/frontmatter.ts as the only module importing gray-matter: parseFrontmatter passes an options object so the module-level parse cache is never read or written; stringifyFrontmatter does the same for matter.stringify.
- Migrated every direct call site: parser.ts parseMarkdown (dropping its local options-object workaround), serializer.ts serializeTask/Decision/Document/Milestone, operations.ts config list values plus DoD parsing plus wiki page save/create stringify, core backlog.ts updateDecisionFromContent (dynamic import replaced with static wrapper import), commands wiki-install.ts parseSkillMeta.
- parseAssigneeConfigValue keeps Bun.YAML.parse by design; content-identity.test.ts lost its stale cache comment (cli-doctor.test.ts has no such comment in this tree).

### Verification

- grep confirms src/markdown/frontmatter.ts is the only gray-matter import site; bunx tsc --noEmit clean; biome check clean on all touched files.
- New regression tests in markdown.test.ts fail when the helper is temporarily reverted to a bare matter(content) call and pass once restored.
- Targeted suites green: markdown, content-identity, wiki-install, definition-of-done, core-autocommit-scope, cli-doctor (92 pass).
- Full suite failures were reproduced identically on a stashed baseline without these changes, so they are pre-existing on this working tree and unrelated to frontmatter parsing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All frontmatter parsing now goes through one no-cache wrapper, src/markdown/frontmatter.ts: parseFrontmatter and stringifyFrontmatter pass an options object so gray-matter's module-level result cache is never read or written, eliminating the mutation-poisoning and malformed-first-parse-only defect class. Every former direct call site (parser, serializer, operations config/DoD/wiki writes, core decision update dynamic import, wiki-install skill meta) routes through the wrapper with byte-identical serialization output. New cache-poisoning regression tests fail against a bare matter() call; typecheck, lint, and related suites pass.
<!-- SECTION:FINAL_SUMMARY:END -->
