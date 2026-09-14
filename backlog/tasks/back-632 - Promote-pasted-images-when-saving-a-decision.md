---
id: BACK-632
title: Promote pasted images when saving a decision
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-14 05:29'
updated_date: '2026-09-14 05:43'
labels:
  - web-ui
dependencies: []
priority: low
ordinal: 233400
actual_start: '2026-09-14 05:45'
actual_end: '2026-09-14 05:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Same defect class as the one just fixed for task comments: the web decision editor mounts PasteAwareMDEditor, which uploads pasted images to assets/.temp and inserts a /assets/.temp/<file> URL, but DecisionDetail.handleSave persists the body straight through apiClient.updateDecision with no asset promotion. Every other markdown surface - task description/plan/notes/final summary, documentation, wiki pages and milestones - calls apiClient.promoteAssets first. As a result a pasted image in a decision keeps pointing at a temporary asset, and the 30 minute temp cleanup deletes it, leaving a broken image.

Fix it the same way the task description path does: extract the temp URLs from the content that is about to be saved, promote them, rewrite the body with the permanent URLs and keep the rewritten text in the editor state so a failed save can be retried.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Saving a decision promotes every /assets/.temp image referenced in the body to assets/paste and stores the permanent URL, matching the task description handling
- [x] #2 The promoted body is written back into the editor state before the update call, so a failed save retries against the permanent URLs instead of re-promoting a moved file
- [x] #3 The new-decision path, the title validation, normalizeMarkdownHashLinks and the success/error handling are unchanged
- [x] #4 A decision with no pasted image saves exactly as before (no promoteAssets call)
- [x] #5 The tsc noEmit check passes and the decision/wiki/documentation tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In DecisionDetail.tsx import extractTempImageUrls and replaceTempImageUrls from utils/temp-assets.
2. In handleSave's update branch, promote temp URLs before apiClient.updateDecision and setContent the rewritten body, mirroring TaskDetailsModal.handleSave.
3. Verify in the real browser on a throwaway decision: paste a real image, save, and confirm the stored body points at assets/paste while the .temp file is gone.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed src/web/components/DecisionDetail.tsx only.

- Imported extractTempImageUrls and replaceTempImageUrls from utils/temp-assets.
- handleSave's update branch now promotes before persisting, mirroring TaskDetailsModal.handleSave: contentToSave = normalizeMarkdownHashLinks(content) -> extractTempImageUrls -> apiClient.promoteAssets -> replaceTempImageUrls -> setContent(contentToSave) -> apiClient.updateDecision(contentToSave). The write-back keeps the permanent URLs in the editor so a failed save can be retried instead of re-promoting a file that already moved. The new-decision branch, title validation and success/error handling are untouched.

Verification (real app, throwaway decision created with decision create and deleted afterwards; browser server on port 6611 plus Chromium):
- Uploaded an asset through POST /api/upload?temp=1 to get /assets/.temp/<uuid>.png, put it in the editor inside the Context section, clicked Save.
- Result: the decision file then contained ![pasted](/assets/paste/<uuid>.png), the .temp file was gone from disk and the file existed under assets/paste. Repeated on a second uuid with the same outcome.
- First attempt placed the image before any section heading and it was not persisted: core updateDecisionFromContent only reads the Context/Decision/Consequences/Alternatives sections, so content outside them is intentionally dropped. Worth knowing when testing this surface; not related to this fix.

Blocking finding for this surface (not fixed, outside this task): the decision editor is currently unreachable for users. The Edit button is hard-disabled in DecisionDetail.tsx with a {false ? ... : null} guard labelled 'Temporarily hidden - decisions editing not ready', and the only other way in, the ?edit=true query flag, is cancelled about 1.3 seconds after mount because the effect keyed on [id, decisions] calls setIsEditing(false) on every parent decisions refresh. That is why the promotion path was never exercised in the wild; the fix is correct but latent until decision editing is re-enabled.

Checks: bunx tsc --noEmit passes; bun test src/test/cli-doc-decision-board.test.ts - 12 pass / 0 fail; bun run check . reports the 3 pre-existing warnings and no errors (biome.json ignores src/web).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Saving a decision now promotes pasted images out of assets/.temp, the same way task descriptions do.

Why: DecisionDetail persisted the body straight through apiClient.updateDecision without calling promoteAssets, so a pasted image kept pointing at a temporary asset that the temp cleanup deletes, leaving a broken image.

Changes:
- src/web/components/DecisionDetail.tsx: promote temp image URLs before the update call and keep the rewritten body in the editor state

Verification:
- real browser: a pasted/uploaded temp image in the Context section was stored as /assets/paste/<uuid>.png, the .temp file was removed and the promoted file existed on disk
- bunx tsc --noEmit; bun test src/test/cli-doc-decision-board.test.ts (12 pass)

Note: this surface is currently unreachable in the UI (the Edit button is hard-disabled and the ?edit=true flag is reset shortly after mount), so the fix is latent until decision editing is re-enabled.
<!-- SECTION:FINAL_SUMMARY:END -->
