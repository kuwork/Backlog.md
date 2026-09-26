---
title: BACK-633 Enable decision editing in the Web UI
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - decisions
source_path: backlog/tasks/back-633 - Enable-decision-editing-in-the-Web-UI.md
---

# BACK-633 Enable decision editing in the Web UI

Decision bodies could not be edited from the web UI: the Edit button was rendered behind a hard `{false ? ... : null}` guard, and the only other entry point, `?edit=true`, was cancelled about 1.3 seconds after mount because the `[id, decisions]` effect reset edit mode on every parent refresh. This task fixed both, and also made the BACK-632 image-promotion path reachable.

## Summary

- `DecisionDetail.tsx` only (+`useRef` import): the Edit button now renders whenever the page is not editing, with the cancel/save pair replacing it in edit mode
- The per-route reset effect is guarded by a `handledRouteIdRef`: the reset (and `loadDecisionContent`) now runs only when the decision id actually changes, so parent decisions-array refreshes neither cancel edit mode nor reload content over in-progress edits
- Deep links unaffected: `loadDecisionContent` always fetches from the API, so dropping the refresh-triggered re-run loses nothing
- Save still goes through `apiClient.updateDecision` with the BACK-632 temp-image promotion; Cancel restores `originalContent`
- Verified in a real browser on a throwaway decision: editor stays open past the old ~1.3s reset window (checked at 4s), edits persist to the file, `?edit=true` persists, and navigating to another decision returns to preview
- Follow-up noted: the create half of the surface was still unreachable (sidebar plus button commented out) — enabled separately in BACK-634

## Acceptance Criteria

- Edit button appears in preview mode and opens the markdown editor; cancel/save replaces it while editing
- Edit mode survives parent decisions refreshes instead of resetting ~1s after mount
- A real route change still resets per-decision state and loads the other decision in preview
- Save persists through the existing updateDecision path; Cancel restores the original content

## Related Concepts

- [[concepts/web-ui-features]] — detail-page edit-mode conventions
- [[concepts/browser-loading]] — effect-dependency and refresh-guard pitfalls in web detail pages

## Related Sources

- [[sources/back-632-decision-image-promotion]] — latent save-path fix this task made reachable
- [[sources/back-634-decision-creation-sidebar]] — next task enabling the create half of the surface
- [[sources/back-635-decision-status-editing]] — builds status editing on top of this enabled editor
