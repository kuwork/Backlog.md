# Project Memory — Backlog.md

## Task-file authoring conventions (confirmed by user, 2026-10-02)
When finalizing a BACK task, the task markdown must:
1. Record changed files: add a `modified_files:` list in the frontmatter (canonical field per back-447) AND/OR a `## Files Changed` section with per-file role notes. Get the real list via `git status --short` / `git diff --stat` — do not guess.
2. Fill the `## Definition of Done` checkboxes (`[x]`) and attach a short English verification note (commands run + pass counts). Note when repo-wide `bun run check .` fails only on unrelated untracked files.
3. Write the task in English. The Description/ACs are already English; any Comments/notes added by the assistant must also be English (do not leave Chinese review notes in the task file).
4. Use the canonical section names and their markers, in this order: `## Description` (`<!-- SECTION:DESCRIPTION:BEGIN|END -->`), `## Acceptance Criteria` (`<!-- AC:BEGIN|END -->`), `## Definition of Done` (`<!-- DOD:BEGIN|END -->`), `## Implementation Plan` (`<!-- SECTION:PLAN:BEGIN|END -->`), `## Implementation Notes` (`<!-- SECTION:NOTES:BEGIN|END -->`), `## Final Summary` (`<!-- SECTION:FINAL_SUMMARY:BEGIN|END -->`), then `## Files Changed` last (no markers). Do NOT invent `## Plan` or `## Comments` — the UI looks the canonical names up, so a mis-named section renders empty. Keep the AC/DoD bodies as pure `- [ ]`/`- [x]` lists: without the `AC` markers the renderer treats the block as plain text and prepends its own `#N`, so hand-written `- [x] #1 ...` lines show as `#1 #1 ...`.
5. Set the frontmatter `actual_start:` when work begins and `actual_end:` when it is done (alongside `created_date`/`updated_date`); roughly 250 tasks in the repo carry them.

## Branch / git conventions (from user profile)
- Working branch for BACK work: `1.53` as of 2026-10-02 (was `1.52.1`); git identity `kuwork <jerry535362936@126.com>`.
- Default: the assistant stages changes (`git rm` etc.) but does NOT commit or `git push` (incl. force) — those are the user's actions. **Exception: when the user explicitly asks for a commit, do it** (they did on 2026-10-02: "把变动的文件提交回737那次提交", which meant rewriting history). `git push` remains the user's even then: a rewritten branch leaves `origin/1.53` behind and needs `git push --force-with-lease`, which the user runs.
- One commit per BACK ticket is the branch's shape. A follow-up fix for ticket N is expected to be folded into ticket N's commit, not left as a stray extra commit — even when that rewrites already-pushed history.
- Wiki (`backlog/wiki/`) edits are "review-first": prepare suggestions, do not auto-commit; user confirms (e.g. "OK 。新增 2 页").

## Memo pagination is offset end to end (BACK-743, 2026-10-02)
- Memos page with `offset`+`limit` on every surface: MCP `memo_list`, REST `GET /api/memos`, the web feed and core `listMemosPage`. The old opaque `cursor`/`nextCursor` is gone; `/api/memos` answers 400 when `cursor` is passed.
- The shared slice helper is `selectListPage` + `ListPage<T>` in `src/utils/list-page.ts` (used by core and the MCP layer). It is deliberately distinct from `ListPage<T>` in `src/utils/list-window.ts`, which models the CLI's `--skip`/`--max-count` window (`skip`/`total`/`nextSkip`/`cut`). Do not merge the two.
- `buildListResult` (the MCP `structuredContent` + `Showing X-Y of N` wrapper) lives in `src/mcp/utils/list-page.ts` and re-exports the shared helper.
- Do not reshape core paging to serve a single surface: BACK-742 kept `cursor` only for the web UI, and BACK-743 removed it once the web feed itself moved to offset.

## Memo day contract — local day for filing, UTC date for the id (BACK-737 follow-up, 2026-10-02)
- `created_date` is stored **UTC** (`nowStamp()`), the repo-wide convention; `src/utils/date-utc.ts` is the canonical converter (`localDateTimeToStoredUtc` local→stored, `parseStoredUtcDate` stored→local).
- Every **day-shaped question** matches the **local** date part via `localDateKeyFromStoredUtc(value)`: the calendar buckets (`handleGetMemoCalendar`), the `?date=` filter (`listMemosPage`, also behind the CLI's `--date` and MCP `memo_list`), `memoCreatedOnDate` in the web helpers, and the memo deep link in `web/utils/search-results.ts`. Never compare `createdDate.slice(0, 10)` — that is the bug that filed a 23:00 capture under the next day.
- The memo **id** is the deliberate exception (user decision, 2026-10-02): `nextMemoId`/`dateStamp`/`dateStampFrom` keep the stored **UTC** date as the `YYYYMMDD` prefix, so an id's digits can be a day ahead of the day the memo is filed under. Do not "fix" this without asking.
- The composer's back-dated chip must pin the picked **local** day at the current **local** time and convert once: `localDateTimeToStoredUtc(\`${day} ${formatLocalTimeStamp()}\`)`. Splicing a local day onto `toISOString()`'s clock time stores an instant the grid can never show.

## The memo-day fix now lives inside the BACK-737 commit (2026-10-02, history rewritten)
- `1.53` was rewritten on request so the memo local-day fix is part of BACK-737 instead of a separate commit. New SHAs: BACK-737 = `77a0fdde5`, BACK-742 = `68dcc9045`, tip = `025d9457f`. **The old SHAs (`26444c66a`, `c0645581e`, `aa15ddaf5`) no longer exist on the branch** — they are only in the backup refs.
- The rewritten tip's tree is byte-identical to the verified pre-rewrite state (`4e368127bb7d5201ca8adb082c1194b13084c3c7`), so no content changed — only where the fix sits in history.
- Backup refs to keep until the user is satisfied: `backup/pre-737-amend` (old tip `aa15ddaf5`), `backup/fix-final` (the fix as one commit on the old history). Delete them after a successful `push --force-with-lease`.
- Where each changed file landed: 15 files that existed at 737 went into the 737 commit; `src/guidelines/mcp/memos.md` and `src/test/mcp-memos.test.ts` went into **742**, because BACK-740 created them and 742 rewrote them both (they cannot exist at 737).
- **`origin/1.53` is now 8 commits behind the rewritten local branch** and needs a force-push by the user.

## Test-runner gotchas on this machine (2026-10-02)
- **`bun test` runs in UTC** (`Intl.DateTimeFormat().resolvedOptions().timeZone === "UTC"`, `process.env.TZ` unset) even though the shell is `America/Los_Angeles`. A timezone-sensitive regression is therefore invisible to the normal suites — it must pin the zone in a **child process**: `Bun.spawnSync({ cmd: [process.execPath, "run", script], env: { ...process.env, TZ: "America/Los_Angeles" } })`. Precedents: `src/test/memo-local-day-timezone.test.ts`, `src/test/overview-date-format.test.ts`. Setting `process.env.TZ` inside a test also works but leaks process-wide — avoid it.
- Verify a regression test is real by reverting the fix and watching it fail, not by trusting that it passes.
- Repo-wide `bun run check .` reports ~25 errors in files nobody touched: those files were checked out with **CRLF** line endings on Windows while biome wants LF. It is not a regression. Scope `bunx biome check <touched files>` instead, and say so in the task's verification note.
- `src/test/memo-search.test.ts`'s `/api/search` server-boot case flakes roughly 1 run in 4 on this machine (readiness retry exhausts, no assertion diff).
