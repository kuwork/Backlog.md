---
title: doc-7 上游 v1.48.0→v1.49.3 迁移差异分类
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - doc
  - migration
  - upstream
source_path: backlog/docs/migration/doc-7 - Upstream-v1.48.0-to-v1.49.3-Migration-Diff-Classification.md
---

# doc-7 上游 v1.48.0→v1.49.3 迁移差异分类

A/B/C 差异分类 for upstream `MrLesk/Backlog.md` `v1.48.0 .. v1.49.3` (139 commits, 33 task groups), organized by domain.

## Summary

- Final result: **13 A / 5 B / 10 C** after priority reclassification.
- A-class items map to fork tasks BACK-562, BACK-567, BACK-561, BACK-560, BACK-556, BACK-558, BACK-559, BACK-555, BACK-563, BACK-565, BACK-557, BACK-566, and draft-89 (CI).
- B-class items include task type field (draft-80), AGENTS.md cleanup (BACK-410), testing reliability, and optional TUI/Web enhancements.
- C-class items are skipped: Nix bun2nix v2, upstream-only docs, UTC display strategy, unimplemented upstream ideas, and features fork already covers or rejects.
- Domain grouping: CLI/Core, TUI, Web, Server, Infra/CI, Nix.
- Provides reuse vs rewrite recommendations: ① direct reuse, ② reference rewrite, ③ ignore.

## Related Concepts

- [[concepts/upstream-migration]] — Fork upstream migration strategy
- [[concepts/core-architecture]] — Core/identity architecture
- [[concepts/web-server]] — Server-side migration items

## Related Sources

- [[sources/doc-4-upstream-migration-classification]] — Previous v1.47.1→v1.48.0 classification
- [[sources/doc-8-upstream-v1-49-3-migration-analysis-by-domain]] — Detailed per-item analysis
