---
title: BACK-714 Ingest wiki/docs/decisions into the graph (FileNode types, tags, provenance, wikilinks)
created_date: '2026-09-26 14:14'
updated_date: '2026-09-26 14:14'
labels:
  - source
  - graph
  - wiki
  - web-ui
source_path: backlog/tasks/back-714 - Ingest-wiki-docs-decisions-into-the-graph-FileNode-types-tags-provenance-wikilinks.md
---

# BACK-714 Ingest wiki/docs/decisions into the graph (FileNode types, tags, provenance, wikilinks)

Phase 3 of the knowledge graph (doc-15): the graph ingests `backlog/wiki/`, `backlog/decisions/` and `backlog/docs/` into the same FileNode table as tasks, adds three mechanically derived relation tables (TaggedWith, SourcedFrom, LinksTo), and splits the UI into a task graph (/graph) and a knowledge graph (/knowledge).

## Summary

- Node types come from the whitelisted directory only (`wiki/**` → wiki, `docs/**` → document, `decisions/**` → decision); frontmatter is never read for a type and subfolders (`wiki/sources/`, `wiki/concepts/`) are navigation scope, not types; `wiki/index.md` and `wiki/log.md` excluded at scan time
- Tag nodes generated from frontmatter `labels`, one `TaggedWith` edge per label, no parallel `tags` field; `SourcedFrom` from `source_path` (task sources matched via `FileNode.id`, knowledge sources via path), with 0 or >1 candidates producing no edge and a report — fail-closed
- `LinksTo` edges parsed from body `[[wikilinks]]`, resolved against the wiki root and the citing page, alias/heading parts stripped, only a unique hit becomes an edge; unlinked mentions are not graph facts; the frontmatter `relations` field and all semantic edge tables are ignored by design (deferred)
- Versions: `SCHEMA_VERSION` 2 (Tag table + new rel tables, wiped/rebuilt by BACK-713's self-describing guard), `PARSER_VERSION` 3; cold start, incremental sync, notify hook and schema guard keep phase-1 behavior
- Two readings of one payload: /graph shows task/completed/draft/milestone only, the new /knowledge sidebar entry shows wiki/decision/document/tag only; hidden kinds are dropped **before** the force layout runs, and the modal relationship subgraph never walks a knowledge edge
- Captions name nodes the way a reader recognises them — knowledge pages by frontmatter title (file-name fallback), work files by code name, tags without the `tag:` prefix — trimmed by estimated width (CJK counted double) in one shared tested module; full title on hover
- Clicking a knowledge node opens its real page in a new tab via one testable mapping (`/wiki/*`, `/documentation/:id`, `/decisions/:id`); a tag or an id-less folder readme opens nothing rather than guessing
- Real corpus verification: 1155 files / 1131 nodes / 216 tags; TaggedWith 2048, LinksTo 1155, SourcedFrom 187; no edge with a missing endpoint, `unresolvedLinks` 0; suites: graph-knowledge 17, graph-caption 8, graph-node-links 5, task-subgraph 9
- Reported, not repaired: four known `source_path` gaps (doc-16 gone; draft-125/92/96 promoted) stay visible as lint defects; 21 pre-existing unparsable `completed/*.md` files (unquoted `assignee: @MrLesk`) skipped by the importer

## Acceptance Criteria

- Directory-derived types only; Tag table + TaggedWith from labels; SourcedFrom and LinksTo fail-closed with reports
- Lint classifies every finding without dropping any; known source_path gaps stay reported
- Version bumps reuse existing fingerprint/notify/schema-wipe machinery; two kind-filtered readings of one payload
- Shared caption-trimming and node-link mapping modules, both tested

## Related Concepts

- [[concepts/wikilink]] — the `[[path|alias]]` syntax LinksTo edges are parsed from
- [[concepts/markdown-pipeline]] — frontmatter/body parsing feeding the graph
- [[concepts/web-ui-features]] — the two graph views and navigation entries

## Related Sources

- [[sources/back-713-filenode-rename]] — FileNode schema and version guard this phase extends (same batch)
- [[sources/back-702-kuzu-graph-foundation]] — phase-1 foundation (same batch)
- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — wikilink alias semantics reused for resolution
- [[sources/back-712-wiki-lint-source-path-guidance]] — the source_path integrity concern, here enforced by the graph's lint (same batch)
- [[sources/wiki-web-ui-task]] — the wiki web pages knowledge nodes link out to
