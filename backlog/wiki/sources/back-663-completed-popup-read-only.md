---
title: BACK-663 Render completed-corpus task popups read-only with a corpus hint
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - completed-corpus
  - i18n
source_path: backlog/tasks/back-663 - Render-completed-corpus-task-popups-read-only-with-a-corpus-hint.md
---

# BACK-663 Render completed-corpus task popups read-only with a corpus hint

BACK-662 let the search dialog open a `backlog/completed/` record, but the popup was still built as an editable board record — read-only gating was keyed only on `task.branch`, and a completed record arrives with `source: "completed"` and no branch, so Edit, inline field edits, comment add/delete, and AC/DoD toggles were all live against a record with no refresh path. This task gives completed popups the same read-only treatment cross-branch popups already had.

## Summary

- Gate split in `TaskDetailsModal.tsx`: `isFromOtherBranch = Boolean(task?.branch)` keeps naming the branch reason; `isReadOnly = isFromOtherBranch || task?.source === "completed"` is what every guard clause, action-button condition, `disabled` prop, and the opacity/cursor styling now reads — the completed popup inherits the cross-branch lock-down instead of a second hand-rolled one
- Banner stays a single slot directly under the title bar; it renders when `isReadOnly` and picks wording by reason — new `taskDetails.completedCorpusHint` for completed records vs. `crossBranchHint(task.branch)` for cross-branch
- i18n: `completedCorpusHint` added to all four locales (en, zh-CN, zh-TW, ja); `TranslationDict` is derived from en so tsc fails until all four carry the key
- Revert probes run one half at a time: reverting the gate to branch-only turned the new case red; reverting the banner alone reproduced the exact old symptom ("Read-only: This task exists in the  branch" with an empty branch)
- Known shared limitation left in place: in preview mode the AC checkboxes come from `AcceptanceCriteriaEditor` with `disableToggle={isCreateMode}`, so on a read-only popup they still look clickable and silently no-op — cross-branch popups behave the same today; a one-line follow-up if both should disable outright
- Verified: all 29 web suites (172 tests) green, plus headless Chrome over CDP showing the localized hint and zero action buttons on BACK-1 opened from the completed-enabled search

## Acceptance Criteria

- A task with `source: "completed"` opens read-only: no Edit, no inline field edits, no comment add/delete, no AC/DoD toggles
- The hint renders in the cross-branch banner slot under the title bar, naming the completed archive
- Cross-branch tasks keep their branch hint and stay read-only; active board tasks open editable as before
- The new hint string exists in all four web locales

## Related Concepts

- [[concepts/web-ui-features]] — task modal read-only gating conventions
- [[concepts/web-ui-i18n]] — four-locale dictionary keyed off the English type
- [[concepts/task-lifecycle]] — completed archive as a view-only surface

## Related Sources

- [[sources/back-662-completed-corpus-query-search]] — dependency: surfaces the completed records this popup renders
- [[sources/back-664-dependency-input-completed-predecessors]] — dependency chips click through into this read-only treatment
- [[sources/back-567-cross-branch-task-identity]] — the cross-branch popup whose lock-down shape was reused
