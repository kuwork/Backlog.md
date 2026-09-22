---
id: BACK-621
title: >-
  Fix launcher resolving unprefixed platform package names (regression from
  BACK-550)
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-07 21:46'
updated_date: '2026-09-07 22:28'
labels: []
dependencies: []
modified_files:
  - scripts/resolveBinary.cjs
  - scripts/cli.cjs
  - scripts/postuninstall.cjs
  - src/test/resolveBinary.test.ts
  - src/test/cli-launcher.test.ts
ordinal: 224400
actual_start: '2026-09-07 21:46'
actual_end: '2026-09-07 22:28'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mac arm64 users installing @kuwork/backlog.md@1.49.3-CN get 'Binary package not installed for darwin-arm64' even though the platform package is installed. Root cause: BACK-550 changed scripts/resolveBinary.cjs to build unprefixed platform package names (backlog.md-darwin-arm64) based on the false claim that scoped platform packages are never published; in fact the fork publishes and installs @kuwork/backlog.md-<platform>-<arch> (see package.json optionalDependencies and release.yml). require.resolve with an unscoped specifier never looks inside the @kuwork scope, so resolution fails before spawn. Local builds work because bun run cli runs src/cli.ts directly, bypassing the launcher. Do NOT hardcode the @kuwork prefix back: derive the scope from the main package's own name so the launcher adapts to scoped or unscoped publishing without fork-specific strings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 scripts/resolveBinary.cjs derives the platform package name prefix from the main package.json name (scope if present, empty otherwise); no @kuwork literal in source
- [x] #2 scripts/postuninstall.cjs reuses the same derivation instead of duplicating package name logic
- [x] #3 Tests cover scoped and unscoped name derivation and the darwin fallback matrix still passes
- [x] #4 bunx tsc --noEmit, bun run check ., and bun test all pass
- [x] #5 The scoped platform package names published by `scripts/publish-npm.cmd` (the release-branch script that performs the real npm publish) match what the resolver derives, so that script needs no change; the `release.yml` Actions workflow is unused here and stays as it is.
- [x] #6 The launcher restores the binary's executable bit before spawning (`chmod 0o755`), covering the EACCES risk left by packing binaries on Windows, which puts them in the tarball as mode 0644.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. scripts/resolveBinary.cjs: read own package.json name, derive scope prefix (name starting with @ -> scope + '/', else ''), build platform package names with it; keep darwin fallback matrix and injectable resolver for tests
2. scripts/postuninstall.cjs: reuse the derivation helper from resolveBinary.cjs instead of hardcoded unprefixed names
3. .github/workflows/release.yml: derive expected package name and platform package name from main package.json name (node one-liner), and chmod +x the binary before packing
4. Update src/test/resolveBinary.test.ts for scoped/unscoped derivation; keep cli-launcher.test.ts aligned
5. Validate: bunx tsc --noEmit, bun run check ., bun test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Release-flow check: this repository does not use `.github/workflows/release.yml` (an Actions workflow whose platform package names are unprefixed, and whose package publishing this fork has no rights to); it builds the GitHub Release binaries from the release branch with `scripts/build-release.cmd` and publishes npm by hand with `scripts/publish-npm.cmd`. Both the platform package names and the optionalDependencies in `publish-npm.cmd` are hardcoded scoped `@kuwork` names that match the main package, so a resolver deriving the scope from the main package's own `package.json` name lines up with them: no `@kuwork` literal in the source, and no change needed in `publish-npm.cmd`. Root cause of the EACCES debt: `publish-npm.cmd` packs non-Windows binaries with copy on Windows, so they land in the tarball as mode 0644; `cli.cjs` now runs `chmodSync` 0o755 before spawning, which is simpler than editing the release script and covers every package-manager install path. The `release.yml` edit was reverted so the file stays merge-friendly.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixes a regression introduced by BACK-550: the launcher resolved the platform package with an unprefixed name, while this fork publishes scoped packages (`@kuwork/backlog.md-<platform>-<arch>`), so users on darwin-arm64 hit "Binary package not installed" after installing. No hardcoded `@kuwork`: `scripts/resolveBinary.cjs` now derives the scope prefix from the main package's own `package.json` name (working in both the published layout, `./package.json`, and the repository layout, `../package.json`), and an unscoped publish falls back to the plain name. Changes:
- `scripts/resolveBinary.cjs`: added `getOwnPackageName` / `scopePrefixOf` / `PLATFORM_ARCHES`; `getPackageName` uses the derived prefix
- `scripts/cli.cjs`: restores the executable bit with `chmodSync` 0o755 before spawning (packing on Windows leaves the tarball's binaries at 0644); the install help text uses the dynamic main package name; the argument-cleaning regex is generalized to any scope
- `scripts/postuninstall.cjs`: reuses `PLATFORM_ARCHES` + `getPackageName` instead of a hardcoded list of package names
- tests: `resolveBinary.test.ts` expectations now derive from the repository `package.json` (no `@kuwork` literal) and `scopePrefixOf` gained unit tests; `cli-launcher.test.ts` writes the real package name into its fixture and adds a case for restoring the executable bit
Release-flow check: this fork publishes from the release branch with `scripts/build-release.cmd` + `publish-npm.cmd` (the `release.yml` Actions workflow is unused and was reverted to its original state); the scoped names in `publish-npm.cmd` match what the resolver derives, so that script needs no change.
Verification: `bun test` over resolveBinary/cli-launcher, 27 cases (22 pass / 5 POSIX-only skips on win32); `bunx tsc --noEmit` passes; `bun run check .` passes with only the 3 pre-existing warnings; an end-to-end run against a simulated published layout (main package + scoped platform package + real exe) prints `1.49.3-CN` from `cli.js --version`, and postuninstall derives the correct name list. Neither the source nor the tests contain an `@kuwork` literal.
<!-- SECTION:FINAL_SUMMARY:END -->
