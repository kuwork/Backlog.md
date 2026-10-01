---
id: BACK-725
title: Add average task completion time to project statistics
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-01 05:43'
updated_date: '2026-10-01 07:13'
labels:
  - statistics
  - cli
  - web-ui
dependencies: []
references:
  - 'src/web/components/GanttView.tsx:76-137'
  - 'src/core/statistics.ts:61-160'
  - 'src/server/index.ts:2726-2738'
  - 'src/commands/overview.ts:23-45'
  - 'src/ui/overview-tui.ts:103-115'
  - 'src/web/components/Statistics.tsx:855-915'
  - 'src/core/backlog.ts:3972-3990'
  - 'src/web/hooks/useCompletedTasks.ts:11-48'
  - 'src/web/components/CompletedFilterToggle.tsx:16-27'
  - 'src/web/components/BoardPage.tsx:139-166'
  - 'src/server/index.ts:1194-1204'
  - 'src/mcp/tools/tasks/handlers.ts:256'
  - 'src/cli.ts:6322-6343'
  - 'src/web/components/Statistics.tsx:22-25'
  - 'src/web/components/Statistics.tsx:189-193'
  - 'src/web/components/Statistics.tsx:614-616'
ordinal: 295400
actual_start: '2026-10-01 06:21'
actual_end: '2026-10-01 07:06'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Project statistics has no completion-time metric, and it also has no way to choose which corpus it reports on. What it reports today is `averageTaskAge`, a mixed figure: terminal tasks measure `updatedDate - createdDate` while open tasks measure `now - createdDate`, so it is neither a delivery cycle nor an in-flight age. It also hardcodes the literal string Done in six places inside `getTaskStatistics`, so a project with a renamed or multi-valued terminal set (this project already declares a `Dropped` column) is counted incorrectly.

Two further defects sat in the same area, both now fixed: the two statistics code paths read different corpora - the cached path used the active-only snapshot while the cold path used active plus completed, so the numbers changed with the cache state - and the cold path fed the raw `statuses` objects into a parameter typed `string[]`, so the first statistics load after a server restart rendered the whole status breakdown as a single `[object Object]` row.

Decisions settled with the user on 2026-09-30 - do not re-litigate them, and do not add rules on top of them:

- The metric is the Gantt-resolved span, and nothing else. Concretely: it is the subtraction of the two values the Gantt left table displays in its Actual Start and Actual End columns, resolved by the Gantt's own chain - start = actualStart, else createdDate, else now; end = actualEnd, else updatedDate, else createdDate + 1d, else start + 1d; and when end is before start, end becomes start + 1d exactly as the Gantt draws it. This was reached over several revisions; do not reintroduce an exclusion rule, a flooring rule, or a separate lead-time metric.
- Every canonical-terminal task contributes. There is no sample filter, so the sample count equals the terminal task count. Zero spans stay zero, and genuinely inverted pairs take the Gantt clamp. These rows are historical artefacts and that is accepted; the value of the metric is that its denominator is the real task count.
- Completed means only the canonical terminal status, `getTerminalStatus(config.statuses)` - here Done. `Dropped` is not a completion and must be excluded.
- The displayed unit is fixed to minutes - a deliberate user decision, not a placeholder. The median sample is tens of minutes and a day-based unit reads 0 across most of the distribution. Do not make the unit adaptive and do not add a locale-dependent unit switch.
- The reported corpus becomes a parameter, following the existing show-completed mechanism rather than inventing one, and it defaults to excluding the completed folder on both surfaces. So the default is the active corpus only (tasks under `backlog/tasks/` with a non-empty status), and including `backlog/completed/` is opt-in.
- On the Web surface the switch sits at the top right of the contribution heatmap card, in a chrome-less variant of the shared toggle so it reads as part of that card. Note the switch governs the scope of the whole page, not only the heatmap; the heatmap title count and every other card move together with it.

How the existing show-completed mechanism works, for reference - mirror these conventions rather than inventing parallel ones:

- API query parameter is `completed=true`, as used by `/api/search` and now by `/api/statistics`.
- Page-level URL parameter is `completed=1`, as used by the board and the task list, and now by the statistics page.
- The switch component is the shared `web/components/CompletedFilterToggle.tsx`; its `plain` variant drops the border so it can live inside a card.
- Statistics are computed server side from `ContentStore.getTasks(filter, { includeCompleted })`, which already exposes the widening. They are not routed through the search endpoint and not merged client side.
- CLI flag naming convention is `--completed`, matching `backlog task list --completed` and the MCP equivalent `task_list({ completed: true })`.

Caching consequence, easy to get wrong: the statistics cache is now keyed by scope and cleared as a whole, so a toggle cannot return the other scope's body. Both scopes are precomputed on each recompute.

Measurements taken on this repository when the decisions were made and after implementation (411 active, 304 completed, 1 archived, 69 drafts):

- Scope figures for the span metric: default (active only) mean 5153 minutes over 386 completions; widened (active plus completed) mean 5305 minutes over 690. The completed folder's records carry only fallback spans, so widening moves both the mean and the sample - the two scopes are not interchangeable on this metric.
- Whole-page scope figures: default totalTasks 411, completedTasks 386, completion 94 percent, contribution heatmap 98 active days, averageTaskAge 28 days. Widened: 715, 690, 97 percent, 135 active days, 38 days.
- The pre-implementation probe measured the widened mean at 5304.5 minutes, which the implementation reproduces as 5305.
- 91 rows have a span of exactly 0 because createdDate and updatedDate are the same minute - mostly the BACK-4.x batch dated 2025-06-08. The end-before-start clamp does not fire on equal values, so they enter as zero.
- 3 rows are genuinely inverted and take the clamp, entering as exactly 24 hours each (BACK-473, BACK-494, BACK-558). Only 37 rows, 5 percent, are ones the Gantt marks with the fallback asterisk.
- The distribution is strongly right-skewed: the 422 rows resolving as createdDate to updatedDate dominate the mean. The card therefore shows the sample size next to the mean.

Adjacent observation recorded for later, not required here: `backlog/wiki/concepts/gantt-view.md` line 38 still says the basic Gantt prefers planned dates, which is BACK-491 wording; the actual bar has been actual-first since BACK-495.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Completion is decided by the configured terminal status via getTerminalStatus, not a hardcoded Done string, and the age and heatmap branches follow the same rule
- [x] #2 The average completion time is the Gantt-resolved span over every canonical-terminal task, with no exclusion and no flooring: zero spans count as zero and inverted pairs count at the clamped 24 hours
- [x] #3 The Gantt time resolution is extracted into one shared helper consumed by both GanttView and the statistics module, with a parity test pinning the metric to the Gantt Actual Start and Actual End columns
- [x] #4 The average renders in minutes as a fixed unit, not an adaptive one, on the web statistics page with en, zh-CN, zh-TW and ja all covered, and the sample count is shown next to it
- [x] #5 The same metric appears in both the CLI overview TUI output and overview --plain, also in minutes
- [x] #6 GET /api/statistics accepts completed=true and returns the active plus completed corpus, while omitting it returns the active corpus only
- [x] #7 The statistics page places the shared CompletedFilterToggle at the top right of the contribution heatmap card header, wired to the page URL parameter completed=1, matching the board and task list conventions
- [x] #8 The overview command accepts --completed, and overview plus overview --plain both default to the active corpus only
- [x] #9 The two scopes are cached separately and invalidated together, so switching scope never serves the other scope numbers
- [x] #10 The cold statistics path no longer stringifies status objects, so the status breakdown never shows an [object Object] row after a server restart
- [x] #11 Tests cover both scopes and their cache isolation, a custom terminal status name, Dropped exclusion, a fallback-resolved row, a zero span, an inverted pair, an empty input, and Gantt parity
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the Gantt time resolution into one shared helper - new src/utils/task-time-span.ts, src/web/components/GanttView.tsx
- Move the resolution out of parseTasks (:76-137) verbatim: start = actualStart -> createdDate -> now; end = actualEnd -> updatedDate -> createdDate + 1d -> start + 1d; end before start becomes start + 1d. Keep the same output shape the Gantt already needs (resolved start/end, the original strings, and the isFallback flag that drives the asterisk).
- GanttView keeps rendering from the helper so its left table and bars stay byte-identical; only the code location changes. The two local parsers (parseDate for date-only, parseDateTime for datetimes) move with it.

2. Core metric and terminal judgement - src/core/statistics.ts
- Take the raw statuses config (readonly (string | StatusDefinition)[]) instead of a name list: derive display names with statusNames() for statusCounts, and resolve the canonical completion status once with getTerminalStatus().
- Replace all six hardcoded "Done" comparisons with a single local isCompleted predicate: :72 (completedTasks + heatmap), :104 (age branch), :125 (stale), :136 (at risk / overdue), :149-150 (blocked dependency lookup).
- Add projectHealth.averageCompletionMinutes and completionSampleCount. Iterate every canonical-terminal task, resolve its span through the shared helper from step 1, and average the spans in minutes rounded. No filter of any kind: zero spans count as zero, inverted pairs count at the clamped 24 hours, and completionSampleCount is simply the number of terminal tasks with a resolvable span.
- Leave the heatmap completion date as actualEnd || updatedDate for now; the drift against the age branch is noted but out of scope.

3. CLI corpus scope - src/core/backlog.ts, src/commands/overview.ts, src/cli.ts
- loadAllTasksForStatistics (:3976-3990) gains an options argument with includeCompleted (default false) and resolves the corpus with identityIndex.getTasks(includeCompleted) instead of the hardcoded true.
- It returns the raw statuses config rather than the name list, so callers can hand it straight to getTaskStatistics.
- overview registers --completed next to --plain (:6322-6343) and forwards it through runOverviewCommand.

4. CLI rendering - src/ui/overview-tui.ts
- renderOverviewTui (:107) and renderStatsPlainText (:245) both print the new metric and the active scope, so 410 and 714 are distinguishable at a glance.

5. Server: one implementation, two scopes - src/server/index.ts
- Extract a private computeStatistics(includeCompleted) used by both recomputeAndBroadcastStatistics (:428-453) and the cold handleGetStatistics path (:2711-2747). The cold path stops resolving the corpus and statuses itself; passing the raw config there is what fixes the [object Object] status keys (:2730).
- Key the statistics cache by scope and clear every entry on invalidate; precompute both scopes on recompute so the statistics-updated broadcast stays meaningful for either scope.
- /api/statistics reads completed=true from the query string; also correct the stale comment at :1200-1201.

6. Web - src/web/lib/api.ts, src/web/components/Statistics.tsx, src/web/locales/*.ts
- fetchStatistics(completed) appends completed=true.
- Statistics owns the scope by reading and writing the page URL parameter completed=1 through useSearchParams, the same single-source-of-truth pattern as BoardPage (:139-166); it refetches on change and on the statistics-updated WebSocket message.
- Render the shared CompletedFilterToggle in the ContributionGraph header, turning the bare heading (:189-193) into a flex row.
- Add the metric to the Project Health row (:855-915) in minutes, with the sample count, and add the i18n key to en, zh-CN, zh-TW and ja.
- The localStorage payload on existing clients predates the new field: guard reads with ?? 0 and include the scope in the cache key.

7. Tests
- New: a parity test asserting the statistic equals the Gantt's own resolved columns for the same task, so the two cannot drift.
- statistics.test.ts: custom terminal status name; Dropped excluded; a row with no actual dates counted through the fallback; a zero span counted as zero; an inverted pair counted at the clamped 24 hours; empty input.
- stats-command.test.ts: overview default scope vs --completed.
- shared-branch-task-loader.test.ts:548-551: its statuses expectation moves to the raw config shape.
- markdown-test-helpers.ts:310: add the new projectHealth keys to the shared mock.
- Server-side: the two scopes resolve from one cache without leaking into each other.

8. Verification
- bunx tsc --noEmit; bun run check .
- bun test --timeout 240000 on the touched suites, GanttView suites included since step 1 touches that file.
- Manual: overview --plain reports 410 total by default and 714 with --completed; the statistics page toggles between the two and still renders a full status distribution after a server restart.
- Mutation check: swap getTerminalStatus back to a literal "Done" comparison and confirm the new tests go red, then restore.

Risk notes
- Step 1 touches GanttView, which has its own test suite; the helper must reproduce the existing resolution exactly or the Gantt bars move. Run those suites before and after.
- The default scope change moves existing CLI output (totalTasks 714 to 410, heatmap 135 to 98 active days). Intended, but it belongs in the release notes.
- The mean is strongly right-skewed (mean 3.68 days against a 50 minute median) because 422 fallback rows carry most of the weight. The mean in minutes is the requirement; if the card has room, the median or sample makeup alongside it would make the number honest.
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-10-01 06:13
---
Definition change requested by the user while this plan was under review. The metric is no longer the strict actualEnd minus actualStart span. It is the Gantt-resolved span: the same two numbers the Gantt left table shows in its Actual Start / Actual End columns, subtracted, using the same fallback chain (start = actualStart -> createdDate -> now; end = actualEnd -> updatedDate -> createdDate+1d -> start+1d; end < start clamped to start+1d).

Measured impact on this repository, 690 terminal tasks, where the previous strict definition covered only 225 of them:

- mean 5304.5 minutes (3.68 days), median 50 minutes, largest span 191.9 days.
- The 422 rows that resolve as createdDate -> updatedDate contribute about 88 percent of the total, so the headline mean is effectively those rows' mean; the rows carrying real actual timestamps stop being visible in it.
- 91 rows have a span of exactly 0 because createdDate and updatedDate are the same minute (mostly the BACK-4.x batch dated 2025-06-08). The end < start clamp does not fire on equal values, so they enter the average as 0 minutes.
- 3 rows are genuinely end < start and are clamped to exactly 24 hours.
- Only 37 rows, 5 percent, are rows the Gantt would mark with the fallback asterisk.

Consequence for the plan: step 1 changes from computing a strict span to reusing the Gantt resolution. To stop the statistic and the Gantt columns from drifting apart later, that resolution should be extracted into one shared helper consumed by both GanttView and the statistics module rather than copied. Steps 2 to 7 are unaffected. The revised criteria must also account for the skew above: a lone mean of 3.68 days sitting next to a 50 minute median is misleading, so the surface needs to show the distribution, not just the mean.

Moving this task back to Planning to revise the plan, because the definition and the acceptance criteria both change.
---

created: 2026-10-01 06:18
---
Correction to the previous comment: the definition is the Gantt resolution verbatim, with nothing added on top. My earlier note proposed flooring inverted pairs to zero. That extra rule is withdrawn - where end is before start the Gantt sets end to start + 1d, and this task follows the Gantt, so those rows enter as exactly 24 hours. Zero spans are unaffected either way, because the clamp only fires on a strict end < start.

Restated final definition: the span is the two Gantt Actual Start and Actual End column values subtracted, computed for every canonical-terminal task, with no exclusion rule and no flooring rule. The sample count is therefore the terminal task count.

Numbers under this definition on this repository, 690 terminal tasks: mean 5304.5 minutes (3.68 days), median 50 minutes, 91 rows at exactly zero span, 3 rows at the clamped 24 hours, 37 rows carrying the Gantt fallback asterisk. The mean is dominated by the 422 fallback rows, which carry about 88 percent of its weight.

The revised plan therefore makes the Gantt resolution a shared helper rather than a copy - new step 1 - and adds a parity test that pins the statistic to the Gantt columns. The remaining steps cover the metric surface, the scope parameter, the two defects, and verification.

Moving back to Planning for this revision, then returning to Plan Review.
---

created: 2026-10-01 07:02
---
Two metrics were mislabelled and have been swapped, which also leaves documentation stale. Nothing in the wiki was touched: the wiki has its own review workflow, so this is left as an explicit follow-up rather than an unattended rewrite.

Still quoting the old label "Average Task Age" or "Avg age" for the cycle metric, or needing the new "Avg Time Spent" metric added:

- `backlog/wiki/concepts/project-health.md` - carries a sample CLI transcript with `Average Task Age: N days`.
- `backlog/wiki/usermanual/60-配置与运维/02-项目概览.md` - configuration/operations chapter describing the overview output.
- `backlog/wiki/sources/back-490-overview-command-task.md` - the source page for the command that introduced it.
- `backlog/wiki_output/用户手册/manual.md` - generated manual, so it should be regenerated rather than edited by hand.
- `backlog/tasks/back-490 - Add-CLI-overview-command-for-project-level-task-statistics.md` - a closed task record. Deliberately not edited: it is the history of what the flag looked like when the work was done.

The project-health concept page also documents only the four health buckets and the age metric; it now needs the second metric (Gantt-resolved span, minutes, sample size) and the corpus scope parameter, since the two are easy to confuse - different units, different denominators.
---

created: 2026-10-01 07:06
---
Correction to the documentation note above: `averageTaskAge` was not renamed after all, so the pages listed there are NOT stale for that label. Those files only need the second metric added, and they are still left alone because the wiki has its own review workflow:

- `backlog/wiki/concepts/project-health.md` - the one worth doing first: it documents the age metric and the four health buckets, and now needs the second metric with its different unit (minutes) and different denominator (completed tasks).
- `backlog/wiki/usermanual/60-配置与运维/02-项目概览.md` - configuration/operations chapter describing the overview output.
- `backlog/wiki/sources/back-490-overview-command-task.md` - the source page for the command that introduced the age metric.
- `backlog/wiki_output/用户手册/manual.md` - generated, so regenerate rather than edit.
- `backlog/tasks/back-490 - Add-CLI-overview-command-for-project-level-task-statistics.md` - a closed task record, deliberately untouched.

What did change and is worth a line in those docs: the corpus scope parameter (`overview --completed`, `?completed=true`, the page toggle, default active only), and the new metric named 任务平均耗时 / Avg Time Spent.

One naming hazard to keep in mind for anyone editing these pages: on a Chinese page the age metric says 平均耗时 and the new metric says 任务平均耗时. They are different metrics - different unit, different denominator - so any page that lists both should say so explicitly.
---

created: 2026-10-01 07:13
---
Label change requested on review: the health-row metric now reads 平均周期 in Chinese instead of 平均耗时 (zh-TW 平均週期 instead of 平均耗時).

Scope kept deliberately narrow:

- Only the two Chinese locale files changed, and only the `avgAge` display string. English stays `Avg age:` and Japanese stays 平均所要時間:.
- The i18n key `avgAge`, the field `averageTaskAge`, its mixed lifecycle formula, its day unit and its rounded value are all unchanged. This is a display-only edit.
- The new metric card keeps its existing Chinese label 任务平均耗时.

One consequence worth recording: the 任务 prefix on the new card was added purely to tell it apart from the old health-row label, because both read 平均耗时. With the health row now reading 平均周期 that collision is gone, so the prefix is no longer load-bearing. Simplifying the card label to 平均耗时 would be a one-key change, but it was not requested, so it was left as-is.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a completion-time metric to project statistics and turned the reported corpus into an explicit, opt-in scope on both surfaces.

What changed

- New shared resolution, `src/utils/task-time-span.ts`. It owns the start/end fallback chain (start = actualStart, else createdDate, else now; end = actualEnd, else updatedDate, else createdDate + 1d, else start + 1d, with an inverted pair clamped to start + 1d) and reports which field each side came from. `GanttView.parseTasks` now renders from it and `core/statistics.ts` measures from it, so the two surfaces cannot drift apart. `src/test/task-time-span.test.ts` pins the whole branch table.
- `core/statistics.ts` takes the raw statuses config, resolves the completion status with `getTerminalStatus` (all six hardcoded "Done" comparisons are gone, and `Dropped` is not a completion), and adds `projectHealth.averageCompletionMinutes` plus `completionSampleCount`. Every completion contributes - no exclusion, no flooring - which is why the sample count equals the completed count.
- CLI. `overview` accepts `--completed`; both `overview` and `overview --plain` default to the active corpus. The metric sits in the headline summary block next to Total Tasks / Completion / Drafts, with its sample and the corpus scope, rather than down in Project Health. `loadAllTasksForStatistics` gained an `includeCompleted` option and returns the raw statuses config instead of a name list.
- Server. One `computeStatistics(includeCompleted)` serves the warm and the cold path, the cache is keyed by scope and cleared as a whole, and `/api/statistics` reads `completed=true`. This removed the duplicated corpus and status handling that produced `[object Object]` status keys and let the two paths disagree.
- Web. The statistics page owns its scope through the page URL (`completed=1`, the same convention as the board and the task list), `fetchStatistics` takes the flag, and the shared CompletedFilterToggle sits at the top right of the contribution card in a chrome-less `plain` variant that reads as part of that card. The average completion time is the fifth card in the top metric row (Total / Completed / Completion / Drafts / Avg completion), showing minutes with the sample size beneath the label. en, zh-CN, zh-TW and ja all carry the new keys. The localStorage cache is keyed per scope and the new fields are guarded for older payloads.

Measured on this repository

- default scope: totalTasks 411, completedTasks 386, 94 percent, mean 5153 minutes over 386 completions
- widened scope: totalTasks 715, completedTasks 690, 97 percent, mean 5305 minutes over 690 completions
- the widened mean reproduces the pre-implementation probe value of 5304.5 minutes; the default scope was not part of that probe, which measured the full corpus only
- the two scopes differ on this metric because the 304 completed-folder records enter through the createdDate-to-updatedDate fallback at roughly 5498 minutes each, which is what lifts the mean from 5153 to 5305

Verification

- `bunx tsc --noEmit` clean; `bun run check .` clean across 619 files
- new tests: task-time-span 11, statistics completion time 7, server-statistics-scope 6, web-statistics-scope 7
- existing suites: statistics / stats-command / shared-branch-task-loader 44 pass; the whole `web-` batch 333 pass / 0 fail
- CLI measured directly against this repo: `overview --plain` reports 411 with Avg Completion 5153 min (n=386) and scope "active only"; `overview --plain --completed` reports 715 with 5305 min (n=690) and scope "active + completed"
- HTTP measured directly: `/api/statistics` returns plain status names as keys, `/api/statistics?completed=true` widens correctly, and the two are cached separately
- mutation check: replacing `getTerminalStatus` with a literal "Done" turns 5 of the new tests red, and the change was reverted afterwards

Notes

- The mean is strongly right-skewed because 422 rows resolve through createdDate to updatedDate and dominate it. The mean in minutes is the requirement; the sample size sits beside it so the number can be read in context. A median was considered and deliberately left out.
- The 91 zero-span rows and the 3 clamped inversions are historical artefacts of the data, kept on purpose so the denominator stays the real task count.
- The new web test originally mocked `web/lib/api` with `mock.module`, which is process-wide in Bun and broke 65 unrelated suites in the same run; it now stubs the singleton and restores it in `afterAll`.
- The installed global `backlog` binary does not contain these changes; use the source CLI or rebuild it.

Naming follow-up after review: the two metrics were labelled the wrong way round, and the labels were swapped.

- `averageTaskAge` measures a task's lifetime - creation to completion for a finished task, creation to now while it is still open - so its label became "Avg task cycle" / 平均任务周期 in the web Project Health row, and "Avg Task Cycle" in both CLI renderers (it previously read "Average Task Age").
- The new metric measures time actually spent, so its label became "Avg Time Spent" / 平均耗时 on the metric card, and "Avg Time Spent" in both CLI renderers. Its i18n key was renamed `avgCompletion` to `avgTimeSpent` so the key matches what it shows.

This is a label-and-key change only. The underlying fields (`averageTaskAge`, `averageCompletionMinutes`), their definitions and their measured values are untouched: 28 days for the cycle, 5153 minutes (n=386) and 5305 minutes (n=690) for the time spent.

Correction to the naming note above: `averageTaskAge` keeps its original label. It still reads "Avg age:" / 平均耗时 in the web Project Health row and "Average Task Age" in both CLI renderers, exactly as before this task - the rename described above was reverted on review.

Only the new metric carries a new name: i18n key `avgTimeSpent`, shown as "Avg Time Spent" in English and 任务平均耗时 / 任務平均耗時 / タスク平均所要時間 in the other three locales. The longer Chinese wording is deliberate, so that on a page where the age metric already says 平均耗时 the two do not read as the same thing.

The underlying fields and values are untouched: `averageTaskAge` is still 28 days, `averageCompletionMinutes` is still 5153 minutes (n=386) and 5305 minutes (n=690).

### Label follow-up: the health-row label reads 平均周期 in Chinese

On review the Chinese label of the pre-existing health-row metric was changed from 平均耗时 to 平均周期, while the English and Japanese labels were left alone.

- zh-CN: `avgAge` = 平均耗时： -> 平均周期：
- zh-TW: `avgAge` = 平均耗時： -> 平均週期：
- Untouched: `avgAge` in en (`Avg age:`) and ja (平均所要時間:), and every other locale key.
- Untouched: the key name `avgAge`, the field `averageTaskAge`, its formula, its unit (days) and its value (28 days at the time of writing).

Effect: in Chinese the two metrics no longer collide by name. The health row measures the lifecycle (created -> completed/now, days, denominator = all tasks), the new card measures the Gantt-resolved actual span (minutes, denominator = canonical-terminal tasks). They were never meant to agree, and now they do not look like two spellings of one number either.
<!-- SECTION:FINAL_SUMMARY:END -->
