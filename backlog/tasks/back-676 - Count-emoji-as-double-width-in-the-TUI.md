---
id: BACK-676
title: Count emoji as double-width in the TUI
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-08-29 18:27'
updated_date: '2026-09-20 22:27'
labels:
  - tui
dependencies: []
references:
  - package.json
  - bun.lock
  - bun.nix
  - src/test/tui-emoji-width.test.ts
modified_files:
  - package.json
  - bun.lock
  - bun.nix
  - src/test/tui-emoji-width.test.ts
priority: low
actual_start: '2026-09-20 22:20'
actual_end: '2026-09-20 22:27'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI renders through `neo-neo-bblessed`, whose width tables count emoji as one cell while terminals draw them two cells wide. Every emoji in a row therefore costs a cell of drift: board column borders shift out of alignment, and a detail-pane re-render leaves stale cells behind. Chinese and emoji text is ordinary in this project's task titles, so the defect shows up on everyday boards rather than only in contrived cases.

Why the fix belongs in the dependency and not in `src/ui`: the width tables are generated from the Unicode 16 Emoji_Presentation property and feed both `charWidth` and the layout regexes that classify a cell as wide, so a table maintained by hand in this repository would have to be kept in step by hand. The 1.0.10 release carries the generated tables plus the VS16 sequence handling that makes variation-selector emoji measure correctly. This project carries no local patch to that package, so the version bump is the entire fix.

Goal: pin the rendering library to 1.0.10 in the manifest, the lockfile and the generated Nix expression, keep those three in step with each other, and add a regression test that pins the width behavior the TUI depends on - emoji presenting as two cells, VS16 sequences handled, and text-presentation, ASCII and CJK widths left alone.

The regression test is what survives the bump: it is what stops the widths from silently going back to one cell the next time the dependency moves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review the upstream changes with `git log --oneline v1.50.1..v1.52.0 --grep BACK-646` and `git show 1fc56775c`, and confirm each stated change against the fork before porting it - this project carries no local patch to the package, so the bump is the whole fix and nothing has to be re-applied by hand.
- [x] #2 `neo-neo-bblessed` resolves to 1.0.10 in `package.json`.
- [x] #3 `bun.lock` pins `neo-neo-bblessed@1.0.10` with the published sha512, and `bun.nix` carries the matching version key, tarball URL and hash, so the manifest, the lockfile and the generated Nix expression agree on one source of truth.
- [x] #4 The installed dependency measures default-emoji-presentation codepoints as 2 cells, which is what terminals draw: rocket, grinning face, lady beetle, sparkles, check mark, wrench, magnifier, ladybug and star.
- [x] #5 VS16 emoji sequences measure 2 cells (`⚠️`, `❤️`), and a redundant VS16 after an already-wide emoji (`✅️`) still measures 2 rather than 3.
- [x] #6 Text-presentation characters keep their single-cell width and ASCII and CJK are unchanged: `⚠` and `🌡` measure 1, `A` measures 1, `hello` measures 5, `中` measures 2.
- [x] #7 The layout regex the renderer uses to classify wide cells marks emoji (`🚀`, `✅`) and CJK (`中`) as wide, and leaves ASCII (`A`) unmatched.
- [x] #8 A TUI emoji-width regression test covers those four surfaces and passes against the installed dependency.
- [x] #9 The repository keeps no local patch directory and no in-tree width table for the rendering library, so the emoji widths come from the dependency alone.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Bump `neo-neo-bblessed` from 1.0.9 to 1.0.10 in `package.json`.

2. Refresh `bun.lock` for the new version in both places it records the dependency: the workspace dependency list and the resolved-package table, keeping the published integrity string so the lockfile still pins the exact artifact.

3. Refresh the generated `bun.nix` entry: version key, tarball URL and sha512 hash.

4. Run the install so the workspace actually holds 1.0.10. The regression test asserts the installed library rather than the manifest, so a manifest-only bump would leave it asserting the old widths.

5. Add `src/test/tui-emoji-width.test.ts` covering four surfaces:

- default-emoji-presentation codepoints measure 2 cells;
- VS16 sequences measure 2 cells, including the redundant-VS16 case where it must not become 3;
- text-presentation, ASCII and CJK widths are unchanged;
- the layout regex used to classify wide cells marks emoji and CJK wide and rejects ASCII.

6. Confirm the repository holds no local patch directory and no in-tree width table for the library, so the widths come from the dependency alone and the bump cannot be half-applied.

7. Run the scoped test, `bunx tsc --noEmit`, and `bun run check .`.

8. Prove the new assertions discriminate rather than merely pass: install 1.0.9 in a scratch project outside this repository and run the same width checks against it. The emoji and VS16 cases must fail there while the text-presentation, ASCII and CJK cases still pass - otherwise the test pins nothing and the bump is unverified.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What changed

- `package.json`, `bun.lock`, `bun.nix` - pinned `neo-neo-bblessed` to 1.0.10 in all three places it is recorded: the manifest entry, the lockfile's workspace dependency list and resolved-entry table (with the published sha512), and the version key, tarball URL and hash in the generated Nix expression. Six insertions and six deletions across the three files; no other package moved.
- `src/test/tui-emoji-width.test.ts` (new) - pins four surfaces of the width tables the TUI renders through: default-emoji-presentation codepoints measure 2 cells, VS16 sequences measure 2 including the redundant-VS16 case, text-presentation / ASCII / CJK widths are unchanged, and the layout regex marks emoji and CJK wide while rejecting ASCII.

## Verification

- `bun install --frozen-lockfile` resolved `neo-neo-bblessed@1.0.10`, which also demonstrates that the manifest, the lockfile and the integrity string agree rather than merely being edited in parallel.
- `bun test src/test/tui-emoji-width.test.ts` - 4 pass / 0 fail, and each of the four cases also passes when run on its own with `-t` (the self-check for fixtures that only pass because of state left by earlier cases).
- The six existing suites that import the rendering library still pass: board-hide-empty-columns 14, generic-list-selection 3, line-wrapping 7, unicode-rendering 1, tui-vim-boundary-navigation 5, tui-runtime-cwd 2 - 32 pass / 0 fail in total.
- `bunx tsc --noEmit` clean; `bun run check` reports only the 3 pre-existing `assets.ts` warnings across 430 files.
- Discriminator check, run in a scratch project outside this repository so the workspace copy stays at 1.0.10: the same test file against 1.0.9 reports 3 fail / 1 pass - both emoji cases measure 1 cell and the layout regex returns null, while the unchanged-widths case still passes. That is what shows the assertions pin the fix instead of passing for free.

## Notes

- The width tables are generated from the Unicode 16 Emoji_Presentation property and feed both the character width and the layout regexes that classify a cell as wide, so a table maintained inside `src/ui` would have to be kept in step by hand. This project carries no patch directory for the library, so the version bump is the whole fix and nothing had to be re-applied on top of it.
- The corrected tables reach both surfaces without a `src/ui` change: `formatTaskListItem` builds the row string and the widget does all wrapping, truncation and wide-cell classification, and no source file outside the tests implements wide-character math. The only surrogate handling in the fork is in the task composer, and that exists to avoid splitting a pair while editing text, not to measure width.
- The lockfile's integrity string was verified against the published artifact rather than copied on trust: the 1.0.10 tarball was hashed locally and matches the sha512 the lockfile now pins.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned `neo-neo-bblessed` to 1.0.10 in `package.json`, `bun.lock` (workspace dependency list plus the resolved entry carrying the published sha512) and the generated `bun.nix`, and added `src/test/tui-emoji-width.test.ts`, which pins the width tables the TUI renders through: emoji measure two cells, VS16 sequences are handled, and text-presentation, ASCII and CJK widths are left alone.

`bun install --frozen-lockfile` resolved 1.0.10, which also proves the three files agree. The new test passes 4/4 and each case passes on its own; the six existing suites that import the rendering library stay green at 32 pass / 0 fail; `bunx tsc --noEmit` is clean and `bun run check` reports only the 3 pre-existing `assets.ts` warnings.

The bump is the whole fix because the fork delegates width handling to the widget - no source file outside the tests implements wide-character math - so the corrected tables reach the board and the detail view without touching `src/ui`. The test's discriminating power was checked against 1.0.9 outside this repository: 3 fail / 1 pass there, with the emoji and layout-regex cases going red while the unchanged-widths case stayed green.
<!-- SECTION:FINAL_SUMMARY:END -->
