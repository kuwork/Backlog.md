---
title: BACK-670 Keep the web loading indicators animating when the OS disables animations
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - loading
  - accessibility
source_path: backlog/tasks/back-670 - Keep-the-web-loading-indicators-animating-when-the-OS-disables-animations.md
---

# BACK-670 Keep the web loading indicators animating when the OS disables animations

The dev host runs over RDP with Windows animations off (`MinAnimate=0`), so Chromium reports `prefers-reduced-motion: reduce` and every loading affordance — inherited verbatim from upstream ports — rendered completely still. A frozen spinner is indistinguishable from a hung app, so the six `motion-reduce:` suppressions were dropped as a deliberate fork divergence.

## Summary

- Root cause confirmed per state over CDP: `reducedMotion: true`, ring computed `animation-name: none`, identical transform matrices 260ms apart — the ring was drawn but not turning
- The suppression is upstream's own code (greps of `f52b190c6` and `v1.52.0` match), inherited while porting BACK-654/BACK-665: 5 × `motion-reduce:animate-none` + 1 × `motion-reduce:hidden` across `LoadingSpinner`, `BoardLoadingSkeleton` (ring + ghost pulses) and `BranchIndexingIndicator` (ring + sweep)
- Fork decision: loading progress is essential feedback, not decoration — a still ring on a still skeleton reads as a broken screen on exactly the hosts that disable animations most often (RDP, VMs, kiosks); each removal site carries a comment recording the WHY so the next porter does not restore it by reflex
- Registered as a deliberate divergence in the migration ledger (doc-12/doc-13 WEB-14 rows); `motion-reduce` stays available for genuinely decorative motion added later
- Side observation: the pre-BACK-669 spinner kept turning because it had no escape hatch — but as a square, `rounded-full` being a dead utility; that explains why "it stopped after the circle swap"
- jsdom contract assertions pin the absence of `motion-reduce` in all three components; 5 revert probes red; live CDP probe on the reduce-reporting host shows rings at `animation-name: spin`, ghosts at `pulse`, sweep bar rendered
- Number-ownership note: local BACK-670 and upstream BACK-670 (remove standalone task dependencies command, #993) are different tasks sharing a number
- Incidental findings not changed: `PasteAwareMDEditor.tsx` still uses dead `rounded-full`; holding `/api/status` leaves the client stuck loading (probe side effect)

## Acceptance Criteria

- No `motion-reduce:` utility remains in the three loading components, with source-level assertions that fail if one returns
- On a reduce-reporting host all rings report computed `animation-name: spin` with changing transforms; ghosts pulse; sweep bar rendered
- Class contract under test per component; restoring any of the six utilities turns assertions red
- Ledger documents the local/upstream BACK-670 number collision

## Related Concepts

- [[concepts/browser-loading]] — loading indicators whose animation contract this task defines
- [[concepts/upstream-migration]] — recorded deliberate divergence from upstream ported code
- [[concepts/ci-platform-contracts]] — host-environment (RDP/reduced-motion) assumptions verified live

## Related Sources

- [[sources/back-668-branch-indexing-header-chip]] — introduced the chip and sweep whose escapes are removed here (batch sibling)
- [[sources/back-669-initial-loading-skeleton]] — introduced the skeleton ring and ghost pulses fixed here (batch sibling)
