---
title: BACK-669 Polish the web UI initial loading state
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - loading
source_path: backlog/tasks/back-669 - Polish-the-web-UI-initial-loading-state.md
---

# BACK-669 Polish the web UI initial loading state

Ports the upstream loading-state polish (PR #977, "the old ugly square") to the fork's two pre-first-load surfaces. Root cause in this fork: `rounded-full` is deliberately excluded from the compiled Tailwind CSS, so the board's first-load spinner rendered as a spinning bordered square, and the app pre-init screen was bare "Loading..." text.

## Summary

- Root cause verified in-fork: `src/web/styles/source.css` excludes `rounded-full` (`@source not inline(...)`; project utility is `rounded-circle`); the reported "~13k px giant SVG" does not reproduce — it matches the unstyled dev shell before the stylesheet applies
- New `BoardLoadingSkeleton.tsx`: `columnCount` ghost columns mirroring real column chrome (`flex-1 min-w-[16rem]`, `rounded-lg p-4 min-h-24` card — `min-h-24` is TaskColumn's empty floor so the board never contracts), `animate-pulse` placeholders honouring `motion-reduce`, all `aria-hidden`, with the compact ring centred over them and an sr-only `t.board.loading`
- Fork divergence: the skeleton takes no `message` prop and renders no progress sentence — the header chip has owned that since BACK-668, so a second copy would duplicate the same line; labels come from i18n rather than hardcoded English
- `App.tsx` pre-init screen (`isInitialized === null`) renders the shared `LoadingSpinner` ring with an sr-only `t.nav.projectLoading` under `role="status"`; `LoadingSpinner` gained `motion-reduce:animate-none` (later removed again by BACK-670)
- Dead plumbing removed: Board/BoardPage drop the `loadingMessage` prop and `translateLoadingMessage`/`locale` leftovers that BACK-668 orphaned; BACK-668's `hasLoadedDataRef` gating untouched, so only the pre-first-load window shows the skeleton
- Real-machine measurements over CDP (endpoints held via Fetch domain): ring computes to 9999px radius, ghost columns match real column geometry, content replaces ghosts cleanly; 7 revert probes all red, 6 new jsdom cases, 20/20 scoped tests

## Acceptance Criteria

- Pre-init screen shows the shared spinner ring with locale sr-only label in both themes instead of bare text
- Board first-load branch renders `BoardLoadingSkeleton` with `statuses.length` columns (three-ghost fallback) mirroring real column chrome
- Loading path never uses the dead `rounded-full`; skeleton announces only via `role="status"` + localized label, no duplicated progress sentence
- Board/BoardPage carry no leftover `loadingMessage` prop; jsdom tests cover skeleton, BoardPage loading and pre-init screen with revert probes

## Related Concepts

- [[concepts/browser-loading]] — pre-first-load loading surfaces and skeleton design
- [[concepts/web-ui-features]] — board column chrome the skeleton mirrors

## Related Sources

- [[sources/back-668-branch-indexing-header-chip]] — prerequisite: owns the mid-session loading signal and `hasLoadedDataRef` gating (batch sibling)
- [[sources/back-670-loading-motion-reduce-removal]] — follow-up removing the motion-reduce escapes this task added (batch sibling)
- [[sources/back-613-web-task-list-width-page-shell]] — earlier board layout geometry work
