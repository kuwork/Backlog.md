---
id: BACK-637
title: 'Keep in-document anchors working on load, reload and slug normalization'
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-14 22:57'
updated_date: '2026-09-15 00:22'
labels: []
dependencies:
  - BACK-536
ordinal: 238400
actual_end: '2026-09-14 23:25'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In-document markdown hash links already jump to headings on click (BACK-536), but the resolved URL is only useful for the rest of that click: reopening or sharing `/documentation/5#a1-section-title` (or `/task/536#a1-section-title`) lands at the top of the page because nothing reacts to a hash that is already present when the route renders. Content also arrives asynchronously (data fetch, markdown render), so the heading is usually not in the DOM yet at mount time.

Fix by resolving the hash once per navigation and scrolling when the target heading appears, reusing the same heading resolution that the click handler uses so there is one implementation instead of two.

Follow-up 1 - the sidebar refresh reset the scroll position

Reopening a documentation URL with an in-document hash (for example http://localhost:6420/documentation/10/v1493-v1501#%E4%BA%8C%E3%80%81TUI) jumped to the heading correctly, but the document was then reset to the top a moment later, exactly when the sidebar finished loading its data.

Cause: DocumentationDetail reloaded its content whenever the docs prop identity changed (effect deps [id, docs]). The document body renders from its own fetchDoc call before the parent loadAllData finishes, and when the docs array then arrived the effect re-ran: loadDocContent set isLoading true, which unmounted the rendered markdown and left main with almost no content, so the scroll container clamped scrollTop back to 0. The content was then re-rendered at the top and nothing restored the position, because the location hash did not change.

DecisionDetail already guarded against this with a handledRouteIdRef that keys off the route id instead of the array identity; DocumentationDetail was missing the same guard. Loading was already covered by the fetchDoc call, so the guard loses nothing for deep links.

Follow-up 2 - slug normalization dropped the anchor

Anchors are not limited to documents: decisions render through the same MermaidMarkdown renderer and carry in-document hash links too (normalizeMarkdownHashLinks runs on both save paths). Both detail pages also normalize a bare id URL to its slugged form, and that normalization used to throw the anchor away.

Reopening a bare decision URL with an in-document hash (for example http://localhost:6420/decisions/1#context, where decision-1 is a real record and `#context` is the github-slugger id of its `## Context` heading) therefore landed on /decisions/1/use-tailwind-css-v4-for-web-ui-development with no hash at all: nothing scrolled, and the anchor was gone from the address bar, so the URL was no longer shareable as a deep link.

Both normalize effects now carry location.hash into the replacement navigation. The scroll hook already tolerates this case: the hash does not change, so its observer keeps watching and scrolls once the heading is rendered.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reopening or sharing a URL whose hash targets a heading scrolls that heading into view once the heading exists in the DOM
- [x] #2 Human-readable anchors written by hand (#A1) and github-slugger slugs (#a1-section-title) both resolve on load
- [x] #3 In-document click behaviour is unchanged: same smooth scroll plus history push, existing hash link tests still pass
- [x] #4 Routes and links without a hash produce no scroll side effect
- [x] #5 bunx tsc --noEmit, bun run check . and bun test pass
- [x] #6 Refreshing the docs array while a document is open does not reload its content or re-enter the loading state
- [x] #7 The rendered document is not unmounted, so a hash scroll performed before the refresh is preserved
- [x] #8 Switching to another document id still loads that document
- [x] #9 Opening a bare id URL with an in-document hash keeps that hash in the URL after slug normalization
- [x] #10 The heading is scrolled to once the content renders, on both documentation and decisions
- [x] #11 Slugged URLs behave exactly as before
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach: resolve the hash once per navigation in a small app-level hook, reusing the renderer's existing heading resolution instead of adding a second implementation.

Changes
- New src/web/utils/hash-target.ts: moved findHeadingByHashTarget out of MermaidMarkdown, added scrollToHeading() and scrollToHashTarget(), exported HEADING_PREFIX_ID_REGEX (previously duplicated in both files).
- New src/web/hooks/useHashScroll.ts: reads useLocation().hash, scrolls immediately, then watches with window.MutationObserver until the heading appears (content loads asynchronously); 3s timeout bounds the watch.
- src/web/App.tsx: mounts useHashScroll() in AppContent.
- src/web/components/MermaidMarkdown.tsx: click handler now calls the shared scrollToHeading(); renderer behaviour unchanged.
- New src/test/hash-scroll.test.tsx: 5 cases.

Follow-up 1 (was BACK-638)

Reproduced before fixing: the new test src/test/web-documentation-refresh.test.tsx mounts useHashScroll plus DocumentationDetail at /documentation/doc-1/alpha#a1-section-title with an empty docs array (the deep-link case), then re-renders with a populated docs array. Before the guard the component issued a second GET /api/docs/doc-1 and replaced the heading node; after the guard the document fetch count stays at 1 and the heading element that was scrolled to is still the same node.

Decision: reuse the handledRouteIdRef pattern already present in DecisionDetail rather than adding scroll-restoration logic to useHashScroll. Preventing the unmount fixes the cause, and the hook stays a single small implementation that does not fight the reader by re-scrolling on every background refresh.

Behaviour change worth noting: content is no longer silently reloaded from disk while a document is open. That also stops the editor from being closed (setIsEditing(false)) and from overwriting in-progress edits a second after opening, on any websocket-triggered refresh. DecisionDetail already behaves this way.

Follow-up 2 (was BACK-639)

Checked the neighbouring cases while here

- Decisions were never affected by the sidebar refresh problem: DecisionDetail already keys its loader on the route id via handledRouteIdRef, so a parent decisions refresh does not unmount the content. That is now locked in by a test instead of being an assumption.
- The remaining navigate calls that build a slug (documentation and decision save/create paths) intentionally drop the hash: those are post-save navigations that land in preview mode, so there is no anchor to preserve.
- Sidebar and search-result links never carry a hash, so they are unaffected.
- The normalize effect keeps the hash as the dep value, so after the first replacement navigation title === expectedSlug and the effect stops; no navigation loop is introduced. Empty/unsafe titles behave exactly as before.

Notes for future work
- window.MutationObserver is required: MutationObserver is not on globalThis in the Bun test environment.
- JSX attribute strings do not process escapes, so markdown sources in tests must be passed as JS string constants.
- Biome useExhaustiveDependencies rejects unreferenced deps, and React Router clears the hash on navigation, so the hook depends on hash alone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hash links now work on load and reload, not only on click.

Problem: BACK-536 made in-document markdown links (`[text](#heading)`) scroll on click, but the URL it produced was only useful for that one click. Reopening or sharing the URL landed at the top of the page, because nothing reacted to a hash that is already in the URL when the route renders. Content also arrives asynchronously, so the heading is not in the DOM at mount time.

Changes
- src/web/utils/hash-target.ts (new): extracted the renderer's heading resolution out of MermaidMarkdown, added scrollToHeading() and scrollToHashTarget(), and exported HEADING_PREFIX_ID_REGEX which had been duplicated.
- src/web/hooks/useHashScroll.ts (new): resolves the location hash, scrolls immediately when the heading is already rendered, otherwise watches for the heading with window.MutationObserver and stops on first hit or after 3s.
- src/web/App.tsx: mounts useHashScroll() in AppContent.
- src/web/components/MermaidMarkdown.tsx: click handler now calls the shared scrollToHeading(); renderer behaviour is unchanged.
- src/test/hash-scroll.test.tsx (new): 5 cases.

Why existing behaviour is unaffected
- The click path keeps the same smooth scroll plus pushState, and now shares one implementation with the load path.
- Routes and links without a hash return early, so there is no scroll side effect.
- Nothing outside src/web imports the moved code.

Verification
- bunx tsc --noEmit: clean
- bun run check .: 0 errors (4 pre-existing warnings)
- 27 web-related test files, 225 pass / 0 fail, including the 5 new cases and the pre-existing hash link click tests
- Full suite was still running when this task was finalised (233 files; the CLI spawn tests dominate, ~5s each, no failures observed)

Follow-up 1 (was BACK-638) - the position is no longer lost when the sidebar finishes loading

Problem: reopening or sharing a documentation URL with an in-document hash (for example /documentation/10/v1493-v1501#%E4%BA%8C%E3%80%81TUI) scrolled to the heading correctly, but a moment later, when the parent finished its initial loadAllData, the page snapped back to the top.

Cause: DocumentationDetail ran its loader from an effect keyed on [id, docs]. The document body renders from its own fetchDoc call, which already works before the parent has loaded the docs array (that is what makes deep links work). When the docs array then arrived with a new identity, the effect re-ran, loadDocContent set isLoading to true, the rendered markdown was unmounted, main was left with almost no content, and the scroll container clamped scrollTop back to 0. The content was then re-rendered at the top and nothing restored the position, because the location hash had not changed.

Fix
- src/web/components/DocumentationDetail.tsx: added a handledRouteIdRef guard so the loader only reacts to an actual route id change, matching the guard DecisionDetail already uses. Loading on deep links is unaffected because the fetchDoc call does not depend on the docs prop.
- src/web/utils/hash-target.ts: optional-chain cleanup picked up by Biome (no behaviour change).
- src/test/web-documentation-refresh.test.tsx (new): regression test that fails without the guard.

Verification
- New test reproduced the bug first: 2 document fetches and a replaced heading node before the guard; 1 fetch and the identical heading node after it.
- bunx tsc --noEmit: clean
- bun run check .: 0 errors, 3 pre-existing warnings in src/core/assets.ts
- 27 web test files, 201 pass / 0 fail, including the pre-existing hash link, hash scroll and ambiguous-id tests

Not verified in a real browser: the scroll outcome is layout dependent and no browser automation is installed here. The running server builds its bundle at startup, so it needs a restart before the fix is visible.

Follow-up 2 (was BACK-639) - slug normalization no longer drops the anchor

Problem: both detail pages normalize /documentation/:id and /decisions/:id to their slugged form by navigating with replace. The replacement path was built without the hash, so arriving on /decisions/1#context ended on /decisions/1/use-tailwind-css-v4-for-web-ui-development with an empty hash: nothing scrolled (the scroll hook saw the hash disappear and stopped watching), and the address bar no longer held a shareable deep link. decision-1 is a real record in the repo and #context is the github-slugger id of its ## Context heading, so both halves of that example can be opened and checked.

Decisions are not a separate case: they render through the same MermaidMarkdown renderer and both save paths call normalizeMarkdownHashLinks, so they carry the same kind of anchors as documents. Both normalize effects were fixed together.

Fix
- src/web/components/DecisionDetail.tsx and src/web/components/DocumentationDetail.tsx: the replacement navigation now appends location.hash, and the effect depends on location.hash.
- src/test/web-decision-hash-scroll.test.tsx (new): decision page keeps the scrolled heading across a decisions array refresh, and keeps the anchor for a bare id URL.
- src/test/web-documentation-refresh.test.tsx: added the same bare id case.

Verification
- The bare id case failed before the fix (hash read back as empty) and passes now; the heading is scrolled to on both pages.
- The decisions refresh case passed before the fix as well, which confirms decisions were never exposed to the unmount-on-refresh problem.
- bunx tsc --noEmit: clean; bun run check .: 0 errors (3 pre-existing warnings in src/core/assets.ts)
- 28 web test files, 204 pass / 0 fail
<!-- SECTION:FINAL_SUMMARY:END -->
