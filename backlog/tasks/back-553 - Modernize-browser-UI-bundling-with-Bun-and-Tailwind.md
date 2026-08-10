---
id: BACK-553
title: Modernize browser UI bundling with Bun and Tailwind
status: Done
assignee:
  - '@kimi'
created_date: '2026-07-08 20:30'
updated_date: '2026-08-09 16:25'
labels:
  - build
dependencies: []
actual_start: '2026-08-09 16:19'
actual_end: '2026-08-09 16:23'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modernize the browser UI build path to a Bun-native full-stack build: use Bun.build + bun-plugin-tailwind so the compiled binary embeds the React app, Tailwind CSS, JavaScript, and static assets directly from source. Remove the committed generated style.css artifact and the obsolete favicon fallback, and refresh stale Bun runtime guidance. The current build flow is build:css (@tailwindcss/cli pre-generates src/web/styles/style.css) followed by bun build --compile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.47.1..v1.48.0 --grep BACK-525 and git show dcaf173 as implementation reference.
- [x] #2 The production build compiles a single Backlog binary with browser UI assets embedded from source CSS, without relying on the committed generated style.css.
- [x] #3 The web shell (src/web/index.html) references the source Tailwind entry and the compiled binary serves hashed CSS, JS, and favicon assets from the HTML bundle.
- [x] #4 Regression coverage and build smoke checks verify browser asset serving, no-store HTML headers, and compiled binary behavior (src/test/build.test.ts).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add scripts/build.ts using Bun.build + bun-plugin-tailwind to replace the build:css prebuild, supporting BACKLOG_BUILD_OUTFILE/BACKLOG_BUILD_VERSION/BACKLOG_BUILD_TARGET env vars and the compile outfile. 2. Point the src/web/index.html stylesheet link from ./styles/style.css to ./styles/source.css and delete the committed generated src/web/styles/style.css. 3. Remove the /favicon fallback branch and favicon import from src/server/index.ts; let Bun serve hashed favicon assets from the HTML bundle. 4. Sync package.json build/cli scripts, CI/release/Nix/dev docs to the shared build script. 5. Extend src/test/build.test.ts to cover compiled-browser asset serving, no-store HTML headers, and compiled-binary behavior; verify install/build/tsc/check/test and compiled/dev browser serving.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migrated the browser UI build to a Bun-native pipeline. Added scripts/build.ts using Bun.build + bun-plugin-tailwind (supports BACKLOG_BUILD_OUTFILE/BACKLOG_BUILD_VERSION/BACKLOG_BUILD_TARGET env vars), pointed src/web/index.html at src/web/styles/source.css, removed the committed generated style.css, removed the obsolete favicon fallback in src/server/index.ts (favicon import and /favicon branch), updated package.json scripts (build/cli -> scripts/build.ts), added [serve.static] plugins = [bun-plugin-tailwind] to bunfig.toml for dev mode, and updated ci.yml/release.yml/flake.nix build steps to invoke scripts/build.ts. Extended src/test/build.test.ts to spawn the compiled binary, serve the browser, and assert no-store HTML headers plus hashed CSS/JS/favicon asset responses. Fork difference: the local browser command has no --non-interactive flag (upstream test uses it), so the migrated test spawns with --no-open --port only; manual run confirmed the compiled browser server serves assets correctly. Installed bun-plugin-tailwind@0.1.2 and dropped @tailwindcss/cli.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Modernized the browser UI build around Bun.build and bun-plugin-tailwind so the compiled binary embeds the React app, Tailwind CSS, JS, and favicon assets from source. Replaced the build:css prebuild and committed generated style.css with scripts/build.ts, pointed the web shell at source.css, removed the server favicon fallback, and aligned package.json/bunfig.toml/ci.yml/release.yml/flake.nix/DEVELOPMENT.md with the shared build script. Added compiled-browser asset and no-store coverage to src/test/build.test.ts. Verified with bunx tsc --noEmit, bunx biome check, bun scripts/build.ts (built a 105MB compiled binary), and bun test src/test/build.test.ts (1 pass, 16 assertions).
<!-- SECTION:FINAL_SUMMARY:END -->
