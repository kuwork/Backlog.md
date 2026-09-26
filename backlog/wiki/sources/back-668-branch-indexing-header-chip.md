---
title: BACK-668 Polish the cross-branch indexing loading indicator in the web UI
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - loading
  - cross-branch
source_path: backlog/tasks/back-668 - Polish-the-cross-branch-indexing-loading-indicator-in-the-web-UI.md
---

# BACK-668 Polish the cross-branch indexing loading indicator in the web UI

The server's cross-branch indexing phase line was rendered verbatim in four places (board loading panel plus three sidebar spots), and every `loading` frame flipped `isLoading` back on — replacing loaded content with skeletons and reading as flicker. This task consolidates the signal into one header chip with a hairline sweep, and stops mid-session frames from unmounting loaded content.

## Summary

- New `BranchIndexingIndicator.tsx`: a `role="status"` chip in the header's right cluster plus a 2px sweep track pinned to the header's bottom border, driven by a delayed-appear (250ms) / fade-out (200ms) state machine with both delays as props for tests; a phase finishing inside the appear window mounts nothing
- The chip's visible label is the real progress line run through `translateLoadingMessage` — the fork's deliberate divergence from the ported hardcoded "Indexing branches" caption — truncated at `max-w-[16rem]` with the full line as tooltip; no new locale keys, unmatched phases fall back to the raw server line
- Consecutive progress messages keep the indicator mounted and swap the label instead of restarting the appear window; `lastMessageRef` keeps the line through the exit fade
- `App.tsx` gates mid-session skeletons on `hasLoadedDataRef`: a `loading` frame only sets `isLoading` before the first successful load, so loaded board and trees stay mounted and interactive while indexing runs
- `SideNavigation` lost its `loadingMessage` prop (three placeholders became pure skeletons); `App` stops handing the message to `Board`, so the header chip is the only place the phase line shows
- CSS block (`indexing-sweep` keyframes) ported byte for byte so future merges see no conflict; the component is the only file carrying a divergence
- Live-verified over CDP during the cold-start window in both themes (light captured by removing `.dark` while the frame was frozen with virtual-time pause); 6-case indicator suite plus updated deep-link and sidebar suites, all probes confirmed red first

## Acceptance Criteria

- Indexing state shows as a header chip plus hairline sweep; the four raw sentence places no longer render the phase line
- Chip label is the real progress line translated through `loadingPhrases`, raw fallback, tooltip for truncation, no new locale keys
- After first successful load, later indexing frames leave board and sidebar trees mounted and interactive
- Indicator mounts only after the phase persists and fades out before unmounting; consecutive messages swap label without restarting
- Each new case confirmed red against the reverted change; verified live in both themes

## Related Concepts

- [[concepts/browser-loading]] — loading-state surfaces and skeleton gating this task restructures
- [[concepts/web-ui-features]] — header layout and loading conventions
- [[concepts/web-ui-i18n]] — `loadingPhrases` translation table the chip reuses

## Related Sources

- [[sources/back-669-initial-loading-skeleton]] — direct follow-up covering the pre-first-load surfaces (batch sibling)
- [[sources/back-670-loading-motion-reduce-removal]] — follow-up removing the motion-reduce escapes from this chip (batch sibling)
- [[sources/draft-125-incremental-cross-branch-task-loading]] — the cross-branch loading feature whose progress this displays
