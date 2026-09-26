---
title: BACK-634 Enable decision creation from the web sidebar
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - decisions
  - i18n
source_path: backlog/tasks/back-634 - Enable-decision-creation-from-the-web-sidebar.md
---

# BACK-634 Enable decision creation from the web sidebar

The Decisions sidebar create button was commented out and its referenced handler no longer existed, so `/decisions/new` was unreachable even after BACK-633 enabled editing. Behind that button a second gap lurked: the create branch only saved the title, silently discarding the typed body. This task wired both.

## Summary

- `SideNavigation.tsx`: the commented-out block became a real plus button calling `navigate('/decisions/new')`, labelled through the existing `t.nav.createDecision` key (already present in en, zh-CN, zh-TW, ja) with the neighbouring plus buttons' hover styling
- `DecisionDetail.tsx` create branch: after `apiClient.createDecision(title)` it normalizes the typed body, promotes any `/assets/.temp` images through `apiClient.promoteAssets`, and persists the body with `apiClient.updateDecision` when non-empty
- An empty body still yields the default Context/Decision/Consequences template, unchanged from before; navigation, refresh and success toast untouched
- Verified in a real browser: button opens the create form; creating with title + body + pasted image stored all three (image promoted to `assets/paste`) and navigated to the new decision's slugged URL
- Tests: 17 pass across `web-side-navigation-loading.test.tsx` and `cli-doc-decision-board.test.ts`

## Acceptance Criteria

- Sidebar Decisions header shows a localized plus button opening `/decisions/new`
- Create persists both the typed title and body instead of dropping the body
- Empty body still produces the default section template
- Temporary pasted images in the body are promoted before storage; app navigates to the new decision and refreshes the list

## Related Concepts

- [[concepts/web-ui-features]] — sidebar create affordances shared across sections
- [[concepts/web-ui-i18n]] — existing `t.nav.createDecision` key reused
- [[concepts/asset-management]] — temp-image promotion on the create path

## Related Sources

- [[sources/back-633-decision-editing-web-ui]] — edit half of the same surface enabled just before
- [[sources/back-632-decision-image-promotion]] — promotion pattern extended to the create path
- [[sources/back-635-decision-status-editing]] — follows with status editing on the created/edited decision
