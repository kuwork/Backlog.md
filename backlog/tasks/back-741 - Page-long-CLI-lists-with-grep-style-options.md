---
id: BACK-741
title: Page long CLI lists with grep-style options
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-16 20:43'
updated_date: '2026-10-02 19:46'
labels:
  - cli
dependencies: []
modified_files:
  - src/utils/list-window.ts
  - src/cli.ts
  - src/formatters/json-output.ts
  - src/board.ts
  - src/ui/board.ts
  - src/test/list-window.test.ts
  - src/test/cli-list-window.test.ts
  - src/test/board.test.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/cli-instructions/milestones.md
  - src/guidelines/cli-instructions/memos.md
  - src/guidelines/cli-instructions/documents.md
  - src/guidelines/cli-instructions/drafts.md
  - src/guidelines/cli-instructions/decisions.md
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/cli-instructions/task-execution.md
  - CLI-INSTRUCTIONS.md
priority: high
actual_start: '2026-10-02 07:22'
actual_end: '2026-10-02 19:46'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents read Backlog.md lists through the CLI. `task list`, `search` and `doc search` accept `--limit`, which cuts the result after sorting without saying that items were left out, and no option reaches the following items. An agent therefore either reads a very long list or acts on a silently incomplete one. `draft list`, `milestone list`, `doc list`, `decision list` and `memo list` have no such option at all and always print every match.

Add `--max-count <n>`, `--skip <n>` and `--count`, named after `git log --max-count --skip` and `grep --count`, so no new vocabulary is needed. A window applies to a list that is already filtered, sorted and shortened by `--limit`, in the order the output prints, so consecutive windows of an unchanged backlog neither overlap nor leave items out. Output cut by a window ends with the shown range, the total and the command that prints the following items.

Scope: eight list commands (`search`, `task list`, `draft list`, `milestone list`, `doc list`, `doc search`, `decision list`, `memo list`). `config list` and `sequence list` are out of scope. Every one of the eight supports `--limit` as well: the four that lack it gain it with the same silent behavior as the commands that already have it, so `--limit` means the same thing everywhere. No short flag is added for any new option, and no existing `-m` is touched.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add `src/utils/list-window.ts` as the one shared paging module, exporting `addListWindowOptions`, `parseListWindow`, `selectListWindow`, `printListWindow`, `formatListWindowFooter`, `nextPageCommand`, `parsePositiveIntegerOption`, `LIST_WINDOW_HELP_FIELDS` and `LIST_WINDOW_OUTPUT_HELP`.
- [x] #2 Each of the eight list commands (`search`, `task list`, `draft list`, `milestone list`, `doc list`, `doc search`, `decision list`, `memo list`) accepts `--max-count <n>`, `--skip <n>` and `--count`, applied after filtering, sorting and `--limit`, in the order the output prints, so consecutive windows of an unchanged backlog neither overlap nor leave items out.
- [x] #3 Each of the eight commands accepts `--limit`. `draft list`, `milestone list`, `doc list` and `decision list` gain it with the same semantics the other commands already have: it silently shortens the list before any window applies, and it never prints a footer by itself.
- [x] #4 Plain output cut by a window ends with `Showing <first>-<last> of <total> items. Next: backlog <command> --skip <n>`; complete output has no footer; the last window has no `Next:` part; a `--skip` past the end prints `Showing 0 of <total> items.`
- [x] #5 `--count` prints only the number of items the same command would list, as a plain string that stays uncolored when color is forced, and is rejected with a diagnostic and a nonzero exit when combined with `--json`.
- [x] #6 The JSON envelopes of `task list`, `search` and `decision list` add `total` and `nextSkip` only when the window cuts the list; uncut JSON output is byte-for-byte unchanged, including `task list --json --watch`.
- [x] #7 No short flag is added for `--max-count`, `--skip` or `--count`, and no existing `-m` is changed or removed: `task create`, `task list`, the shared `addEditFieldOptions` helper and `board --milestones` keep theirs. The existing `-m` tests in `src/test/cli-milestone-filter.test.ts` still pass unchanged.
- [x] #8 `milestone list` windows its milestone sections: `--max-count`, `--limit`, `--skip` and `--count` count milestones, and tasks without a milestone are omitted by default. Pass `--with-no-milestone` to prepend them as a fixed `## No Milestone (n tasks)` header that leads every window (so it appears on each page when following the `Next:` command) and never fills a `--max-count` or `--limit` quota nor the `--count` total; `generateMilestoneGroupedBoard` defaults to `includeNoMilestone: false`, and the CLI passes `true` only when `--with-no-milestone` is set.
- [x] #9 `searchJson` keeps the local-editable-task filter: only the `page` parameter is added, and the `isLocalEditableTask` check stays, because this fork has cross-branch task semantics.
- [x] #10 `src/test/list-window.test.ts` (pure functions) and `src/test/cli-list-window.test.ts` (end to end) cover window selection, boundaries, the footer, following real `Next:` commands, `--count`, `--count` with `--json`, invalid `--max-count` and `--skip` values, and `--limit` behavior being unchanged.
- [x] #11 `memo list` pages with `--skip` instead of `--cursor`: the `--cursor <memoId>` option and its `Next page: backlog memo list --limit <n> --cursor <x>` hint are removed, and the list prints the shared window footer `Showing <first>-<last> of <total> items. Next: backlog memo list --limit <n> --skip <m>`. Its `--limit` loses the default of 30, so the command prints every memo unless `--limit` or a window option narrows it, which is what makes `--skip` reach the following memos; with a default of 30 the window would only ever see the newest 30. The `cursor` parameter of `listMemosPage` stays, because the MCP memo tools and the server API page through it and offer no offset. `src/guidelines/cli-instructions/memos.md` stops documenting `--cursor` and documents `--limit`, `--max-count`, `--skip` and `--count` instead.
- [x] #12 The help schema of each of the eight commands lists `--max-count`, `--skip` and `--count` through `LIST_WINDOW_HELP_FIELDS`, mentions `LIST_WINDOW_OUTPUT_HELP` in its output text, and carries one paging example.
- [x] #13 `src/guidelines/cli-instructions/overview.md` gains one dedicated section, placed right after `## Search Quick Reference`, named `## List Paging Quick Reference`. It is the single place that explains the four options together for every list command: what `--limit`, `--max-count <n>`, `--skip <n>` and `--count` each do; that they apply after filtering and sorting in the order the output prints, so consecutive windows of an unchanged backlog join into the complete output; the footer `Showing <first>-<last> of <total> items. Next: <command>` with the note that the last window has no `Next:` part and a skip past the end prints `Showing 0 of <total> items.`; that `--count` prints only the number and cannot be combined with `--json`; that window options print text instead of opening an interactive view; that `total` and `nextSkip` appear in JSON only when the window cuts the list; that no short forms exist; and one runnable example against `task list`, `search` and `memo list` each. The existing paging sentence in the `### Start Every Request Here` section links to it instead of repeating the details.
- [x] #14 Each command guide that owns one of the eight commands documents paging for its own commands: `memos.md` replaces its `--cursor` documentation (lines 42 to 45, including the `backlog memo list --cursor 20261001-5` example) with `--limit`, `--max-count`, `--skip` and `--count`; `documents.md` covers `doc list` and `doc search`; `drafts.md` covers `draft list`; `milestones.md` covers `milestone list`; `decisions.md` covers `decision list`; `task-creation.md` and `task-execution.md` add the window options next to the `--limit` examples they already carry. `CLI-INSTRUCTIONS.md` keeps its own Paging long lists section and adds the `total` and `nextSkip` sentence to the JSON envelope description.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes

Verification (2026-10-02): `bunx tsc --noEmit` clean. `bunx biome check` clean on every BACK-741 touched file (src + tests + guides). The repo-wide `bun run check .` reports 22 diagnostics, but all are in untracked files outside this task (back-742, backlog/memos, .workbuddy); none originate from BACK-741 changes. `bun test src/test/list-window.test.ts src/test/board.test.ts src/test/cli-list-window.test.ts` → 43 + 17 pass, 0 fail.
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. DONE: `src/utils/list-window.ts` added (214 lines, Biome clean). Not imported anywhere yet.
2. DONE: the migration ledger updated. doc-22 decision records D2 and D3 are withdrawn, and doc-21 and doc-22 point at this task instead of the promoted draft.
3. `src/cli.ts`: delete the local `parsePositiveIntegerOption` (`src/cli.ts:257`) and import it from `list-window.ts`; add one `resolveListOutput(options, command)` helper next to the existing `getReadOutputMode` (`src/cli.ts:807`) that resolves the output mode, parses the window from `process.argv.slice(2)`, and downgrades an interactive mode to plain when the window forces text.
4. `src/formatters/json-output.ts`: add an optional `page?: ListPage<unknown>` to `taskListJson`, `decisionListJson` and `searchJson`, and emit `total` and `nextSkip` only when `page.cut` is true. Keep the existing `isLocalEditableTask` filter in `searchJson`; only the page handling is added.
5. Wire the seven plain list commands. Each keeps its command object in a variable so `addListWindowOptions` can attach the options, then calls `resolveListOutput` at the top of its action and prints through `printListWindow`, passing the page to the JSON formatter: `search` (:2076, `--limit` at :2134), `task list` (:2862, `--limit` at :2944, hard slice at :2643), `draft list` (:4087), `milestone list` (:4369), `doc list` (:4860), `doc search` (:4911, `-l, --limit` at :4926), `decision list` (:5053).
6. Add `--limit` to `draft list`, `milestone list`, `doc list` and `decision list`, parsed with the shared positive-integer parser, applied before the window and printing no footer of its own.
7. `memo list` (:5288): drop `--cursor` (:5319) and the next-cursor hint (:5354), drop the `--limit` default of 30 (:5318), run the list through the same window helper as every other list command, and keep the `cursor` parameter of `listMemosPage` for the MCP tools and the server API.
8. `milestone list` no longer slices milestones by hand: `--limit` becomes a silent `--max-count` for the milestone window, and No Milestone is hidden by default. `--with-no-milestone` prepends it as a fixed header every window prints through the exported `generateMilestoneSection`, while `generateMilestoneGroupedBoard` defaults to `includeNoMilestone: false` (the CLI passes `true` only with the flag); the windows join into the complete output, with and without `--show-completed`.
9. Help schemas: append `LIST_WINDOW_HELP_FIELDS` to the optional fields of the eight commands, mention `LIST_WINDOW_OUTPUT_HELP` in their output text, and add one paging example each.
10. Usage guides, per command: `memos.md` (replace the `--cursor` documentation at lines 42 to 45), `documents.md` (`doc list`, `doc search`), `drafts.md` (`draft list`), `milestones.md` (`milestone list`), `decisions.md` (`decision list`), plus `task-creation.md` and `task-execution.md` next to the `--limit` examples they already carry.
11. Usage guides, shared: add `## List Paging Quick Reference` to `src/guidelines/cli-instructions/overview.md` right after `## Search Quick Reference` as the one place that explains `--limit`, `--max-count`, `--skip` and `--count` together for every list command, and point the existing paging sentence in `### Start Every Request Here` at it. Add the Paging long lists section and the `total` and `nextSkip` sentence to `CLI-INSTRUCTIONS.md`.
12. Tests: `src/test/list-window.test.ts` for the pure functions and `src/test/cli-list-window.test.ts` for the CLI surface, following real `Next:` commands, including `memo list --max-count` and `--skip`. Add a guidance assertion that the overview section documents all four options.
13. Verify with `bunx tsc --noEmit`, `bun run check .` and `bun test`.
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: @kimi
created: 2026-10-02 07:22
---
Plan approved by the user in conversation on 2026-10-02; moving to In Progress and starting implementation from plan step 3.
---
author: @kuwork
created: 2026-10-02 12:39
---
milestone list paging semantics (direction D) finalized: the window unit is the milestone (`--max-count`/`--limit`/`--skip`/`--count` all count milestones); No Milestone is hidden by default and appears only as a `## No Milestone (n tasks)` header when `--with-no-milestone` is passed; the header never fills the `--max-count`/`--limit` quota and is excluded from the `--count` total, and it leads every window (including later pages reached via the `Next:` command) when `--with-no-milestone` is set. `generateMilestoneGroupedBoard` defaults to `includeNoMilestone: false`; only `milestone list` passes `true` with the flag, while `backlog board --milestones` passes `true` explicitly to preserve its existing behavior. Source, tests, guides and AC #8 are in sync; tsc + biome + cli-list-window (17 pass) are green. Changes are in the working tree only, not committed.
---
<!-- COMMENTS:END -->

## Files Changed

- `src/utils/list-window.ts` (new) — shared paging module exporting `addListWindowOptions`, `parseListWindow`, `selectListWindow`, `printListWindow`, `formatListWindowFooter`, `nextPageCommand`, `parsePositiveIntegerOption`, `LIST_WINDOW_HELP_FIELDS`, `LIST_WINDOW_OUTPUT_HELP`; `ListWindow.silent` suppresses the footer.
- `src/cli.ts` — wires the eight list commands through `resolveListOutput` + `printListWindow`; `isTaskJsonRequested` fixes `--json` absorbed by the parent `task` command; `memo list` drops `--cursor` and its `--limit` default of 30; `milestone list` adds `--with-no-milestone` and stops hand-slicing `--limit` (silent `--max-count`).
- `src/formatters/json-output.ts` — `taskListJson`/`decisionListJson`/`searchJson` gain an optional `page`; `total`/`nextSkip` are emitted only when the window cuts.
- `src/board.ts` — `generateMilestoneGroupedBoard` gains `options?.includeNoMilestone` (default `false`); `generateMilestoneSection` is exported.
- `src/ui/board.ts` — `backlog board --milestones` passes `includeNoMilestone: true` to keep current behavior.
- `src/test/list-window.test.ts` (new) — pure-function coverage for window selection, footer, and `silent`.
- `src/test/cli-list-window.test.ts` (new) — end-to-end coverage following real `Next:` commands, `--count`, `--json` exclusion, and `milestone list` window/header behavior.
- `src/test/board.test.ts` — adds `includeNoMilestone` coverage.
- `src/guidelines/cli-instructions/{overview,milestones,memos,documents,drafts,decisions,task-creation,task-execution}.md` and `CLI-INSTRUCTIONS.md` — paging docs; `memos.md` drops `--cursor`; `milestones.md` documents `--with-no-milestone`.
- `backlog/docs/migration/doc-21` and `doc-22` — migration ledger now points at BACK-741.
