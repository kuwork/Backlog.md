---
title: doc-15 Wiki 知识图谱关系设计（doc-14 第三期）
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - graph
  - wiki
  - kuzu
  - design
source_path: backlog/docs/BRDS/doc-15 - Wiki-知识图谱关系设计（doc-14-第三期）.md
---

# doc-15 Wiki 知识图谱关系设计（doc-14 第三期）

Detailed phase-3 design extending the doc-14 Kuzu task graph with knowledge files (`wiki/`, `decisions/`, `docs/`). Central decision: the project-relative file path is the only node identity — no synthetic wiki page IDs — and the graph is a pure projection of Markdown + frontmatter, preserving the Obsidian "file is node, wikilink is navigation" model.

## Summary

- Scope deliberately narrowed: only four mechanical graph facts land now — `FileNode` with frontmatter `file_type`, `TaggedWith` edges from `labels`, `SourcedFrom` edges from `source_path`, `LinksTo` edges from body `[[wikilink]]`; **all semantic relations (`relations` field and seven semantic edge tables) are designed but deferred** since no file uses `relations` and no query consumes semantic edges
- Knowledge node type comes from explicit frontmatter `file_type` (`wiki`/`decision`/`document`), never inferred from directory; `type` is not reused because `backlog/docs/` already occupies it with Backlog document types (`normalizeDocumentTypeInput` errors on foreign values) — disjoint value ranges forced a separate field
- Only knowledge files' `labels` become `Tag` nodes: task/draft/milestone labels are a different vocabulary, and merging them left 79 of 216 Tag nodes orphaned (no edges) in a real-repo measurement; after narrowing, all 137 tags are wiki-backed with zero orphans
- `source_path` resolution is fail-closed: path match first, then stable-ID fallback (task ID via `FileNode.id` index); zero or multiple candidates → no edge, recorded in `invalidRelations`/`unresolvedSources`; deleted sources keep the wiki page with a note, never a fabricated path
- Two-level gate for relations: formal validation (controlled `type` values, resolvable whitelisted targets) is fully automated and **must not be overridden by an LLM**; semantic validation defaults to humans, and LLM authorization requires proposer/validator separation plus per-relation evidence citations
- Wikilinks parse without `.md`, relative to `backlog/wiki/`, support `[[path|alias]]`; they generate plain `LinksTo` citation edges only — no semantic interpretation, and unlinked mentions never enter the graph
- Deferred designs retained for activation: seven semantic REL tables with `evidence STRING[]` (verified supported by the project's Kuzu version), namespaced controlled label vocabulary (`domain/`, `topic/`, `origin/`, `lifecycle/`), lint rules for unresolvable wikilinks/missing `file_type`, and an Obsidian-compatible graph view with tag filtering

## Acceptance Criteria

- Not applicable (design document); migration order keeps existing wiki usable while adding `file_type` declarations, label normalization, mechanical edge generation, and lint checks (the doc ships the mechanism and reports, not the data migration).

## Related Concepts

- [[concepts/wikilink]] — body `[[wikilink]]` parsing rules (no `.md`, alias form, wiki-root-relative) that feed `LinksTo`
- [[concepts/task-identity]] — path-based node identity and fail-closed resolution inherited from doc-14
- [[concepts/markdown-pipeline]] — frontmatter fields (`file_type`, `labels`, `source_path`) as the only graph fact sources

## Related Sources

- [[sources/doc-14-kuzu-task-graph-cold-start-hot-update-design]] — the phase-1/2 design this extends; Graph Service, fingerprints, notify/watch, and fail-closed principles unchanged
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — existing wikilink alias support the `[[path|alias]]` parsing rule aligns with
- [[sources/back-524-add-media-wikilink-support-for-images-video-and-audio]] — media `![[...]]` embeds classified as informational in this doc's lint rules
