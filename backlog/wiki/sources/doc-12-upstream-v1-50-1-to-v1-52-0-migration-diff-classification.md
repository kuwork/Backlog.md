---
title: doc-12 Upstream v1.50.1 to v1.52.0 Migration Diff Classification
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - upstream-migration
source_path: backlog/docs/migration/doc-12 - Upstream-v1.50.1-to-v1.52.0-Migration-Diff-Classification.md
---

# doc-12 Upstream v1.50.1 to v1.52.0 Migration Diff Classification

Classification table for the upstream `v1.50.1..v1.52.0` range (131 commits, 80 candidate entries), organized by domain (CLI/Core, TUI, Web, Server, Infra/CI) with final A/B/C priorities and per-entry migration-task tracking. Deep analysis landed at 7 A / 43 B / 30 C; pairs with the per-item report [[sources/doc-13-upstream-v1-50-1-to-v1-52-0-migration-analysis-by-domain]] and is the authoritative tracker for the v1.52.0 migration wave.

## Summary

- Candidate scope is a **dual-source union** (in-range commit numbers ∪ in-range task-file additions) because tasks like BACK-589/590/592/401 were filed before v1.50.1 but only merged in this range — file-only enumeration would have missed the whole batch
- Deep-analysis reclassification from initial screening (7/54/19 → 7/43/30): 4 promoted to A (CORE-19 punctuation-title filenames, CORE-24 dependency resolution in completed tasks, TUI-5 Unicode-safe insertion, TUI-10 shared ID comparator), 14 demoted to C; WEB-8 was domain-corrected to TUI-14 (upstream change was entirely in `src/ui/board.ts` + `task-watcher.ts`) and returned to B
- Data-quality notes: BACK-641/BACK-670 cancel out (dependencies command added then removed — net zero); task record status lags implementation (BACK-222 still To Do though BACK-222.1 shipped it); several upstream/fork BACK numbers collide with different meanings (BACK-669, BACK-672, BACK-675–680), judged by link target not number
- A/B entries were imported as upstream drafts DRAFT#121–#169; drafts were progressively promoted to fork tasks BACK-642 through BACK-699 — the status table at the bottom shows every migration task Done at final update
- Migration ordering: eight waves — A-class correctness fixes first, cross-branch index correctness (CORE-4/5), dependency-graph chain (CORE-2→CORE-28, CORE-23→CORE-30), search convergence (CORE-20→21), collision items vs exclusion list (CORE-34/31, CORE-3+32 merged into BACK-691), large standalone items (CORE-12 project attribute), TUI series serialized to avoid `src/ui` stomping, then web/infra
- Notable merges: TUI-1+TUI-7+TUI-9 combined into BACK-675 landing the upstream final AC-bar form directly; CORE-3+CORE-32 combined into BACK-691; CORE-29+CORE-33 combined into BACK-656

## Acceptance Criteria

- Not applicable (classification document); the classification tables, wave ordering, and migration-task status tracker are the deliverables.

## Related Concepts

- [[concepts/upstream-migration]] — same A/B/C scheme and wave-based ordering as earlier rounds, refined with dual-source candidate enumeration
- [[concepts/task-identity]] — collision handling for upstream vs fork BACK numbers and ambiguous draft/task identities recurring across entries

## Related Sources

- [[sources/doc-13-upstream-v1-50-1-to-v1-52-0-migration-analysis-by-domain]] — per-item deep analysis companion for every entry in this table
- [[sources/doc-9-upstream-v1-49-3-to-v1-50-1-migration-diff-classification]] — previous round's classification table
- CORE-2 heads the dependency-graph wave; it has not yet been promoted to a fork task
- INF-2 (biome check in CI) carries no upstream task number and was reconstructed from the commit
