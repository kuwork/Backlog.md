---
id: BACK-550
title: Improve binary resolution on Apple Silicon (Rosetta/arch mismatch)
status: Done
assignee: []
created_date: '2025-08-17 17:00'
updated_date: '2026-08-08 01:28'
labels: []
dependencies: []
actual_start: '2026-08-08 00:50'
actual_end: '2026-08-08 01:15'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On M1/M2 Macs, users can have Node/Bun running under Rosetta (x64) while the OS/CPU is arm64, causing the launcher to resolve the wrong platform package or install only one variant, producing errors like illegal hardware instruction or Binary package not installed. Goals: make the macOS binary resolver more robust (detect Rosetta and fall back between darwin arm64 and x64), provide clear actionable error output with reinstall guidance (brew paths, arch checks), and add Apple Silicon install documentation. Scope: scripts/resolveBinary.cjs tries darwin-arm64 and darwin-x64 package names in order when require.resolve fails and runs whichever exists; detects Rosetta via sysctl -in sysctl.proc_translated and hints it in error/help output; error message shows process.platform/process.arch, Rosetta status, and the package name looked up; README gains an Apple Silicon troubleshooting section. Out of scope: universal binaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-240 and git show a659ac7 as implementation reference.
- [x] #2 scripts/resolveBinary.cjs supports bidirectional darwin arm64<->x64 fallback on macOS: resolve the native-arch package first, fall back to the sibling darwin arch on failure; no fallback on non-darwin platforms. Preserve the fork's @kuwork/ package-name prefix.
- [x] #3 scripts/cli.cjs distinguishes missing vs arch-mismatch errors (errno -86 / EBADARCH / ENOEXEC / ENOENT), outputs detected platform-arch, Rosetta status, and actionable reinstall guidance; exits non-zero when the child dies from a signal (SIGILL/SIGTRAP).
- [x] #4 Tests cover the resolution matrix: darwin bidirectional fallback, linux/win32 no-fallback, .exe suffix, both-missing error, non-darwin short-circuit; bunx tsc --noEmit and bun run check pass.
- [x] #5 README adds an Apple Silicon troubleshooting section (native-arch reinstall commands for brew/npm/bun).
- [x] #6 scripts/resolveBinary.cjs supports bidirectional darwin arm64<->x64 fallback on macOS: resolve the native-arch package first, fall back to the sibling darwin arch on failure; no fallback on non-darwin platforms. Package names use the fork's published unprefixed backlog.md-<platform>-<arch> form (@kuwork scope only applies to the main package, not platform packages).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/resolveBinary.cjs: build an ordered candidate package-name list (native darwin arch first, sibling darwin arch as fallback; no fallback on linux/win32 or unknown darwin arches), expose getCandidatePackageNames and isRosettaTranslated (sysctl -in sysctl.proc_translated), and let resolveBinaryPath accept an injectable resolver for tests; keep the @kuwork/ package-name prefix.
2. scripts/cli.cjs: unify error handling - route both synchronous spawn throws and error events through isBinaryInstallError classification (errno -86 / EBADARCH / ENOEXEC / ENOENT), print platform-arch, Node version, Rosetta status, and macOS remediation commands; exit 1 (not 0) on child signal death; guard main with require.main === module for integration tests.
3. src/test: port resolveBinary.test.ts (darwin bidirectional fallback matrix, linux/win32 no-fallback, .exe suffix, both-missing error, non-darwin short-circuit) and cli-launcher.test.ts (missing-package guidance + exit 1, args/exit-code passthrough, SIGILL guidance, SIGTERM exit 143, ENOEXEC), adapting assertions to the @kuwork/ package name.
4. README.md: add a Troubleshooting > Apple Silicon (macOS) section with arch checks and native-arch reinstall commands for brew/npm/bun.
5. Validation: bunx tsc --noEmit, bun run check ., bun test (resolveBinary/cli-launcher related).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: scripts/resolveBinary.cjs now builds an ordered candidate package-name list (native darwin arch first, sibling darwin arch as fallback; no fallback on linux/win32 or unknown darwin arches), exposes getCandidatePackageNames and isRosettaTranslated (sysctl -in sysctl.proc_translated), and resolveBinaryPath accepts an injectable resolver for tests. Platform package names use the fork's published unprefixed form (backlog.md-<platform>-<arch>); the @kuwork scope applies only to the main package, not platform packages - this also fixes the pre-existing bug where the launcher looked up scoped @kuwork/backlog.md-* names that are never published. scripts/cli.cjs routes both synchronous spawn throws and error events through isBinaryInstallError (errno -86 / EBADARCH / ENOEXEC / ENOENT), prints platform-arch, Node version, Rosetta status, and macOS remediation commands; child signal deaths exit 1 instead of 0; main guarded by require.main === module. Ported resolveBinary.test.ts (16 pass) and cli-launcher.test.ts (3 pass / 4 skip on win32) with unprefixed package-name assertions and correct node_modules layout. Added a README Troubleshooting > Apple Silicon (macOS) section in Chinese matching the fork README language. Verified with bunx tsc --noEmit, bun run check ., and bun test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made the launcher robust on Apple Silicon: scripts/resolveBinary.cjs tries the native darwin arch package first and falls back to the sibling darwin arch (arm64 <-> x64) since macOS runs either variant, detects Rosetta via sysctl.proc_translated. Platform package names use the fork's published unprefixed form (backlog.md-<platform>-<arch>); the @kuwork scope applies only to the main package, and the fix corrects the pre-existing bug where the launcher resolved scoped names that are never published. scripts/cli.cjs prints detected platform-arch, Rosetta status, tried packages, and concrete reinstall commands on resolution failure, ENOENT/EBADARCH/ENOEXEC spawn errors, and SIGILL/SIGTRAP crashes (which now exit 1 instead of 0). Ported the resolution-matrix test suite (resolveBinary.test.ts, 16 pass) and launcher integration tests (cli-launcher.test.ts, 3 pass / 4 POSIX-skip on win32). Added a Chinese README Troubleshooting > Apple Silicon (macOS) section. Verified with bunx tsc --noEmit, bun run check ., and bun test; bun scripts/cli.cjs --version exits 0.
<!-- SECTION:FINAL_SUMMARY:END -->
