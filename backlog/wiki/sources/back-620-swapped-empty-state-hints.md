---
title: BACK-620 Fix swapped empty-state hints for references and documentation sections
created_date: '2026-09-07 21:15'
updated_date: '2026-09-07 21:15'
labels:
  - source
  - web-ui
  - bug
  - i18n
source_path: backlog/tasks/back-620 - Fix-swapped-empty-state-hints-for-references-and-documentation-sections.md
---

# BACK-620 Fix swapped empty-state hints for references and documentation sections

In the web task details modal (also the edit and create page), the empty-state hints for the References and Documentation sections were swapped — References showed the 'No documents' hint and Documentation showed 'No references' — and the remove-button hover titles were swapped too. Users saw a misleading message in the wrong section whenever a task had no references or no documentation.

## Summary

- `src/web/components/TaskDetailsModal.tsx`: four usages swapped back — References section now renders `noReferences`/`removeReference`; Documentation renders `noDocumentation`/`removeDocumentation` (locale keys were always correct; usage was swapped at lines 1261/1338/1250/1327)
- `src/test/web-task-details-modal-documentation.test.tsx`: replaced the assertion that encoded the bug, added a references-empty test, and added a per-locale (en/zh-CN/zh-TW/ja) swap-detection test
- Verified: scoped suite 7/7, tsc clean, biome exit 0; full suite skipped per user decision

## Acceptance Criteria

- References section shows the references-specific empty hint; Documentation shows its own
- Remove-button hover titles match their section
- Behavior verified in all supported locales (en, zh-CN, zh-TW, ja)
- tsc and scoped bun test pass

## Related Concepts

- [[concepts/web-ui-features]] — task details modal section rendering
- [[concepts/web-ui-i18n]] — locale keys correct but usages swapped; per-locale regression test added
