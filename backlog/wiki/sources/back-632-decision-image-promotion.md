---
title: BACK-632 Promote pasted images when saving a decision
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - decisions
  - assets
source_path: backlog/tasks/back-632 - Promote-pasted-images-when-saving-a-decision.md
---

# BACK-632 Promote pasted images when saving a decision

The web decision editor mounts PasteAwareMDEditor, which uploads pasted images to `assets/.temp`, but `DecisionDetail.handleSave` persisted the body without promotion — so the 30-minute temp cleanup left broken images. Every other markdown surface already promoted first; this task fixed decisions the same way.

## Summary

- `DecisionDetail.tsx` only: the update branch of `handleSave` now runs `normalizeMarkdownHashLinks` → `extractTempImageUrls` → `apiClient.promoteAssets` → `replaceTempImageUrls` → `setContent` → `apiClient.updateDecision`, mirroring `TaskDetailsModal.handleSave`
- The promoted body is written back into editor state before the update call so a failed save retries against permanent URLs instead of re-promoting a moved file
- New-decision branch, title validation and success/error handling untouched; a decision with no pasted image saves exactly as before (no promoteAssets call)
- Testing gotcha recorded: `updateDecisionFromContent` only reads the Context/Decision/Consequences/Alternatives sections, so content placed before any heading is intentionally dropped
- Blocking finding (not fixed here): the decision editor was unreachable — the Edit button hard-disabled behind a `{false ? ... : null}` guard, and `?edit=true` was cancelled ~1.3s after mount by the `[id, decisions]` effect — so the fix was latent until BACK-633
- Verified in a real browser with an uploaded temp asset: stored body points at `/assets/paste/<uuid>.png` and the `.temp` file is gone

## Acceptance Criteria

- Saving a decision promotes every `/assets/.temp` image to `assets/paste`, matching task description handling
- Promoted body written back into editor state for safe retry on failed saves
- New-decision path, title validation and hash-link normalization unchanged
- Decision with no pasted image skips promoteAssets entirely

## Related Concepts

- [[concepts/asset-management]] — temp-asset lifecycle and promotion this surface was missing
- [[concepts/paste-as-markdown]] — PasteAwareMDEditor upload behaviour producing `.temp` URLs
- [[concepts/markdown-pipeline]] — section-scoped decision content parsing

## Related Sources

- [[sources/back-631-comment-rich-markdown-editor]] — same defect class fixed for comments immediately before
- [[sources/back-633-decision-editing-web-ui]] — re-enabled the edit surface that makes this fix reachable
- [[sources/wiki-pasted-images-promote-fix]] — earlier instance of the same promotion pattern for wiki pages
