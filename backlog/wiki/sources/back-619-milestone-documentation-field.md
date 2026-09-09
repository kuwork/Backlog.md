---
title: BACK-619 Add documentation field support to milestones (--doc/--add-doc/--clear-docs)
created_date: '2026-09-07 21:02'
updated_date: '2026-09-07 21:02'
labels:
  - source
  - milestones
  - cli
  - mcp
  - web-ui
source_path: backlog/tasks/back-619 - Add-documentation-field-support-to-milestones-doc-add-doc-clear-docs.md
---

# BACK-619 Add documentation field support to milestones (--doc/--add-doc/--clear-docs)

Milestones could not link to design docs or specs while tasks have had a documentation field since early versions. This task adds `documentation?: string[]` to milestones with CLI, MCP, and Web UI support, plus a guide gap fix (task-creation.md never explained the --add-doc/--clear-docs family). A key architecture fact shaped the implementation: CLI milestone add/edit delegate to MilestoneHandlers (shared with MCP and the web server), so doc resolution implemented once in the handlers layer covers all three surfaces simultaneously.

## Summary

- Core: `Milestone` gains `documentation?: string[]`; `parseMilestone`/`serializeMilestone` round-trip it (frontmatter key `documentation`, omitted when empty); doc changes count as substantive in BACK-618's comparable projection, so updated_date refreshes for free — the BACK-618 lesson applied: fields ride the `{...milestone}` spread instead of extending the fragile positional-arg signature
- Signature refactor: `fs.updateMilestone(identifier, title, options)` / `fs.createMilestone(title, options)` now take options objects (MilestoneCreateOptions/MilestoneUpdateOptions); all call sites updated (Core wrapper, task status auto-population, handlers + rollback sites, web server)
- Handlers: MilestoneEditArgs += documentation/addDocumentation/removeDocumentation with a local resolver applying set/add/remove semantics identical to Core.updateTask's resolveDocumentation; MCP schemas mirror task_edit descriptions
- CLI: `milestone add --doc` (repeatable, empty rejected via validateClearableListInput); `milestone edit --doc/--add-doc/--remove-doc/--clear-docs` with task-edit mutual-exclusion rules
- Web: MilestoneDetailsModal documentation card below Description (link list, per-item remove, PathAutocomplete add input visible in both preview and edit mode, task-page parity per BACK-479's TaskDetailsModal.tsx:1292-1360 reference); MilestoneAddModal uses the same card layout; fixed an invalid nested form (inner doc form closed the outer create form early in HTML parsing — add row is now a div with type=button)
- Guides: cli-instructions/milestones.md, mcp/milestones.md, agent-guidelines.md document the new options; task-creation.md gap fixed (--add-doc/--remove-doc/--clear-docs explained)
- Verification: full bun test 2191 pass / 0 fail; new coverage in cli-milestone-management, mcp-milestones, milestone-timestamps (doc round-trip + updated_date refresh), web-milestone-timestamps

## Acceptance Criteria

- Milestone files round-trip a documentation list; doc changes refresh updated_date via substantive-change detection
- milestone add accepts repeatable --doc; empty values rejected like task create
- milestone edit supports --doc/--add-doc/--remove-doc/--clear-docs with task-edit semantics and mutual exclusion
- MCP milestone_add/milestone_edit expose documentation/addDocumentation/removeDocumentation
- Guides document the new milestone options; task-creation.md gains the missing --add-doc/--clear-docs/--remove-doc explanation
- Web UI displays and edits milestone documentation with i18n in all 4 locales and API forwarding

## Related Concepts

- [[concepts/milestones]] — milestone field parity with tasks across CLI/MCP/Web
- [[concepts/mcp-workflow]] — handlers-layer sharing that gives CLI/MCP/Web API parity from one implementation

## Related Sources

- [[sources/back-618-milestone-created-updated-dates]] — immediately preceding milestone field task whose spread/projection architecture this reuses
