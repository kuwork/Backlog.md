---
id: BACK-807
title: 'Graph legend persistence: browser boot restore + write-through saves'
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-17 02:45'
updated_date: '2026-10-17 15:05'
labels:
  - web-ui
milestone: m-16
dependencies:
  - BACK-806
documentation:
  - backlog/docs/PRDS/cypher/doc-29 - Graph-Legend-配置持久化：项目级存储与启动恢复.md
modified_files:
  - src/web/App.tsx
  - src/web/components/CypherResultGraph.tsx
  - src/web/components/GraphLegendSettings.tsx
  - src/web/lib/api.ts
  - src/web/utils/graph-legend-config.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/test/api-graph-legend.test.ts
  - src/test/cypher-query-block.test.tsx
  - src/test/graph-legend-config.test.ts
  - src/test/web-graph-legend-persistence.test.tsx
priority: medium
ordinal: 369001
actual_start: '2026-10-17 03:45'
actual_end: '2026-10-17 09:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PRD: doc-29. CypherResultGraph (the only legend consumer) restores the server-side config on mount, migrates a localStorage-only config up once, and writes saves through to the server while keeping localStorage as the instant/offline cache.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CypherResultGraph mounts with the localStorage config instantly, then applies the server config when it differs and refreshes the localStorage cache
- [x] #2 When the server has no entry but localStorage does, the local config is pushed up once (migration)
- [x] #3 Saves write localStorage immediately and PUT through; a failed PUT keeps the local copy without crashing or losing the edit
- [x] #4 A graph-legend-updated broadcast for the same database re-fetches and applies the config live; broadcasts for other databases are ignored
- [x] #5 When the server is unreachable the block behaves exactly as today (localStorage only)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend apiClient (src/web/lib/api.ts) with fetchGraphLegend(database) and saveGraphLegend(database, config | null).
2. In CypherResultGraph.tsx: after mount, fetch the server config; server wins when present, otherwise migrate localStorage up once; keep the useState initializer on loadLegendConfig for the first frame.
3. Save path: keep the existing saveLegendConfig call and fire the PUT alongside; subscribe to the graph-legend-updated window event (re-dispatched by App.tsx from the WS broadcast) and reload when the database matches.
4. Tests: extend the legend config / CypherResultGraph test setup with fetch mocks for restore, migration, write-through failure, and the broadcast path.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented browser-side graph legend persistence. apiClient gained fetchGraphLegend(database) and saveGraphLegend(database, config|null) in src/web/lib/api.ts (204 -> null, PUT with config:null resetting). CypherResultGraph.tsx restores the server config on mount (server wins when it differs, otherwise migrates a localStorage-only config up once), keeps the useState initializer on loadLegendConfig for the first frame, writes saves through to the server while keeping localStorage as the instant/offline cache, and re-fetches on graph-legend-updated broadcasts whose database matches (other-database broadcasts ignored). App.tsx re-dispatches the WS graph-legend-updated message as a window event for in-document consumers.

The save/restore path was built for the reader's actual usage rather than the happy path: a localActivity counter is carried with every server read and a response that lands after local work moved on (opening the panel, saving, toggling a legend dot) is dropped instead of applied, so a restore in flight can never revert newer edits; a save marks the copy pending in localStorage before its PUT, clears the mark on success and leaves it on failure, and the next mount pushes a pending local copy up instead of letting the older server config win; a failed write-through keeps the panel open with the reason (new i18n key legendSaveFailed in en/zh-CN/zh-TW/ja, rendered by GraphLegendSettings in the footer, role=alert) instead of closing as if it had worked. Saving also pins the automatic type colours into the stored config: pinAutomaticTypeColors(config, theme) writes, for every type without an explicit colour, the fill it is painted with (hueNodeColors(labelHue(label), theme).fill - exactly what the canvas and the colour picker show), so the file records the whole picture the reader sees instead of leaving those colours to be re-derived from the type name on every visit; explicit colours, the rule lightness ramp and the catch-all colour stay derived on purpose (they re-flow as rules come and go), pinning is idempotent, the pinned fill is theme-rendered just like a picked one, and the panel's × still returns a type to automatic. Colour inputs fall back to the effective automatic colour when nothing is stored.

Covered by src/test/api-graph-legend.test.ts (6 unit tests), src/test/web-graph-legend-persistence.test.tsx (7 component tests: restore+cache, one-time migration, same-db broadcast, other-db ignored, edit-while-restore-in-flight survives, pending copy pushed over an older server copy, failed PUT surfaced and recovered on the next mount, save pins the automatic colour) and 5 pinAutomaticTypeColors cases in src/test/graph-legend-config.test.ts. Fixed a latent bug where async throwResponseError was called without return in fetchGraphLegend/saveGraphLegend, swallowing server errors instead of rejecting, and two pre-existing test-infrastructure bugs in src/test/cypher-query-block.test.tsx (an afterEach that leaked a fetch mock across files sharing a process - proved pre-existing via git stash - and a catch-all mock that answered /api/graph/legend with 200 {} where a real server answers 204, silently overriding a stored localStorage config in the BACK-803 test). tsc --noEmit, biome check and the 14-file graph/web sweep (153 tests) are clean; the usage guide documents the save-time pinning and the × way back to automatic.
<!-- SECTION:FINAL_SUMMARY:END -->
