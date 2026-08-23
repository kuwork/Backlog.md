---
id: BACK-583
title: Add labels config editor to web settings
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-23 14:10'
updated_date: '2026-08-23 14:31'
labels: []
dependencies: []
references:
  - src/web/components/Settings.tsx
  - src/web/components/ChipInput.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/server-config-endpoint.test.ts
modified_files:
  - src/web/components/Settings.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/server-config-endpoint.test.ts
ordinal: 199400
actual_start: '2026-08-23 14:27'
actual_end: '2026-08-23 14:31'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web UI Settings page currently lets users edit defaultAssignee, defaultStatus, definitionOfDone, and other config fields, but does not expose the labels config key. The labels key in BacklogConfig is the project's recommended label group, used by the Web UI and TUI as autocomplete options when editing task labels. Add an editing entry for labels in Settings.tsx using the same ChipInput pattern already used for defaultAssignee and TaskDetailsModal labels, with i18n strings for all locales and tests covering the config round-trip.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Settings page displays a labels editor populated from config.labels
- [x] #2 Users can add and remove project recommended labels using ChipInput
- [x] #3 Saving persists labels via updateConfig and reloads correctly
- [x] #4 i18n strings added for labels label/description/placeholder in en/zh-CN/zh-TW/ja
- [x] #5 Tests cover labels config round-trip via /api/config
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect Settings.tsx and existing label editing patterns (ChipInput, TaskDetailsModal labels).
2. Add a labels editor in Settings.tsx Workflow Settings section using ChipInput, populated from config.labels.
3. Add i18n strings in en/zh-CN/zh-TW/ja for labels label/description/placeholder.
4. Add server-config-endpoint test for labels round-trip and clear.
5. Run type-check, lint, and targeted tests.
6. Finalize task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added labels ChipInput editor in Settings.tsx Workflow Settings section between defaultAssignee and defaultEditor.
Added i18n strings for labels label/description/placeholder in en/zh-CN/zh-TW/ja.
Normalized labels on save by trimming and filtering empty values (labels is required in BacklogConfig, so it stays as a string[] rather than undefined).
Extended server-config-endpoint.test.ts with labels round-trip and clear-via-empty-list tests.
Verified bunx tsc --noEmit, bun run check (only pre-existing warnings), and targeted tests (20 pass / 0 fail).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a project recommended labels editor to the web UI Settings page. The new ChipInput control lives in the Workflow Settings section between defaultAssignee and defaultEditor, allowing users to add/remove recommended labels. Added i18n strings in en/zh-CN/zh-TW/ja. Labels are normalized on save by trimming and removing empty entries. Extended server-config-endpoint.test.ts with labels round-trip and clear-via-empty-list coverage. Verified with bunx tsc --noEmit, bun run check (only pre-existing warnings), and targeted tests (20 pass / 0 fail).
<!-- SECTION:FINAL_SUMMARY:END -->
