---
id: BACK-507
title: Fix Windows npm install failure caused by sh-dependent postinstall script
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-04 13:55'
updated_date: '2026-06-04 13:59'
labels:
  - bug
  - windows
  - npm
dependencies: []
modified_files:
  - package.json
  - scripts/postinstall.cjs
priority: high
ordinal: 166400
actual_start: '2026-06-04 05:59'
actual_end: '2026-06-04 05:59'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Windows users encounter installation failure when running npm i -g @kuwork/backlog.md because the postinstall script uses sh -c syntax which does not exist on Windows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Windows users can install the package without errors
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Problem Analysis

Windows users installing `@kuwork/backlog.md` via `npm i -g` encountered a fatal error:

```
command failed: cmd.exe /d /s /c sh -c 'command -v bun2nix ...'
```

Root cause: `package.json` contained a `postinstall` script using `sh -c '...'`, which relies on the Unix shell `sh`. Windows does not have `sh` by default, causing npm's install lifecycle to fail.

### Solution Evolution

**Attempt 1 — Direct deletion:**
- Simply removed the `postinstall` line from `package.json`.
- Pro: Windows installation succeeds immediately.
- Con: Developers working in the git repo lose automatic `bun.nix` regeneration after `bun install`.

**Attempt 2 — Cross-platform inline Node.js command:**
- Considered replacing `sh -c '...'` with a long `node -e "..."` string inside `package.json`.
- Con: Unreadable, unmaintainable, and still wouldn't match the original fallback logic (bun2nix → nix run).

**Final Approach — Dedicated `scripts/postinstall.cjs`:**
- Created `scripts/postinstall.cjs` following the same style as the existing `scripts/postuninstall.cjs`.
- Logic:
  1. Check if `.git` exists. If not, this is an npm install from the registry → **skip entirely**.
  2. Detect commands cross-platform: `where` on Windows, `command -v` on Unix.
  3. If `bun2nix` exists locally → run `bun2nix -o bun.nix`.
  4. Else if `nix` exists → run `nix run github:baileyluTCD/bun2nix/... -- -o bun.nix`.
  5. Otherwise → silently ignore (optional step).
- Updated `package.json`:
  ```json
  "postinstall": "node scripts/postinstall.cjs"
  ```

### Key Design Decisions

- **`.git` guard:** Prevents the script from running during end-user installation. Only runs in a development clone.
- **No new file for end-users to worry about:** `scripts/*.cjs` is already included in `package.json`'s `files` array, so `postinstall.cjs` ships with the package.
- **Preserved original Nix sync behavior:** The fallback chain (bun2nix → nix run → ignore) is identical to the original `sh` script.

### Verification

- `package.json` no longer references `sh` in `postinstall`.
- Windows `npm install` from registry: script exits immediately (no `.git`), no error.
- Unix development environment: `.git` exists → script correctly detects `bun2nix`/`nix` and regenerates `bun.nix`.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
