---
id: BACK-633
title: Enable decision editing in the Web UI
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-14 05:34'
updated_date: '2026-09-14 05:42'
labels:
  - web-ui
dependencies: []
priority: medium
ordinal: 234400
actual_start: '2026-09-14 06:05'
actual_end: '2026-09-14 06:20'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
DecisionDetail.tsx renders its Edit button behind a hard false guard - {false ? <button onClick={handleEdit}>...</button> : null} - with the comment 'Temporarily hidden - decisions editing not ready', so the decision body cannot be edited from the web UI at all. The only other way into edit mode is the ?edit=true query flag.

Enabling the button alone is not enough: the effect keyed on [id, decisions] calls setIsEditing(false) every time the parent refreshes its decisions array, which cancels edit mode about 1.3 seconds after mount (measured). So clicking Edit would close the editor again a second later. That same re-run also calls loadDecisionContent, which reloads content and title over any in-progress edits.

Fix both: render the Edit button in preview mode, and make the per-route reset fire only when the decision id actually changes. The save path already promotes pasted images (BACK-632), so nothing else is needed for pasted assets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The decision header shows an Edit button in preview mode; clicking it opens the markdown editor for the decision body, and the cancel/save pair replaces it while editing
- [x] #2 Edit mode survives parent decisions refreshes: after entering edit mode through the button or through ?edit=true, the editor stays open until save or cancel instead of being reset about a second later
- [x] #3 A real route change still resets per-decision state: navigating to another decision reloads its content in preview mode, and the new-decision route still opens the create form
- [x] #4 Save persists the edited body through the existing updateDecision path, and Cancel restores the original content and returns to preview
- [x] #5 The tsc noEmit check passes and the decision tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In DecisionDetail.tsx render the Edit button when not editing, replacing the {false ? ... : null} guard.
2. Guard the [id, decisions] effect with a ref of the last handled id so a decisions refresh neither resets edit mode nor reloads content over in-progress edits.
3. Verify in the real browser: Edit button present, editor stays open beyond the old ~1.3s reset window, editing and saving persists, ?edit=true persists too.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed src/web/components/DecisionDetail.tsx only (+useRef import).

- The Edit button was rendered behind {false ? <button onClick={handleEdit}>...</button> : null} with the comment 'Temporarily hidden - decisions editing not ready'. It now renders whenever the page is not editing, so the cancel/save pair replaces it in edit mode.
- The effect keyed on [id, decisions] reset per-decision state on every parent decisions refresh, which cancelled edit mode about 1.3 seconds after mount and reloaded content over in-progress edits. It is now guarded by handledRouteIdRef: the reset runs only when the decision id actually changes. loadDecisionContent already always fetches from the API, so dropping the refresh-triggered re-run does not affect deep links.
- No other change: save still goes through apiClient.updateDecision (now with the BACK-632 temp-image promotion, which this task makes reachable), cancel still restores originalContent.

Verification (real app, throwaway decision created with decision create and deleted afterwards; browser server on port 6611 plus Chromium):
- Preview mode shows the Edit button and no editor. Clicking it opens the markdown editor.
- The editor was still open after 4 seconds with the Save button visible and the Edit button hidden, past the old ~1.3 second reset window.
- Editing the Context section and clicking Save returned to preview and persisted the text: the decision file contained 'Edited through the Edit button.' inside Context, and the preview rendered it.
- ?edit=true kept the editor open for 4 seconds as well and then consumed the parameter.
- Clicking through to decision-1 from an edit session landed on the other decision in preview mode with the Edit button showing, so a real route change still resets per-decision state.

Follow-up: at the time of this change the create half of the surface was still unreachable (the sidebar plus button was commented out). That was enabled separately in BACK-634, which also made the create form persist a body typed before saving.

Checks: bunx tsc --noEmit passes; bun test src/test/cli-doc-decision-board.test.ts - 12 pass / 0 fail; bun run check . reports the 3 pre-existing warnings and no errors (biome.json ignores src/web).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision editing is now reachable from the web UI.

Why: the Edit button was behind a hard false guard and the only other entry point, ?edit=true, was cancelled about 1.3 seconds after mount because the [id, decisions] effect reset edit mode on every parent decisions refresh.

Changes:
- src/web/components/DecisionDetail.tsx: render the Edit button in preview mode; guard the per-route reset effect with a ref so a decisions refresh no longer cancels edit mode or overwrites in-progress edits

Verification:
- real browser on a throwaway decision: Edit opens the editor, the editor stays open past the old reset window, editing and saving persists to the file, ?edit=true persists, and navigating to another decision returns to preview
- bunx tsc --noEmit; bun test src/test/cli-doc-decision-board.test.ts (12 pass)
<!-- SECTION:FINAL_SUMMARY:END -->
