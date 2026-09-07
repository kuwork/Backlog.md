---
id: BACK-619
title: Add documentation field support to milestones (--doc/--add-doc/--clear-docs)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 19:04'
updated_date: '2026-09-07 21:02'
labels:
  - api
  - cli
  - mcp
  - milestones
  - web-ui
dependencies: []
references:
  - src/guidelines/cli-instructions/task-execution.md
  - backlog/wiki/sources/back-521.7.md
  - >-
    backlog/tasks/back-618 -
    Add-created_date-and-updated_date-fields-to-milestones.md
ordinal: 222400
actual_start: '2026-09-07 19:05'
actual_end: '2026-09-07 20:47'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a documentation field to milestones, mirroring the task field of the same name, with CLI, MCP, and Web UI support, plus guide updates.

Core (model + markdown + file system):
- Milestone type gains documentation?: string[] (frontmatter key: documentation), parsed by parseMilestone and written by serializeMilestone, following the task field conventions (list of project-root-relative paths or URLs)
- fs.createMilestone accepts initial documentation; fs.updateMilestone supports set/add/remove/clear semantics. Avoid extending the fragile positional-arg signature — use the BACK-618 lesson: fields round-trip through the {...milestone} spread, so prefer an options object or dedicated params that the comparable projection already treats as substantive changes (doc changes must refresh updated_date)
- Empty values for --doc are rejected on creation, mirroring task behavior

CLI:
- milestone add gains --doc (repeatable)
- milestone edit gains --doc (replace), --add-doc (repeatable), --remove-doc (repeatable, comma-separated), --clear-docs — same semantics and mutual-exclusion rules as task edit

MCP (parity per BACK-521.7):
- milestone_add accepts documentation; milestone_edit accepts documentation/addDocumentation/removeDocumentation, mirroring task_edit conventions

Web UI:
- MilestoneAddModal: documentation input (add/remove chips, same interaction pattern as the task references editor)
- MilestoneDetailsModal: documentation section — visible in preview mode as a link list, editable (add/remove) in edit mode
- i18n keys in en/zh-CN/zh-TW/ja; web server API passes documentation through (handleCreateMilestone must forward it)

Docs:
- src/guidelines/cli-instructions/milestones.md and src/guidelines/mcp/milestones.md: document the new options; sync src/guidelines/agent-guidelines.md (BACK-521 backport pattern)
- Fix the gap in src/guidelines/cli-instructions/task-creation.md: it only shows --doc in an example but never explains the documentation option family — add the missing --add-doc/--clear-docs (and --remove-doc) explanation, matching how task-execution.md documents them for edit

Why: milestones currently cannot link to design docs or specs; tasks have had this since early versions. Guide gap: agents reading the task-creation guide cannot discover --add-doc/--clear-docs exist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestone files round-trip a documentation list through parse/serialize, and doc changes refresh updated_date via the existing substantive-change detection
- [x] #2 milestone add accepts repeatable --doc; empty values are rejected like task create
- [x] #3 milestone edit supports --doc (replace), --add-doc, --remove-doc, and --clear-docs with the same semantics and mutual-exclusion rules as task edit
- [x] #4 MCP milestone_add/milestone_edit expose documentation/addDocumentation/removeDocumentation consistent with task_edit
- [x] #5 cli-instructions/milestones.md, mcp/milestones.md, and agent-guidelines.md document the new milestone documentation options
- [x] #6 cli-instructions/task-creation.md gains the missing --add-doc/--clear-docs/--remove-doc explanation for task documentation management
- [x] #7 Web UI: add modal and details modal display and edit milestone documentation (chips add/remove pattern mirroring the task references editor), with i18n in all 4 locales and the web server API forwarding documentation
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Key architecture fact: CLI milestone add/edit delegate to MilestoneHandlers (shared with MCP and the web server), so implementing doc resolution once in the handlers layer covers CLI + MCP + Web API simultaneously.

1. Model & Markdown layer
- src/types/index.ts: Milestone gains documentation?: string[]
- parseMilestone/serializeMilestone: handle the documentation list exactly like tasks (frontmatter key documentation, omit when empty)
- The field rides the {...milestone} spread, so BACK-618's comparable projection automatically treats doc changes as substantive -> updated_date refreshes for free

2. fs/Core signature refactor (options object, per AC)
- fs.updateMilestone(identifier, title, options): { dueDate?, plannedStart?, plannedEnd?, description?, actualStart?, actualEnd?, documentation? } — undefined = leave unchanged, [] = clear; keep the '' = clear convention for dates
- fs.createMilestone(title, options): { description?, dueDate?, plannedStart?, plannedEnd?, actualStart?, actualEnd?, documentation? }
- Update all call sites: Core.updateMilestone wrapper, task-status auto-population (backlog.ts:1629), handlers editMilestone + 2 rollback sites, web server handleCreateMilestone/handleUpdateMilestone, affected tests

3. Handlers layer (CLI + MCP + Web API)
- MilestoneEditArgs += documentation/addDocumentation/removeDocumentation; a local resolver applies set/add/remove semantics identical to Core.updateTask's resolveDocumentation
- MilestoneAddArgs += documentation; no-op detection gains isDocumentationChanged
- MCP schemas (milestones/schemas.ts): add the three fields to milestone_add/milestone_edit mirroring task_edit descriptions

4. CLI (cli.ts)
- milestone add --doc (repeatable); empty value rejected via the existing validateClearableListInput helper
- milestone edit --doc/--add-doc/--remove-doc/--clear-docs with the same mutual-exclusion and empty-value validation style as task edit; --clear-docs maps to documentation: []

5. Web UI
- MilestoneAddModal: documentation chips input (add/remove pattern mirroring the task references editor)
- MilestoneDetailsModal: documentation section — link list in preview mode, editable add/remove in edit mode
- Web server: handleCreateMilestone forwards documentation; update flows already go through handlers
- i18n keys in en/zh-CN/zh-TW/ja; web component tests

6. Guides (BACK-521 backport pattern)
- cli-instructions/milestones.md + mcp/milestones.md: document new options; sync agent-guidelines.md
- Fix cli-instructions/task-creation.md: add the missing documentation option family explanation (--doc replace / --add-doc append / --remove-doc remove-by-value / --clear-docs clear, managed via task edit)

7. Tests
- CLI: milestone add --doc, edit set/add/remove/clear, empty-value rejection (cli-milestone-management.test.ts)
- MCP: milestone_add/edit documentation parity (mcp-milestones.test.ts)
- Round-trip: documentation in milestone markdown parse/serialize + updated_date refresh on doc change (milestone-timestamps.test.ts)
- Web component tests for the new documentation UI

8. Verification
bunx tsc --noEmit, bun run check ., scoped bun test, then full bun test

5b. Web UI detail (per BACK-479 reference): reuse the existing PathAutocomplete component and mirror TaskDetailsModal.tsx:1292-1360 (documentation section markup + interaction). MilestoneDetailsModal: Documentation section below Description — item list with per-item remove in preview/edit, add input with PathAutocomplete in edit mode. MilestoneAddModal: documentation add/remove chips input using PathAutocomplete. i18n keys in en/zh-CN/zh-TW/ja; web server handleCreateMilestone forwards documentation; update flows already route through handlers. Web component tests cover add/remove/display.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan refinement from user guidance: Web UI must mirror the task interface. Researched BACK-479 (Web UI: full documentation editing with path autocomplete) — its implementation in TaskDetailsModal.tsx:1292-1360 is the reference: reusable PathAutocomplete component (src/web/components/PathAutocomplete.tsx), documentation section with remove-per-item in view mode and PathAutocomplete add input. Milestone UI will reuse PathAutocomplete and mirror this section's markup/behavior; MilestoneAddModal gets a chips-style add/remove input with the same autocomplete.

UI corrections after review: (1) details modal documentation add-input is now visible in preview mode too, matching the task details page parity; (2) create modal documentation section migrated to the exact details-page card layout (bordered card, SectionHeader, URL links / mono chips, hover remove, empty placeholder, PathAutocomplete add row); (3) fixed invalid nested form in MilestoneAddModal (inner doc form closed the outer create form early in HTML parsing) - add row is now a div with a type=button add action. Added tests: view-mode add (web), documentation round-trip + updated_date refresh (milestone-timestamps).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added documentation field support to milestones across core, CLI, MCP, and Web UI, mirroring the task field of the same name.

Changes:
- Core: Milestone gains documentation?: string[]; parseMilestone/serializeMilestone round-trip it (omitted when empty); fs.createMilestone/fs.updateMilestone refactored to options objects (MilestoneCreateOptions/MilestoneUpdateOptions); doc changes count as substantive, so updated_date refreshes via the existing projection
- CLI: milestone add --doc (repeatable, empty rejected); milestone edit --doc (replace) / --add-doc / --remove-doc / --clear-docs with task-edit mutual-exclusion rules
- MCP: milestone_add accepts documentation; milestone_edit accepts documentation/addDocumentation/removeDocumentation; schemas updated
- Web UI: MilestoneDetailsModal documentation card below description (link list, per-item remove, PathAutocomplete add input visible in both preview and edit mode, task-page parity); MilestoneAddModal uses the same card layout; apiClient + web server forward documentation for create and update; reuses existing taskDetails i18n keys (all 4 locales)
- Guides: cli-instructions/milestones.md, mcp/milestones.md, agent-guidelines.md document the new options; fixed the task-creation.md gap (--add-doc/--remove-doc/--clear-docs now explained)

Verification:
- bunx tsc --noEmit clean; bun run check clean (3 pre-existing warnings in core/assets.ts only)
- bun test: 2191 pass, 0 fail (full suite); new coverage in cli-milestone-management, mcp-milestones, milestone-timestamps, web-milestone-timestamps
<!-- SECTION:FINAL_SUMMARY:END -->
