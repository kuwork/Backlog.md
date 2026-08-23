---
id: BACK-581
title: Add defaultAssignee editing to web settings
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-23 13:33'
updated_date: '2026-08-23 13:43'
labels: []
dependencies:
  - BACK-579
references:
  - src/web/components/Settings.tsx
  - src/web/lib/api.ts
  - ADVANCED-CONFIG.md
documentation:
  - backlog/docs/doc-000 - Backlog.md-Usage-Guide.md
modified_files:
  - src/web/components/Settings.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/server-config-endpoint.test.ts
ordinal: 197400
actual_start: '2026-08-23 13:33'
actual_end: '2026-08-23 13:36'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an editing entry for the defaultAssignee configuration in the web UI Settings page. This depends on BACK-579 which made defaultAssignee a string list and wired it through the core/config layers. The web UI currently exposes defaultStatus, defaultEditor, and other config fields, but does not allow editing defaultAssignee. The new entry should let users view and edit the list of default assignees, save via the existing updateConfig API, and apply the same semantics as the CLI (empty clears, list replaces the default on create).

Polish follow-up (merged from BACK-582): use the ChipInput component already used by TaskDetailsModal for assignees, and rename Chinese labels from '经办人'/'經辦人' to '负责人'/'負責人' for consistency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings page displays a defaultAssignee input/control populated from fetchConfig
- [x] #2 Users can add, remove, and reorder default assignees in the web UI
- [x] #3 Saving updates config via updateConfig and persists as a YAML list
- [x] #4 Empty list clears the default, matching CLI semantics
- [x] #5 Tests cover the Settings change and/or API config round-trip
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect Settings.tsx and api.ts to confirm how config is loaded/saved and where to insert the defaultAssignee editor.
2. Add a list-editing control for defaultAssignee in the Workflow Settings section, alongside defaultStatus/defaultEditor.
3. Add i18n strings for labels/descriptions in en/zh-CN/zh-TW/ja.
4. Verify with bunx tsc --noEmit, bun run check ., and relevant tests.
5. Check acceptance criteria and finalize the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added defaultAssignee list editor in Settings.tsx Workflow Settings section, normalized empty list to undefined on save.
Added i18n strings for defaultAssignee label, description, and placeholder in en/zh-CN/zh-TW/ja.
Added src/test/server-config-endpoint.test.ts covering defaultAssignee round-trip and clear semantics via PUT /api/config.
Verified bunx tsc --noEmit, bun run check (only pre-existing warnings in src/core/assets.ts), and targeted tests pass.

Merged BACK-582 polish into this task: replaced manual list inputs with ChipInput and aligned Chinese terminology to '负责人'/'負責人'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a defaultAssignee editing entry to the web UI Settings page using the shared ChipInput component (same as TaskDetailsModal assignee), with i18n strings in en/zh-CN/zh-TW/ja. Chinese labels use '负责人'/'負責人' for consistency. Added server API round-trip tests for defaultAssignee. Verified with bunx tsc --noEmit, bun run check (only pre-existing warnings), and targeted tests.
<!-- SECTION:FINAL_SUMMARY:END -->
