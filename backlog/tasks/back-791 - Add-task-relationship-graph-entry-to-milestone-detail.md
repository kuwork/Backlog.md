---
id: BACK-791
title: Add task relationship graph entry to milestone detail
status: Done
assignee:
  - '@kimi'
created_date: '2026-10-13 09:08'
updated_date: '2026-10-13 13:17'
labels: []
dependencies: []
references:
  - 'src/web/components/MilestoneDetailsModal.tsx:842'
  - src/web/components/TaskDependencyGraph.tsx
  - 'src/web/components/TaskDetailsModal.tsx:240'
ordinal: 350001
actual_start: '2026-10-13 09:36'
actual_end: '2026-10-13 11:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A milestone's detail modal has no entry point into the task relationship (dependency) graph, even though the tasks grouped under that milestone clearly have dependencies worth visualizing. Task detail already provides this via a per-task graph toggle, but the milestone detail does not.

Add an entry similar to the task detail one, placed at the top-right of the progress display on the milestone detail right side. Clicking it should open the relationship graph scoped to the milestone's tasks so a reader can jump straight into its dependency network.

Source: memo backlog/memos/20261013-1.md reports this as a missing navigation affordance; milestones are the natural grouping for a dependency view but currently trap the user in the list.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Milestone detail modal shows a graph entry control at the top-right of the progress section
- [x] #2 Activating it opens the task relationship graph scoped to the milestone's tasks
- [x] #3 The entry mirrors the task detail graph toggle behavior (open/close, viewport and legend persistence per milestone)
- [x] #4 Tests cover the entry presence and that it opens the scoped graph
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementation plan for BACK-791: milestone detail relationship-graph entry

Context: TaskDetailsModal already exposes a per-task relationship graph via a toggle button in the Dependencies section and a HeaderBackButton when open. MilestoneDetailsModal has no such entry. This adds the equivalent, scoped to the milestone tasks.

1. task-subgraph.ts - multi-root scope
- Change buildRelationshipSubgraph(payload, focusId) to accept focusId: string | string[].
- Seed the BFS queue with every focus id; mark each focus node isRoot = true.
- Single-string callers (TaskDetailsModal) keep working unchanged.
- Result: union of every milestone task relationship neighborhood, showing the milestone dependency network at once.

2. TaskDependencyGraph.tsx - milestone scope props
- Add optional props focusIds?: string[] and viewportKey?: string.
- Derive focusList = focusIds ?? (focusId ? [focusId] : []); pass focusList to buildRelationshipSubgraph.
- Use viewportKey (default focusId) for viewports.get/set so per-milestone viewport persistence works; task-detail path unchanged.
- No change to the task-detail call site.

3. MilestoneDetailsModal.tsx - entry control + graph view
- Export HeaderBackButton from TaskDetailsModal; import it plus TaskDependencyGraph, GraphViewports, NodeStyle here.
- Add prop graphVersion?: number (threaded from App.tsx).
- Add state: showGraph (boolean), graphHiddenStylesByMilestone: Map<string, ReadonlySet<NodeStyle>>, milestoneGraphViewportsRef = useRef<GraphViewports>(new Map()).
- Reset showGraph when activeMilestone.id changes.
- Modal: disableEscapeClose = (mode === edit) || showGraph; leftActions shows HeaderBackButton (label t.milestones.dependencyGraphBack) when showGraph.
- Escape handler: when showGraph and Escape, setShowGraph(false) (mirror TaskDetailsModal around line 795).
- Progress section (around line 842): replace SectionHeader with a flex row (title plus graph toggle button top-right). Button reuses the TaskDetailsModal graph icon; hidden when milestoneTasks.length === 0; title/aria = t.milestones.dependencyGraphToggle.
- When showGraph, render TaskDependencyGraph with focusIds = milestone task ids, viewportKey = activeMilestone.id, graphVersion, viewports = milestoneGraphViewportsRef.current, hiddenStyles = graphHiddenStylesByMilestone.get(id), onHiddenStylesChange updates that map, onTaskClick resolves id from tasks and calls onEditTask.

4. App.tsx - thread graphVersion
- Pass graphVersion={graphVersion} to MilestoneDetailsModal (around line 1271).

5. i18n - en.ts, zh-CN.ts, zh-TW.ts, ja.ts
- Add under milestones: dependencyGraphToggle and dependencyGraphBack keys with locale strings (mirror taskDetails.dependencyGraph* wording).
- Reuse taskDetails.dependencyGraphTitle for the graph header.

6. Tests
- task-subgraph.test.ts: add multi-root cases - all focus ids isRoot, union neighborhood returned, missing focus id yields empty.
- (AC 4) Add a render test (src/test/milestone-graph-entry.test.tsx) mounting MilestoneDetailsModal with jsdom plus createRoot; vi.spyOn(apiClient.getGraph) returns a controlled payload; assert the entry button is present in the progress section and clicking it renders the relationship graph. If the harness proves too heavy, fall back to the subgraph unit test plus a manual checklist noted in final summary.

DoD: bunx tsc --noEmit; bun run check .; bun test (scoped to task-subgraph and milestone-graph-entry).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delivered as planned, plus two follow-up fixes surfaced while testing the milestone <-> task round trip.

Core feature (AC #1-#3)
- src/web/utils/task-subgraph.ts: buildRelationshipSubgraph now accepts focusId: string | string[]. Every focus id seeds the BFS at depth 0 / isRoot, so a milestone scope returns the union of all its tasks' neighborhoods. Missing focus ids are ignored; all-missing yields empty. Single-string callers are unchanged.
- src/web/components/TaskDependencyGraph.tsx: new optional props focusIds, viewportKey, drillOnRoot. focusList = focusIds ?? (focusId ? [focusId] : []) drives the subgraph; viewportKeyResolved = viewportKey ?? focusId keys the viewport map, so viewports persist per milestone. Double-click now opens any node when drillOnRoot is set (milestone scopes make every node a root, so the previous isRoot guard blocked every drill).
- src/web/components/MilestoneDetailsModal.tsx: exported HeaderBackButton is imported from TaskDetailsModal. Added graphVersion prop, graphOpenByMilestone / graphHiddenStylesByMilestone maps and milestoneGraphViewportsRef. Progress SectionHeader became a flex row with a graph toggle button at the top-right (hidden when the milestone has no tasks). When showGraph, the modal body renders TaskDependencyGraph scoped to the milestone's task ids, with the per-milestone viewport/legend; Escape and the header back button close it.
- src/web/App.tsx: threads graphVersion into MilestoneDetailsModal.

i18n
- Added milestones.dependencyGraphToggle / dependencyGraphBack to en, zh-CN, zh-TW, ja; the graph header reuses taskDetails.dependencyGraphTitle.

Follow-up fix A - double-clicking a milestone node in the task graph
- The task graph's double-click handler only looked the id up in the task corpus, so a milestone node (id m-N, absent there) did nothing. onTaskClick now also receives the node kind, and a shared pure helper relationshipNodeRoute(id, kind) maps a milestone node to its /milestone/:id route (everything else returns null).
- TaskDetailsModal.handleGraphTaskClick navigates to the milestone route with state.backgroundLocation = the current location, mirroring GraphView.openNode. Closing the milestone then navigate(-1) back to /task/:id instead of dropping the reader onto /milestones.

Follow-up fix B - graph state was lost on return from the milestone
- TaskDetailsModal cleared graphOpenByTask / graphHiddenStyles / graphViewportsRef whenever `!isOpen`. Because a milestone drilled on top flips useMatch("/task/:id") to null, isOpen briefly became false and the clear fired, wiping the "show graph" flag, viewport and filters; returning re-derived showGraph as false, i.e. the relationship graph collapsed back to the detail view.
- The per-task graph state is keyed by task id and now lives for the whole lifetime of the always-mounted modal, so the task returns exactly where it was left. Switching to a different task id reads that task's own (empty) entry, so a fresh task still opens on the detail view.

Follow-up fix C - reset only on a genuine close, not on an occlusion
- Dropping the clear outright (fix B) left the opposite defect: after a real close the state survived, so reopening the same record jumped straight back into the graph. The two situations must be told apart.
- src/web/utils/modal-route.ts: new isModalRoutePath(pathname) returns true for the full-screen detail routes (/task/:id, /draft/:id, /milestone/:id) and false for the list/board routes (/tasks, /milestones, /).
- Both modals now clear their per-record graph state only on a genuine close: `!isOpen && previousIsOpen` AND the landing route is NOT a modal route. Landing on a modal route means the record was only occluded (a task drilled from the milestone graph, or a milestone drilled from the task graph) - the state survives for the return trip; landing on a list/board route means it was really left, so a fresh open starts on the detail view. This is the same rule in TaskDetailsModal and MilestoneDetailsModal, keeping them symmetric.
- An explicit navigation-stack model (an Android-style modal back stack) was considered and deliberately not built: the route-derived rule already distinguishes occlusion from close for both modals, and a stack would be a larger routing change.

Tests (AC #4)
- src/web/utils/task-subgraph.test.ts: multi-root cases (every focus isRoot, union neighborhood, missing focus ids ignored).
- src/test/milestone-graph-entry.test.tsx: renders MilestoneDetailsModal under jsdom + createRoot; asserts the progress-section entry exists and that activating it swaps in the scoped graph (back button, canvas, title).
- src/web/utils/relationship-node-route.test.ts: locks the milestone -> /milestone/:id routing decision and confirms non-milestone nodes return null.
- src/test/task-graph-stack-return.test.tsx: opens the task graph, flips isOpen false then true to emulate the milestone occlusion, and asserts the graph is still open on return.
- src/test/milestone-graph-reset.test.tsx: drives the real navigation - mounts the modal outside Routes (as App does) and derives isOpen from the match, so a close pops back to /milestones and a reopen pushes a new entry. Asserts (1) a real close resets to the detail view on reopen, and (2) an occlusion by a drilled task preserves the expanded graph on return.

Verification: bunx tsc --noEmit clean; bun run check . 0 errors (14 pre-existing noExplicitAny warnings); scoped suites green (21 tests across task-subgraph, milestone-graph-entry, relationship-node-route, task-graph-stack-return, milestone-graph-reset). Both regression guards were checked against a deliberately reverted fix and fail as expected.

Known boundary: the task and milestone modals are mutually exclusive by URL route (only one matches at a time), so the task detail is visually hidden, not stacked as a second layer, while the milestone is open - the same behaviour as the existing milestone -> task direction. Neither instance unmounts, so state is preserved across the round trip; a true always-visible double-layer would be a larger routing change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the task relationship-graph entry to the milestone detail modal and made the milestone <-> task graph round trip lossless.

What shipped
- Milestone detail now shows a graph toggle at the top-right of the progress section; it opens the dependency graph scoped to the milestone's own tasks (multi-root subgraph), with per-milestone viewport and legend persistence, mirroring the task detail toggle.
- Double-clicking a milestone node inside the task relationship graph now opens that milestone (routed with backgroundLocation), and closing it returns to the task with its graph still expanded.
- The milestone <-> task graph round trip is lossless in both directions: an occlusion (a task drilled on top of the milestone graph, or a milestone drilled on top of the task graph) preserves the expanded graph and viewport, while a genuine close resets the record to the detail view so reopening does not jump back into the graph. Implemented via isModalRoutePath in both modals, symmetric and covered by regression tests.

Files: src/web/utils/task-subgraph.ts, src/web/utils/modal-route.ts, src/web/components/TaskDependencyGraph.tsx, src/web/components/TaskDetailsModal.tsx, src/web/components/MilestoneDetailsModal.tsx, src/web/App.tsx, src/web/locales/{en,zh-CN,zh-TW,ja}.ts, plus tests src/web/utils/task-subgraph.test.ts, src/web/utils/relationship-node-route.test.ts, src/test/milestone-graph-entry.test.tsx, src/test/task-graph-stack-return.test.tsx, src/test/milestone-graph-reset.test.tsx.

DoD: bunx tsc --noEmit passes; bun run check . passes (0 errors); scoped bun test suites pass (21 tests across the five touched test files).
<!-- SECTION:FINAL_SUMMARY:END -->
