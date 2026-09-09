---
title: v1.49.3 to v1.50.1 Upstream Task Migration Analysis Report (by domain)
created_date: '2026-09-08 17:00'
updated_date: '2026-09-08 17:00'
labels:
  - source
  - migration
  - upstream
source_path: backlog/docs/migration/doc-10 - v1.49.3-至-v1.50.1-上游任务迁移分析报告（按领域）.md
---

# v1.49.3 to v1.50.1 Upstream Task Migration Analysis Report (by domain)

Per-item deep analysis for all A/B entries classified in doc-9, covering the v1.49.3..v1.50.1 upstream range. Each of the 26 items (CLI-1..13, TUI-1..8, WEB-1..4, SVR-1..2, CI-1) is analyzed along six dimensions — purpose, change summary, fork-intersection risk, reusable content, exclusions, priority and migration advice (①reuse / ②rewrite / ③skip) — with file:line evidence from both the upstream merge commits and the fork worktree. Original upstream tasks were imported as drafts (draft-90..draft-125) and migrated as BACK-571..BACK-615, all Done.

## Summary

- Method: four domains analyzed in parallel (CLI/Core, TUI, Web, Server+Infra), comparing each upstream merge-commit diff against the fork worktree file by file.
- CLI-1 (BACK-575→571): `withTaskLock`/`withLockTarget`/`TaskLockError` in `src/file-system/operations.ts`, `updateTaskFromInput` re-reads inside the lock in `src/core/backlog.ts`, MCP maps lock errors to OPERATION_FAILED; lock order fixed as task lock → create lock.
- CLI-2 (BACK-583→579): `defaultAssignee` applied in `createTaskFromInput` (`resolvedAssignees = normalizedAssignees.length > 0 ? ... : normalizeStringList(config?.defaultAssignee) ?? []`), string→string[] type upgrade, coverage across CLI/wizard/TUI/web/MCP.
- CLI-4 (BACK-572/586/618→577): `--clear-deps/--clear-refs/--clear-docs` plus rejecting empty `--dep ""`/`--ref ""`/`--doc ""` on edit; create still rejects empty values.
- CLI-10 (BACK-623/624→600/601/602): local-first CLI reads landed first, then BACK-601 completed the BACK-559 publication-owner / batchTaskUpdates / transitionTask foundation, then BACK-602 ported full BACK-624 (tip snapshots, shared cache, bounded fetch, ref leases, MCP search local path).
- WEB-1 (BACK-617→573): Chromium aborts native drag when dragstart synchronously reveals hidden columns — fix defers reveal by one macrotask; fork `Board.tsx:658` had the identical bug pattern.
- WEB-4 (BACK-614/604→584): three-state assignee payload — absent applies defaultAssignee, explicit `[]` means unassigned; CLI `--unassign` added, `-a ""` errors with a hint; web form prefills defaultAssignee chips and clearing chips sends explicit unassign.
- SVR-1 (BACK-580/602→596): fail-closed document/decision identity (AmbiguousDocumentIdError-style) replacing filename-prefix matching in `loadDecision` and silent first-match in `getDocument`, plus doctor diagnostics.
- SVR-2 (BACK-613→595): content-store document watcher no longer retries `doc-1`-style names forever, publishes zero-padded-ID renames by path, and `strandedEquivalent` triggers a full refresh fallback.
- TUI items (BACK-565→587 composer UX, 584/616→588/589 vim keys, 615→590 hideEmptyColumns, 577→591 window titles, 609→592 doc --plain, 620→594 footer hints, 581/605→593 BACKLOG_CWD/runtime cwd) were promoted to A as real interaction/correctness defects with fork worktree evidence.

## Related Concepts

- [[concepts/upstream-migration]] — the canonical example of the classification → analysis → draft import → BACK-5xx/6xx migration pipeline
- [[concepts/task-identity]] — SVR-1 extends fail-closed identity from tasks (AmbiguousTaskIdError) to documents and decisions
- [[concepts/core-architecture]] — CLI-10 documents the cross-branch loading architecture (publication owner, bounded fetch, ref leases)

## Related Sources

- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — the classification index this report analyzes item by item
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — previous wave's domain analysis, same six-dimension method
