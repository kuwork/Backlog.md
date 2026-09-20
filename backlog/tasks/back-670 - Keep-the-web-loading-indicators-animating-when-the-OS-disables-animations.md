---
id: BACK-670
title: Keep the web loading indicators animating when the OS disables animations
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-20 05:13'
updated_date: '2026-09-20 05:48'
labels: []
dependencies: []
references:
  - src/web/components/LoadingSpinner.tsx
  - src/web/components/BoardLoadingSkeleton.tsx
  - src/web/components/BranchIndexingIndicator.tsx
  - src/test/web-board-loading-skeleton.test.tsx
  - src/test/web-branch-indexing-indicator.test.tsx
  - src/test/web-task-deep-link.test.tsx
modified_files:
  - src/web/components/LoadingSpinner.tsx
  - src/web/components/BoardLoadingSkeleton.tsx
  - src/web/components/BranchIndexingIndicator.tsx
  - src/test/web-board-loading-skeleton.test.tsx
  - src/test/web-branch-indexing-indicator.test.tsx
  - src/test/web-task-deep-link.test.tsx
ordinal: 253400
actual_start: '2026-09-20 05:13'
actual_end: '2026-09-20 05:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The machine this fork is developed and inspected on runs over RDP with Windows animations switched off (`HKCU\Control Panel\Desktop\WindowMetrics\MinAnimate=0`, session `RDP-Tcp#0`), so Chromium reports `prefers-reduced-motion: reduce`. Every loading affordance the web UI shows carries a `motion-reduce:` escape hatch, and that host therefore renders a **completely still loading state**: the centre ring of the board skeleton, the pre-init ring and the header indexing chip's ring never rotate, the ghost cards never pulse, and the header sweep bar is removed outright. A frozen spinner is indistinguishable from an app that has hung.

## Where the suppression comes from

It is upstream's own code, inherited verbatim while porting BACK-654 (WEB-12) and BACK-665 (WEB-14), not a fork invention:

- `git show f52b190c6:src/web/components/BranchIndexingIndicator.tsx` — ring `motion-reduce:animate-none`, sweep bar `motion-reduce:hidden`
- `git show v1.52.0:src/web/components/LoadingSpinner.tsx` — ring `motion-reduce:animate-none`
- `git show v1.52.0:src/web/components/BoardLoadingSkeleton.tsx` — ring and both ghost-card blocks `motion-reduce:animate-none`

The same suppression also silently removed the spinning the fork had before BACK-669: the old board panel's spinner was `animate-spin rounded-full` with no escape hatch, so it kept turning (as a bordered square, `rounded-full` being a dead utility in this build). BACK-669 swapped it for a correct circle that no longer turns on this host.

## Fork decision

Loading progress is essential feedback, not decoration: a still ring on a still skeleton reads as a broken screen on exactly the hosts that disable animations most often (RDP, VMs, kiosks). The six suppression sites are therefore dropped — the loading state always animates. `motion-reduce` stays available for genuinely decorative motion added later, and the rule is recorded in a comment at each site so the next porter does not restore it by reflex.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Confirm the suppression is upstream's own code rather than a fork slip, so the entry is a recorded divergence: `git show f52b190c6:src/web/components/BranchIndexingIndicator.tsx | grep motion-reduce` and `git show v1.52.0:src/web/components/LoadingSpinner.tsx | grep motion-reduce` both match.
- [x] #2 No `motion-reduce:` utility remains in `LoadingSpinner`, `BoardLoadingSkeleton` (centre ring and ghost cards) or `BranchIndexingIndicator` (ring and sweep bar), and a source-level assertion fails if one returns.
- [x] #3 On this host, which reports `prefers-reduced-motion: reduce` (`MinAnimate=0` over RDP), the pre-init ring, the board skeleton ring and the header chip ring all report computed `animation-name: spin` and a transform matrix that changes between two samples ~260 ms apart.
- [x] #4 On the same host the ghost cards report `animation-name: pulse` and the header sweep bar is rendered instead of hidden.
- [x] #5 jsdom cases pin the class contract for all three components; the two cases that previously asserted `motion-reduce:animate-none` now assert its absence.
- [x] #6 `bunx tsc --noEmit` is clean, `bun run check .` reports no new findings, and the four web test files pass.
- [x] #7 Revert probes: restoring `motion-reduce:animate-none` or `motion-reduce:hidden` at any of the six sites turns the corresponding assertions red.
- [x] #8 The task record and the doc-12 number-ownership note state that local 670 and upstream BACK-670 (Remove the standalone task dependencies command and its TUI, #993) are different tasks sharing a number.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce on the host before touching code: read `MinAnimate`, then probe the live app through CDP for `matchMedia("(prefers-reduced-motion: reduce)").matches` and the ring's computed `animation-name` — expect `true` and `none`, which places the fault in the media query rather than in the components.
2. Drop the six `motion-reduce:` utilities (five `animate-none`, one `hidden`) and record the rule in a comment at each family: `LoadingSpinner`, `BoardLoadingSkeleton` (ring + ghost cards), `BranchIndexingIndicator` (ring + sweep).
3. Update the two cases that pinned the suppression, and put the class contract under test for each component so it cannot come back silently.
4. Re-run the four web test files, `bunx tsc --noEmit` and `bun run check .`.
5. Run the revert probes: restoring any one of the six utilities must turn the new assertions red.
6. Re-probe the live app on this host (where reduce is on) and screenshot the animating pre-init, skeleton and settled states.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Root cause

This machine runs an RDP session with `HKCU\Control Panel\Desktop\WindowMetrics\MinAnimate=0` (system animations off), so Chromium reports `prefers-reduced-motion: reduce`. The upstream BACK-654/BACK-665 ports gave every loading animation an escape hatch (5 × `motion-reduce:animate-none` + 1 × `motion-reduce:hidden`), so the whole loading UI renders completely still on such hosts.

Verified per state over CDP: `reducedMotion: true`, the ring's computed `animation-name: none`, and two `transform` samples 260 ms apart are identical — on the real host the ring is drawn but not turning.

The board spinner before BACK-669 was `animate-spin rounded-full` with no escape hatch, so it kept turning (except `rounded-full` is a dead utility in this build, so what turned was a square). That explains why it felt like "it stopped turning after the circle swap".

## What changed

Removed the six suppressions: the `LoadingSpinner` ring, the `BoardLoadingSkeleton` ring and both ghost pulses, and the `BranchIndexingIndicator` ring plus header sweep. Each component's doc comment now records the WHY: loading progress is essential feedback and must keep moving on hosts with system animations off — a still ring is indistinguishable from a hang.

## Upstream comparison

The suppression classes are upstream's own code (both `git show f52b190c6:src/web/components/BranchIndexingIndicator.tsx` and `git show v1.52.0:src/web/components/LoadingSpinner.tsx` grep for them), so this is a **deliberate fork divergence**. It is registered in doc-12's WEB-14 row and doc-13's WEB-14 "migration suggestion" row.

## Verification

- The three test files gained or updated contract assertions: component `innerHTML` contains no `motion-reduce`, rings no longer carry `animate-none`, ghost cards no longer carry `animate-none`.
- `tmp/revert-verify-670.py`: all 5 revert probes turn red — restoring any single suppression class fails its case, and the script sha1-checks that the files were restored afterwards.
- `tmp/cdp-spin670.mjs` on the real host (`reducedMotion: true`): the pre-init ring, skeleton ring, and header chip ring all report `animation-name: spin` / `1s` with different transform matrices across two samples; ghost cards report `pulse` / `2s`; the sweep bar reports `display:block`, `opacity:1`, `animation:indexing-sweep`; the chip text is the localized real-progress sentence "indexing 3 other local branches...".
- `bunx tsc --noEmit` clean, `bun run check .` clean, and the four web test files pass.

## Incidental findings (not changed here)

1. `PasteAwareMDEditor.tsx:263` still uses the dead `rounded-full` class (renders as a square). This falls under upstream BACK-668 "Replace dead rounded-full classes", i.e. the WEB-17 entry in doc-12.
2. Holding `/api/status` via CDP leaves the client stuck in the loading state — there is no other clearing point after missing the server's `loaded` broadcast, while an unblocked cold load settles within 4 s. Judged a probe side effect, not introduced by this change; to be evaluated separately if needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the six `motion-reduce:` escapes the port had inherited from upstream. On hosts that report `prefers-reduced-motion: reduce` — which is what an RDP session with system animations off looks like — the whole loading surface used to render completely still, so the new circle read as a hung app. Ring, ghost pulses and header sweep now always animate, and the deliberate divergence is recorded in the migration ledger.
<!-- SECTION:FINAL_SUMMARY:END -->
