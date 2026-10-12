---
id: BACK-765
title: Knowledge Graph Cypher Search
status: Done
assignee:
  - '@kuwork'
created_date: '2026-10-10 17:56'
updated_date: '2026-10-12 13:33'
labels: []
dependencies: []
modified_files:
  - DEVELOPMENT.md
  - bun.lock
  - package.json
  - scripts/dev-kuzu.cmd
  - scripts/dev-kuzu.ps1
  - scripts/dev-kuzu.sh
  - src/graph/service.ts
  - src/graph/store.ts
  - src/server/index.ts
  - src/test/graph-foundation.test.ts
  - src/test/web-graph-cypher-reveal.test.tsx
  - src/web/components/CypherSearchDialog.tsx
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphView.tsx
  - src/web/lib/api.ts
  - src/web/locales/en.ts
  - src/web/locales/ja.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
ordinal: 327001
actual_start: '2026-10-10 17:58'
actual_end: '2026-10-11 04:35'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Cypher search to the knowledge graph (/knowledge) and task graph (/graph) pages.

- The magnifier entry button sits in the control cluster top-right cell (row 1, column 3 of the 3x3 fit/pan/zoom grid) and opens the Cypher search dialog.
- The dialog shows a schema hint (node tables FileNode/Tag/Meta and rel tables ParentOf/BelongsToMilestone/DependsOn/SourcedFrom/LinksTo/TaggedWith), a Cypher input, and Search/Clear buttons.
- On success: the dialog closes and the canvas filters down to the matched result set - only hit nodes and edges whose both ends hit (induced subgraph); the result set re-clusters (unpinned force-layout re-run) and the viewport auto-fits it; while the filter is active the legend reads as the result set own summary: only node categories and relation types present in the result set appear at all, counts are result-set counts, categories the result set has but the legend had hidden are opened, and legend clicks keep working (hide/restore on top of the result set); an empty result set (e.g. RETURN count(*)) leaves the view untouched; the dialog persists the last successfully executed Cypher statement and refills the input on reopen.
- Clear: empties the input, lifts the canvas filter, and restores the pre-search legend state and viewport (back to the original picture).
- Backend: new POST /api/graph/cypher (the kuzu backend runs native Cypher; the memory backend returns an explicit not-supported message), used by the knowledge/task graph pages only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 放大镜按钮位于左上控制簇右上角
- [x] #2 弹窗展示 Schema 提示与 Cypher 输入框及搜索/清除按钮
- [x] #3 搜索成功关闭弹窗并高亮结果节点集合
- [x] #4 再次打开弹窗回填上次 Cypher 语句
- [x] #5 清除按钮清空输入并恢复画布原状
- [x] #6 后端 POST /api/graph/cypher 正确执行并返回命中节点键
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Backend chain: add CypherQueryResult and runCypher in src/graph/store.ts (read-only execution on kuzu, write-keyword block, 500-row cap, extract FileNode path/id from results as nodeKeys; the memory backend throws an explicit error); pass through in graph/service.ts; add the POST /api/graph/cypher route in src/server/index.ts (200/400/503); add the CypherResult type and runCypher method in src/web/lib/api.ts.
2. Dialog component: new src/web/components/CypherSearchDialog.tsx (schema hint, Cypher input, Search/Clear buttons, localStorage refill of the last statement, Cmd/Ctrl+Enter), calling back with nodeKeys on success and closing.
3. Filtered view: GraphView carries the result set in cypherFilter state (replacing the first-round highlight fade); GraphLegend gains selectFilteredGraph(nodes, edges, keys, hidden?) as the induced-subgraph pure function (optionally overlaying legend hiding) plus stylesMatchedByKeys; layout subset, headline counts and legend counts share the same computation.
4. Result-set presentation: nodes are unpinned and the force layout re-runs while filtered, re-clustering the set; entering the filter saves preFilterTransform/preFilterHidden snapshots and fitForFilterRef fits only once; clearing restores the pre-search viewport and legend.
5. Legend as the result-set summary: while filtered, resultSetStyles/resultSetEdgeTypes decide which legend entries exist at all (hiding a category never removes its entry), counts reflect the result set after legend overlay, and legend clicks stay functional.
6. Entry and copy: the magnifier button moves into the control cluster row 1 column 3, with a SearchIcon component in the same style as FitIcon; the four locales (en/zh-CN/ja/zh-TW) gain the graphView.cypher* strings.
7. Tests and gates: web-graph-cypher-reveal.test.tsx (induced subgraph and both-ends-survival rule, legend show/hide/counts/click overlay, clear restore, relation-legend filtering) plus web-graph-canvas smoke tests; bunx tsc --noEmit, bun run check . and bun test all green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation and rework record (acceptance-driven; the user decided each round):
- First version: highlight hits and fade the rest. Acceptance found that the knowledge graph hides task/completed/draft/milestone by default, so when hits land outside the view the highlighted set is empty and everything fading reads as "search does nothing" (backend extraction and field matching verified 20/20 via the API - no issue there).
- Rework 1 (option A, auto-open hit categories): implemented, but on the real corpus the user found the whole-graph relayout (hundreds of nodes entering the layout) too noisy, and hits still sat at their old full-graph coordinates with an unchanged viewport - not the "filtered" feel.
- Rework 2 (user decision: filter to the result set): induced subgraph (hit nodes plus edges whose both ends hit); nodes unpinned with a force-layout re-run while filtered; auto-fit on entering, restore the pre-search viewport on clear; hiddenStyles snapshot save/restore.
- Rework 3 (refinement): the legend becomes the result-set summary - categories/relations the result set lacks are removed entirely, counts are result-set counts, only categories the result set has but were hidden get opened; legend clicks keep working over the filter (fixed "legend clicks do nothing").
- Key implementation: GraphView.cypherFilter state; GraphLegend.selectFilteredGraph(nodes, edges, keys, hidden?) as the single subset source for layout, headline and legend counts; preFilterTransformRef/preFilterHiddenRef snapshots; empty nodeKeys leaves the view untouched; a new search over an active filter keeps the snapshot and re-fits the new result set.
- The entry button ended up in control-cluster grid row 1 column 3 (top-right inside the cluster), SearchIcon styled like FitIcon.
- Environment constraints: on Windows the kuzu native binding only loads when the process is named node.exe (kuzudb/kuzu#5672; the project is archived and will not be fixed; its successor LadybugDB was tested and does not work either). The dev workflow lives in scripts/dev-kuzu.{sh,ps1,cmd} (a bun copy renamed to node.exe). The packaged build bakes the kuzu native path as a build-machine absolute path, and the process name is wrong on Windows, so packaged Cypher needs a separate effort (native sidecar + renaming the Windows platform package binary - to be tracked in a new task).
- Quality gates: tsc and biome pass; web-graph-cypher-reveal (4 cases) + web-graph-canvas + graph-foundation, 41 cases pass.
- Leftover: the FINAL summary and AC #3 wording still describe the first-round "highlight" semantics; both are rewritten at finalization alongside final acceptance, keeping the AC checked state.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Knowledge graph (/knowledge) and task graph (/graph) share one Cypher search: one entry button and one dialog, and a successful query filters the canvas down to the matched result set.

**Backend chain (kuzu only; the memory backend rejects explicitly)**
- src/graph/store.ts: CypherQueryResult type; KuzuGraphStore.runCypher executes read-only (blocks CREATE/DROP/DELETE/INSERT/MERGE/SET/UPDATE, caps at 500 rows) and extracts FileNode path/id values from results as nodeKeys; MemoryGraphStore.runCypher throws an explicit not-supported error. Helpers: isCypherNode/isCypherRel/isCypherPath/collectCypherNodeKeys/serializeCypherValue.
- src/graph/service.ts: runCypher pass-through.
- src/server/index.ts: POST /api/graph/cypher route with handlePostGraphCypher (200 success, 400 write/block, 503 no service).
- src/web/lib/api.ts: CypherResult type + runCypher method.

**Frontend**
- src/web/components/CypherSearchDialog.tsx (new): schema hint (node tables / rel tables / FileNode.type enum), Cypher input, Search/Clear buttons; localStorage refill of the last statement (key backlog.graph.cypher.lastStatement); Cmd/Ctrl+Enter; on success closes and calls onSearchSuccess(nodeKeys); Clear goes through onClear.
- src/web/components/GraphView.tsx: cypherFilter state carries the result set - the canvas shows the induced subgraph (hit nodes plus edges whose both ends hit), re-clusters it unpinned, and auto-fits the viewport once; entering the filter snapshots the pre-search viewport and legend state (preFilterTransformRef/preFilterHiddenRef), and Clear restores them (back to the original picture). While filtered, the legend is the result-set summary: only categories/relations the result set has appear at all, counts are result-set counts, previously-hidden categories the result set has get opened, and legend clicks keep working on top of the filter. The magnifier entry button sits in the control cluster grid row 1 column 3, with a SearchIcon next to FitIcon.
- src/web/components/GraphLegend.tsx: selectFilteredGraph(nodes, edges, keys, hidden?) - the single induced-subgraph subset source shared by the layout, the headline counts and the legend counts; stylesMatchedByKeys maps a hit set to node styles.
- Four locales (en/zh-CN/ja/zh-TW) gain the graphView.cypher* strings.

**Quality gates**
- bunx tsc --noEmit passes; bun run check . (biome) passes; 41 related test cases pass (web-graph-cypher-reveal covering induced-subgraph rules, legend show/hide/counts/click overlay, clear restore and relation-legend filtering, plus web-graph-canvas and graph-foundation).

**Constraints / leftovers**
- Windows: the kuzu native binding only loads when the process is named node.exe (kuzudb/kuzu#5672, archived upstream); dev uses scripts/dev-kuzu.{sh,ps1,cmd} shims. Packaged builds bake the kuzu native path as a build-machine absolute path, so packaged Cypher needs a separate effort (native sidecar + renaming the Windows platform binary) - tracked as follow-up work.
- The acceptance criteria #3 wording predates the rework ("highlight"); the implemented semantics are filter-to-result-set as approved during acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
