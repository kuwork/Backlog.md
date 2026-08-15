---
id: BACK-559
title: Honor BROWSER for devcontainer browser launch
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-02 16:09'
updated_date: '2026-08-15 07:34'
labels:
  - cli
  - server
dependencies: []
references:
  - src/utils/browser-launch.ts
  - src/cli.ts
  - src/server/index.ts
  - src/test/browser-launch.test.ts
priority: high
actual_start: '2026-08-15 07:08'
actual_end: '2026-08-15 07:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When opening the Web UI, honor a non-empty BROWSER environment variable (devcontainer scenario): treat it as a single executable path — do not split, do not shell-evaluate, accept wrapping quotes (protects paths with spaces and prevents shell injection). When BROWSER is unset or empty, keep the platform fallbacks (open / cmd c start / xdg-open). When automatic opening fails, still print the URL with clear manual-open guidance.

The fork previously had two inline implementations (src/cli.ts openUrlInBrowser, src/server/index.ts openBrowser) that both ignored BROWSER.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-562 and git show 83fca84 as implementation reference.
- [x] #2 When BROWSER is non-empty, opening the Web UI launches that executable with the URL as a separate argument (no splitting, no shell evaluation, wrapping quotes stripped).
- [x] #3 When BROWSER is unset or empty, macOS/Windows/Linux keep their platform fallbacks (open / cmd c start / xdg-open).
- [x] #4 When automatic opening fails, output still includes the URL and clear manual-open guidance (fork try/catch behavior preserved).
- [x] #5 Focused browser-launch tests cover the BROWSER override and fallback behavior with injectable env and platform.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/utils/browser-launch.ts: resolveBrowserLaunchCommand(url, env, platform) returns [executable, url] when BROWSER is non-empty (after trim and quote-stripping), otherwise platform fallback darwin=open / win32=cmd /c start / default xdg-open; launchBrowser(url) runs it via Bun $. env and platform are injectable for tests.
2. Replace the two inline implementations: src/cli.ts openUrlInBrowser and src/server/index.ts openBrowser now call launchBrowser(url). Keep the fork's existing try/catch and manual-open guidance in both callers (the upstream version does not catch, so it cannot be copied verbatim).
3. Remove the now-unused `import { $ } from "bun"` from src/cli.ts and src/server/index.ts (each had exactly one usage).
4. Tests: add src/test/browser-launch.test.ts unit tests for resolveBrowserLaunchCommand with injected env/platform — BROWSER override, whitespace trim, quote stripping, no split/shell evaluation, empty/whitespace/quoted-empty fallback, and all three platform fallbacks.
5. Verify bunx tsc --noEmit, bun run check, focused browser-launch tests, and server regression tests; end-to-end check that a BROWSER .cmd executable receives the URL as a separate argument.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- Added src/utils/browser-launch.ts with resolveBrowserLaunchCommand(url, env, platform) and launchBrowser(url). BROWSER is treated as one executable path: trimmed, wrapping quotes stripped, never split or shell-evaluated. Platform fallbacks: darwin open, win32 cmd /c start, default xdg-open. env and platform are injectable for tests.
- src/cli.ts openUrlInBrowser and src/server/index.ts openBrowser now delegate to launchBrowser(url); both keep their existing try/catch with manual-open guidance.
- Removed the now-unused `import { $ } from "bun"` from both files.

Tests:
- src/test/browser-launch.test.ts: 6 unit tests (BROWSER override, whitespace trim, quote stripping, no split/shell evaluation, empty/whitespace/quoted-empty fallback, all three platform fallbacks) — 6 pass.
- Server regression: server-hostname 5 pass + server-port 6 pass = 11 pass.
- bunx tsc --noEmit pass; biome check pass.
- End-to-end: set BROWSER to a Windows .cmd capture script; server startup invoked it with the URL as a separate argument (captured http://localhost:PORT).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Honored a non-empty BROWSER executable when opening the Web UI from either the CLI or the server, treating it as a single executable path (trimmed, quote-stripped, never split or shell-evaluated) with the URL passed as a separate argument. Platform fallbacks (open / cmd c start / xdg-open) and the existing manual-open guidance are preserved. Extracted the shared logic into src/utils/browser-launch.ts and removed the duplicated inline implementations from src/cli.ts and src/server/index.ts.

Verified by 6 new unit tests, 11 server regression tests, typecheck, biome, and an end-to-end BROWSER launch capture.
<!-- SECTION:FINAL_SUMMARY:END -->
