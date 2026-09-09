---
title: BACK-586 Allow clearing defaultEditor
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
source_path: backlog/tasks/back-586 - Allow-clearing-defaultEditor.md
---

# BACK-586 Allow clearing defaultEditor

There was no supported way to clear a configured defaultEditor: `config set defaultEditor ""` was rejected by the executable validation and `init --default-editor ""` was silently discarded by truthiness fallbacks. Both paths now treat an explicitly empty value as "no editor" — important because the shipped default `code --wait` can hang unattended agent processes.

## Summary

- `config set defaultEditor ""`: skips the `isEditorAvailable` executable check when the value is empty; the config serializer already omits `default_editor` when falsy, clearing the key from config.yml (`src/file-system/operations.ts`).
- `init --default-editor ""`: the isNonInteractive guard changed from truthiness to `options.defaultEditor !== undefined` and the fallback chain from `||` to `??` in `src/cli.ts`, so an explicit empty flag no longer falls through to existingConfig/EDITOR/VISUAL; pre-existing clear-on-empty logic in `src/core/init.ts` (`hasDefaultEditorOverride` + delete) removes the key.
- Non-empty values still validated and rejected when the executable is missing.
- Tests: 3 new cases in `src/test/config-commands.test.ts` (19 pass) plus scripted repro of both clear paths.

## Acceptance Criteria

- config set defaultEditor "" clears the key; init --default-editor "" clears a previously configured editor; non-empty values still validated; tests cover both clear paths.

## Related Concepts

- [[concepts/cli-entry]] — config command and init flag handling
