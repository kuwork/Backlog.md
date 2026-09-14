---
id: BACK-629
title: Fix global search dialog not following the light theme
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-14 03:30'
updated_date: '2026-09-14 03:32'
labels:
  - web-ui
dependencies:
  - BACK-624
priority: low
ordinal: 230400
actual_start: '2026-09-14 03:00'
actual_end: '2026-09-14 03:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User-reported bug on BACK-624: the global search dialog could not be switched to the light theme.

Root cause: every surface class in src/web/components/search/SearchDialog.tsx was written dark-first - no light counterpart and no dark: variant - so the dialog rendered dark regardless of the active theme (panel bg-gray-900, input text-gray-100, selected row bg-gray-700/70, filter tab bg-gray-700, type icons text-*-400, keyword highlight bg-amber-400/25 text-amber-100).

Fix: rewrite every color class as a light class + dark: variant pair, preserving the dark rendering item by item (panel bg-white dark:bg-gray-900, border border-gray-200 dark:border-gray-700, input text-gray-900 placeholder-gray-400 dark:text-gray-100 dark:placeholder-gray-500, selected row bg-gray-100 dark:bg-gray-700/70 with border-blue-500 dark:border-blue-400, hover bg-gray-50 dark:bg-gray-700/40, active filter tab bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100, type icons text-*-600 dark:text-*-400, highlight bg-amber-200/70 text-amber-900 dark:bg-amber-400/25 dark:text-amber-100, loading chip bg-white/80 dark:bg-gray-900/80, error text-red-600 dark:text-red-400). Narrow-screen panel bg-white dark:bg-gray-900. The backdrop (bg-black/40 dark:bg-black/60) was already theme-aware and is unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Light theme: dialog panel, input, rows, filter tabs and group headers render light (white background, dark text) with no dark surfaces left inside the dialog
- [x] #2 Dark theme: rendering is unchanged item by item (panel gray-900, light text, selected row gray-700/70 with blue-400 accent, no light panels)
- [x] #3 Toggling the theme updates the open dialog immediately without a reload, in both directions
- [x] #4 Narrow viewport (<640px) renders the full-screen dialog in light theme as well
- [x] #5 bunx tsc --noEmit passes and bun run check . passes for touched files
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Applied to src/web/components/search/SearchDialog.tsx (single file, classes only; no logic, routing or i18n changes).

Verified by launching the real UI (bun src/cli.ts browser --port 6611 --no-open) and driving it with Chromium:
- light theme: computed dialog background rgb(255,255,255), input color oklch(0.21...) (gray-900), selected row border blue-500 + bg gray-100, highlight mark amber-200/70; screenshot review confirmed no dark surfaces inside the dialog
- dark theme: panel oklch(0.21...) (gray-900), input gray-100, selected row gray-700/70 + blue-400 accent - identical to the pre-fix rendering
- toggling the documentElement dark class while the dialog is open flips the dialog colors immediately (light -> dark -> light), no reload
- narrow (500px wide) light theme: full-screen white panel, two-line rows intact

Command results: bunx tsc --noEmit passes; bun run check . completes with 3 pre-existing warnings and no errors (biome.json ignores src/web, so the touched file is not linted); bun test src/web/utils/search-results.test.ts 31 pass / 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the BACK-624 search dialog so it follows the application theme.

Why: the dialog was styled dark-first - panel bg-gray-900, input text-gray-100, selected row bg-gray-700/70, filter tabs bg-gray-700, type icons text-*-400 and the highlight bg-amber-400/25 text-amber-100 all lacked a light counterpart, so in light mode the dialog still rendered dark and the user could not switch it to the light theme.

Changes:
- src/web/components/search/SearchDialog.tsx: every color class rewritten as light + dark: variant pairs; dark rendering preserved item by item

Verification:
- bunx tsc --noEmit
- real browser walkthrough in light and dark themes, plus live theme toggle with the dialog open and the narrow (<640px) layout
<!-- SECTION:FINAL_SUMMARY:END -->
