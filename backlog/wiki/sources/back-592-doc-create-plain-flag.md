---
title: BACK-592 Accept --plain on doc create
created_date: '2026-09-08 16:55'
updated_date: '2026-09-08 16:55'
labels:
  - source
  - cli
source_path: backlog/tasks/back-592 - Accept-plain-on-doc-create.md
---

# BACK-592 Accept --plain on doc create

The `doc create` subcommand never registered `--plain`, so commander rejected it with 'unknown option' — making it unusable from agent guidance that passes `--plain` on every command. The flag is now accepted and documented, following the decision create --plain precedent.

## Summary

- `src/cli.ts`: added `{ name: 'plain', type: 'Boolean', description: 'Use plain text output' }` to the doc create help schema and registered `--plain` on the subcommand, mirroring decision create.
- Create output is already plain text, so the flag is accepted rather than switching formats.
- Test in `src/test/cli-doc-decision-board.test.ts` asserts exit 0, no 'unknown option' in stderr, and the created id/path printed (12 pass); temp-project smoke verified.

## Acceptance Criteria

- doc create accepts --plain; help schema documents it; exits 0 and prints created id/path; tests cover the flag.

## Related Concepts

- [[concepts/cli-entry]] — CLI help schema and option registration conventions
- [[concepts/cli-instructions]] — agent guidance passes --plain on every command
