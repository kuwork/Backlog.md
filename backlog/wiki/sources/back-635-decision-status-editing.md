---
title: BACK-635 Add decision status editing across CLI, MCP and Web UI
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - cli
  - mcp
  - web-ui
  - decisions
source_path: backlog/tasks/back-635 - Add-decision-status-editing-across-CLI-MCP-and-Web-UI.md
---

# BACK-635 Add decision status editing across CLI, MCP and Web UI

A decision could only receive its status at creation (`decision create -s`, defaulting to proposed), MCP exposed no decision tools at all, and the web editor had no status control — so accepted/rejected/superseded were unreachable. This task made status (and body) editable from all three surfaces through one core path, and fixed a section-parser bug that duplicated headings on every save.

## Summary

- Core: `updateDecisionFromContent` now takes an options object `{ status?, autoCommit? }` where an explicit status wins over content frontmatter; new `updateDecisionStatus` writes only the status without round-tripping the body
- CLI: `decision update --status <status>` (free-form, documented values proposed/accepted/rejected/superseded), usable alone or with `--content`/`--append-content`; the no-options guard names all three options
- Server/API: `PUT /api/decisions/:id` accepts JSON `{ content?, status? }`; an absent content key means status-only; plain-text bodies still work; `apiClient.updateDecision` sends JSON
- Web: status select in the decision edit header (canonical values plus any stored non-canonical value); body sent only when changed; component re-reads the decision after save because nothing else refreshed the preview (latent issue from the BACK-633 effect guard)
- MCP: new decisions tool group (`src/mcp/tools/decisions/`) exposing `decision_update` (id + content/appendContent/status), registered in `createMcpServer`; new 5-case `mcp-decisions.test.ts`
- Root-cause fix: `parser.ts extractSection`'s `## Title\s*\n` pattern swallowed separating newlines, forcing empty sections to consume the next heading and duplicating `## Decision`/`## Consequences` on every read-then-write; the pattern is now line-anchored on both ends and core reuses it instead of carrying its own copy
- Guides updated: `cli-instructions/decisions.md`, `mcp/decisions.md` (removed three phantom decision tools that were documented but never existed), `mcp/overview-tools.md`, `mcp/overview.md`, and a wiki manual page rewritten with the three real status-change paths
- Verification: CLI status-only leaves the body byte-identical; append no longer duplicates headings; real-browser status-only and body+status saves persist with the badge refreshing; pre-existing full-suite CLI-subprocess timeouts reproduced with changes stashed

## Acceptance Criteria

- Core accepts an explicit status override applied together with content in a single write
- CLI, MCP and Web can each set the status, alone or with body changes; unknown MCP ids fail with a clear error
- Status values stay free-form and stored as-is (no fixed-set validation)
- Usage guides document `--status` and the `decision_update` MCP tool

## Related Concepts

- [[concepts/mcp-server]] — tool group registration pattern the decisions group follows
- [[concepts/mcp-workflow]] — decision tooling exposed to agents
- [[concepts/markdown-pipeline]] — section extraction bug and line-anchored fix
- [[concepts/cli-instructions]] — guides updated alongside the CLI surface

## Related Sources

- [[sources/back-633-decision-editing-web-ui]] — prerequisite that made the web edit form reachable
- [[sources/back-574-decision-list-view-update-commands]] — earlier decision CLI surface work
- [[sources/back-576-dedupe-generate-next-decision-id]] — decision ID handling in the same core area
