---
id: BACK-721
title: Optimize State Machine Guidance
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-30 04:35'
updated_date: '2026-09-30 07:35'
labels:
  - state-machine
  - guidelines
dependencies:
  - BACK-716
priority: medium
ordinal: 291400
actual_start: '2026-09-30 04:46'
actual_end: '2026-09-30 07:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Goal: optimize the default task state machine and its guidance so agents read it faster and projects get a machine in their own language.

Final scope (as implemented):
- Default machine ships in four locale variants living in the existing locale files: src/web/locales/{en,ja,zh-CN,zh-TW}.ts each export defaultStateMachine; src/web/locales/index.ts assembles DEFAULT_STATE_MACHINES. Only when/if/requires/evidence prose is localized.
- Plan approval (Plan Review -> In Progress) and final acceptance (In Review -> Done) are ai: allowed_if with an explicit user-approval condition; no default edge is forbidden. To Do -> Dropped stays propose and tells the user that dropping archives the task.
- Language detection: detectDefaultLocale() reads LC_ALL/LC_MESSAGES/LANG and falls back to the OS locale via Intl (env vars do not exist on stock Windows); unknown languages fall back to English. init writes one detected value into both config locale (the Settings language option) and the statuses variant, so UI language and machine language never diverge.
- Guidance wording says "user" instead of "human"; every "Status Machine" reads "State Machine" (guideline headings, tests, comments).
- Renderer readability: requires omitted when identical to if; intro long sentence split into two bullets; the stop-and-wait section is an index of edges; terminal-status table and archive rules merged into one sentence; statuses with no outgoing edges collapsed into one line (machine block ~80 -> ~55 lines).
- Settings state machine editor: the Default button no longer auto-saves - it loads the default variant for the project's configured language into the editor as a draft and writes only when the user saves; button copy updated in all four locales.
- Project backlog/config.yml uses the zh-CN variant with locale: zh-CN.

Verification: bunx tsc --noEmit, bun run check, bun test for state-machine / init / mcp-server suites; full bun test shows only pre-existing or load-flaky failures (verified via stash baseline).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Default state machine Plan Review -> In Progress and In Review -> Done edges are ai: allowed_if with a user-approval if condition; no default edge uses forbidden
- [x] #2 defaultStateMachineForLocale() maps LANG/LC_ALL/LC_MESSAGES to en, zh-CN, zh-TW, ja variants and falls back to en for unknown locales; init writes the detected variant into config.yml
- [x] #3 To Do -> Dropped when text in every locale tells the user that dropping archives the task (exit: archive)
- [x] #4 Guidance and guideline wording uses "user" instead of "human", and every "Status Machine" heading/comment/assertion reads "State Machine"
- [x] #5 bunx tsc --noEmit, bun run check ., and the state-machine / init / mcp-server test suites pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/core/state-machine.ts
   - Replace DEFAULT_STATE_MACHINE single constant with per-locale variants: en (fallback), zh-CN, zh-TW, ja — matching src/web/locales. Only when/if/requires/evidence text is localized; status names, categories, exit channels stay identical.
   - Plan Review -> In Progress and In Review -> Done become ai: allowed_if with if = user-approval condition (e.g. en: "the user has explicitly approved the implementation plan in conversation or comments").
   - To Do -> Dropped keeps ai: propose but its when text gains an archival hint in every locale (e.g. zh-CN: "任务已过时或被放弃；提示用户将其移动到 Dropped 即归档（exit: archive）", en: "the task is obsolete or abandoned; tell the user that dropping it archives the task (exit: archive)").
   - Add defaultStateMachineForLocale(locale?): detects from LANG/LC_ALL/LC_MESSAGES when no locale is passed, maps to one of the four variants, falls back to en. Returns a structuredClone.
   - Keep DEFAULT_STATE_MACHINE exported (= en variant) so existing imports keep compiling.
   - Wording: AI_TIER_MEANINGS propose/forbidden meanings, the intro sentence, and the "Stop and wait for a human" heading switch human -> user. Guidance framework prose stays English; localization lives in the machine text written to config.
2. src/core/init.ts:149 — statuses: defaultStateMachineForLocale() instead of structuredClone(DEFAULT_STATE_MACHINE).
3. src/guidelines/cli-instructions/overview.md, src/guidelines/mcp/overview.md, src/guidelines/mcp/overview-tools.md — rename heading "The Project Status Machine" -> "The Project State Machine"; align the ai-tier descriptions with the new human->user wording.
4. src/web/utils/state-machine-tree.ts comment: "status machine" -> "state machine".
5. Tests: update assertions that quote the old headings / old edge text (state-machine.test.ts, state-machine-guidance.test.ts, mcp-server.test.ts, enhanced-init.test.ts, server-statuses-endpoint.test.ts); add cases for locale detection (en default, zh-CN mapping, fallback on unknown), the new allowed_if edges, and the archival hint in the To Do -> Dropped when text.
6. Verify: bunx tsc --noEmit, bun run check ., bun test state-machine/init/mcp suites, then full bun test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Settings Default button no longer auto-saves: it now loads defaultStateMachineForLocale(config?.locale) into the editor as a draft change and only writes when the user saves. StateMachineEditor onRestoreDefault prop type relaxed to () => void; restoreDefaultDesc/restoreDefaultConfirm strings updated in all four locales to say the write happens on save.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Default state machine now ships in four locale variants in the existing locale files (src/web/locales/*), assembled as DEFAULT_STATE_MACHINES. Plan approval and acceptance edges are allowed_if with user-approval conditions; no default edge is forbidden; To Do -> Dropped hints that dropping archives the task. Language detection uses LC_ALL/LC_MESSAGES/LANG with an Intl OS-locale fallback (fixes always-English on Windows), and init writes one detected value into both config locale and the statuses variant. Guidance says user/State Machine everywhere. Renderer: requires dedup, two-bullet intro, index-form stop list, merged terminal/archive section, collapsed empty statuses (~80 -> ~55 lines). Settings Default button loads the localized default as a draft instead of auto-saving. Project config uses the zh-CN variant. Verification: tsc clean, biome clean, scoped suites all pass; full bun test failures are pre-existing or load-flaky (stash-verified).
<!-- SECTION:FINAL_SUMMARY:END -->
