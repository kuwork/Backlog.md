---
id: BACK-715
title: Add a state machine editor to the settings page
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-28 07:59'
updated_date: '2026-09-29 07:11'
labels:
  - feature
  - ui
dependencies: []
references:
  - >-
    backlog/docs/PRDS/state-machine/doc-19 -
    PRD：默认状态机（7-列-·-三审查点落位-·-可重置-·-指引优先）.md
modified_files:
  - src/core/state-machine.ts
  - src/types/index.ts
  - src/file-system/operations.ts
  - src/server/index.ts
  - src/utils/terminal-status.ts
  - src/utils/dependency-query.ts
  - src/web/lib/api.ts
  - src/web/components/Settings.tsx
  - src/web/components/StateMachineEditor.tsx
  - src/web/components/Board.tsx
  - src/web/components/BoardPage.tsx
  - src/web/components/TabButton.tsx
  - src/web/components/StatusExcludeDropdown.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/TaskList.tsx
  - src/web/App.tsx
  - src/web/utils/state-machine-tree.ts
  - src/web/locales/en.ts
  - src/web/locales/zh-CN.ts
  - src/web/locales/zh-TW.ts
  - src/web/locales/ja.ts
  - src/cli.ts
  - src/core/backlog.ts
  - src/core/init.ts
  - src/commands/help-schema.ts
  - src/ui/board.ts
  - src/ui/unified-view.ts
  - src/ui/simple-unified-view.ts
  - src/ui/enhanced-views.ts
  - src/ui/milestones.ts
  - src/ui/task-viewer-with-search.ts
  - src/mcp/tools/tasks/handlers.ts
  - src/test/state-machine.test.ts
  - src/test/config-statuses.test.ts
  - src/test/web-state-machine-editor.test.tsx
  - src/test/server-statuses-endpoint.test.ts
  - src/test/web-board-drag-hidden-columns.test.tsx
  - src/test/board-hide-empty-columns.test.ts
  - src/test/enhanced-init.test.ts
  - src/test/core.test.ts
  - src/test/cli.test.ts
  - src/test/dependency-closure.test.ts
priority: high
ordinal: 285400
actual_start: '2026-09-29 00:11'
actual_end: '2026-09-29 06:58'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per the doc-19 PRD, add a "state machine" editor panel to the settings page so the object form of `statuses` can be maintained visually in the UI (today it can only be hand-edited in config.yml; see FR-7).

Layout:
- Left pane: status settings. A list of status cards; each card edits name / category / exit, and each status can add, remove and edit its `next` transitions (to / when / ai / if / requires / evidence).
- Right pane: a Mermaid tree rooted at initialStatus and expanded recursively along `next`, refreshed live as the left pane changes; back edges (e.g. Plan Review → Planning) must not expand forever.

Dirty state and two recovery buttons (strictly distinct semantics):
- Reset (Reload from config): appears after any left-pane change (adding or removing a status, renaming, changing a category, editing transitions). Clicking it discards every unsaved change and reloads the currently saved content from config.yml — it never overwrites anything.
- Default (Set to agreed default): replaces the whole machine with doc-19's built-in seven-column default (FR-5: writes the object-form seven columns), overwriting the current config. i.e. "restore the agreed factory value".

Constraints:
- Saves write the object form back without dropping any field (FR-7 R4: ai / if / requires / evidence / exit all preserved).
- A legacy plain-string-array project can still open the editor (read-only, or with a prompt to convert to the object form) without erroring.
- The editor implements no transition enforcement (M1 declares, never enforces — consistent with doc-19 AC-18); it may surface FR-6 lint warnings but never blocks a save.

Related: doc-19 FR-1 (compiler / object form), FR-5 (reset / default), FR-6 (lint), FR-7 R4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The settings page shows a state machine editor with a left/right layout (status settings on the left, Mermaid tree preview on the right), with Mermaid rendered live.
- [x] #2 The left pane can add, remove and edit statuses (name/category/exit) and transitions (to/when/ai/if/requires/evidence).
- [x] #3 The right-pane tree refreshes live as the left pane changes; back edges and cycles never expand forever or crash.
- [x] #4 After any left-pane change a "Reset" button appears; clicking it discards the changes and reloads the currently saved content from config.yml.
- [x] #5 Saves write the object form of statuses back without dropping any field (including ai/if/requires/evidence/exit).
- [x] #6 The "Reset" (reload from config) and "Default" (set to agreed seven-column default) buttons are clearly distinguished and never confused.
- [x] #7 A legacy plain-string-array project opens the editor normally (read-only, or with a convert prompt) without erroring.
- [x] #8 The editor implements no transition enforcement, consistent with doc-19 AC-18 (it only declares, never enforces).
- [x] #9 The settings page provides a "terminal statuses" multi-select (checking a status sets category: done + exit: complete, unchecking falls back to active), saved together with the machine.
- [x] #10 "Status settings" and "Transition tree preview" become switchable tabs, fixing the too-narrow side-by-side layout.
- [x] #11 The machine supports a "display" field (shown by default); the preset machine hides Dropped by default; the web board hides that column when display: false (still hidden when a drag reveals empty columns).
- [x] #12 backlog init writes the seven-column preset on first initialization (including Dropped display: false); a re-init keeps the existing statuses and is not pushed back to three columns.
- [x] #13 The CLI/TUI board honours display: false: renderBoardTui's hiddenStatuses hides the matching column, which never appears even when a drag reveals empty columns.
- [x] #14 With object-form statuses, terminal detection and the --help status rendering are correct: the CLI/MCP judge terminal by category (a Done task can be completed) and --help prints bare status names rather than name: "...".
- [x] #15 With object-form statuses, the dependency closure and readiness also judge terminal by category: the server dependency query, the TUI task viewer and the web (Board/TaskList/TaskDetailsModal) all pass the raw config instead of statusNames.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
This task lands per the doc-19 PRD plus four follow-up asks (terminal-status multi-select, tabbed layout, display field, init defaults and CLI/TUI alignment), in five blocks:

### 1. Core compiler and types (FR-1 / FR-7)
- New src/core/state-machine.ts: the object form of StatusesConfig / StatusDefinition, the DEFAULT_STATE_MACHINE seven-column default (doc-19 §4.1), compileStateMachine() (names / categoryOf / transitionsOf / initialStatus / terminalStatuses / exitChannel / validate — M1 declares, it never enforces), statusNames() (the name-only shim), validateStatusesShape() (rejects only what cannot be written back), hiddenStatusNames() (the display:false columns).
- src/types/index.ts: BacklogConfig.statuses becomes StatusesConfig; StatusDefinition gains category / exit / next / display.

### 2. Config IO and endpoints (FR-5 / FR-7 / validation)
- src/file-system/operations.ts: parseStatusesConfig / serializeStatusesConfig round-trip the object form (fixing the old serializeConfig bug that String()'d objects into [object Object]); parse and serialize the display field.
- src/server/index.ts: /api/statuses goes through statusNames(); new PUT/POST /api/config/statuses plus validateStatusesShape() in handleUpdateConfig; broadcast config-updated after a save (fixing the earlier tasks-updated broadcast that left the board stale).

### 3. Web UI (editor / terminal statuses / tabs / display)
- src/web/components/StateMachineEditor.tsx: left cards (name / category / exit / next — six fields, add-remove-edit, renames fix references automatically) plus the right Mermaid tree (back and cycle edges degrade to dashed back-references); Reset = reload config, Default = write the seven-column default after a second confirmation.
- Settings.tsx: wire up the editor plus the terminal-status multi-select (check sets category:done + exit:complete, uncheck falls back to active); reuse StatusExcludeDropdown as the terminal-status picker.
- Tabs: new TabButton.tsx; StateMachineEditor and TaskDetailsModal become switchable tabs (fixing the cramped side-by-side layout).
- display field: StatusDefinition.display?: boolean (shown by default), Dropped preset to display:false; Board / BoardPage / App take hiddenStatuses so a hidden column never appears, even while a drag reveals empty columns; the editor adds a "show on board" checkbox per card.
- Four locales (en / zh-CN / zh-TW / ja) gain the stateMachine.* and display strings.

### 4. Tests and quality gates
- New / extended: state-machine.test.ts (hiddenStatusNames / the preset hides only Dropped), config-statuses.test.ts (display round-trip), web-state-machine-editor.test.tsx (checkbox / tabs), server-statuses-endpoint.test.ts (config-updated broadcast regression), web-board-drag-hidden-columns.test.tsx (hiddenStatuses filtering).
- Full tsc --noEmit / biome check / bun test pass.

### 5. Defaults and downstream alignment (init seven columns / TUI display / terminal detection)
- src/core/init.ts: a first init writes the seven-column preset directly (structuredClone(DEFAULT_STATE_MACHINE), Dropped display:false); a re-init keeps existingConfig.statuses, so only the first init is seven columns.
- The TUI board honours display: renderBoardTui gains a hiddenStatuses option. Because src/board.ts's buildKanbanStatusGroups re-adds any status a task carries but the list lacks, it filters both the columns (a shared buildColumns wrapping every internal prepareBoardColumns call) and the tasks (dropHiddenTasks at the data entry points, including the update's nextTasks and nextStatuses); the piped generators do the same. Wired through unified-view / simple-unified-view / enhanced-views / milestones (MilestonesTuiOptions.hiddenStatuses) / the cli milestones plain path.
- Terminal detection aligned with the object form: getTerminalStatus prefers the exit:complete terminal; the CLI (archive/complete/cleanup) and the MCP handlers (archive/complete, adding getStatusesConfig()) pass the raw config.statuses instead of statusNames (which drops category and makes Done non-terminal under seven columns).
- The dependency closure and readiness judge by category too: the server buildDependencyQuery passes the raw config (DependencyQueryInput.statuses widened), the TUI task viewer passes statusesConfig, and the web Board / BoardPage / TaskList / TaskDetailsModal take an optional statusesConfig prop forwarded by App, falling back to `statusesConfig ?? <name list>`.
- help schema: src/commands/help-schema.ts's synchronous parser understands the object form (reading only the top-level `- name:` item per indentation depth), so --help no longer prints garbage.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Key decisions and pitfalls
- Terminal statuses are multi-valued: getTerminalStatuses() (src/utils/terminal-status.ts) uses the declared category and falls back to the last entry. The settings-page multi-select edits category/exit directly and stores no extra field.
- Broadcast bug root cause: handleUpdateConfig / handleUpdateStatuses called broadcastDataUpdated(), which only pushes tasks/milestones events; the client reloads config and statuses only on config-updated, so the board columns and terminal statuses stayed stale. Fixed by broadcasting config-updated (with a regression test).
- Three columns is not a bug: config.yml has hide_empty_columns: true, so empty columns are hidden; this repo's tasks live only in To Do / In Progress / Done, hence three columns. Expected behaviour, not a persistence failure.
- display semantics: undefined / true = shown, only false hides; the serializer emits display: false only when the value is false, keeping the config clean. Web board order: Board.visibleStatuses drops hiddenStatuses unconditionally before the empty-column filter / drag reveal.
- TS pitfall: a local function in state-machine-tree.ts was named declare(...), which TypeScript treats as an ambient declaration and erases entirely, so the tree root never rendered; renamed.
- Test pitfall: after swapping window under JSDOM, React's delegated events are unreliable, so controlled-component tests call onChange/onClick directly through __reactProps$ .
- statusNames() shim: every name-only reader must go through it, or the object form prints [object Object]; the cli / core/backlog / mcp / completions / ui readers were all moved onto it.

### Round 2: init seven columns + TUI display + downstream compatibility
- init default: src/core/init.ts sets baseConfig.statuses = structuredClone(DEFAULT_STATE_MACHINE). A first init produces the seven-column object form (Dropped display:false); a re-init goes through {...baseConfig, ...(existingConfig??{})} and keeps the existing statuses, so only the first init is seven columns.
- The TUI board honours display: renderBoardTui gains options.hiddenStatuses. Filtering the statuses list alone is not enough — src/board.ts's buildKanbanStatusGroups re-adds any status a task carries but the list lacks, so a shared buildColumns (dropHiddenColumns(prepareBoardColumns(...)), covering every internal call) filters the columns, and dropHiddenTasks at the data entry points filters hidden-status tasks (including the update's nextTasks and the host's nextStatuses). The piped path (generateKanbanBoardWithMetadata / generateMilestoneGroupedBoard rebuild columns from tasks) filters the tasks the same way.
- Terminal-detection downgrade bug (a pre-existing defect the init change amplified): getTerminalStatus / isTerminalStatus can judge by category, but the CLI/MCP passed statusNames(config.statuses) (dropping category) and fell back to the last entry; with seven columns the last is Dropped, so task complete refused a Done task and dependencies read Done as unfinished. Fix: getTerminalStatus now prefers the exit:complete terminal (Done); the CLI (archive/complete/cleanup) and the MCP handlers (a new getStatusesConfig() returning the raw config) pass the raw config.
- help garbage: src/commands/help-schema.ts's synchronous YAML parser only understood a string list, so the object form parsed as `name: "To Do`, making --help print `status: one of configured statuses: name: "To Do`. Fix: take only the top-level `- name:` item per indentation depth, skip the deeper next sub-items, and stop at a flush-left `key:`. Added a test that the object form renders as bare names in help.
- Test results: cli.test.ts 93 pass / 0 fail; core.test.ts 43; enhanced-init 33; board-hide-empty-columns 17 (a new TTY case including no-reveal-on-drag plus a piped hidden-column case); board-tui-move / board-popup-sync / milestones-tui 54; terminal-status / state-machine / mcp-task-complete 24; readiness / dependency-closure / mcp-tasks / board.test 78. tsc --noEmit and biome check pass.
- Test pitfall: createUniqueTestDir builds inside the repo's tmp/, so the "default three statuses" help-schema tests walked up via findBacklogConfigPathSync into the repo's own config (object-form seven statuses); for determinism those tests now write their own backlog/config.yml (added to two help-schema tests).
- Flaky: "renders help and instruction examples from BACKLOG_CWD" once timed out at 10s in a full run but passes in 3.1s alone — heavy-load flakiness, not a regression.

### Round 3: every downstream terminal check now judges by category (dependency closure / TUI and web readiness)
- Server dependency closure: src/server/index.ts buildDependencyQuery passed statusNames(...); it now passes the raw config.statuses. DependencyQueryInput.statuses and the private field widened from readonly string[] to readonly (string | StatusDefinition)[] (only ever fed to isTerminalStatus).
- TUI task viewer readiness: src/ui/task-viewer-with-search.ts keeps a statusesConfig (the raw config) and passes it to createReadinessGraph (statuses stays the display name list).
- Web: Board / BoardPage / TaskList / TaskDetailsModal each take an optional statusesConfig prop, forwarded by App from config?.statuses (BoardPage passes it on to Board); consumers use `statusesConfig ?? <name list>`, so they fall back to the old behaviour without a config. Fixed sites: Board's cleanup-column check (getTerminalStatus), TaskList's terminal-status filter (isTerminalStatus), and TaskDetailsModal's readiness graph.
- Regression test: dependency-closure.test.ts gains "a Done dependency is terminal under the object form even with Dropped last" and "a name-only list still follows the legacy fallback"; 16 pass.
- Related suites: server-dependencies-endpoint / dependency-closure / readiness 39 pass; web-task-details-modal-dependency-closure / web-completed-task-modal / web-task-deep-link / web-board-* / web-dependency-input-completed 68 pass; task-viewer-boundary-navigation / task-viewer-milestone-filter-model 16 pass; cli-dependency / dependency 50 pass. tsc / biome pass (note: biome's files.includes only lists src/**/*.ts, so .tsx is never checked).
- The one remaining fallback: src/graph/validation.ts computeRecordReadiness has no config parameter and still uses DEFAULT_STATUSES (whose last entry is Done, so the impact is limited).
<!-- SECTION:NOTES:END -->
