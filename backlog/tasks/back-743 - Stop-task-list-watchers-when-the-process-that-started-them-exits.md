---
id: BACK-743
title: Stop task list watchers when the process that started them exits
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-23 19:31'
updated_date: '2026-10-03 06:47'
labels:
  - cli
dependencies: []
references:
  - src/commands/watch-json.ts
  - scripts/cli.cjs
  - src/test/cli-json-watch.test.ts
modified_files:
  - scripts/cli.cjs
  - src/commands/watch-json.ts
  - src/cli.ts
  - src/test/cli-json-watch.test.ts
  - src/test/test-utils.ts
  - src/guidelines/cli-instructions/overview.md
  - CLI-INSTRUCTIONS.md
priority: high
actual_start: '2026-10-03 05:29'
actual_end: '2026-10-03 06:47'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`backlog task list --json --watch` is run by other programs that read its stdout. When such a program ends without stopping the watch, because its terminal is closed or it is killed, the watcher keeps running as an orphan (reparented to PID 1 on POSIX). An orphaned watcher exits only when a task change makes it write to its closed stdout, so in a quiet repository it runs indefinitely. The watch in `src/commands/watch-json.ts` has no liveness guard: its 1 s reconcile tick refreshes unconditionally.

The program that starts the watch cannot prevent this alone: a killed process cannot stop its children, and on npm installs the process it starts is the Node launcher `scripts/cli.cjs`. The launcher spawns the native binary with inherited stdio, forwards no signals, and does not notice when its own parent dies. A caller may start the watch in its own process group and stop it by signalling that group.

Make the watch end when the process that started it ends. The launcher passes the native binary one internal, undocumented env value naming the launcher and the process that started it (`launcher pid:parent pid`); the watch records its own parent, plus the launcher's parent when that value names its own parent as the launcher, and on its existing 1 s tick stops like SIGTERM through the existing exit-143 forced-exit path once the parent changed (POSIX reparenting) or a recorded process no longer exists (`kill(pid, 0)` returning ESRCH, which also covers Windows). Do not use Bun no-orphans: it is process-wide (would also end `backlog browser` run as a service), SIGKILLs every descendant on exit, is a no-op on Windows, and cannot cover the Node launcher.

Scope: processes started for the watch, directly or through the launcher. Other long-running commands, such as `backlog browser` run as a service, keep their current lifetime.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using `git log --oneline v1.52.0..v1.53.0 --grep BACK-688` and `git show 2c8183a3` as implementation reference.
- [x] #2 When the process that started `backlog task list --json --watch` exits or is killed, including with SIGKILL, the watcher exits without waiting for a task change.
- [x] #3 The same holds when the watch starts through the npm launcher: neither the launcher nor the native binary outlives the process that started the launcher. The launcher change is limited to injecting the internal env value; lifetime, exit codes, signal mapping and arg cleaning are unchanged, and no helpers are re-exported.
- [x] #4 While the starting process lives, the watch keeps emitting complete task lists; a stale env value inherited through unrelated processes is ignored, so a directly started watch carrying one keeps running; and signalling the process group of a launched watch still stops both the launcher and the native binary.
- [x] #5 New cases in `src/test/cli-json-watch.test.ts` kill the starting process with SIGKILL and require stdout EOF within a bound, for a direct watch and for one started through `node scripts/cli.cjs` with a fixture platform package; they build on the existing Windows-safe `collect()` scaffold (`Promise.race([drain, until])`), and both fail on the unfixed code with a timeout waiting for exit.
- [x] #6 The watch field of `task list --help`, `src/guidelines/cli-instructions/overview.md` and `CLI-INSTRUCTIONS.md` state that the watch ends when the process that started it ends.
- [x] #7 Implementation Notes record the two known limits: through the launcher, the starter's exit is seen once its own parent has reaped it (`kill(pid, 0)` succeeds on zombies), and PID reuse within one tick delays detection.
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

The watch (`src/commands/watch-json.ts`) and the launcher spawn block (`scripts/cli.cjs`) take the fix almost verbatim; only the tests are adapted, growing on this codebase's Windows-safe `collect()` scaffold in `src/test/cli-json-watch.test.ts` instead of assuming that a killed child's streams report end.

### Steps

1. `scripts/cli.cjs`: in the native-binary spawn block, set one internal, undocumented env value `BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>` on the child environment. Inert for every command except the watch. No launcher lifetime, exit-code, signal or arg-cleaning change; keep the existing inline signal handling and do not re-export helpers.

2. `src/commands/watch-json.ts`: capture `const parent = process.ppid` at module load, before parsing and project lookup. Record the launcher's parent as a second starter only when the env value's first segment equals this process's own parent, so stale values inherited through other processes are ignored. Add `isRunning(pid)` using `process.kill(pid, 0)` where only `ESRCH` counts as gone, and `starterExited()` reporting true when the parent changed (POSIX reparenting) or any recorded pid is gone. Change the existing `setInterval(refresh, 1000)` tick to `starterExited() ? onTerminate() : refresh()`, reusing the existing exit-143 forced-exit path.

3. `src/cli.ts`: the existing `watchJson(...)` call needs no wiring change; only the watch help field gains one sentence stating that the watch ends when the process that started it ends.

4. Documentation: the same sentence in `src/guidelines/cli-instructions/overview.md` and `CLI-INSTRUCTIONS.md`.

5. Tests: add two SIGKILL cases to `src/test/cli-json-watch.test.ts`, one for a direct watch and one for a watch started through `node scripts/cli.cjs` with a fixture platform package whose binary is a copy of the running Bun executable; extract the shared launcher fixture as `createLauncherInstall` in `src/test/test-utils.ts`. Reuse the existing Windows-safe `collect()` (`Promise.race([drain, until])`); the automated criterion is stdout EOF within a bound. Do not assert specific launcher exit codes, which come from a manual walkthrough not reproducible on this platform. Verify both cases fail on the unfixed code (timeout waiting for exit), then pass.

6. Verify with `bunx tsc --noEmit`, `bun run check .`, and scoped then full `bun test`. Record the two known limits in Implementation Notes (starter reaping delay through the launcher; PID reuse within one tick).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- `scripts/cli.cjs`: the native-binary spawn block now passes `BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>` (the only change: one comment + one env line). Launcher lifetime, exit codes, signal mapping and arg cleaning are untouched, and no helpers were re-exported.

- `src/commands/watch-json.ts`: the starter set is captured at module load, before parsing and project lookup: the parent, plus the launcher's parent only when the marker's first segment equals this process's own parent, so stale markers inherited through unrelated processes are ignored. The 1 s reconcile tick now runs `starterExited() ? onTerminate() : refresh()`; `isRunning(pid)` uses `process.kill(pid, 0)` where only `ESRCH` counts as ended, and exit goes through the existing exit-143 forced-exit path.

- One sentence added to each of the three text surfaces: the watch field of `task list --help` (`src/cli.ts`), `src/guidelines/cli-instructions/overview.md`, and `CLI-INSTRUCTIONS.md`.

### Tests and Windows findings

- Two SIGKILL cases added to `src/test/cli-json-watch.test.ts` (a direct watch, and a watch through `node cli.cjs` with a fixture platform package whose binary is a copy of the running Bun), plus a stale-marker case. The shared launcher fixture moved into `src/test/test-utils.ts` as `createLauncherInstall`, which `cli-launcher.test.ts` now uses as well. The automated criterion is stdout EOF within a bound, collected through the existing Windows-safe `collect()` scaffold.

- Platform deviation from the reference test design: the throwaway starter is `node -e`, not `bun -e`, and on Windows the spawned command goes through `cmd /c`. Reason: Bun assigns spawned children to a kill-on-close job object, so a Bun starter's whole tree dies with it and no test could tell whether the watch ended by itself; node leaves no such job, and cmd breaks the job linkage one level down (cmd dies with the starter, its own children survive), so only the watch's liveness check can end the watch.

- Regression matrix on this machine (Windows): with the guard reverted, both SIGKILL cases time out waiting for exit; with the guard present but the launcher env line reverted, the launcher case still fails while the direct case passes, pinning each half; the stale-marker case fails if the `launcher === parent` comparison is removed. Verified by temporary mutation, then restored.

- The manual exit-code walkthrough (launcher exit 143/137/130) is a POSIX-only observation and is not asserted anywhere; the automated criterion is stdout EOF only.

### Known limits

- Through the launcher, the starter's exit is seen once its own parent has reaped it (`kill(pid, 0)` succeeds on zombies; shells, Node, Bun and init reap immediately).

- PID reuse within one tick delays detection.

- An intermediate such as `npx` stays the launcher's parent, so it is what the watch follows.

- On Windows, a watch whose whole tree sits in the same Bun job object dies with its starter regardless of this check; the check covers chains that escape job linkage (shims, launchers, non-Bun starters).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`backlog task list --json --watch` now ends when the process that started it ends, including after SIGKILL, both when started directly and through the npm launcher. The launcher passes the native binary an internal, undocumented `BACKLOG_LAUNCHER=<launcher pid>:<launcher parent pid>` that every other command ignores. On its existing 1 s reconcile tick the watch ends through the existing exit-143 path once its parent changed (POSIX reparenting) or a recorded starter process no longer exists (`kill(pid, 0)` returns ESRCH, which also covers Windows). Other long-running commands, such as `backlog browser` run as a service, keep their lifetime. Watch help, the CLI instructions overview and CLI-INSTRUCTIONS.md state the new behavior.

`src/commands/watch-json.ts` is byte-identical to the reference fix, and the launcher change is exactly the two-line env injection. The tests adapt the reference design to this codebase: the Windows-safe `collect()` scaffold is kept, the starter is `node -e`, and on Windows the spawned command goes through `cmd /c` so Bun's kill-on-close job object cannot mask a missing check. New coverage: a direct-watch SIGKILL case, a launcher SIGKILL case, and a stale-marker case. Regression matrix: with the guard reverted both SIGKILL cases time out waiting for exit; with only the launcher env line reverted the launcher case still fails; removing the `launcher === parent` comparison turns the stale-marker case red.

Verification: `bunx tsc --noEmit` clean; Biome clean on all touched files (the repo-wide `bun run check .` has 21 pre-existing format errors in untouched files); `cli-json-watch` / `watch-json` / `cli-launcher` suites 18 pass / 0 fail (5 POSIX-only launcher cases skip on Windows). Full `bun test`: 3379 pass / 15 skip / 3 fail / 1 error in 1042 s — the 3 failures reproduce in isolation without this change and are unrelated (two `cli-milestone-management` cases expect the pre-paging default that listed no-milestone tasks, and one `claude-agent-install` case trips over this machine's symlinked agents directory); the single error was not attributable from the tail log and did not reproduce in the scoped rerun.
<!-- SECTION:FINAL_SUMMARY:END -->
