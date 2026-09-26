---
title: BACK-636 Localize decision status labels in the Web UI
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - decisions
  - i18n
source_path: backlog/tasks/back-636 - Localize-decision-status-labels-in-the-Web-UI.md
---

# BACK-636 Localize decision status labels in the Web UI

BACK-635 made the decision status editable, but the badge and select rendered the raw English value capitalized in the component. This task localized the labels across the four locales and restyled the status chip to match the task status badge treatment — the old chip used light-only yellow classes with no dark variants.

## Summary

- All four locale files gained a `statusLabels` map covering proposed, accepted, rejected, deprecated and superseded; `deprecated` is labelled even though it is not an editor option, because it is documented and can exist in stored data
- `DecisionDetail.tsx` renders both the preview badge and the edit-mode select options through one lookup helper that falls back to the previous capitalized-raw behaviour for free-form statuses; option values stay the raw status string, so translating the interface never rewrites stored data
- Restyle (merged from BACK-637's scope): the local `getStatusColor` helper (bg-yellow-50/text-yellow-700, no dark variants) was replaced by `DECISION_STATUS_STYLES` mirroring the task-status palette from `utils/task-badge-colors`, with `dark:bg-<hue>-900/50` pairs and a neutral fallback style
- Each known status carries its own leading icon (clock, check circle, x circle, slashed circle, swap arrows; info circle fallback) so colour is never the only signal; the edit-mode control became a plain select preceded by the same icon
- Verified in a real browser under the zh-CN locale: option values stayed raw while labels localized, saving stored `status: accepted`, and a non-canonical `triage` status fell back to 'Triage' in both places; dark-mode pill computed to muted green-900/50 with green-200 text (screenshot reviewed)
- No test imports the locale modules, so four-language coverage rests on the browser pass rather than a new test

## Acceptance Criteria

- Badge and select show localized labels for the five known statuses in all four locales; raw value kept as option value
- Non-canonical stored statuses render as the capitalized raw value in both places
- Chip uses the borderless task-status pill treatment with theme-aware colour pairs and per-status icons; obsolete `getStatusColor` removed

## Related Concepts

- [[concepts/web-ui-i18n]] — locale-file label conventions and raw-value preservation
- [[concepts/i18n-string-fragmentation]] — related risk when labels live in components instead of locale files

## Related Sources

- [[sources/back-635-decision-status-editing]] — introduced the editable status this task localizes
- [[sources/back-517-i18n-fragmentation-fix]] — earlier cleanup of component-embedded UI strings
- [[sources/back-624-global-search-dialog]] — `task-badge-colors.ts` palette source for the restyle
