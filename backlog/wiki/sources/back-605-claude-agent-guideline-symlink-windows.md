---
title: BACK-605 Fix Claude agent guideline checkout on Windows via symlink-capable config
created_date: '2026-09-08 17:30'
updated_date: '2026-09-08 17:30'
labels:
  - source
  - bug
  - infra
  - windows
source_path: backlog/tasks/back-605 - Fix-Claude-agent-guideline-checkout-on-Windows-via-symlink-capable-config.md
---

# BACK-605 Fix Claude agent guideline checkout on Windows via symlink-capable config

`src/guidelines/project-manager-backlog.md` is committed as a symlink to `../../.claude/agents/project-manager-backlog.md`. On Windows checkouts without symlink support (`core.symlinks=false`) it materializes as a plain text file containing the link target path, so `CLAUDE_AGENT_CONTENT` becomes a path string and the installClaudeAgent content test fails on every full Windows run. This task fixed the degradation by enabling symlink-capable checkouts rather than replacing the link.

## Summary

- Root cause: git materialized the committed symlink as a text file holding the target path on Windows, so the embedded guideline content was a path string instead of the agent definition.
- First approach (reverted): replaced the symlink with a regular file copy (git mode 100644) so any checkout works; rejected by user decision to preserve single source of truth.
- Final approach: `git config core.symlinks=true` for this repo and restored the symlink via `git checkout`; it resolves to real agent content on the dev machine (Developer Mode).
- Verified: `bun test src/test/claude-agent-install.test.ts` 4/4 pass; `bun run build` clean and the embedded binary contains the full agent content (string match).
- Accepted trade-off: checkouts now require symlink support (Windows Developer Mode or elevated clone); `core.symlinks=false` degrades the link again.

## Acceptance Criteria

- claude-agent-install content test passes on Windows.
- `core.symlinks=true` set for this repo and the symlink resolves to real agent content on Windows; checkout requires symlink support (Developer Mode or elevated clone).

## Related Concepts

- [[concepts/embedded-skills]] — Guidelines/agent content embedded into the built binary must survive checkout and build dereferencing.
- [[concepts/ci-platform-contracts]] — Windows checkout environment assumptions (symlink support) as an implicit CI contract.

## Related Sources

- [[sources/back-410-cursor-agents-md-cleanup]] — Prior work on committed agent instruction files in this repo.
