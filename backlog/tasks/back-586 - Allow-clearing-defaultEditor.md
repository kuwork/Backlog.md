---
id: BACK-586
title: Allow clearing defaultEditor
status: Done
assignee:
  - '@kimi'
created_date: '2026-08-07 17:25'
updated_date: '2026-08-23 23:48'
labels:
  - cli
dependencies: []
references:
  - src/cli.ts
  - src/file-system/operations.ts
priority: medium
actual_start: '2026-08-23 23:25'
actual_end: '2026-08-23 23:48'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
There is no supported way to clear a configured defaultEditor. config set defaultEditor "" is rejected because the value is validated as an executable before it is stored, and init --default-editor "" is silently discarded by truthiness fallbacks. The only workaround today is hand-editing config.yml. This matters because the shipped default `code --wait` blocks until the editor window closes, which can hang unattended agent processes. Users need a supported way to turn the editor off.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.49.3..v1.50.1 --grep BACK-574 and git show 3b3bddc as implementation reference.
- [x] #2 Setting an empty value via config set defaultEditor "" clears the key from config.yml.
- [x] #3 init --default-editor "" clears a previously configured editor.
- [x] #4 Non-empty defaultEditor values are still validated before being stored.
- [x] #5 Tests cover both clear paths (config set and init).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
### Phase 1 - config set defaultEditor clear path

- 1.1 Skip the isEditorAvailable executable check when the value is empty, so an empty string is stored. The config serializer already omits default_editor when falsy, which clears the key from config.yml.

### Phase 2 - init --default-editor clear path

- 2.1 Change the isNonInteractive guard from truthiness to 'options.defaultEditor !== undefined' and the fallback chain from || to ??, so an explicitly empty flag is treated as provided rather than falling through to existingConfig/EDITOR/VISUAL.
- 2.2 The pre-existing clear-on-empty logic in src/core/init.ts (hasDefaultEditorOverride + delete config.defaultEditor) then removes the key.

### Phase 3 - Validation and tests

- 3.1 Keep validation for non-empty values unchanged.
- 3.2 Tests: config set clear, init --default-editor "" with sentinel EDITOR/VISUAL, and re-init clearing a previously configured editor in src/test/config-commands.test.ts.
- 3.3 Verify with bunx tsc --noEmit, bun run check ., scoped config tests, and the full suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Implementation

- config set defaultEditor: skip the isEditorAvailable executable check when the value is empty, so an empty string is stored. The config serializer already omits default_editor when falsy, which clears the key from config.yml.
- init: the isNonInteractive guard uses options.defaultEditor !== undefined instead of truthiness, and the fallback chain uses ?? so an explicitly empty --default-editor is treated as provided rather than falling through to existingConfig/EDITOR/VISUAL. The pre-existing clear-on-empty logic in src/core/init.ts (hasDefaultEditorOverride + delete config.defaultEditor) then removes the key.
- Non-empty defaultEditor values are still validated and rejected when the executable is missing.

### Verification

- bunx tsc --noEmit clean; bun run check clean over the touched files; config-commands tests (19 pass, 0 fail).
- Scripted repro: config set defaultEditor clear path removes the key and non-empty validation still errors; init --default-editor "" clears a previously configured editor with sentinel EDITOR/VISUAL.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Allowed an explicitly empty defaultEditor to mean 'no editor' in both CLI paths. 'config set defaultEditor ""' now skips the executable check and clears default_editor from config.yml; 'init --default-editor ""' is treated as provided (!== undefined / ??) instead of falling through to the existing config or EDITOR/VISUAL, so the pre-existing clear-on-empty logic in src/core/init.ts removes the key. Non-empty values are still validated and rejected when the executable is missing. Verified with 3 new tests in src/test/config-commands.test.ts, typecheck, and Biome.
<!-- SECTION:FINAL_SUMMARY:END -->
