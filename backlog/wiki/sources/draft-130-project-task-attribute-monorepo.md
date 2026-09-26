---
title: draft-130 Add a project task attribute for monorepo backlogs
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - cli
  - mcp
  - tui
  - web-ui
  - monorepo
source_path: backlog/drafts/draft-130 - Add-a-project-task-attribute-for-monorepo-backlogs.md
---

# draft-130 Add a project task attribute for monorepo backlogs

Upstream BACK-643 (doc-12 CORE-12) imported as a draft: a validated, single-valued `project` task attribute (frontmatter `project:`, CLI `--project`, config `projects:` list) so monorepo teams can distinguish packages without splitting backlogs or abusing labels. Follows the BACK-355 task-type six-slice rollout precedent; all ACs checked upstream, fork migration pending (58-file change surface).

## Summary

- Fail-closed by design: with no `projects:` configured, `--project` errors with a clear message and the field is invisible on every surface (no badge, filter, or MCP enum) — unlike `type`, projects has no sensible default
- Six-slice rollout mirroring BACK-355: core/persistence, CLI, MCP, filtering, TUI, web — with scope corrected four times against verified source evidence (e.g. no `--project` on `draft create`; GET /api/tasks gets no project param because task-type has zero HTTP filtering there)
- Maintainer takeover review fixes: web modal only sends `project` from the create form (edit-mode save previously re-sent an unrendered value, clearing it or failing the save); TUI project filter picker moved off g/G to avoid scroll-shortcut collision; `config get projects` prints the joined list like sibling keys
- Clear semantics follow `type` (empty string clears, stamps `updated_date`), not `priority`; filtering is multi-value OR, matching `--type`
- Explicit non-goals: no changes to project-root resolution, ID allocation/prefixing, or `backlog/` directory layout
- Verified upstream with full suite (2400 tests) plus manual smoke tests in two scratch repos covering unconfigured fail-closed behavior end-to-end

## Acceptance Criteria

- `project:` frontmatter validated against config `projects:`; unconfigured or invalid values rejected with the valid-values list
- With no projects configured the flag fails closed and all project UI is invisible everywhere
- `task list`, `search`, and MCP `task_list` filter by project with multi-value OR semantics
- TUI board/list and Web board/cards/detail show project badge and filter only when configured (TaskList.tsx/DraftsList.tsx intentionally excluded, matching type's real footprint)
- No changes to project-root resolution, ID allocation, or directory layout

## Related Concepts

- [[concepts/cli-instructions]] — CLI/MCP guideline surfaces documenting the new field
- [[concepts/json-output]] — compact JSON envelope gained a `project: null` field (test contract update)
- [[concepts/upstream-migration]] — imported as DRAFT#130 (doc-12 CORE-12), the largest standalone item in wave six

## Related Sources

- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — CORE-12 entry; fork task-number collision noted (fork BACK-642/643 are different migrations)
- [[sources/back-585-multi-assignee-parity-task-create]] — precedent for cross-surface field parity work
