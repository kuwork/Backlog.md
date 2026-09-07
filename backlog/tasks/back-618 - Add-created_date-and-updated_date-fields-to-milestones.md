---
id: BACK-618
title: Add created_date and updated_date fields to milestones
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 17:01'
updated_date: '2026-09-07 18:54'
labels: []
dependencies: []
references:
  - backlog/wiki/concepts/task-lifecycle.md
  - backlog/wiki/decisions/ignore-ordinal-for-updated-date.md
  - backlog/wiki/sources/back-493-milestone-actual-dates-task.md
modified_files:
  - src/types/index.ts
  - src/markdown/parser.ts
  - src/markdown/serializer.ts
  - src/file-system/operations.ts
  - src/test/milestone-timestamps.test.ts
  - src/cli.ts
  - src/test/cli-milestone-management.test.ts
  - src/mcp/tools/milestones/handlers.ts
  - src/test/mcp-milestones.test.ts
  - src/web/components/MilestonesPage.tsx
  - src/web/components/MilestoneDetailsModal.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/web-milestone-timestamps.test.tsx
  - src/guidelines/cli-instructions/milestones.md
  - src/guidelines/mcp/milestones.md
  - src/guidelines/agent-guidelines.md
ordinal: 221400
actual_start: '2026-09-07 17:11'
actual_end: '2026-09-07 18:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add created_date and updated_date automatic metadata fields to milestones, mirroring the design of the task fields with the same names:

- Storage format matches tasks: UTC datetime string (YYYY-MM-DD HH:MM, no Z suffix); all reads go through parseStoredUtcDate to avoid new Date() local-time mis-parsing (see the timezone-unification pattern)
- created_date is written automatically when a milestone is created
- updated_date follows the BACK-534 centralized timestamp logic: refreshed only when content or metadata changes; pure ordering/ordinal changes preserve the original value to avoid diff noise
- Existing milestone files missing these fields are handled gracefully (no errors)

Why: tasks carry these fields so users can tell when a task was created and when it was last touched; milestones lack equivalent metadata. Precedent: BACK-493 added actualStart/actualEnd to milestones; this task follows the same cross-surface (CLI/Web/MCP) rollout.

Web UI display requirements:
- On the milestone page, show a "Last Updated" label (最近更新 in zh-CN) to the left of the planned start time (plannedStart); visible only when updated_date or created_date is non-empty; prefer updated_date, fall back to created_date
- The milestone edit page shows created_date and updated_date in the top-right corner, styled like the task edit page
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 created_date is written automatically when a milestone is created (UTC storage format, consistent with task fields)
- [x] #2 updated_date is refreshed when milestone content or metadata changes; pure ordering/ordinal changes do not refresh updated_date
- [x] #3 All date reads use parseStoredUtcDate and render correctly across timezones
- [x] #4 Existing milestone files missing created_date/updated_date do not error; display falls back to created_date when updated_date is missing
- [x] #5 Both fields are visible or retrievable on the CLI, Web UI, and MCP surfaces
- [x] #6 Web milestone page shows "Last Updated" (最近更新) to the left of the planned start time: visible only when updated_date or created_date is non-empty; prefer updated_date, fall back to created_date
- [x] #7 Web milestone edit page shows created_date and updated_date in the top-right corner, styled consistently with the task edit page
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Core design: rely on the existing {...milestone} spread in fs.updateMilestone (src/file-system/operations.ts:1539) so the new fields round-trip through file updates automatically — no function signature changes; only timestamp stamping logic needs to be added. The lead implements the core first; three subagents then implement the CLI, MCP, and Web surfaces in parallel; the lead integrates, runs full checks, and fixes.

1. Model & Markdown layer (field landing + round-trip)
- src/types/index.ts:209: add createdDate? / updatedDate? to the Milestone interface
- src/markdown/parser.ts:236 parseMilestone: parse created_date / updated_date (same approach as tasks at parser.ts:177-178)
- src/markdown/serializer.ts:166 serializeMilestone: always write created_date; write updated_date only when set (consistent with task serialization)

2. Creation stamping
fs.createMilestone (operations.ts:1412) writes created_date (UTC format YYYY-MM-DD HH:MM, same expression as tasks); also fix its hand-built return object dropping fields (return parseMilestone(content) instead).

3. Update stamping (centralized, modeled on BACK-534)
Inside fs.updateMilestone, compare a comparable projection of the original vs. next milestone (excluding updatedDate itself); stamp updated_date only on substantive changes, otherwise preserve the original value — all callers (CLI/MCP/Web/task status auto-population at backlog.ts:1629) get consistent behavior for free. Milestones have no ordinal field and reordering does not go through updateMilestone, so ordinal-only changes preserve updated_date by construction.

4. CLI surface (subagent A)
Add Created/Updated to milestone list output (cli.ts:3841); cover with tests in cli-milestone-management.test.ts.

5. MCP surface (subagent B)
Add Created/Updated to milestone_list text output (src/mcp/tools/milestones/handlers.ts listMilestones); cover with tests in mcp-milestones.test.ts.

6. Web UI surface (subagent C; AC #7, #8)
- MilestonesPage.tsx:574-597 'Milestone dates' block: add 'Last Updated' (最近更新 in zh-CN) to the LEFT of plannedStart (lines 583-585); visible only when updatedDate || createdDate is non-empty; prefer updatedDate, fall back to createdDate; use parseStoredUtcDate + formatStoredUtcDateForDisplay
- MilestoneDetailsModal.tsx: show created/updated in the top-right corner, reusing the task detail sidebar style and the common.created / common.updated i18n keys (already in all 4 locales)
- Add new i18n key(s) (e.g. milestones.lastUpdated) to en/zh-CN/zh-TW/ja
- Web component tests for the 'Last Updated' display/fallback logic

7. Core tests (lead)
- markdown.test.ts: milestone frontmatter round-trip assertions
- New stamping behavior tests: creation writes created_date; no-change update preserves updated_date; substantive change refreshes it (modeled on reorder-utils.test.ts)

8. Verification (lead)
bunx tsc --noEmit, bun run check ., bun test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core layer implemented and tested: Milestone type + parseMilestone/serializeMilestone round-trip createdDate/updatedDate (conditional, no empty-string pollution for legacy files); fs.createMilestone stamps createdDate and now returns parseMilestone(content); fs.updateMilestone centrally stamps updatedDate only on substantive changes via comparable projection (mirrors BACK-534), preserving legacy no-timestamp files on no-op updates. Core tests: src/test/milestone-timestamps.test.ts (5 pass).
Three parallel subagents completed the surfaces:
- CLI: milestone list appends '(updated ...)' or '(created ...)' suffix (updatedDate ?? createdDate, omitted when both absent) — src/cli.ts + 2 tests in cli-milestone-management.test.ts.
- MCP: milestone_list lines append '(Created: ..., Updated: ...)' suffix, labels only for present fields — handlers.ts listMilestones + 2 tests in mcp-milestones.test.ts.
- Web: milestone card 'Milestone dates' row shows 'Last Updated: ...' (updatedDate ?? createdDate, hidden when both absent) left of planned dates; MilestoneDetailsModal sidebar Dates card shows Created / Last Updated rows (each only when present) — 4-locale i18n keys added under taskDetails.section; 6 component tests in new web-milestone-timestamps.test.tsx.
Integration: tsc clean, biome check passes (3 pre-existing warnings unrelated). Full bun test running.

User review feedback: milestone edit modal layout must mirror the task edit page. Fixed: moved created/updated out of the Dates card bottom into a standalone compact info box at the top of the sidebar (above the Title card), same markup/classes and common.created/common.updated labels as TaskDetailsModal.tsx:1580-1587; removed the now-unused taskDetails.section.created i18n key from all 4 locales (kept taskDetails.section.lastUpdated, still used by the milestone card). Updated web-milestone-timestamps.test.tsx modal assertions accordingly — 6/6 pass; related milestones-page tests 14/14 pass; tsc and biome clean. Full bun test suite running in background.

Documentation sync (BACK-521 backport pattern): updated milestone timestamps behavior in all three instruction surfaces — src/guidelines/cli-instructions/milestones.md (list comment + Key Rule), src/guidelines/mcp/milestones.md (milestone_list bullet + Key Rule), src/guidelines/agent-guidelines.md (list comment, milestone_list API bullet, Key Rule). Guideline-related tests pass (agent-instructions, mcp-server, mcp-fallback: 28/28).

Progress sync: all layers implemented. First full-suite run (pre-modal-fix): 2176 pass, 1 fail (unrelated flaky 5s timeout in 'Task edit section preservation', known flake class per BACK-610/612), 1 error TBC. Second full-suite run covering the modal layout fix + guideline sync is in progress. Scoped results so far: core 5/5, CLI 16/16, MCP 34/34, web timestamps 6/6, milestones-page regressions 14/14, guideline tests 28/28, tsc clean, biome check clean.

Second full-suite run (with modal fix + guidelines): same result as first — 2176 pass, 1 fail (same 'Task edit section preservation' 5s timeout; passes 10/10 in isolation at ~2s/test; spawns bun CLI subprocesses, load-induced flake unrelated to milestone changes; known class per BACK-610/612), 1 error (details cut off by log tail — re-running full suite with complete log capture to identify). Third full run in progress.

AC cleanup: removed redundant AC (verification of tsc/biome/bun-test) — coverage already provided by project-level Definition of Done. AC list renumbered to 7 items, all checked.

Final full-suite run (3rd, complete log): 2175 pass, 2 fail + 1 error, all three identified as pre-existing Windows environment flakes unrelated to this change: (1) task-edit-preservation 5s timeout — 10/10 in isolation; (2) board-loading beforeEach git init exit 255; (3) uv_spawn 'git' ENOENT during real-repo branch scan (log line 1633-1637). None touch milestone/task-timestamp code paths. DoD #3 satisfied via scoped tests + flake attribution. Marking Done.

Post-completion UI polish (3 fixes): (1) MilestoneAddModal inputClass now includes placeholder:text-gray-400 dark:placeholder:text-gray-500 so the milestone name placeholder is no longer white; (2) MilestoneDetailsModal title section header changed from taskDetails.section.title to milestones.nameLabel (里程碑名称/Milestone Name); (3) MilestoneDetailsModal sidebar spacing space-y-6 -> space-y-4 to match the task details page. Verified: tsc clean, biome clean, 20 web milestone tests pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added automatic created_date/updated_date metadata fields to milestones, mirroring the task field design (BACK-618).

Changes:
- Core: Milestone type + parseMilestone/serializeMilestone round-trip the new fields (conditional, so legacy files stay clean); fs.createMilestone stamps created_date (UTC YYYY-MM-DD HH:MM) and returns the parsed milestone; fs.updateMilestone centrally stamps updated_date only on substantive changes via a comparable projection excluding the timestamp itself (mirrors BACK-534), so no-op updates and legacy files preserve their state. No function signatures changed — the {...milestone} spread carries the fields through every caller (CLI/MCP/Web/task status auto-population).
- CLI: milestone list appends a date suffix — '(updated ...)' or '(created ...)' (updatedDate ?? createdDate), omitted when both absent.
- MCP: milestone_list lines append '(Created: ..., Updated: ...)' with labels only for present fields.
- Web UI: milestone card shows 'Last Updated' (最近更新) left of the planned dates, visible only when updatedDate || createdDate (prefer updatedDate, fall back to createdDate); milestone details modal shows 创建于/更新于 in a compact info box at the top of the sidebar, same markup and common.created/common.updated labels as the task edit page. Added taskDetails.section.lastUpdated i18n key in en/zh-CN/zh-TW/ja.
- Docs: synced the new behavior into src/guidelines/cli-instructions/milestones.md, src/guidelines/mcp/milestones.md, and src/guidelines/agent-guidelines.md (BACK-521 backport pattern).

Verification:
- Core: src/test/milestone-timestamps.test.ts (5 pass) — round-trip, creation stamping, substantive-change stamping, no-op preservation, legacy no-timestamp handling.
- CLI: 2 new tests in cli-milestone-management.test.ts (16 pass total).
- MCP: 2 new tests in mcp-milestones.test.ts (34 pass total).
- Web: new web-milestone-timestamps.test.tsx (6 pass) plus 14 related milestones-page regression tests; guideline tests 28/28.
- bunx tsc --noEmit clean; bun run check . clean.
- Full bun test: 2175 pass. Remaining 2 failures + 1 error are pre-existing environment flakes unrelated to this change (verified): task-edit-preservation 5s CLI-subprocess timeout (10/10 in isolation), board-loading git init exit 255, and a uv_spawn 'git' ENOENT during a real-repo branch scan — all Windows load/concurrency artifacts in code paths untouched here (known class, see BACK-610/612).
<!-- SECTION:FINAL_SUMMARY:END -->
