---
title: Add defaultAssignee editing to web settings
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - web-ui
  - config
source_path: backlog/tasks/back-581 - Add-defaultAssignee-editing-to-web-settings.md
---

# Add defaultAssignee editing to web settings

Added a `defaultAssignee` editing entry to the Web UI Settings page (Workflow Settings section, alongside defaultStatus/defaultEditor). Users can view, add, remove, and reorder default assignees; saving goes through the existing `updateConfig` API with CLI-matching semantics (empty list clears the default, list replaces the default on create). Depends on BACK-579, which made `defaultAssignee` a string list wired through core/config.

## Summary

- `src/web/components/Settings.tsx`: new list editor in the Workflow Settings section, populated from `fetchConfig`; empty list normalized to `undefined` on save so the key is removed (matching CLI clear semantics).
- Uses the shared `ChipInput` component already used by TaskDetailsModal for assignees (polish merged from BACK-582); Chinese labels renamed from `经办人`/`經辦人` to `负责人`/`負責人` for consistency.
- i18n strings for label/description/placeholder added to `src/web/locales/en.ts`, `zh-CN.ts`, `zh-TW.ts`, `ja.ts`.
- `src/test/server-config-endpoint.test.ts` covers `defaultAssignee` round-trip and clear semantics via PUT `/api/config`.
- Verification: `bunx tsc --noEmit` and `bun run check .` pass (only pre-existing `src/core/assets.ts` warnings); targeted tests pass.

## Acceptance Criteria

- Settings page displays a defaultAssignee control populated from fetchConfig; users can add, remove, and reorder assignees.
- Saving persists as a YAML list via updateConfig; empty list clears the default, matching CLI semantics; tests cover the round-trip.

## Related Concepts

- [[concepts/web-ui-features]] — Settings page config editing pattern
- [[concepts/web-ui-i18n]] — four-locale label updates

## Related Sources

- [[sources/back-579-default-assignee]] — the core/config implementation this UI edits (same batch)
- [[sources/back-533-config-block-yaml-lists]] — config YAML list serialization semantics
