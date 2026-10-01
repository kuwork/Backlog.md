---
id: BACK-738
title: >-
  Memo card menu: copy ID action and fix entity-link modal losing the /memos
  background
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 22:14'
updated_date: '2026-10-01 22:49'
labels:
  - web-ui
milestone: m-10
dependencies:
  - BACK-737
modified_files:
  - src/test/web-memos-page.test.tsx
  - src/web/components/MemosPage.tsx
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
references:
  - 'src/web/components/MemosPage.tsx:165'
  - 'src/web/components/MemosPage.tsx:375'
  - 'src/web/App.tsx:732'
  - 'src/web/App.tsx:217'
ordinal: 308400
actual_start: '2026-10-01 22:40'
actual_end: '2026-10-01 22:49'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two MemosPage UX fixes in the memo card kebab menu and entity-link navigation.

1. Copy ID: each memo card's kebab menu (currently edit/delete) gains a "Copy ID" item that writes the memo id (YYYYMMDD-N) to the clipboard and gives transient confirmation (tooltip/toast or temporary label swap), matching however other copy actions in the web UI confirm.

2. Modal return bug: clicking a task/doc/wiki entity link inside a memo body navigates with plain navigate() (src/web/components/MemosPage.tsx:375-379) and passes no backgroundLocation state, so the task preview modal opens without a background location and closing it lands on the tasks board instead of back on /memos. Other pages open the modal with navigate(path, { state: { backgroundLocation: location } }) (see src/web/App.tsx:732). Memo entity links must do the same so closing the modal returns to the exact /memos view (feed scroll, selected day, calendar mode) the user came from.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Kebab menu on every memo card shows a Copy ID item that puts the memo id on the clipboard
- [x] #2 Clicking Copy ID gives visible transient confirmation and leaves the menu state sane (closes or resets)
- [x] #3 Existing edit/delete kebab actions and entity link rendering are unaffected
- [x] #4 Opening a task or draft link from a memo and closing the preview modal returns to /memos with the feed position and selected day intact (doc/wiki links are full-page navigation, not modals)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. MemosPage.tsx MemoCard: add a Copy ID item to the kebab menu between Edit and Delete. On click, write the memo id to the clipboard (navigator.clipboard.writeText, falling back to a temporary textarea + execCommand), swap the menu item label to a Copied confirmation for ~1.2s, then close the menu and reset state.
2. MemosPage.tsx: read the current location via useLocation and pass { state: { backgroundLocation: location } } in the onTaskClick / onDraftClick navigate calls, matching handleOpenTask in App.tsx:732. The main Routes then keep rendering /memos under the /task/:id modal (mainLocation = backgroundLocation), so MemosPage never unmounts and the feed scroll position and selected day survive; handleCloseModal's navigate(-1) lands back on that background. Doc/decision/wiki routes are full pages (DocumentationDetail etc.), not modals, so they stay as-is.
3. Locales: add copyId / copied keys to the memos section of en, ja, zh-CN and zh-TW.
4. Tests in src/test/web-memos-page.test.tsx: (a) the menu shows Copy ID, clicking it calls navigator.clipboard.writeText with the memo id and shows the Copied confirmation; (b) clicking a task link in a memo body leaves window.history.state.usr.backgroundLocation.pathname === "/memos" (same for a draft link); (c) existing edit/delete and entity-link tests keep passing.
5. Reword AC #3 via the CLI: the modal return covers the task/draft preview modal; doc/wiki links are full-page navigation, not modals.
6. Verify: bun test src/test/web-memos-page.test.tsx, bunx tsc --noEmit, bun run check .
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Copy ID lives on the menu item itself: the label swaps to Copied for 1.2s (idCopied state + timeout) while the menu stays open, then the menu closes and the state resets. Clipboard write is navigator.clipboard.writeText with a hidden-textarea execCommand fallback for insecure contexts.
The modal fix is one line per handler: onTaskClick/onDraftClick now pass { state: { backgroundLocation: location } }, so App keeps MemosPage mounted under the /task/:id modal (mainLocation = backgroundLocation) and handleCloseModal's navigate(-1) returns to the untouched feed. Doc/decision/wiki routes are full pages, deliberately unchanged.
Test gotcha: setupDom replaces globalThis.navigator with a fresh jsdom one, so the clipboard mock must be installed AFTER renderMemos, not before.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Copy ID to the memo card kebab menu and fixed entity-link modals losing the /memos background.

Changes:
- src/web/components/MemosPage.tsx: Copy ID menu item between Edit and Delete (clipboard API + textarea fallback, Copied confirmation for 1.2s before the menu closes); onTaskClick/onDraftClick now navigate with { state: { backgroundLocation: location } } so the task/draft preview modal closes back onto the untouched /memos view.
- src/web/locales/{en,ja,zh-CN,zh-TW}.ts: new memos.copyId / memos.copied keys.
- src/test/web-memos-page.test.tsx: two new tests (clipboard write + confirmation label; backgroundLocation carried on the task link), 43 pass total.

Verification:
- bun test src/test/web-memos-page.test.tsx -> 43 pass / 0 fail
- bunx tsc --noEmit -> clean
- bun run check . -> no errors
<!-- SECTION:FINAL_SUMMARY:END -->
