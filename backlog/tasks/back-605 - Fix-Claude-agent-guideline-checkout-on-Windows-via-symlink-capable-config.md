---
id: BACK-605
title: Fix Claude agent guideline checkout on Windows via symlink-capable config
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-06 06:57'
updated_date: '2026-09-06 07:25'
labels: []
dependencies: []
references:
  - src/guidelines/project-manager-backlog.md
  - src/guidelines/index.ts
  - src/test/claude-agent-install.test.ts
modified_files:
  - src/guidelines/project-manager-backlog.md
ordinal: 210400
actual_start: '2026-09-06 06:58'
actual_end: '2026-09-06 07:17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
src/guidelines/project-manager-backlog.md is committed as a symlink pointing at ../../.claude/agents/project-manager-backlog.md. On Windows checkouts without symlink support (git core.symlinks=false) it materializes as a plain text file containing the link target path, so CLAUDE_AGENT_CONTENT becomes a path string and the installClaudeAgent content test fails on every full test run on Windows. Enable symlink-capable checkouts (git config core.symlinks=true, requires Windows Developer Mode or an elevated clone) and keep the symlink so the embedded guideline stays a single source of truth with .claude/agents/project-manager-backlog.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bun test src/test/claude-agent-install.test.ts passes on Windows
- [x] #2 bunx tsc --noEmit and bun run check pass on touched files
- [ ] #3 core.symlinks=true is set for this repo and the symlink resolves to real agent content on Windows; checkout requires symlink support (Developer Mode or elevated clone)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enable symlink-capable checkouts: git config core.symlinks=true (Windows needs Developer Mode or an elevated clone)
2. Restore the symlink src/guidelines/project-manager-backlog.md → ../../.claude/agents/project-manager-backlog.md and verify it resolves to real agent content
3. Verify bun test src/test/claude-agent-install.test.ts, tsc/biome, and bun run build (symlink must be dereferenced when embedding)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced symlink src/guidelines/project-manager-backlog.md with a regular copy of .claude/agents/project-manager-backlog.md (git now records mode 100644). Windows checkouts without symlink support no longer degrade CLAUDE_AGENT_CONTENT to a path string. Scoped claude-agent-install tests 4/4 pass.

2026-09-06 direction change per user decision: keep the original symlink instead of the regular file copy. Set git config core.symlinks=true in this repo and restored the symlink via git checkout; it resolves correctly on this machine (Developer Mode), claude-agent-install tests 4/4 pass, and bun run build is being verified. Trade-off accepted: repo requires symlink-capable checkouts; the earlier regular-file approach was reverted to preserve single source of truth.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the Windows checkout degradation of the committed symlink src/guidelines/project-manager-backlog.md by enabling symlink support instead of replacing the link.

Changes:
- git config core.symlinks=true for this repo
- src/guidelines/project-manager-backlog.md: kept as symlink to ../../.claude/agents/project-manager-backlog.md (single source of truth preserved)

Verification:
- Symlink resolves to real agent content on this machine
- bun test src/test/claude-agent-install.test.ts → 4/4 pass
- bun run build → clean; embedded binary contains the full agent content (verified by string match)
- Full bun test (full-test-605-607.log): 2045 pass / 10 fail; installClaudeAgent content failure absent; no new failures introduced

Note: checkouts now require symlink support (Windows Developer Mode or elevated clone); core.symlinks=false degrades the link to a path string again.
<!-- SECTION:FINAL_SUMMARY:END -->
