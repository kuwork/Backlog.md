---
id: BACK-794
title: Configurable legend for the Cypher result graph
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 17:32'
updated_date: '2026-10-14 07:52'
labels:
  - web-ui
  - graph
milestone: m-13
dependencies:
  - BACK-793
modified_files:
  - src/web/utils/graph-expression.ts
  - src/web/utils/graph-legend-config.ts
  - src/web/utils/cypher-graph.ts
  - src/web/utils/graph-palette.ts
  - src/web/utils/graph-canvas.ts
  - src/web/components/GraphLegend.tsx
  - src/web/components/GraphLegendSettings.tsx
  - src/web/components/CypherResultGraph.tsx
  - src/web/components/GraphCanvas.tsx
  - src/web/components/GraphView.tsx
  - src/web/components/GraphDatabases.tsx
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/test/graph-expression.test.ts
  - src/test/graph-legend-config.test.ts
  - src/test/web-graph-palette.test.ts
ordinal: 353001
actual_start: '2026-10-13 17:58'
actual_end: '2026-10-14 07:52'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The result graph on the databases page (BACK-793) paints every node from its label and every relationship as one solid arrowed line. A result whose interesting axis is a property - a status, a priority, a score - has no way to say so, and the reader cannot choose what a circle is called.

This task adds a legend settings panel to that pane. Colour is a function of two independent dimensions the engine combines: the node's *type* (its table label) owns the hue, so every Person reads as one colour family; within a type, a *field subclass* owns the lightness, decided by a quick method (equal-width bins, quantiles, a single threshold, by value, contains, prefix, or boolean) or by the reader's own ordered rules plus an implicit Other catch-all. The quick method *generates* an editable rule list in one click; the reader then edits those boolean expressions by hand, inserting other fields through a dropdown. Captions are written from a `{{field}}`-template, relationships are styled per type (line style × arrowhead), every bucket is a toggle that keeps its legend entry so it can be shown again, and the configuration is stored per database in localStorage and restored on the next visit. Internal bookkeeping nodes (the store's own Meta table) start hidden so the count reflects the reader's data, and can be switched back on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A legend settings control sits on the result graph's title bar beside the fullscreen toggle and opens a panel that configures that pane alone.
- [x] #2 Node captions are written as a template - literal text with `{{field}}` placeholders - rather than picked from a flat list. The result's own property names are offered as chips that insert a `{{field}}` placeholder at the caret, and the caption can be switched off entirely for a cleaner picture.
- [x] #3 Node colouring is two-layer. Layer 1 is the node type (table label), which owns the hue - every Person is one hue, every Project another, so the type is read from the colour family. Layer 2 is a field subclass chosen by a quick method - equal-width bins, quantiles, a single threshold (numeric), by value, contains or prefix (string), or boolean - or by the reader's own ordered rules, first match winning, with an implicit "Other" catch-all for whatever no rule matched. Within a type the subclasses differ by lightness, not hue, so the two dimensions never fight over the same axis. The type is never written into an expression; the engine applies it on top. A node with no field configured takes the type hue at the catch-all lightness. The quick method generates an editable rule list; rules are boolean expressions edited by hand, and a field is inserted through a caret-inserting dropdown (the sole field picker).
- [x] #4 A rule's condition is a small boolean expression: comparisons (`==`, `!=`, `>`, `>=`, `<`, `<=`) plus `contains` and `startsWith`, combined with `&&`, `||` and `!`, grouped with parentheses, over the node's own properties. The editor offers the same field chips plus operator buttons, so a rule can be written without memorising the syntax.
- [x] #5 Both editors teach by example. The caption editor offers ready-made templates built from the result's own fields - `{{name}}`, `{{title}} · {{status}}`, `{{key}} — {{filePath}}` - and the rule editor offers ready-made conditions in the same voice: `status == "open"`, `priority >= 3 && status != "done"`, `tag contains "auth"`, `!(type == "internal")`. Each example is a chip that fills the field when clicked, and both lists skip any example whose fields the current result does not carry, so nothing offered is a dead end.
- [x] #6 The rule list always ends in a catch-all bucket - "Other" - collecting every node no rule matched, so a reader never has to enumerate the cases. It is configured like any rule - its own colour, its own count, its own visibility - except that it cannot be removed or reordered.
- [x] #7 Relationship styling is per relation type, combining a line style - solid, dashed, dotted, long-dashed - with an arrowhead choice of none, at the target, or at both ends, each previewed as a sample of the line itself.
- [x] #8 The legend keeps working as a filter: every colour bucket is a toggle that hides its members, hidden entries stay in the legend so they can be shown again, and the headline counts what is actually drawn.
- [x] #9 Configuration persists per database under a namespaced localStorage key and is restored on the next visit. A missing, partial, or unparseable entry falls back to the defaults instead of throwing.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
**Revised during review:** the colouring described below (steps 3 and 5: five modes - corpus / label / values / bands / rules) was replaced by a two-layer model after reviewer feedback - Layer 1 type (hue), Layer 2 field subclass (lightness via quick methods or rules) - because different node types carry different fields and a single flat mode per database could not express "hue by type, shade by field". See the Final Summary for the shipped design; this plan otherwise stands as the original intent.

The pane already owns everything it needs to draw; what is missing is a description of *how* to draw it that a reader can edit, somewhere to keep it, and a way to build the node and edge lists from it. The work splits along that seam: carry the properties through extraction, describe the look as data, resolve that description into the per-element visual vocabulary the engine already consumes, and let a panel edit it.

1. `src/web/utils/graph-expression.ts` (new) - the expression engine both editors share: a tokenizer and a recursive-descent parser over one grammar - `||` loosest, then `&&`, then `!`, then comparisons (`==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `startsWith`) over string / number / boolean literals, parenthesised groups and bare property names. Only a comparison yields a boolean, so a mistyped condition is a parse error the editor can surface rather than a silently truthy value. `evaluate(properties)` returns the boolean; a property the node does not carry reads as null and simply fails to match. Unit tests covering precedence, grouping, literals, missing properties and malformed input.
2. `src/web/utils/cypher-graph.ts` - carry each node's properties, internal handles removed, onto `ResultGraphNode`, and publish `ResultGraph.fields`: the union of the property names the result actually carries, sorted, so the panel offers only fields that exist. Unit tests.
3. `src/web/utils/graph-palette.ts` - keep `labelNodeColors` for the label mode; add the corpus assigner, which classifies a node the way the corpus graph does - from its `kind`, with `filePath` under `completed/` completing it - and reads its colours from the same table, so the two pages cannot drift apart; add a categorical assigner that spreads a field's distinct values over a fixed colour card by rank rather than by hash (a plain `* 31` hash put Person, Item and Product on one hue - measured), so colours are evenly spread and stay put across re-runs; and a range assigner that bands a numeric field and paints the bands as a gradient. The band count is the reader's to set, four by default, and the edges carry a decimal setting of their own - integers by default, decimals when the field wants them - and the bands are cut to equal width between the field's lowest and highest value in the result, each labelled with its own interval (e.g. "7 – 11") rather than an index. Unit tests.
4. `src/web/utils/graph-legend-config.ts` (new) - the configuration type and localStorage read and write keyed per database. The defaults are per database: `default` starts on the corpus mode with the corpus caption, every other database starts on labels and the guessed caption. Reading validates: a missing, partial or unparseable entry yields the defaults with the valid parts kept, so a schema change or a hand-edited entry degrades instead of throwing. Unit tests.
5. `src/web/components/GraphLegendSettings.tsx` (new) - the panel, in three sections. The caption: a template input plus the schema's field chips, each inserting a `{{field}}` placeholder at the caret, and a switch to hide captions outright. The node colours: the mode - corpus offered for the `default` database, where it is the starting point, the other four always - then the field, then the band count and the decimal setting the mode asks for, and the card as it stands - one row per bucket with its swatch, name and count, the catch-all pinned last so an incomplete rule set can never leave a node unaccounted for. The rule rows are ordered, with a chip for each field and a button for each operator beside the expression, so a condition can be assembled without remembering the grammar. The relationships: one row per type with a line style, an arrowhead choice, and a sample of the line itself. A footer resets to the defaults and closes.
6. `src/web/components/CypherResultGraph.tsx` - take the database name, keep the configuration in state, write it through to storage as it changes, and resolve it into the `visual` prop: captions from the template, node colours from the active mode, edge styles per type. The empty state and the internal-label default stay as they are.
7. `src/web/components/GraphDatabases.tsx` - pass the selected database down.
8. Locale keys in all four web locales; unit and smoke tests for the panel and the resolution; `bunx tsc --noEmit`, `bun run check .`, `bun test`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Full-suite attribution (2026-10-14): bun test over the whole repo shows ~154-161 failures / 23-28 errors, all in areas this task never touched - server-* endpoint tests (beforeEach hook timeouts under parallel load), memos endpoints, web-task-details-modal tests (useTaskHierarchyCorpus mock pollution across files), milestones TUI, auto-commit, and the atomic-task-edit parallel-CLI lock test (60s timeout exceeded on this machine). Verified unrelated: (1) none of the failing test files import any module this task changed (graph-legend-config, graph-palette, GraphLegendSettings, CypherResultGraph, GraphCanvas, GraphLegend, locales); (2) representative failing files pass in isolation - server-search-endpoint 21/21, server-memos-endpoint 17/17, web-task-details-modal-final-summary 17/17 (the last one exercises I18nProvider, i.e. the edited locale files); (3) remaining errors are environmental: duckdb node-bindings-linux-x64-musl resolution and git uv_spawn ENOENT inside tmp test dirs. The atomic-task-edit parallel-process test fails standalone too (69.8s vs 60s timeout), i.e. a slow-machine flake that predates this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rewrote the configurable legend for the Cypher result graph (BACK-793) around a two-layer colour model after reviewer feedback replaced the original five-mode design (corpus / label / values / bands / rules). Layer 1 colours by node type (hue derived from the label); Layer 2 classifies a field into subclasses by a quick method - equal-width bins, quantiles, a single threshold (numeric), by value, contains or prefix (string), or boolean - or by the reader's own ordered rules, first match winning, with an implicit "Other" catch-all. Within a type the subclasses differ by lightness, not hue, so the two dimensions never fight over the same axis; the type is never written into an expression, the engine applies it on top. The quick method generates an editable rule list; rules are boolean expressions edited by hand, and a field is inserted through a caret-inserting dropdown (the sole field picker). Captions remain a `{{field}}`-template; relationships are styled per type (line style × arrowhead) with a live sample; every bucket is a toggle that keeps its legend entry so it can be shown again. Configuration persists per database in localStorage and normalizes tolerantly.

Files: src/web/utils/graph-legend-config.ts (config type, two-layer resolveLegend, caption rendering, tolerant normalization, persistence, rule generation), src/web/utils/graph-palette.ts (added subclassColors: hue + lightness), src/web/components/GraphLegendSettings.tsx (two-section panel - type read-only hue swatches; field → method → bands/threshold/decimals → Generate → editable rules - with the FieldInsert dropdown and operator chips), src/web/components/CypherResultGraph.tsx (renders the resolved visual; keeps the store's own internal Meta nodes hidden by default), src/web/components/GraphDatabases.tsx (passes the database), plus all four locales (legend* keys) and the shared expression engine src/web/utils/graph-expression.ts. Fixed a default-hide regression in CypherResultGraph.tsx: internal-bucket keys were joined and split on `|`, colliding with the `|` inside each key (`t:Meta|s:type:only`), so Meta was never actually hidden; the keys are now kept as an array and default-hide is re-triggered only on a new result (cameraToken) rather than on every config edit, so un-hiding an internal node sticks. 51 related tests pass (including the Meta default-hide integration test); bunx tsc --noEmit and bun run check are clean.

Per-type refactor (second pass): the legend configuration moved from one global field + one rule list for the whole result to per-node-type configuration. GraphLegendConfig is now { captionsVisible, types: Record<label, TypeConfig>, relations, hidden }; each TypeConfig carries its own caption template (empty = auto-guessed from name/title/key/label/id, falling back to the node title), an optional explicit type colour (hex) that overrides the automatic hue, its own ordered rule list, and an optional explicit colour for the "Other" catch-all. Every rule row and every relationship row can pin its own colour. resolveLegend(nodes, config, theme) no longer takes a fields argument; fields are grouped per type via fieldsByType. The settings panel became an accordion - one card per node type sorted by node count, the first expanded - with a colour dot + reset in the header, a caption template area whose placeholder shows the auto-guessed field, rule rows whose colour input shows the resolved effective colour, a pinned "Other" row (colour only; its name stays localized), and a quick-add section whose parameters (method, bins, threshold, decimals, match mode, value selection) are panel-local state that appends generated rules without entering the stored config. Backward compatibility: a stored config without the types key normalizes back to the defaults as a whole (per-database localStorage). Palette colours are now emitted as hex so <input type="color"> can display the resolved effective colour; explicitNodeColors pairs an explicit hex fill with a theme-aware border. Fixed along the way: relation dash style names ("solid" etc.) were being passed to canvas/SVG as dash patterns - they now go through the LINE_DASH lookup in both GraphCanvas and the header legend; compileRule now wraps compileExpression in try/catch so a malformed stored expression degrades instead of throwing through the panel. Tests: src/test/graph-legend-config.test.ts rewritten (57 assertions covering normalization fallback, per-type rules, explicit colours, auto captions, fieldsByType, subset binning, storage round-trip, palette additions); src/test/web-graph-palette.test.ts updated for hex output. bunx tsc --noEmit and bun run check . clean; 57 targeted + 472 web-graph tests pass.

Follow-up review round (UX rework after hands-on feedback):
- Internal Meta nodes no longer appear anywhere in the legend UI while the result carries real data: the legend dots, the settings panel's type cards and bucket list all read panelNodes (external nodes only). A Meta-only query still shows them.
- Legend bucket labels are theme-aware (text-gray-700 dark:text-gray-200 on LegendDot) - they rendered black on the dark canvas before.
- Caption editor per type: the two hint lines merged into one, the 'Fields' label dropped, and the insert-field dropdown moved to the right end of the caption section title (Section gained an aside slot).
- Arrow modes extended to four: none / end / start / both, painted through the batched edge painter (startArrowSize) and both line previews (LineSample, LegendRelation).
- Relation types gained a display name (RelationStyle.name; legend entries and deep-zoom edge labels prefer it) and unconfigured types now cycle line styles over the sorted type list (solid -> dashed -> dotted -> long) via relationStyle(type, config, order); editing one knob merges onto the effective style so the cycled defaults of the rest survive.
- Quick-add gained a colour mode: the existing type-hue lightness ramp, or a colour segment gradient (two endpoint colours, sRGB interpolation) with optional photographic negative (invert) and 50/50 overlay on the type's base colour, baked into the generated rules as explicit hex colours (gradientColors in graph-palette.ts). A live preview shows the colours before committing: per-value dots in the string picker, a swatch strip for numeric bands and booleans; the lightness preview accounts for the rules already present.
- The settings panel is now a draft: edits preview live but persist only on 保存; 取消 / the X icon (the old text Close) / re-clicking the gear restore the snapshot taken on open. Reset is a draft too.
- Fullscreen switched from the Fullscreen API to CSS maximise (fixed inset-0) because the browser reserves Esc under native fullscreen: a short Esc now releases the pinned focus, a 600 ms hold exits the maximised pane. fitToView/flyTo read the viewport size live (cssWidth/cssHeight kept by the ResizeObserver) instead of a build-time constant, so the overview centres correctly after fullscreen or window resizes.
Verification: bunx tsc --noEmit, bun run check . and the scoped suites (graph-legend-config, graph-expression, web-cypher-result-graph, web-graph-palette) pass; the only full-suite failures reproduce on the clean tree (install/packaging, environment).
<!-- SECTION:FINAL_SUMMARY:END -->
