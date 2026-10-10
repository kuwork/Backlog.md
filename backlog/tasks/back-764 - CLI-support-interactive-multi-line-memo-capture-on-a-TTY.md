---
id: BACK-764
title: 'CLI: support interactive multi-line memo capture on a TTY'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-10 02:40'
updated_date: '2026-10-10 15:05'
labels:
  - cli
  - memo
dependencies: []
references:
  - 'src/cli.ts:5500-5520'
  - 'src/cli.ts:780-789'
  - 'src/cli.ts:5475-5493'
  - 'src/guidelines/cli-instructions/memos.md:16-30'
modified_files:
  - src/core/interactive-input.ts
  - src/test/stdin-capture.test.ts
  - src/test/cli-memo-stdin.test.ts
  - src/cli.ts
  - src/guidelines/cli-instructions/memos.md
priority: medium
ordinal: 326001
actual_start: '2026-10-10 09:19'
actual_end: '2026-10-10 15:05'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare `backlog memo create` on an interactive terminal fails instead of capturing a note. The command only reads stdin when it is not a TTY: on a TTY it exits 1 with "No memo content provided. Pass --content or pipe the memo body on stdin." The guard exists for a reason — readStdinText awaits EOF, and on an interactive terminal there is no EOF until the user signals one, so simply removing the check risks a command that appears to hang.

The gap is real though: quick capture is the whole point of memos, and requiring --content (or a pipe) for every terminal note means either cramming escapes into an argument or shelling out to a pipe. Users expect to type their note and finish with Ctrl+D.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running backlog memo create with no --content on an interactive terminal prompts for the note instead of exiting 1 with "No memo content provided."
- [x] #2 The prompt/hint goes to stderr so it never ends up inside the captured body
- [x] #3 Immediate EOF (empty input) exits non-zero with the existing empty-content message and creates no memo file
- [x] #4 --tags keeps working when the body is typed interactively
- [x] #5 The non-TTY path is unchanged: piping or redirecting stdin still captures without any prompt
- [x] #6 Ctrl+C during capture aborts without creating a memo and without leaving the terminal in a broken state
- [x] #7 The doc comment on readStdinText is updated, since its "callers must check isTTY" rationale no longer holds for this caller
- [x] #8 Unit tests in src/test/stdin-capture.test.ts drive the helper with a fake stream: multi-line capture, empty input, abort via AbortSignal, and the hint going to output rather than the body; src/test/cli-memo-stdin.test.ts covers the CLI paths (piped stdin unchanged, --tags with a piped body, empty pipe rejected)
- [x] #9 backlog memo create --help and the CLI instruction guide src/guidelines/cli-instructions/memos.md document the interactive path, presenting Ctrl+D as the primary end key on every platform (a lone Ctrl+D character ends capture even without real EOF) and noting Ctrl+Z only works on the classic Windows console (cmd/PowerShell) because VS Code and mintty (Git Bash) intercept or repurpose it
- [x] #10 Multiple lines are captured verbatim and stored as the memo body; capture ends on EOF (Ctrl+D on Unix/macOS/WSL) or a lone Ctrl+D character, which is the only end key that works in every terminal including the VS Code integrated terminal and Git Bash; a line containing only Ctrl+Z (0x1A) also ends capture as a convenience for the classic Windows console, which delivers no EOF
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a testable interactive capture helper (e.g. src/core/interactive-input.ts): captureInteractiveBody(stream, hintStream, {signal}) reads a multi-line body verbatim; capture ends on EOF, a lone Ctrl+D character (0x04, the only end key that works in every terminal incl. VS Code and Git Bash), or a line containing only Ctrl+Z (0x1A, classic Windows console convenience); the hint goes to the hint stream (stderr) never the body; empty input yields an empty string for the caller's existing error path; on a TTY it uses raw mode so Ctrl+C arrives as 0x03 and the terminal mode is always restored (finally)
2. Wire the helper into the memo create action in src/cli.ts: when --content is absent and stdin is a TTY, print a hint naming Ctrl+D as the primary end key (Ctrl+Z noted for the classic Windows console) and capture interactively instead of exiting 1; keep the empty-body error/exit-1 path, the unchanged piped-stdin branch, and the --tags handling
3. Update the doc comment on readStdinText (its callers-must-check-isTTY rationale no longer holds for this caller)
4. Docs: update the memo create help schema and -c option description in src/cli.ts, and add the interactive capture flow to src/guidelines/cli-instructions/memos.md, presenting Ctrl+D as the universal end key and explaining why Ctrl+Z only works on the classic Windows console
5. Tests: new src/test/stdin-capture.test.ts drives the helper with a fake stream (multi-line capture, empty input, abort via AbortSignal, hint lands on the hint stream not the body); new src/test/cli-memo-stdin.test.ts covers CLI paths (piped stdin unchanged, --tags with a piped body, empty pipe rejected)
6. Verify: bun test on the two new test files, bunx tsc --noEmit, bun run check ., then full bun test
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: the TTY branch of memo create now captures instead of exiting 1. The logic lives in src/core/interactive-input.ts so tests can drive it with a fake stream. An earlier attempt stayed in cooked mode and read raw chunks, stopping on a line holding only U+001A or U+0004; that works on the classic Windows console and nowhere else.

Ctrl+Enter was proposed as the end key and rejected with measurements, not theory: tmp/key-probe.ts run in a real Windows console printed identical bytes for plain Enter and Ctrl+Enter, so in cooked mode no parser can separate them, and Ctrl+D alone arrived as nothing. Separating them is only possible in raw mode, so the final design went there instead.

In raw mode every key reaches the program: Ctrl+D ends the note (it is a real EOF on Unix and a forwarded byte everywhere else, including the VS Code terminal and Git Bash), Ctrl+Z ends it on the classic Windows console, which delivers no EOF, and Ctrl+C arrives as 0x03 and throws InteractiveCaptureAbortedError. Raw mode also silences the console's own echo, so the helper takes an echoTarget (the CLI passes stdout) and echoes characters itself, including a backspace that erases a whole surrogate pair. The raw-mode flag and the abort listener are restored in finally, and the iterator is returned without awaiting - awaiting return() deadlocks against a still-open TTY - after which cli.ts destroys stdin so the process can exit.

Verification: the user typed a note in a real terminal and confirmed both that typing echoes and that the command exits normally. src/test/stdin-capture.test.ts and src/test/cli-memo-stdin.test.ts pass 27/27, bunx tsc --noEmit is clean, and bun run check . reports 674 files with no fixes. Anyone rerunning those suites must pass --timeout 60000: with explicit file paths bun ignores bunfig's timeout and falls back to 5s, which CLI-spawning tests exceed on this machine.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog memo create can now be typed straight into a terminal. With --content omitted and stdin on a TTY it prints the hint to stderr, captures every line verbatim, and ends on Ctrl+D - the one end key that works in every terminal, including the VS Code integrated terminal and Git Bash - while Ctrl+Z additionally ends capture on the classic Windows console, which delivers no EOF. Ctrl+C aborts with exit code 130 and writes nothing; ending immediately still reports the existing empty-content error and creates no file. Piping and redirecting stdin behave exactly as before: no hint, no echo.

The behavior lives in src/core/interactive-input.ts, isolated behind a small stream interface so it can be unit tested with a fake stream, and the raw-mode flag, abort listener, and iterator are always released so the terminal and the process are left clean. Docs were updated in the create help schema and src/guidelines/cli-instructions/memos.md. Verified by real-terminal use plus 27 unit and CLI tests, a clean tsc, and a clean biome run.
<!-- SECTION:FINAL_SUMMARY:END -->
