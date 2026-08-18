---
title: doc-8 上游 v1.48.0→v1.49.3 迁移分析报告（按领域）
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - doc
  - migration
  - upstream
source_path: backlog/docs/migration/doc-8 - 上游任务迁移分析报告（v1.48.0-..-v1.49.3-按领域）.md
---

# doc-8 上游 v1.48.0→v1.49.3 迁移分析报告（按领域）

Detailed per-item analysis of upstream `v1.48.0 .. v1.49.3` changes, organized by domain and migration recommendation.

## Summary

- Covers CLI/Core, TUI, Web, Server, Infra/CI, and Nix domains.
- Each item includes: core purpose, upstream merge commit/files/churn, intersection risk with fork custom code, reusable parts, parts to exclude/adjust, priority, and migration suggestion (① direct reuse / ② reference rewrite / ③ ignore).
- Highlights fork-specific adaptations: fork has no `task.type`, uses local-timezone display, retains `sequences`, uses `get-port@7.2.0`, lacks upstream publication-owner/batchTaskUpdates/refreshLocalTaskCorpus machinery.
- Recommends migration order: independent A-class first (TUI watcher, append-plan, browser shortcuts, loopback, BROWSER, milestone filtering, autoCommit), then JSON output, CI platform contracts, composer, Web async loading, then identity index as a standalone large phase.
- Warns about upstream commit prefix confusion (commits labeled `BACK-555` actually implement BACK-564/562).

## Related Concepts

- [[concepts/upstream-migration]] — Fork upstream migration strategy
- [[concepts/cli-entry]] — CLI command surface
- [[concepts/core-architecture]] — Core and ContentStore
- [[concepts/web-server]] — Server and WebSocket

## Related Sources

- [[sources/doc-7-upstream-v1-48-0-to-v1-49-3-migration-classification]] — A/B/C classification
- [[sources/back-562-stable-json-output]] — CLI-1 JSON output
- [[sources/back-567-cross-branch-task-identity]] — CLI-2 identity index
- [[sources/back-561-autocommit-exact-files]] — CLI-3 autoCommit
- [[sources/back-560-milestone-id-filtering]] — CLI-4 milestone filtering
- [[sources/back-556-task-edit-append-plan]] — CLI-5 append-plan
- [[sources/back-410-cursor-agents-md-cleanup]] — CLI-7 AGENTS.md cleanup
- [[sources/back-555-tui-live-refresh-atomic-writes]] — TUI-1 live refresh
- [[sources/back-563-tui-intent-first-composer]] — TUI-2/3 composer
- [[sources/back-565-tui-theme-adaptive-scroll]] — TUI-4 theme/scroll
- [[sources/back-557-browser-shortcuts-inline-fields]] — WEB-1 keyboard guards
- [[sources/back-566-browser-async-loading]] — WEB-2/3 async loading
- [[sources/back-558-browser-server-loopback-only]] — SERVER-1 loopback
- [[sources/back-559-browser-launch-honor-browser-env]] — SERVER-2 BROWSER launch
- [[sources/back-568-core-browser-task-boundary]] — SERVER-3 Core boundary
