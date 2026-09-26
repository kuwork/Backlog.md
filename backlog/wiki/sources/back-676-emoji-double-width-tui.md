---
title: BACK-676 Count emoji as double-width in the TUI
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - tui
  - dependencies
  - unicode
source_path: backlog/tasks/back-676 - Count-emoji-as-double-width-in-the-TUI.md
---

# BACK-676 Count emoji as double-width in the TUI

The TUI renders through `neo-neo-bblessed`, whose width tables counted emoji as one cell while terminals draw them two wide — every emoji in a row cost a cell of drift, misaligning board borders and leaving stale cells on re-render. The fix is a dependency bump to 1.0.10 plus a regression test that pins the width behaviour.

## Summary

- Fix belongs in the dependency, not `src/ui`: the width tables are generated from the Unicode 16 Emoji_Presentation property and feed both `charWidth` and the layout regexes that classify wide cells — a hand-maintained in-tree table would drift; the project carries no local patch, so the bump is the entire fix
- `neo-neo-bblessed` pinned to 1.0.10 in all three recording places: `package.json`, `bun.lock` (workspace dependency list plus resolved entry with published sha512), and generated `bun.nix` (version key, tarball URL, hash); the lockfile integrity string was verified by hashing the tarball locally, not copied on trust
- New `src/test/tui-emoji-width.test.ts` pins four surfaces: default-emoji-presentation codepoints measure 2 cells; VS16 sequences measure 2 including the redundant-VS16 case (`✅️` must not become 3); text-presentation/ASCII/CJK widths unchanged; the layout regex marks emoji and CJK wide while rejecting ASCII
- Corrected tables reach both surfaces without a `src/ui` change: `formatTaskListItem` builds the row string and the widget does all wrapping, truncation and wide-cell classification — no source file outside tests implements wide-character math
- Discriminating power proven: the same test run against 1.0.9 in a scratch project outside the repository fails 3/4 (emoji cases measure 1 cell, regex returns null) while unchanged-widths pass — otherwise the test pins nothing and the bump is unverified
- `bun install --frozen-lockfile` resolving 1.0.10 demonstrates the three files agree; six existing suites importing the rendering library stay green (32 pass)

## Acceptance Criteria

- `neo-neo-bblessed` resolves to 1.0.10 with manifest, lockfile and Nix expression agreeing on one source of truth
- Emoji default-presentation codepoints and VS16 sequences measure 2 cells; redundant VS16 stays 2
- Text-presentation, ASCII and CJK widths unchanged; layout regex classifies emoji/CJK wide, ASCII not
- Regression test covers all four surfaces; no local patch directory or in-tree width table kept

## Related Concepts

- [[concepts/cli-tui]] — blessed/neo-neo-bblessed rendering stack and cell-width model
- [[concepts/ci-platform-contracts]] — lockfile/manifest/Nix agreement as a reproducibility contract
- [[concepts/upstream-migration]] — port of upstream BACK-646 verified against the fork

## Related Sources

- [[sources/back-675-tui-ac-bar-ascii]] — sibling TUI rendering fix for glyph portability (batch sibling)
- [[sources/back-539-linux-runner-win32-arm64-build]] — earlier dependency/platform pinning work
