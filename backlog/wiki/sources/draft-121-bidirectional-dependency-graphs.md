---
title: draft-121 Expose bidirectional dependency graphs in task details
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - graph
  - dependencies
  - cli
  - web-ui
source_path: backlog/drafts/draft-121 - Expose-bidirectional-dependency-graphs-in-task-details.md
---

# draft-121 Expose bidirectional dependency graphs in task details

Upstream BACK-548 (doc-12 CORE-2) imported as a draft: task detail views should show the complete dependency context — both the transitive set a task depends on and the transitive set depending on it — across CLI, TUI, browser, and the legacy MCP adapter. All ACs are checked (upstream shipped it); the fork migration is pending.

## Summary

- One shared model: new `src/utils/dependency-graph.ts` (`buildDependencyGraph`) is the single owner of the reverse edge — no reverse-dependency owner existed before; canonical identity/ambiguity/completion evidence moved to `src/utils/task-record-index.ts` so readiness and the graph resolve records by the same rule
- Contract: edges point from declarer to dependency; each identity is one node carrying shortest `dependencyDepth`/`dependentDepth` (0 root, 1 direct, >1 transitive, null unreachable); BFS with visited set so diamonds/cycles terminate without duplication; missing/ambiguous identities become explicit nodes never traversed
- Visibility is caller-supplied corpus per surface; the browser needed a server-side source (`GET /api/tasks/:id/dependency-graph`) because the modal only held the board list — cross-branch store contributes only identities the working copy lacks, so a locally duplicated ID reads ambiguous instead of flattened-resolved
- Rendering: direction-separated "Depends on" / "Dependents" sections in the shared plain-text formatter, each node expanded once with `(cycle)` / `(shown above)` back-references; JSON gains an additive `dependencyGraph` object (schemaVersion 1) with root/nodes/edges; list and search summary payloads untouched
- TUI gets scrollable branch-glyph sections; browser renders semantic list markup with navigation links; MCP mirrors the settled CLI contract last, explicitly as a legacy adapter
- Archived IDs are never resurrected (archive releases identity); determinism via `compareTaskIds` ordering of nodes and edges

## Acceptance Criteria

- Canonical CLI detail shows direction-separated forward and reverse graphs with direct vs transitive distinguished
- JSON task view adds documented additive graph (root, nodes, directed edges) while compact list/search contracts stay unchanged
- Graph handles chains, branches, diamonds, and cycles with deterministic ordering and no recursive payload explosion
- Missing references and ambiguous identities are explicit and fail closed — never guessed or reported as resolved
- TUI and browser show navigable forward/reverse sections without expanding board cards or list rows; MCP follows only as legacy adapter after the canonical contract settles

## Related Concepts

- [[concepts/task-identity]] — canonical identity, alias, and ambiguity rules the graph resolution shares with readiness
- [[concepts/json-output]] — additive `dependencyGraph` contract under schemaVersion 1
- [[concepts/upstream-migration]] — imported as DRAFT#121 in the doc-12 dependency-graph wave (CORE-2)

## Related Sources

- [[sources/doc-12-upstream-v1-50-1-to-v1-52-0-migration-diff-classification]] — CORE-2 entry tracking this draft
- [[sources/back-615-dependency-readiness-guidance]] — fork-native readiness engine the graph shares identity rules with
- [[sources/back-505]] — earlier dependency drill-down navigation
- [[sources/draft-140-dependency-graph-follow-ups]] — review follow-ups to this task
- [[sources/draft-135-reject-self-referential-cyclic-dependencies]] — validation layer reusing this graph model
