---
id: BACK-508
title: CLI task create does not interpret \n escape sequences in description
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-04 15:27'
updated_date: '2026-06-05 05:46'
labels:
  - bug
  - cli
  - ux
dependencies: []
modified_files:
  - src/cli.ts
  - src/test/description-newlines.test.ts
priority: medium
ordinal: 167400
actual_start: '2026-06-05 03:46'
actual_end: '2026-06-05 05:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The CLI currently writes `--description` / `--desc` values verbatim without interpreting escape sequences. This causes two problems:

1. **Windows users** cannot write `\n` in the command line and get a newline in the task file, because the Windows shell does not interpret escape sequences — the literal characters `\n` are passed to the CLI and written as-is.
2. **Cross-platform inconsistency**: the same command produces different files on Windows vs bash, because bash strips one layer of backslashes in double-quoted strings while Windows does not.

**Chosen solution**: On Windows, the CLI first simulates the bash double-quote escape layer (`\\` → `\`, `\` → `\`), then applies C-style escape processing (`\n` → newline, `\\` → literal backslash) uniformly on all platforms.

This guarantees **the same command produces the same file on both platforms**.

| User input | Windows flow | bash flow | Final result |
|---|---|---|---|
| `\\\\n` (4 backslashes) | `\\\\n` → simulate bash → `\\n` → C-escape → `\n` | `\\n` → C-escape → `\n` | `\n` (literal) |
| `\\n` (2 backslashes) | `\\n` → simulate bash → `\n` → C-escape → newline | `\n` → C-escape → newline | newline |
| `\n` (1 backslash) | `\n` → simulate bash → `\n` → C-escape → newline | `\n` → C-escape → newline | newline |
| `\n\n` (two `\n`) | `\n\n` → simulate bash → `\n\n` → C-escape → two newlines | `\n\n` → C-escape → two newlines | two newlines |

**Cost / trade-off**: Windows users must type backslashes as if they were in bash. For example, to get a literal `\n` in the file on Windows you must type `\\\\n` (four backslashes), not `\\n` (two backslashes).

Related file: `src/cli.ts`
Related test: `src/test/description-newlines.test.ts`
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `processCliEscapes` helper to `src/cli.ts` that:
   - On Windows: simulates bash double-quote escape layer (`\\` → `\`)
   - On all platforms: applies C-style escape processing (`\n` → newline, `\\` → `\`)
2. Apply `processCliEscapes` to `--description` / `--desc` values in:
   - `task create`
   - `task edit`
   - `draft create`
   - `milestone create`
   - `milestone edit`
3. Update `src/test/description-newlines.test.ts`:
   - Change existing test from "should not interpret" to "should interpret"
   - Add test for literal `\n` with platform-appropriate input
   - Add test for double newline `\n\n`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Changes

1. **`processCliEscapes` helper** — Added to `src/cli.ts`. Uses `process.platform === "win32"` to detect Windows. On Windows, scans for `\\` pairs and collapses each pair to a single `\` (matching bash double-quote behavior). Then on all platforms, scans for `\n` and `\\` escape sequences and replaces them with newline and literal backslash respectively. Other escape sequences (`\t`, `\r`, etc.) are passed through unchanged.

2. **Applied to all description entry points** — The helper is called on `--description` / `--desc` values in five CLI commands:
   - `task create`
   - `task edit`
   - `draft create`
   - `milestone create`
   - `milestone edit`

3. **Tests updated** — `src/test/description-newlines.test.ts` now verifies:
   - `\n` → newline (all platforms)
   - `\\n` on Windows / `\n` on non-Windows → literal `\n`
   - `\n\n` → two newlines
   - Literal newlines in quoted strings are still preserved

### Verification

- `bun test src/test/description-newlines.test.ts` — 5/5 pass
- `npx biome check src/cli.ts src/test/description-newlines.test.ts` — pass
- `bunx tsc --noEmit` — no errors in modified files
<!-- SECTION:NOTES:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On Windows (`process.platform === 'win32'`), `--description` / `--desc` values first go through a bash double-quote simulation layer: `\\` → `\`, `\` → `\`
- [x] #2 After step 1 (or directly on non-Windows), C-style escape processing is applied: `\n` → newline, `\\` → literal backslash
- [x] #3 Other escape sequences (`\t`, `\r`, etc.) are passed through unchanged (no error)
- [x] #4 The four cross-platform scenarios from the description table are verified by tests:
  - `\\n` → literal `\n`
  - `\n` → newline
  - `\n` → newline
  - `\n\n` → two newlines
- [x] #5 Existing tests in `src/test/description-newlines.test.ts` are updated or replaced to match the new behavior
- [x] #6 Fix passes code review
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
