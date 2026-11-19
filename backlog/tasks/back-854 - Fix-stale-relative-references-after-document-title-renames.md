---
id: BACK-854
title: Fix stale relative references after document title renames
status: Done
assignee:
  - '@kimi'
created_date: '2026-11-19 03:29'
updated_date: '2026-11-19 07:52'
labels:
  - cli
dependencies: []
references:
  - 'src/core/backlog.ts:3814-3851'
  - 'src/file-system/operations.ts:1639-1698'
  - 'src/web/utils/markdown-paths.ts:163-290'
  - 'src/test/core.test.ts:507-532'
documentation:
  - doc-36
modified_files:
  - src/core/backlog.ts
  - src/core/file-rename-plan.ts
  - src/file-system/operations.ts
  - src/markdown/file-rename-references.ts
  - src/markdown/frontmatter.ts
  - src/markdown/local-paths.ts
  - src/markdown/parser.ts
  - src/web/utils/markdown-paths.ts
  - src/test/file-rename-plan.test.ts
  - >-
    backlog/docs/migration/doc-4 -
    Upstream-v1.47.1-to-v1.48.0-Migration-Diff-Classification.md
  - backlog/docs/migration/doc-5 - v1.48.0-至-v1.49.3-上游任务迁移分析报告（按领域）.md
ordinal: 413004
actual_start: '2026-11-19 04:03'
actual_end: '2026-11-19 07:52'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Changing a document title already renames its file on disk, but relative links and structured path fields in local tasks, other documents, decisions, and Wiki pages retain the old path and become stale. Implement this as a bug fix: extract an independent file rename plan and integrate it with document title updates to build, apply, and roll back reference rewrites consistently. Shared slug normalization covers /documentation/:id/:title, /task/:id/:title, and /decisions/:id/:title. This change only triggers documentation routes when a document title changes; task and decision routes are covered by independent method tests for future integration. Wiki handling covers relative Markdown links and source_path in content pages while respecting maintenance boundaries: do not directly modify wiki_output, index.md, overview.md, or log.md. Do not add task or decision rename commands in this change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a document title changes its filename, update relative links resolving to the old path in local tasks including completed tasks; other documents; decisions; and Wiki content pages. Preserve link text; queries; fragments; line ranges; and page ranges
- [x] #2 Update exact old-path matches in task documentation; references; modified_files; and Wiki source_path. Leave title-less entity short links; wikilinks; external URLs; code blocks; and inline code unchanged
- [x] #3 Keep the file rename plan independent from document title updates. Describe the primary change with old and new project-relative paths and emit reference changes for reuse by future task and decision renames
- [x] #4 Do not write other files when the path is unchanged or no references match. Target conflicts or apply failures must not leave partial reference updates. Never directly modify wiki_output; Wiki index.md; overview.md; or log.md
- [x] #5 Cover active and completed tasks; documents; decisions; Wiki content pages; source_path; spaces and non-ASCII filenames; angle-bracket links; range suffixes; missing references; maintenance-file exclusion; and end-to-end document updates. Pass relevant type; formatting; and test checks
- [x] #6 Treat a missing Wiki directory or one without Markdown content pages as an empty reference set without errors or directory creation. Continue renaming documents and repairing references for other entities. Report other read errors explicitly
- [x] #7 Allow tasks; documents; decisions; and Wiki pages at different depths to reference the same old file through different relative paths. Resolve each file independently and generate its new relative path. Do not rewrite identical text that resolves to another target from a different directory
- [x] #8 Support shared slug normalization for /documentation/:id/:title; /task/:id/:title; and /decisions/:id/:title. Update the title segment only when the ID identifies the source entity and the segment matches the old sanitizeUrlTitle. Preserve the ID; link text; query; fragment; and line range. Leave title-less short links and other IDs unchanged. Document updates trigger only documentation routes in this change; task and decision routes are covered by independent method tests
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract shared Markdown path rewriting that reuses target splitting, project-root boundaries, and protected-code rules. Resolve old targets from each referencing file and rewrite only links that resolve to the old project-relative path. Preserve relative style, angle brackets, queries, fragments, and range suffixes.
2. Add an independent FileRenamePlan builder. Accept old and new project-relative paths, optional entity title route information, primary file content, and candidate local tasks including completed tasks, documents, decisions, and Wiki files. Emit before/after content for the primary file and actual reference changes. Update task structured fields and Wiki source_path only on exact path matches. Perform no disk writes while building the plan.
3. Respect Wiki maintenance boundaries by never directly modifying wiki_output, index.md, overview.md, or log.md. Do not rewrite wikilinks as file paths. Return an empty candidate set when the Wiki directory is missing or contains only maintenance files. Do not create the directory and report other read errors explicitly.
4. Resolve Markdown body links from the dirname of each referencing file's project-relative path and compute each new relative address independently. Do not rewrite identical text that resolves to another target from a different directory. Keep project-root-relative semantics for structured fields.
5. Support shared entity slug normalization for /documentation/:id/:title, /task/:id/:title, and /decisions/:id/:title. Reuse sanitizeUrlTitle and entity ID equivalence rules. Replace the title segment only when the ID identifies the source entity and the segment matches the old title. Preserve the original ID spelling, link text, and suffixes. Keep the decorative routing semantics established by BACK-511.
6. Provide a unified plan application boundary with target and input-content preflight checks, staged writes, backups, same-directory hard-link installation, and rollback on failure. Prevent partially applied primary and reference changes. Keep unchanged paths and plans without reference changes as no-ops.
7. Integrate updateDocumentFromInput with the plan only when the actual document path changes and trigger only documentation routes. Preserve existing document body and metadata semantics. Let existing file watchers detect related-file changes and include the primary rename and every changed reference in auto-commit. Do not add task rename or decision rename commands in this change.
8. Add pure-function and Core end-to-end tests for active and completed tasks, documents, decisions, Wiki content pages and source_path, different relative paths, spaces and non-ASCII text, angle brackets, range suffixes, all three slug types, false-match prevention, code protection, missing Wiki directories, maintenance-file exclusion, missing references, target conflicts, and concurrent preflight checks. Run relevant tests, bunx tsc --noEmit, and Biome checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation completed:
- Promoted the Web Markdown local-path pure functions to src/markdown/local-paths.ts and kept compatibility re-exports in the original Web module.
- Added a reusable FileRenamePlan that resolves relative paths per referencing file and updates task structured fields, Wiki source_path, and matching slugs for all three entity types.
- Added target and content preflight checks, staged writes, backups, hard-link installation, and rollback to plan application. A missing Wiki is treated as an empty candidate set.
- Integrated updateDocumentFromInput only when the docs-relative target path actually changes. Convert explicitly between docs-relative and project-root-relative paths and include reference files in auto-commit.
- Provided shared pure functions and tests for task and decision slugs without connecting their title-update entry points in this change.

Validation:
- bun test src/test/file-rename-plan.test.ts src/test/markdown-paths.test.ts --timeout 30000: 48 pass, 0 fail, 129 assertions.
- bun test src/test/core.test.ts --timeout 30000 --test-name-pattern "document operations": 5 pass, 0 fail.
- bunx tsc --noEmit: passed.
- bun run check .: exit code 0 with only pre-existing graph/duckdb warnings.
- The full Core run was affected by local Git subprocess ENOENT errors and 30-second test timeouts, so it is not recorded as passing. The relevant document tests and new regressions passed independently.

Additional compatibility fix validated with a real migration analysis document:
- The root cause was that reference rewriting called parseFrontmatter directly and bypassed parseMarkdown compatibility for unquoted assignee/reporter values. The unquoted @MrLesk value in completed/BACK-1 triggered YAMLException. Failure occurred while building the plan and the target document was not written.
- Consolidated legacy handle normalization in the shared parseFrontmatter entry point and reused it from parseMarkdown. Other malformed YAML still fails explicitly as before.
- Added a regression for reference rewriting in a completed task with unquoted @MrLesk. Changed end-to-end tests to filesystemOnly initialization to remove unrelated cross-branch Git dependencies.
- Final validation: 108 pass, 0 fail, and 335 assertions across four related test files; 5 document Core tests passed; TypeScript and full Biome checks passed.
- Verified with a real migration analysis document: changing its title to the migration analysis report covering v1.48.0 through v1.49.3 by domain renamed the disk file. Existing old relative links in migration classification content retained their line-range suffixes and pointed to the new file.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed stale references in local tasks, other documents, decisions, and Wiki pages after document title or path changes rename the underlying file. Added compatibility for unquoted assignee/reporter values in legacy tasks.

Changes:
- Added an independent reusable FileRenamePlan with an atomic application boundary.
- Rewrote relative Markdown paths per referencing file and synchronized task structured fields, Wiki source_path, and matching documentation slugs.
- Added shared slug-normalization pure functions for documentation, task, and decisions routes. This change triggers only documentation routes from document updates.
- Extracted the shared Markdown path module while retaining Web compatibility re-exports.
- Consolidated legacy @handle frontmatter compatibility in the shared parser so historical tasks cannot block renames.
- Included the primary rename and every changed reference in auto-commit.

Verification:
- Related tests: 108 pass, 0 fail, 335 assertions.
- Document Core tests: 5 pass, 0 fail.
- TypeScript and full Biome checks passed.
- A real migration analysis document title update succeeded and stale relative links in existing migration classification content were repaired.
<!-- SECTION:FINAL_SUMMARY:END -->
