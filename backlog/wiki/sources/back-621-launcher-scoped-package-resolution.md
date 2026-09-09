---
title: BACK-621 Fix launcher resolving unprefixed platform package names (regression from BACK-550)
created_date: '2026-09-07 22:28'
updated_date: '2026-09-07 22:28'
labels:
  - source
  - cli
  - bug
  - release
source_path: backlog/tasks/back-621 - Fix-launcher-resolving-unprefixed-platform-package-names-regression-from-BACK-550.md
---

# BACK-621 Fix launcher resolving unprefixed platform package names (regression from BACK-550)

Mac arm64 users installing `@kuwork/backlog.md@1.49.3-CN` got 'Binary package not installed for darwin-arm64' even though the platform package was installed. BACK-550 had changed `scripts/resolveBinary.cjs` to build unprefixed platform package names based on the false claim that scoped platform packages are never published; `require.resolve` with an unscoped specifier never looks inside the `@kuwork` scope, so resolution failed before spawn. The fix derives the scope from the main package's own `package.json` name — no `@kuwork` literal anywhere in source or tests.

## Summary

- `scripts/resolveBinary.cjs`: new `getOwnPackageName`/`scopePrefixOf`/`PLATFORM_ARCHES` helpers; `getPackageName` builds `@<scope>/backlog.md-<platform>-<arch>` or unprefixed names when unscoped — compatible with both publish layout (`./package.json`) and repo layout (`../package.json`); darwin fallback matrix and injectable resolver kept
- `scripts/postuninstall.cjs`: reuses `PLATFORM_ARCHES` + `getPackageName`, deleting its hardcoded package-name list
- `scripts/cli.cjs`: `chmodSync 0o755` on the binary before spawn — covers the EACCES risk from `publish-npm.cmd` packing non-Windows binaries on Windows (tarball mode 0644); install help text uses the dynamic main package name; arg-cleanup regex generalized to any scope
- Publishing reality check: the fork does not use upstream `.github/workflows/release.yml`; it publishes manually from the release branch via `scripts/build-release.cmd` + `scripts/publish-npm.cmd`, whose hardcoded `@kuwork` scoped names already match the derivation — release.yml changes were reverted to stay merge-compatible with upstream
- Tests: `resolveBinary.test.ts` derives expectations from the repo package.json dynamically (no scope literal) + `scopePrefixOf` unit tests; `cli-launcher.test.ts` fixture writes the real package name + execute-bit restore case; 22 pass / 5 POSIX-skip on win32; end-to-end simulated published layout runs `cli.js --version` → 1.49.3-CN

## Acceptance Criteria

- resolveBinary.cjs derives the prefix from the main package.json name; no @kuwork literal in source
- postuninstall.cjs reuses the same derivation
- Tests cover scoped/unscoped derivation; darwin fallback matrix passes
- tsc, biome, bun test pass
- publish-npm.cmd published names match the derivation unchanged; release.yml left as upstream
- Launcher restores the execute bit (chmod 0o755) before spawn

## Related Concepts

- [[concepts/cli-entry]] — launcher/resolveBinary resolution chain from global install to binary spawn

## Related Sources

- [[sources/back-550-apple-silicon-binary-resolution]] — the BACK-550 change that introduced this regression
