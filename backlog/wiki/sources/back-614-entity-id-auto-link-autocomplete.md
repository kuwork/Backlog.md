---
title: BACK-614 Auto-link entity IDs in web markdown with input-side insert-link hint
created_date: '2026-09-07 02:53'
updated_date: '2026-09-07 02:53'
labels:
  - source
  - web-ui
source_path: backlog/tasks/back-614 - Auto-link-entity-IDs-in-web-markdown-with-input-side-insert-link-hint.md
---

# BACK-614 Auto-link entity IDs in web markdown with input-side insert-link hint

Bare entity IDs (tasks, docs, decisions, drafts, wiki paths) written into web UI markdown rendered as plain text, forcing users to copy the ID and search for it. This task migrated and extended the upstream task-ID deep-link capability: a fail-closed render-side auto-linker links known IDs in all markdown display fields, and an input-side prefix autocomplete materializes the link in one keystroke — both sharing one canonical entity index built from the corpus App has already loaded (no new API calls).

## Summary

- `src/web/utils/task-id-links.ts` (new): canonical entity index (tasks + documents + decisions + drafts, canonical collisions dropped as ambiguous) + zero-padding-aware ascending prefix query (top 5 per kind; wiki paths lexicographic top 5) + remark AST link plugin — inline/fenced code structurally excluded, existing links keep their target, boundary rules reject identifier tails; empty index links nothing
- `src/web/contexts/TaskIdIndexContext.tsx` (new): index via `useMemo` from the loaded corpus, distributed by React Context, updates automatically on WebSocket corpus changes
- Render side wired into `MermaidMarkdown.tsx` and `DependencyInput.tsx` chips (matches become react-router Links to `/task/<canonical>`, misses stay plain text); route family matches BACK-511 short aliases, hrefs de-prefixed (`/task/506` not `/task/BACK-506`)
- `src/web/hooks/useEntityAutocomplete.ts` + `src/web/components/EntityLinkAutocomplete.tsx` (new): 200ms debounce, caret-bound token extraction, listbox with kind badges below the caret, arrow-key selection, Enter inserts a space-padded markdown link, single candidate inserts directly, Escape closes without reopen; negative cache keyed by candidate string, invalidated wholesale on index change; IME composition neither intercepted nor triggering
- Unsaved-edits guard: capture-phase click guard on `TaskDetailsModal.tsx` content area — isDirty / comment draft / any filled create-mode field asks confirmation before leave-type links; same-page anchors, modifier-key new-tab, non-http protocols exempt
- Key extraction: fork's `canonicalTaskId` lived in `src/utils/task-path.ts` which imports node:path/core (breaks the web build); moved to pure module `src/utils/task-id.ts` with task-path re-exporting — single implementation, zero behavior change
- @uiw/react-md-editor v4 drops `textareaProps.ref`; textarea obtained via wrapper `querySelector` + MutationObserver
- Verification: 64 new tests (task-id-links 24, autocomplete 22, chips 4, modal guard 6, mermaid +8); full bun test 2129 pass / 0 fail; live browser verification of auto-links, chips, and autocomplete interaction

## Acceptance Criteria

- Bare task/entity IDs matching the index render as links in all web markdown fields; unknown IDs stay plain text
- IDs inside code spans/blocks are not linkified; existing links keep their target; identifier tails rejected
- Input-side menu: 200ms debounce, prefix bounded by whitespace/line start, top 5 ascending, arrow select, Enter inserts space-padded link, single candidate direct insert
- Prefix matching zero-padding aware (BACK-01 ≡ BACK-1); canonical collisions excluded fail-closed
- Wiki paths prefix-matched lexicographically with per-candidate negative caching
- Autocomplete lookup is a standalone read-only prefix query — no change to list endpoint sorting, parameters, or pagination
- Unsaved-edits guard covers chips and auto-links before leaving the modal

## Related Concepts

- [[concepts/wikilink]] — existing wiki link syntax, complementary to bare-ID auto-linking
- [[concepts/task-identity]] — canonical ID resolution, zero-padding, and collision handling shared by both sides
- [[concepts/web-ui-features]] — markdown display/edit surfaces the linker and autocomplete are wired into

## Related Sources

- [[sources/back-523-wiki-wikilinks-alias-support-with-markdown-html-labels-and-markdown-it-attrs]] — the wiki-side link handling this task's bare-ID linking complements
