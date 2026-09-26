---
title: BACK-666 Show and edit modified files in the web task modal
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - web-ui
  - task-modal
source_path: backlog/tasks/back-666 - Show-and-edit-modified-files-in-the-web-task-modal.md
---

# BACK-666 Show and edit modified files in the web task modal

The `modifiedFiles` field was carried end to end (parser, CLI, TUI, MCP, web search) but the web task modal never showed it. This task surfaces it by merging References, Documentation and Modified Files into one tabbed metadata panel instead of adding a third stacked card.

## Summary

- Three tabs replace the two stacked cards in `TaskDetailsModal.tsx`; the strip carries `role="tablist"`/`tab`/`tabpanel` and only the active tab's body renders, so the new list cannot push Acceptance Criteria and fields below out of reach
- Default tab follows task state: `metadataTabPriorityFor(isDone)` puts Modified Files first on a finished record, References first otherwise, first filled list wins, References is the fallback; a `metadataTab` state of `null` means "follow the task", so the rule re-runs on unsaved edits, and a click pins the tab only for that task
- Each caption carries its list length in parentheses (`References(5)`), read from rendered state so counts track unsaved edits; empty lists show the bare caption, no `(0)`
- Modified Files rows clone the References rows (monospace path chip opening the file preview) minus the URL branch: a module-local `looksLikeUrl` rejects any `scheme://` value on submit, so a modified file is always a project-root path
- `modifiedFiles` is wired through all existing modal plumbing (`buildTaskDetailsFormState`, refresh-preserving sync, task-switch reset, `handleInlineMetaUpdate`, create-mode check) and is sent in `handleSave` — a divergence from the ported upstream version, which dropped paths added while creating
- Fork divergences from upstream BACK-633 port: tabbed panel instead of a third stacked card, all strings through i18n, no `max-h-64` height cap on the file list
- Tests: new 18-case `web-task-details-modal-modified-files.test.tsx` plus updated documentation cases; live-verified on BACK-664/BACK-666/BACK-438 against the source server in en and zh-CN

## Acceptance Criteria

- References, Documentation and Modified Files render as three tabs of one panel; only the active tab's body renders
- Default tab is state-driven (Modified Files for finished tasks, References otherwise), follows unsaved edits, and click overrides it per open task
- Modified Files reuses References row/form rendering with URL input refused and never rendered as an external link
- Cross-branch and completed-corpus tasks render the lists read-only, matching References gating
- Captions carry list counts with no `(0)`; new i18n keys exist in all four locales with no hardcoded strings

## Related Concepts

- [[concepts/web-ui-features]] — task modal structure and inline-edit conventions
- [[concepts/file-preview]] — path chip opening the file preview, reused from References
- [[concepts/i18n-string-fragmentation]] — avoided here by routing every string through i18n, unlike the ported version

## Related Sources

- [[sources/back-628-task-hierarchy-section]] — sibling task-modal section work; same modal and drill-down plumbing
- [[sources/back-665-completed-corpus-filter-checkbox]] — completed-corpus read-only gating this panel honours (batch sibling)
