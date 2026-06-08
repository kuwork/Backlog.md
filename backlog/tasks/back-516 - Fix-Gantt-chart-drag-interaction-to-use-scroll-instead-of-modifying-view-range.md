---
id: BACK-516
title: Fix Gantt chart drag interaction to use scroll instead of modifying view range
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-08 14:20'
updated_date: '2026-06-08 15:16'
labels:
  - web-ui
  - gantt
  - bug
milestone: m-7
dependencies:
  - BACK-495
modified_files:
  - src/web/components/GanttView.tsx
priority: high
ordinal: 173400
actual_start: '2026-06-08 14:30'
actual_end: '2026-06-08 15:16'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When holding and dragging the Gantt chart timeline area, the date scale on the right side expands or shrinks unexpectedly instead of staying fixed. This causes tasks whose end dates exceed the current rightmost date to get squeezed against the right edge, and the red "today" marker line is also pushed to the right edge when the timeline range shrinks below today's date.

Expected behavior: dragging should behave like dragging a scrollbar thumb — only the visible viewport scrolls, the total timeline range (date scale) remains fixed. Both horizontal and vertical dragging should be supported simultaneously.

Root cause: `handleMouseMove` in `GanttView.tsx` modifies `viewStart`/`viewEnd` state directly on every drag frame, which recalculates the entire `columns` array, changes `timelineWidth`, and conflicts with the container's native `overflow-auto` scroll mechanism.

Fix: replace the view-range mutation with direct `scrollLeft`/`scrollTop` manipulation on the timeline container. Remove `viewStartAtDrag` ref, add `dragStartY` and `scrollTopAtDrag` refs, and set `container.scrollLeft` / `container.scrollTop` in `handleMouseMove` instead of calling `setViewStart`/`setViewEnd`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Dragging horizontally pans the timeline viewport without changing the date scale range
- [x] #2 Dragging vertically pans the timeline viewport and syncs with the left task list
- [x] #3 Tasks and the today line no longer get squeezed to the right edge during drag
- [x] #4 Dragging feels like moving a scrollbar thumb, not resizing the timeline
<!-- AC:END -->









## Implementation Plan
<!-- SECTION:PLAN:BEGIN -->
1. In `handleMouseDown`, record initial scroll position: `scrollLeftAtDrag` and `scrollTopAtDrag` from `timelineContainerRef.current`
2. In `handleMouseMove`, compute `deltaX` and `deltaY`, then set `container.scrollLeft = scrollLeftAtDrag - deltaX` and `container.scrollTop = scrollTopAtDrag - deltaY`
3. Remove `viewStartAtDrag` ref and the `setViewStart`/`setViewEnd` calls from drag handlers
4. Verify vertical scroll sync via existing `useEffect` that binds `leftScrollRef` and `timelineContainerRef` scroll events
<!-- SECTION:PLAN:END -->

## Implementation Notes
<!-- SECTION:NOTES:BEGIN -->
The timeline container already has `overflow-auto`, so native scroll works. The previous approach of mutating `viewStart`/`viewEnd` during drag was essentially reimplementing scroll by mutating the data model, which caused cascading re-renders of columns, task positions, and the today line calculation.

By switching to `scrollLeft`/`scrollTop`, the `viewStart`/`viewEnd` state remains fixed (only updated on task/granularity changes via `getInitialViewRange`), and drag becomes a pure viewport pan operation. The existing `scrollToTask` helper already uses `container.scrollTo({ left })`, confirming this scroll-based approach is the intended pattern.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
