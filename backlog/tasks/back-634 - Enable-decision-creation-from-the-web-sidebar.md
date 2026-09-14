---
id: BACK-634
title: Enable decision creation from the web sidebar
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-14 05:39'
updated_date: '2026-09-14 05:42'
labels:
  - web-ui
dependencies: []
priority: medium
ordinal: 235400
actual_start: '2026-09-14 06:30'
actual_end: '2026-09-14 06:45'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Decisions section of the web sidebar had its create button commented out (Temporarily hidden - decisions editing not ready), and the handler the commented JSX referenced, handleCreateDecision, no longer exists in SideNavigation.tsx. As a result /decisions/new - which DecisionDetail fully supports - was unreachable from the UI, even after decision editing itself was enabled in BACK-633.

A second gap sits behind that button: the create form renders both the title input and the body editor, but the create branch of handleSave only called apiClient.createDecision(title) and navigated away, silently discarding whatever body the user had typed.

This task wires the plus button to /decisions/new and persists the body entered in the create form, promoting any temporary pasted images the same way the other markdown surfaces do.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Decisions section header in the web sidebar shows a plus button that opens /decisions/new, labelled through the existing t.nav.createDecision key (present in en, zh-CN, zh-TW and ja)
- [x] #2 Submitting the create form persists both the typed title and the body typed in the editor, instead of dropping the body
- [x] #3 A create with an empty body still produces the default Context/Decision/Consequences template, unchanged from before
- [x] #4 Temporary pasted images in the typed body are promoted from assets/.temp to assets/paste before the decision is stored
- [x] #5 After creation the app navigates to the new decision in preview mode and the sidebar decision list refreshes
- [x] #6 The tsc noEmit check passes and the sidebar/decision tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the commented create button in SideNavigation.tsx with a real plus button that navigates to /decisions/new, mirroring the existing plus button styling.
2. In DecisionDetail.tsx's create branch, promote temp images found in the typed body and persist it via updateDecision after createDecision when it is not blank.
3. Verify in the real browser: the button opens the create form, creating with a title, a body and a pasted image stores all three and navigates to the new decision.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed src/web/components/SideNavigation.tsx and src/web/components/DecisionDetail.tsx.

- SideNavigation: the commented-out create block was replaced by a real plus button that calls navigate('/decisions/new'), with title/aria-label from the existing t.nav.createDecision key and the hover styling of the neighbouring plus buttons. The handler the old comment referenced (handleCreateDecision) never existed in the file.
- DecisionDetail, create branch: after apiClient.createDecision(title) it now normalizes the typed body, promotes any /assets/.temp images through apiClient.promoteAssets, and persists it with apiClient.updateDecision when non-empty. An empty body still yields the default Context/Decision/Consequences template. Navigation, refresh and the success toast are unchanged.

Verification (real app; browser server on port 6611 plus Chromium; the decision created during the test was deleted afterwards together with its promoted asset):
- The Decisions header row shows the plus button with title and aria-label '新建决策' (the active zh-CN locale), next to the collapse chevron.
- Clicking it opened /decisions/new with the title input and the body editor.
- Filling the title with 'TEMP created decision check' and a body containing a temporary pasted image, then clicking Save, navigated to /decisions/2/temp-created-decision-check.
- The created file contained the title, 'Created through the sidebar button.' inside Context, the image as ![pasted](/assets/paste/9d21afca-....png) (promoted out of .temp, which no longer held it) and the default Decision/Consequences template text.

Checks: bunx tsc --noEmit passes; bun test src/test/web-side-navigation-loading.test.tsx src/test/cli-doc-decision-board.test.ts - 17 pass / 0 fail; bun run check . reports the 3 pre-existing warnings and no errors (biome.json ignores src/web).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decisions can now be created from the web UI, and the body typed in the create form is no longer lost.

Why: the sidebar create button was commented out (its handler no longer existed), so /decisions/new was unreachable; and the create branch only saved the title, discarding the body the create form let the user type.

Changes:
- src/web/components/SideNavigation.tsx: real plus button opening /decisions/new, labelled from t.nav.createDecision
- src/web/components/DecisionDetail.tsx: the create branch persists the typed body with temp-image promotion before navigating to the new decision

Verification:
- real browser: button opens the create form; creating with a title, a body and a pasted image stored all three (image promoted to assets/paste) and navigated to the new decision
- bunx tsc --noEmit; 17 tests pass across the sidebar and decision suites
<!-- SECTION:FINAL_SUMMARY:END -->
