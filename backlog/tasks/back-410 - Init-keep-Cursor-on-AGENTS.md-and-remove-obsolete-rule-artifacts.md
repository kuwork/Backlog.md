---
id: BACK-410
title: 'Init: keep Cursor on AGENTS.md and remove obsolete rule artifacts'
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-03-25 18:13'
updated_date: '2026-08-16 20:47'
labels:
  - cli
  - init
  - agents
  - cursor
dependencies: []
references:
  - src/agent-instructions.ts
  - src/guidelines/index.ts
  - src/cli.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/cli-init-cursor.test.ts
  - src/test/web-initialization-cursor.test.tsx
modified_files:
  - src/agent-instructions.ts
  - src/guidelines/index.ts
  - src/cli.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/cli-init-cursor.test.ts
  - src/test/web-initialization-cursor.test.tsx
actual_end: '2026-08-16 20:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep Cursor mapped to the shared AGENTS.md init target and remove the obsolete Backlog-owned Cursor rule artifacts: the .cursorrules special-casing in the guideline marker helpers, the unused CURSOR_GUIDELINES export, and the stale 'alias of agents' CLI copy. Preserve existing AGENTS.md content and user-managed .cursor/rules, keep repeated init idempotent, and leave the fork's checkbox-based Web init unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream BACK-410 follow-up via git show b421d75 / d7202e7 and confirm the fork conflict surface (agent-instructions.ts marker helpers, guidelines/index.ts export, cli.ts copy, Web init copy).
- [x] #2 Remove the .cursorrules special-casing and fileName threading from getMarkers/hasBacklogGuidelines/wrapWithMarkers/stripGuidelineSection so all guideline blocks use HTML-comment markers.
- [x] #3 Remove the unused CURSOR_GUIDELINES export from src/guidelines/index.ts.
- [x] #4 Update cli.ts --agent-instructions option description and help copy to state that cursor writes AGENTS.md.
- [x] #5 Sync the Web init AGENTS.md option description (agentsMdDesc) in all four locale files to name Cursor as an AGENTS.md user.
- [x] #6 Cursor selection never creates .cursorrules or other Backlog-owned Cursor rule files; existing AGENTS.md content is preserved and repeated init keeps a single marker block.
- [x] #7 Focused tests cover cursor CLI init (AGENTS.md with HTML markers, no .cursorrules, preserved user content, repeated-init idempotency) and the localized Web init Cursor copy; bunx tsc --noEmit and biome pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove only dead Backlog-owned Cursor-specific guideline exports and marker branches; leave user Cursor rule paths untouched.
2. Keep the existing cursor-to-AGENTS.md mappings across CLI and Web init, and document the shared target plus coexistence with user-managed Cursor rules.
3. Add real CLI, PTY, idempotency, combined-selection, and Web selector coverage, then run focused and repository-wide verification before finalizing the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fork-adapted cleanup of upstream BACK-410 follow-up (upstream merge b421d75, PR #799, final d7202e7).

Changes:
- src/agent-instructions.ts: removed the obsolete .cursorrules special-casing and the fileName threading from the guideline marker helpers (getMarkers, hasBacklogGuidelines, wrapWithMarkers, stripGuidelineSection). All guideline blocks now use HTML-comment markers; Backlog-owned Cursor rule files are never created.
- src/guidelines/index.ts: removed the unused CURSOR_GUIDELINES export.
- src/cli.ts: --agent-instructions option description and help text now read 'cursor (writes AGENTS.md)' instead of 'cursor (alias of agents)'.
- src/web/locales/{en,ja,zh-CN,zh-TW}.ts: agentsMdDesc now names Cursor as an AGENTS.md user (upstream changed the hardcoded English description; fork copy lives in the locale files).

Fork adaptations:
- Web InitializationScreen structure untouched (checkbox list with i18n copy; upstream changed its hardcoded English description, which does not exist in fork - the locale value was updated instead).
- Upstream's three new tests (cli-init-create, cli-init-cursor-pty, web-initialization-cursor) not ported verbatim; added fork-style coverage: src/test/cli-init-cursor.test.ts (end-to-end) and src/test/web-initialization-cursor.test.tsx (locale contract + SSR smoke).
- Fork has no versionMarkerLine in wrapWithMarkers (no version metadata in markers); only the .cursorrules branch was removed, nothing else restructured.

Verification: bunx tsc --noEmit pass; biome pass; cli-init-cursor 2 pass; web-initialization-cursor 2 pass; cli.test.ts/enhanced-init/cli-init-claude-default regression pass (118 pass; 2 pre-existing failures in cli.test.ts unrelated - plain-limit grouping and doc update Path, verified via git stash).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cursor stays a first-class init choice mapped to the shared AGENTS.md target. Removed the obsolete Backlog-owned Cursor artifacts: the .cursorrules special-casing in the guideline marker helpers and the unused CURSOR_GUIDELINES export; CLI help and the Web init AGENTS.md description now state that Cursor writes/uses AGENTS.md. Existing AGENTS.md content and user-managed Cursor rules remain untouched.

Verified by new end-to-end cursor init tests, Web init copy tests, typecheck, and lint.
<!-- SECTION:FINAL_SUMMARY:END -->
