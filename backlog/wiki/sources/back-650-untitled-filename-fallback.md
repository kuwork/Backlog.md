---
title: BACK-650 Fall back to a placeholder filename for punctuation-only titles
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - core
source_path: backlog/tasks/back-650 - Fall-back-to-a-placeholder-filename-for-punctuation-only-titles.md
---

# BACK-650 Fall back to a placeholder filename for punctuation-only titles

A punctuation-only title such as `!!!` sanitizes to an empty segment, producing `back-42 - .md`. The empty segment itself round-trips, but the `<id> - ` prefix is load-bearing for several filename readers, so `sanitizeFilename` — the single owner of filename sanitization — now falls back to an `untitled` placeholder instead of emitting an empty segment.

## Summary

- One function owns the fix: `sanitizeFilename` (`src/file-system/operations.ts`) returns the sanitized value or `'untitled'`, so a `!!!` title yields `task-1 - untitled.md`; all four call sites (saveTask, saveDraft, saveDecision, saveDocument) inherit it, and the frontmatter title keeps `!!!` untouched
- The `<id> - <title>.md` shape is load-bearing: the content-store task watcher takes the id from the segment before the first space, the decision watcher and `task-path` id lookup split on ` - `, document save dedup matches by `base.split(' - ')[0]`, the docs tree labels nodes the same way, and duplicate-task repair refuses to rebuild a path without the separator — id-only filenames would break all of them
- 5 new cases in `src/test/filesystem.test.ts` cover tasks, drafts, decisions, and documents, including id recovery by both filename splitters and a document resave that must still dedupe to one file; reverting the fallback turns 4 of 5 red (the fifth is a shape guard)
- End-to-end in a throwaway project: `task create '!!!'` -> `task-1 - untitled.md`, same for doc and draft, with `task list` still rendering the `!!!` title; scoped run 74 pass, tsc and biome clean

## Acceptance Criteria

- A punctuation-only title produces a non-empty title segment (e.g. `task-42 - untitled.md`)
- Filenames keep the `id - title.md` shape; no id-only filenames are introduced
- Tests cover punctuation-only titles for tasks, docs, and decisions

## Related Concepts

- [[concepts/task-identity]] — filename-derived id recovery that depends on the separator
- [[concepts/core-architecture]] — single-owner sanitization shared by all entity stores

## Related Sources

- [[sources/back-538-duplicate-task-id-recovery]] — duplicate-task repair among the separator-dependent readers
- [[sources/back-642-draft-identity-fail-closed]] — filename-derived draft identity protected by the same invariant
