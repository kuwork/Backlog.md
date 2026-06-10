---
id: BACK-509
title: Add stable task modal URLs with drill-down support
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-04 14:00'
updated_date: '2026-06-05 14:56'
labels:
  - web-ui
dependencies:
  - BACK-505
modified_files:
  - src/web/App.tsx
  - src/web/components/MermaidMarkdown.tsx
  - src/web/components/TaskDetailsModal.tsx
  - src/web/components/DocumentationDetail.tsx
  - src/web/components/DecisionDetail.tsx
  - src/web/components/WikiDetail.tsx
  - src/server/index.ts
  - src/web/lib/api.ts
actual_start: '2026-06-04 14:00'
actual_end: '2026-06-05 14:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a stable `/task/:id` URL route for task detail modals in the Web UI. Clicking a task from any view (board, task list, milestones, statistics, gantt) opens the modal while keeping the underlying page visible in the background. Support drill-down navigation into dependency tasks with a navigation stack, and ensure closing the modal returns to the original background page.

Also intercept `/task/:id` links inside rendered markdown (task descriptions, documentation, decisions, and wiki pages) so they open in the modal instead of a new tab.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking a task card/row updates the URL to `/task/:id` and opens the detail modal
- [x] #2 The underlying page (board, task list, etc.) remains visible in the background
- [x] #3 Closing the modal (× or backdrop) returns to the background page without history clutter
- [x] #4 Direct visit to `/task/:id` loads the board as background and opens the task modal
- [x] #5 Drill-down from dependency chips or markdown links pushes the next task onto the history stack
- [x] #6 Back arrow in the modal header navigates to the previous task in the stack
- [x] #7 Browser back/forward correctly traverses the task stack and closes the modal at the end
- [x] #8 `/task/:id` links inside Documentation, Decision, and Wiki markdown open in the modal
- [x] #9 Server routes `/task/:id` to the SPA entry
- [x] #10 URL format supports `/task/:id/:title` with automatic slug redirect from bare `/task/:id`
- [x] #11 URL IDs are prefix-agnostic (`/task/506` resolves to `BACK-506`)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Architecture

- **Modal Route pattern (background location)**: Opening a task pushes `/task/:id` onto the history stack with `state.backgroundLocation` set to the current page location. `Routes` renders the background page via `location={state.backgroundLocation || location}` while the modal is rendered outside `Routes` and controlled by `showModal` state.
- **URL sync effect**: A `useEffect` in `AppContent` watches `useMatch('/task/:id')` and `useMatch('/task/:id/*')`. When the URL task ID changes it opens, drills down, or goes back automatically by inspecting `taskHistoryRef`.
- **Close behavior**: Closing the modal `replace`s the current history entry with the background page path. This avoids leaving stale `/task/:id` entries in history and prevents race conditions where `setShowModal(false)` fired before the URL actually changed.
- **Markdown link interception**: `MermaidMarkdown` gained `parseTaskUrl()` which detects same-origin `/task/:id` links and calls `onTaskClick` instead of rendering an external `<a target="_blank">`. `WikiDetail` also intercepts `/task/` clicks in its native `contentRef` click listener because wiki pages use event delegation for wiki links.
- **Draft modal URLs (follow-up fix)**: Drafts were broken after this task because `handleOpenTask` navigated all tasks to `/task/:id`, but drafts are not in the `tasks` array returned by `search()`. Added a parallel `/draft/:id` route with the same modal-route behavior: `AppContent` loads drafts via `apiClient.fetchDrafts()`, the URL sync effect resolves `/draft/:id` against the `drafts` array, and `getTaskUrlPath(task)` generates `/draft/:id/:title` for draft IDs (`DRAFT-*`) while keeping `/task/:id/:title` for regular tasks. Drill-down and browser back/forward work across the mixed task/draft stack. `MermaidMarkdown` and `WikiDetail` also gained `/draft/:id` link interception so drafts can be opened from markdown content.
- **Title slug redirect**: Bare `/task/:id` URLs are automatically `replace`-navigated to `/task/:id/:title` after the task is resolved, matching the documentation/decision URL pattern.
- **Prefix-agnostic matching**: Both client-side (`stripAnyPrefix`) and server-side (`findTaskByLooseId`) support resolving numeric IDs like `506` to full IDs like `BACK-506`.

### Files changed

- `src/web/App.tsx` – extracted `AppContent` inside `BrowserRouter`; added `/task/:id` and `/task/:id/*` routes; synced modal state with URL; replaced `navigate(-1)` close logic with explicit background-page navigation; added title slug redirect in URL sync effect. **(Follow-up)** added `drafts` state, `/draft/:id` and `/draft/:id/*` routes/matches, `getTaskUrlPath()` helper, and updated URL sync effect to resolve drafts.
- `src/web/components/MermaidMarkdown.tsx` – added `onTaskClick` prop and `parseTaskUrl` helper; updated regex to handle `/task/:id/:title` URLs. **(Follow-up)** added `parseDraftUrl()` and `onDraftClick` prop for `/draft/:id` links.
- `src/web/components/TaskDetailsModal.tsx` – wired `onTaskClick` into all four `MermaidMarkdown` instances (description, plan, notes, final summary); added `stripAnyPrefix` matching for task ID resolution. **(Follow-up)** also loads `availableDrafts` and wires `onDraftClick` so dependency chips and markdown links can drill down into drafts.
- `src/web/components/DocumentationDetail.tsx` – passed `onTaskClick` to `MarkdownEditor`. **(Follow-up)** also passed `onDraftClick`.
- `src/web/components/DecisionDetail.tsx` – passed `onTaskClick` to `MarkdownEditor`. **(Follow-up)** also passed `onDraftClick`.
- `src/web/components/WikiDetail.tsx` – passed `onTaskClick` to `MermaidMarkdown`; added `/task/` interception in `contentRef` and `WikiLinkPreview` click handlers; stripped title slug from intercepted URLs. **(Follow-up)** added parallel `/draft/` interception and `onDraftClick` prop to `MermaidMarkdown`.
- `src/server/index.ts` – added `/task/:id` and `/task/:id/*` to Bun `routes` so direct visits serve `index.html`. **(Follow-up)** also added `/draft/:id` and `/draft/:id/*`.
<!-- SECTION:NOTES:END -->

## Final Summary

Task modal URLs are now stable and shareable. Any task can be opened via `/task/:id` (e.g. `/task/506`) which automatically redirects to `/task/:id/:title` (e.g. `/task/506/fix-cli-actualstart-actualend-missing-local-to-utc-conversion`). Drill-down navigation into dependency tasks works with a history stack and back button. Markdown links to tasks across all content types (descriptions, documentation, decisions, wiki) open in the modal. The background page remains visible and closing the modal cleanly returns to it.

**Follow-up fix**: Drafts also gained stable modal URLs via `/draft/:id` (e.g. `/draft/16/prototype-a-codex-plugin`) with the same background-location modal behavior, slug redirect, and drill-down support. Draft links inside task descriptions, documentation, decisions, and wiki pages are intercepted and open in the modal. This fixes a regression where drafts could not be opened from the drafts list after the `/task/:id` route was introduced.
