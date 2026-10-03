---
id: BACK-744
title: Keep idle task list watchers from using constant CPU
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 19:35'
updated_date: '2026-10-03 07:11'
labels:
  - cli
dependencies:
  - BACK-743
references:
  - src/commands/watch-json.ts
  - src/cli.ts
  - src/test/watch-json.test.ts
modified_files:
  - src/commands/watch-json.ts
  - src/cli.ts
  - src/test/watch-json.test.ts
priority: high
actual_start: '2026-10-03 06:20'
actual_end: '2026-10-03 07:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --json --watch` (BACK-657) is run by other programs that read its stdout, and such a watch stays resident for as long as the program is open, often several at once. Between task changes it should sit idle, but its 1 s reconciliation tick runs `refresh()` unconditionally: every second it repeats the full canonical task-list read (new Core, duplicate-ID scan, task query, completed corpus for readiness, JSON serialization) even when nothing changed. The cost grows with the watched repository: measured on macOS in a repository with 645 entries under `backlog/`, an idle watcher held a steady 35-42% CPU (17 minutes produced 6m23s of CPU time), while a small scratch repository stays under 1%. This repository carries more than twice that corpus (~1379 markdown files under `backlog/`), so the idle cost is at least as severe here.

Filesystem notifications are not the cause: a recursive `fs.watch` counter saw 0 events in 10 idle seconds. The browser and TUI use ContentStore watchers without this poll and are unaffected.

Keep the watch's periodic reconciliation guarantee (BACK-657: a missed notification is still repaired within about a second) but make the idle check cheap: each second compare a stat signature of the inputs of the canonical read (entry names plus size, mtimeMs and ctimeMs, one level deep, following symlinks like the loaders; missing, dangling or looping entries count by name only) with the signature taken just before the last read, and read only when the signatures differ. Notifications still trigger reads directly, so filters, scope, JSON bytes and update latency are unchanged. Stat one level only: recursively walking `backlog/` follows symlinked directories without a cycle check and can hang under the pinned Bun 1.3.14. The tick keeps the BACK-743 starter check first, so a killed starter still ends the watch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.52.0..v1.53.0 --grep BACK-689` and `git show 1bb3d686` as implementation reference.
- [x] #2 While nothing changes, an idle watch does not repeat the full task-list read: the 1 s tick only compares stat signatures (entry names plus size, mtimeMs and ctimeMs of the inputs, one level deep, following symlinks; missing, dangling or looping entries count by name only), and a full read is scheduled only when the signature differs.
- [x] #3 Task changes still produce a complete updated task list promptly; notifications, filters, local scope and JSON bytes are unchanged, a missed notification is still repaired within about a second, and the signature is taken before each read so a change during the read schedules another pass.
- [x] #4 `src/cli.ts` builds the inputs from the same FileSystem getters the loaders use (tasksDir, completedDir, milestonesDir, archiveMilestonesDir, configFilePath) and passes them as watchJson's second argument; the notification scope (recursive `backlog/` plus the config directory) is unchanged.
- [x] #5 New cases in `src/test/watch-json.test.ts`: an idle watch must not repeat its read (fails on the unfixed timer with 3 reads), and `filesSignature` covers same-size edits that keep the mtime (the ctime reveals them), creation, removal and the non-recursive scope; the directory-link case uses junctions so it runs on Windows, and the file-symlink case is skipped on Windows.
- [x] #6 Implementation Notes record why the signature stats one level only (recursively walking `backlog/` follows symlinked directories without a cycle check and can hang under the pinned Bun 1.3.14), and that the before/after CPU measurements were taken on macOS and were not reproduced on this machine.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Adaptation

`src/commands/watch-json.ts` and `src/test/watch-json.test.ts` match the reference pre-change versions byte for byte, so both are taken verbatim from the reference fix (AC #1). Only the `src/cli.ts` call site is adapted: the inputs array is built from this codebase's FileSystem getters, and the surrounding list-window wiring is left untouched.

### Steps

1. `src/commands/watch-json.ts`: take the reference version verbatim. It exports `filesSignature(inputs)`, changes the tick to check `starterExited()` first and otherwise read only when the signature differs, and takes the signature before each read.

2. `src/cli.ts`: build `inputs` from `filesystem.tasksDir` / `completedDir` / `milestonesDir` / `archiveMilestonesDir` / `configFilePath` and pass it as `watchJson`'s second argument. The notification scope (`backlog/` recursive plus the config directory) stays as is.

3. `src/test/watch-json.test.ts`: take the reference version verbatim. It replaces the in-memory-only reconciliation test (which only passed while the watch reread every second) with an idle no-repeat test and `filesSignature` coverage (same-size edit keeping mtime, creation, removal, scope, junction-linked directory, and a file-symlink case skipped on Windows).

4. Verify with `bunx tsc --noEmit`, Biome on the touched files, and the scoped watch suites. Record in Implementation Notes the one-level rationale and where the CPU measurements were taken.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- `src/commands/watch-json.ts` and `src/test/watch-json.test.ts` are byte-identical to the reference fix (AC #1; verified by diff against its blobs). `filesSignature(inputs)` describes each input file and each directory's entries one level deep as name + size + mtimeMs + ctimeMs joined with NUL separators; `statSync` follows symlinks like the loaders, and missing, dangling or looping entries count by name only. The ctime also moves when a copy keeps the mtime (`cp -p`).

- The 1 s tick now checks `starterExited()` first (BACK-743), and otherwise calls `refresh()` only when `filesSignature(inputs)` differs from the signature taken just before the last read. Notifications still trigger reads directly, so update latency, filters, local scope and JSON bytes are unchanged, and a missed notification is still repaired within about a second.

- `src/cli.ts`: the watch branch of `task list` builds `inputs` from the five FileSystem getters the loaders use (tasksDir, completedDir, milestonesDir, archiveMilestonesDir, configFilePath) and passes it as `watchJson`'s second argument. Milestones are always included even without `--milestone`: they are few files, and unchanged output is suppressed. The notification scope is unchanged (recursive `backlog/` plus the config directory), so directories created later are still seen.

### Why one level only

- The first version of the signature walked `backlog/` recursively. Recursive `readdirSync` follows directory symlinks with no cycle check: one symlink loop cost ~21-25 ms per pass, two loops never finished, and `Bun.Glob` with followSymlinks walks loops to the link limit under the pinned Bun 1.3.14. The adopted version stats exactly the inputs of the canonical read, one level deep; no recursion, realpath set or loop handling remains.

### Measurements

- Taken on macOS in a repository with 645 entries under `backlog/` (60 s idle samples, built binaries side by side): before 21.47 s CPU (35.8%), after 0.41 s (0.68%); other idle runs 0.65-0.88%. During an external edit both watchers emitted the same snapshots byte for byte; in a scratch repo an edit produced the updated list 0.07 s after the command returned. These numbers were not reproduced on this machine. This repository's `backlog/` holds ~1379 markdown files, more than twice that corpus, so the pre-fix idle cost here is at least as severe.

- The remaining idle cost is the 1 s stat pass itself (~3-5 ms of syscalls per ~650 entries on macOS plus GC), roughly 1% per ~800 files. The interval stays at 1 s so the repair cadence for missed notifications is unchanged.

### Tests and platform notes

- `src/test/watch-json.test.ts`: the old reconciliation test changed in-memory state with no file change and only passed while the watch reread every second; it is replaced by an idle test that must not repeat the read for 2.5 s (fails on the old timer with 3 reads) and by `filesSignature` coverage of same-size edits keeping the mtime, creation, removal and the non-recursive scope.

- The directory-link case uses junctions, which link directories on Windows without extra privileges, so it runs here; the file-symlink and looping-link case is skipped on Windows (needs extra privileges), following the existing convention.

- Verification on this machine: `bunx tsc --noEmit` clean; Biome clean on the three touched files (the repo-wide `bun run check .` has 21 pre-existing format errors in untouched files); `bun test --timeout 30000 src/test/watch-json.test.ts src/test/cli-json-watch.test.ts`: 17 pass, 1 skip (the win32 file-symlink case), 0 fail.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Idle `backlog task list --json --watch` processes no longer repeat the full task-list read every second. The 1 s reconciliation tick now checks the starter liveness guard (BACK-743) first and otherwise only compares a cheap stat signature of the canonical read's inputs (entry names plus size, mtimeMs and ctimeMs, one level deep, following symlinks; missing, dangling or looping entries count by name), reading only when it differs. Notifications still trigger reads directly, so filters, scope, JSON bytes and update latency are unchanged, and a missed notification is still repaired within about a second. `src/cli.ts` builds the inputs from the FileSystem getters the loaders use; the notification scope is unchanged. The adopted signature stats one level only, not recursively: a recursive walk follows symlinked directories without a cycle check and can hang under the pinned Bun 1.3.14.

`src/commands/watch-json.ts` and `src/test/watch-json.test.ts` are byte-identical to the reference fix (AC #1); only the `src/cli.ts` call site was adapted to this codebase's getters and list-window wiring. New tests: an idle watch must not repeat its read (fails on the old timer with 3 reads) and `filesSignature` covers same-size edits keeping the mtime, creation, removal, scope, and a junction-linked directory; the file-symlink case skips on Windows. Reference measurements (macOS, 645 entries under `backlog/`): idle CPU dropped from 35.8% to 0.68%; this repository's `backlog/` is more than twice that size. Verification: `bunx tsc --noEmit` clean, Biome clean on the touched files, and the watch suites pass 17 pass / 1 skip / 0 fail.
<!-- SECTION:FINAL_SUMMARY:END -->
