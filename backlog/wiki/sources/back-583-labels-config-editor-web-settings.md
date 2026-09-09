---
title: BACK-583 Add labels config editor to web settings
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - web-ui
  - cli
source_path: backlog/tasks/back-583 - Add-labels-config-editor-to-web-settings.md
---

# BACK-583 Add labels config editor to web settings

The web UI Settings page gained an editor for the `labels` config key (project recommended labels used as autocomplete in Web UI and TUI), following the existing ChipInput pattern used for defaultAssignee and TaskDetailsModal labels.

## Summary

- Added a labels ChipInput editor in `src/web/components/Settings.tsx` Workflow Settings section, placed between defaultAssignee and defaultEditor.
- Labels are normalized on save: trimmed, empty values filtered; stays a required `string[]` (not undefined) in BacklogConfig.
- i18n strings for labels label/description/placeholder added in `src/web/locales/en.ts`, `zh-CN.ts`, `zh-TW.ts`, `ja.ts`.
- `src/test/server-config-endpoint.test.ts` extended with labels round-trip and clear-via-empty-list tests (20 pass / 0 fail).

## Acceptance Criteria

- Settings page displays a labels editor populated from config.labels; add/remove via ChipInput; persists via updateConfig and reloads correctly.
- i18n strings added for all four locales; tests cover the round-trip via /api/config.

## Related Concepts

- [[concepts/web-ui-features]] — Settings page config editing surface
- [[concepts/web-ui-i18n]] — four-locale i18n string convention (en/zh-CN/zh-TW/ja)
