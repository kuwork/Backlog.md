---
id: BACK-717
title: >-
  Reorder the settings page: state machine card above Workflow Settings and Hide
  empty columns under the terminal status
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-29 08:07'
updated_date: '2026-09-29 08:18'
labels: []
dependencies: []
modified_files:
  - src/web/components/Settings.tsx
priority: medium
ordinal: 287400
actual_start: '2026-09-29 08:13'
actual_end: '2026-09-29 08:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Correction made while implementing, because the first draft of this task mis-stated where Hide empty columns lives: the settings page renders six cards - Project Settings, Workflow Settings, Definition of Done Defaults, Web UI Settings, Advanced Settings, State Machine - and the Hide empty columns toggle belongs to the **Web UI Settings** card as its last item (after autoPort and autoOpenBrowser), while the terminal status picker belongs to the Workflow Settings card.

Goal: gather the status-related settings so the page reads top-down.

1. Move the State Machine card (the t.stateMachine.title heading plus StateMachineEditor) so it comes immediately before the Workflow Settings card. Resulting card order: Project Settings, State Machine, Workflow Settings, Definition of Done Defaults, Web UI Settings, Advanced Settings.
2. Move the Hide empty columns toggle out of the Web UI Settings card and into the Workflow Settings card, directly after the terminal status picker (the StatusExcludeDropdown block): after defaultStatus / terminal status and before defaultAssignee.

Scope is src/web/components/Settings.tsx only: two JSX blocks move, nothing else changes. No new component, no new i18n key, no copy or class change, no behaviour change - each binding moves with its markup (config.hideEmptyColumns with handleInputChange('hideEmptyColumns', ...), the terminal picker with handleTerminalStatusesChange and menuId terminal-statuses-menu).

Verification: the file is .tsx, which biome does not cover (biome.json matches src/**/*.ts only) and which has no component test today, so the reorder is checked by bunx tsc --noEmit, a symmetric diff (34 added / 34 removed lines, single file) and a source-order read-back of the rendered card and item order.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Card order is Project Settings, State Machine, Workflow Settings, Definition of Done Defaults, Web UI Settings, Advanced Settings - the State Machine card sits directly above Workflow Settings.
- [x] #2 The Hide empty columns toggle (t.settings.hideEmptyColumns) renders inside the Workflow Settings card directly after the terminal status picker (t.stateMachine.terminalStatus), and no longer inside the Web UI Settings card after autoPort / autoOpenBrowser.
- [x] #3 The change is a pure JSX relocation: bindings, class names, headings and i18n keys are unchanged (config.hideEmptyColumns with handleInputChange('hideEmptyColumns', ...), the StatusExcludeDropdown with handleTerminalStatusesChange and menuId terminal-statuses-menu).
- [x] #4 No i18n key is added, removed or edited; src/web/locales/en.ts, ja.ts, zh-CN.ts and zh-TW.ts are untouched.
- [x] #5 bunx tsc --noEmit passes and no new type error is introduced.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Two JSX block moves in src/web/components/Settings.tsx; no refactor. Done with an anchor-based, indent-checked script (tmp/move-settings-blocks.py) that asserts every anchor is unique and fails loudly instead of writing a broken file:

1. Cut the Hide empty columns item out of the Web UI Settings card (it was that card's last item, after autoOpenBrowser) and paste it directly after the terminal-status item in the Workflow Settings card.
2. Cut the State Machine card block (comment, card div, StateMachineEditor, closing div) from the end of the page and paste it immediately before the Workflow Settings card.

Both cards use the same inner layout (a 6-tab space-y-4 container with 7-tab items), so the moved markup keeps its indentation unchanged. Verify by reading the card and item order back, bunx tsc --noEmit, a symmetric diff, and the scoped state-machine-editor test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Layout fact that the task description got wrong at first and that the implementation had to correct: there are six cards, and Hide empty columns lived in Web UI Settings, not in Workflow Settings - so the move is cross-card, not an in-card reorder.

The two blocks were moved by tmp/move-settings-blocks.py, which locates anchors by content and indentation (never by hard-coded line numbers), asserts each anchor is unique, and writes the file only after all six steps succeed.

Resulting order, read back from the file:
- cards: Project Settings -> State Machine -> Workflow Settings -> Definition of Done Defaults -> Web UI Settings -> Advanced Settings
- Workflow Settings items: autoCommit -> remoteOperations -> defaultStatus -> terminal status -> Hide empty columns -> defaultAssignee -> labels -> defaultEditor

Validation results:
- bunx tsc --noEmit: exit 0, no output
- git diff --name-status: M src/web/components/Settings.tsx only; --numstat 34 added / 34 removed (a symmetric move, i.e. no content change)
- git diff --check: clean (no whitespace errors, LF endings preserved)
- bun run check .: Checked 492 files, 0 errors; only the 4 pre-existing findings remain (src/core/assets.ts x3 noNonNullAssertion, src/test/board-tui-draft-create.test.ts useTemplate), none in the touched file
- bun test --timeout 240000 src/test/web-state-machine-editor.test.tsx: 10 pass, 0 fail

No i18n key or copy changed, so the four locale files are untouched.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reordered the web settings page (src/web/components/Settings.tsx).

Changes:
- The State Machine card moved from the bottom of the page to sit directly above the Workflow Settings card, giving the card order Project Settings -> State Machine -> Workflow Settings -> Definition of Done Defaults -> Web UI Settings -> Advanced Settings.
- The Hide empty columns toggle moved out of the Web UI Settings card and now sits in the Workflow Settings card directly after the terminal status picker (before defaultAssignee).
- Pure JSX relocation: no component, binding, class, heading or i18n key changed; the four locale files are untouched.

Verification:
- bunx tsc --noEmit (exit 0)
- git diff: single file, 34 added / 34 removed - a symmetric move
- git diff --check clean; bun run check . reports no new findings
- bun test --timeout 240000 src/test/web-state-machine-editor.test.tsx: 10 pass, 0 fail
- Card and item order read back from the file, not assumed
<!-- SECTION:FINAL_SUMMARY:END -->
