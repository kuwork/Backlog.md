---
id: BACK-636
title: Localize decision status labels in the Web UI
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-14 06:38'
updated_date: '2026-09-14 06:59'
labels:
  - web-ui
dependencies:
  - BACK-635
priority: low
ordinal: 237400
actual_start: '2026-09-14 13:45'
actual_end: '2026-09-14 14:40'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-635 made the decision status editable in the Web UI, but every status label is still the raw English value capitalized in the component (decision.status.charAt(0).toUpperCase() + decision.status.slice(1)), so a Chinese, Japanese or Traditional Chinese interface shows 'Proposed', 'Accepted' and so on.

Add status labels to the four locale files and render them in both places the Web UI shows a decision status: the preview badge and the options of the edit-mode status select. Values that are not part of the labelled set keep the previous capitalized fallback, so free-form statuses still display something sensible.

The same surface also carried its own colour treatment: the status used bg-yellow-50 / text-yellow-700 / border-yellow-200 classes with no dark variants, so in dark mode a bright light chip sat on the dark header, and the treatment differed from every task status shown elsewhere in the app.

Adopt the task status badge treatment for decisions - the same borderless, theme-aware pill - and carry the per-status meaning with a leading icon that differs per status (clock, check circle, x circle, slashed circle, swap arrows, and an info circle for anything else), so colour is never the only signal and non-canonical values still read sensibly. The edit-mode control becomes a plain select like the other inline selects, preceded by the same per-status icon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The decision detail status badge shows a label from the active locale (en, ja, zh-CN, zh-TW) for proposed, accepted, rejected, deprecated and superseded
- [x] #2 The status select in edit mode uses the same localized labels while keeping the raw status as the option value, so switching the interface language never rewrites the stored status
- [x] #3 A stored status outside the labelled set still renders as the capitalized raw value in both places
- [x] #4 All four locale files define the same status keys
- [x] #5 The tsc noEmit check passes and the web/i18n-related tests pass
- [x] #6 The decision status chip uses the task status badge treatment: borderless pill (inline-flex rounded-circle px-2 py-0.5 text-[11px] font-medium) with theme-aware colour pairs and no light-only backgrounds
- [x] #7 Each known status renders its own leading icon (proposed, accepted, rejected, deprecated, superseded) and a non-canonical status falls back to a neutral info icon
- [x] #8 The icon and chip are legible in both light and dark mode (dark variants present on every colour class)
- [x] #9 The edit-mode control keeps a plain select styled like the other modal selects, preceded by the same per-status icon, so the control no longer carries a coloured background
- [x] #10 The obsolete getStatusColor helper is removed
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed src/web/locales/{en,ja,zh-CN,zh-TW}.ts and src/web/components/DecisionDetail.tsx.

- Each locale's decisions block gained a statusLabels map covering proposed, accepted, rejected, deprecated and superseded: the English dictionary carries the canonical English words and the ja, zh-CN and zh-TW dictionaries carry their own translation of all five. deprecated is labelled even though it is not one of the four canonical editor options (it is documented in the user manual and can exist in stored data), so an existing value renders properly instead of falling back.
- DecisionDetail renders both places that show a decision status through one local helper: the preview badge and the edit-mode select options. The helper looks the lowercased status up in the locale map and falls back to the previous capitalized-raw behaviour, so free-form statuses and statuses stored in another language still display. Option values stay the raw status string, so translating the interface never rewrites stored data.

Verification (real browser, server on port 6611 + Chromium, repo locale zh-CN; throwaway decision created and deleted afterwards):
- Edit mode: the select's option values stayed proposed/accepted/rejected/superseded while the printed labels were the localized ones, under an aria-label carrying the localized word for "status".
- Choosing the localized "accepted" option and saving left `status: accepted` in the file and rendered the badge with that same localized label.
- A non-canonical status (triage, set through the CLI) rendered as the capitalized fallback 'Triage' in the badge, and the select listed the four localized options plus an extra option valued triage and labelled 'Triage' - preserving the stored value instead of dropping it.
- All four locale files define the same five keys (checked per file).

Checks: bunx tsc --noEmit passes; bun test src/test/readiness.test.tsx src/test/web-task-details-modal-final-summary.test.tsx - 37 pass / 0 fail; bun run check . reports the 3 pre-existing warnings and no errors. No test in the repository imports the locale modules, so the four-language labelling is covered by the browser pass described above rather than by a new test.

Restyle (merged from BACK-637):
- Replaced the local getStatusColor helper (bg-yellow-50 / text-yellow-700 / border-yellow-200 style classes with no dark variants) with a DECISION_STATUS_STYLES map that mirrors the task status palette from utils/task-badge-colors: bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 for proposed, and the green/red/amber/blue equivalents with dark:bg-<hue>-900/50 dark:text-<hue>-200 pairs for accepted, rejected, deprecated and superseded. An unknown status falls back to the neutral style through DECISION_STATUS_UNKNOWN_STYLE.
- The preview badge is now the same pill as a task status elsewhere in the app: inline-flex rounded-circle px-2 py-0.5 text-[11px] font-medium plus those colours, without the previous border.
- Each status carries its own leading icon, rendered before the pill or the select: clock (proposed), check circle (accepted), x circle (rejected), slashed circle (deprecated), swap arrows (superseded) and an info circle for anything else, each with a light/dark text colour from the same style entry.
- The edit-mode control is now a plain select (h-8 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800) matching the other inline selects in the app, preceded by the same per-status icon, so the control no longer paints a coloured background.
- Removed the now-unused getStatusColor.

Restyle verification (real browser, server on port 6611 + Chromium, throwaway decision deleted afterwards; the status was driven through PUT /api/decisions/:id between reads):
- All six cases (proposed, accepted, rejected, deprecated, superseded and the non-canonical triage) rendered the expected per-status icon path and light/dark colour pair, with the localised label; triage fell back to the info icon and the neutral grey pill.
- Dark mode: the preview pill computed to backgroundColor oklab(0.393 -0.084 0.044 / 0.5) (green-900/50) with color oklch(0.925 0.084 156) (green-200) - a muted dark-green pill on the dark header instead of the previous light-yellow patch; a screenshot review confirmed no bright or light-coloured fill remains. The edit-mode select computed to the plain dark surface.
- Light mode: pale green pill with green text and a check-circle icon, matching a standard subtle status pill.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision status labels in the Web UI now follow the interface language instead of always showing the raw English value.

Why: BACK-635 made the status editable, but the badge and the status select rendered decision.status.charAt(0).toUpperCase() + slice(1), so a Chinese or Japanese interface still showed 'Proposed'.

Changes:
- src/web/locales/en.ts, ja.ts, zh-CN.ts, zh-TW.ts: statusLabels for proposed/accepted/rejected/deprecated/superseded
- src/web/components/DecisionDetail.tsx: both the preview badge and the edit-mode select options render through one lookup that falls back to the capitalized raw value; option values remain the raw status string

Verification:
- real browser: the printed labels were the localized ones while the raw values stayed intact, saving the localized "accepted" option stored `status: accepted` and showed that same label, and a non-canonical status (triage) fell back to 'Triage' while staying selectable
- bunx tsc --noEmit; 37 tests pass in the i18n-adjacent suites

The status is also presented like a task status rather than with its own light-only colours: the old bg-yellow-50 / text-yellow-700 / border-yellow-200 chip (no dark variants) jarred against the dark header, so it now uses the task-status palette with dark pairs plus a per-status leading icon (clock, check, x, slash, swap arrows, info fallback) and a plain edit-mode select.

Additional changes (merged from BACK-637):
- src/web/components/DecisionDetail.tsx: DECISION_STATUS_STYLES with task-status colours and dark pairs, per-status leading icons, plain select in edit mode, obsolete getStatusColor removed

Additional verification:
- real browser: all six statuses render their own icon with light and dark colour pairs and localised labels; dark mode computes to a muted green-900/50 pill with green-200 text (screenshot reviewed); light mode shows the standard pale pill
<!-- SECTION:FINAL_SUMMARY:END -->
