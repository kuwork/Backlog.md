---
id: BACK-808
title: 'CLI: backlog graph legend get/set/remove'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-17 02:46'
updated_date: '2026-10-17 15:06'
labels:
  - cli
  - docs
milestone: m-16
dependencies:
  - BACK-806
documentation:
  - backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
modified_files:
  - src/cli.ts
  - src/guidelines/cli-instructions/graph.md
  - src/guidelines/mcp/graph.md
  - src/test/cli-graph-legend.test.ts
priority: medium
ordinal: 370001
actual_start: '2026-10-17 04:02'
actual_end: '2026-10-17 08:13'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PRD: doc-29. A legend subcommand group under the existing graph command (m-13) that reads and writes the same backlog/databases/graph-legends.yaml the server uses - direct file access, no HTTP, works offline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog graph legend get <database> prints the stored config for that database; --json prints the raw JSON; an unknown database prints a clear no-config message and exits 0
- [x] #2 backlog graph legend set <database> <file> imports a YAML file; --stdin reads from standard input; invalid YAML exits non-zero with a clear error and leaves the store untouched
- [x] #3 backlog graph legend remove <database> removes that database's entry
- [x] #4 CLI and web panel operate on the same file: a CLI set is visible to the web after reload, and vice versa
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse the legend-store module from BACK-806 (load/save/remove) - no second storage path.
2. Add the legend subcommand group under the existing graph command in src/cli.ts with help schema entries and examples; validate set input is a plain YAML mapping before writing; deletion follows the CLI convention and is named remove.
3. Tests: CLI-level tests for get (hit/miss), set from file and stdin, invalid YAML refusal, remove.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the graph legend subcommand group (M-16 / doc-29) reading and writing the same backlog/databases/graph-legends.yaml the server and web panel use. Commands: graph legend get <database> (prints a human-readable summary of the stored config by default - captions toggle, per-type colour/caption/rules, per-relation line style, hidden buckets, via formatLegendConfigText + asLegendRecord over the tolerant store; --json prints the raw JSON for scripts and piping; an unknown database prints a clear no-config message and exits 0), graph legend set <database> <file> (file or --stdin; invalid YAML or a non-mapping payload exits non-zero and leaves the store untouched), graph legend remove <database> (idempotent). Reuses loadLegendConfig/saveLegendConfig from src/graph/legend-store.ts - no second storage path, so CLI edits are visible to the web panel after reload and vice versa (AC #4). Covered by src/test/cli-graph-legend.test.ts (11 tests: get hit/miss, readable summary not raw JSON, rules/relations/hidden rendered, set from YAML file and stdin, a JSON payload also parses (YAML is a superset), invalid YAML refusal, non-mapping refusal, remove + idempotent, round-trip with the server-side reader). tsc --noEmit and biome check are clean. Usage guide src/guidelines/cli-instructions/graph.md updated with a 'Graph legend config' section (get/set/remove, readable default vs --json raw, and the save-time pinning of automatic type colours in the Web UI).
<!-- SECTION:FINAL_SUMMARY:END -->
