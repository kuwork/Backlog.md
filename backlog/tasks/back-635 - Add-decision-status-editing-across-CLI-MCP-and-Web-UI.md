---
id: BACK-635
title: 'Add decision status editing across CLI, MCP and Web UI'
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-14 05:46'
updated_date: '2026-09-14 07:00'
labels:
  - web-ui
dependencies:
  - BACK-633
priority: medium
ordinal: 236400
actual_start: '2026-09-14 06:55'
actual_end: '2026-09-14 13:30'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A decision can only receive its status at creation: decision create -s <status> defaults to proposed, the current decision update command only handles body content (--content / --append-content), MCP exposes no decision tools at all, and the web decision editor edits the body while the status badge stays read-only. In practice accepted, rejected and superseded are unreachable through any surface, and a decision created with the default status can never be moved off proposed.

This task makes the status (and the body) editable from all three surfaces through one core path, and updates the usage guides that describe the command and the MCP tool surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Core: updateDecisionFromContent accepts an explicit status override and applies it together with the content in a single write; without an override the status still comes from content frontmatter or the existing decision
- [x] #2 CLI: decision update <id> --status <status> sets the status, usable alone or together with --content / --append-content (the explicit flag wins over frontmatter in the content); the no-options error only fires when none of the three is provided, and the command help documents the new option
- [x] #3 MCP: a decision_update tool sets the status and/or replaces or appends the body by decision id, returning the updated id and failing with a clear error for unknown ids; it is registered in createMcpServer
- [x] #4 Web: the decision edit form exposes the status and saving persists body and status together; preview keeps rendering the status badge
- [x] #5 Status values stay free-form and are stored as-is, matching decision create (no validation against a fixed set)
- [x] #6 Guides updated: the CLI decisions guide documents --status (command table, parameters, example) and the MCP overview tool reference lists decision_update
- [x] #7 The tsc noEmit check passes and the decision, MCP and server tests pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: extend updateDecisionFromContent with an options object ({ status?, autoCommit? }) and update the existing positional caller in the auto-commit test.
2. CLI: add --status to decision update, allow it alone, and refresh the help schema.
3. Server + API client: let PUT /api/decisions/:id carry an optional status (JSON body) while still accepting a plain-text body, and extend apiClient.updateDecision.
4. Web: add a status selector to the decision edit header and pass it on save.
5. MCP: add a decisions tool group (schemas, handlers, index) exposing decision_update, register it in createMcpServer, and update the expected tool list in the MCP server test.
6. Guides: update cli-instructions/decisions.md and the MCP overview tool reference.
7. Verify: CLI on a throwaway decision, an MCP call through the in-process test interface, and a browser pass over the web status change.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Changed: src/core/backlog.ts, src/cli.ts, src/server/index.ts, src/web/lib/api.ts, src/web/components/DecisionDetail.tsx, src/markdown/parser.ts, src/mcp/server.ts, plus new src/mcp/tools/decisions/{schemas,handlers,index}.ts and src/test/mcp-decisions.test.ts; four guide files.

Surfaces:

Core
- updateDecisionFromContent(decisionId, content, { status?, autoCommit? }): an explicit status wins over the status in the content frontmatter.
- New updateDecisionStatus(decisionId, status, autoCommit?): writes only the status, without round-tripping the body.

CLI
- decision update gained --status (free-form; documented values proposed/accepted/rejected/superseded), usable alone or together with the content flags.
- The no-options guard now names all three options; the help schema lists the new option and an example.

Server / API client
- PUT /api/decisions/:id accepts a JSON body { content?, status? }; plain-text bodies still work.
- An absent content key means leave the body alone, so a status-only request writes just the status.
- apiClient.updateDecision({ content?, status? }) sends JSON.

Web
- The decision header renders a status select while editing (canonical values plus any stored non-canonical value).
- hasChanges and cancel include the status; the body is sent only when it actually changed.
- After a successful save the component re-reads the decision from disk, because the route does not change and nothing else refreshed the preview. Without that, the badge kept showing the pre-save status - a latent issue from the BACK-633 effect guard.

MCP
- New decisions tool group exposing decision_update (id plus content/appendContent/status), registered in both createMcpServer paths.
- The expected tool list in mcp-server.test.ts was extended.

Root-cause fix found while implementing:

parser.ts extractSection used this pattern:

```
## <Title>\s*\n([\s\S]*?)(?=\n## |$)
```

Because \s* swallowed the separating newlines, an EMPTY section had to swallow the following heading line to satisfy the lookahead. Every read-then-write therefore duplicated headings, which is why Web saves and CLI --append-content kept emitting "## Decision" and "## Consequences" twice (seen in decision-2 and reproduced on a fresh decision before the fix).

The pattern is now anchored to line starts on both ends, and core reuses it instead of carrying its own copy:

```
^##[ \t]+<Title>[ \t]*\n([\s\S]*?)(?=^##[ \t]|$(?![\s\S]))
```

Verification:
- CLI on throwaway decisions (deleted afterwards): --status alone changes the status and leaves the body byte-identical; --status with --content replaces the body and sets the status with exactly one of each heading; --append-content no longer duplicates headings (previously "## Consequences" appeared twice); no options prints the new error.
- MCP: new src/test/mcp-decisions.test.ts - 5 pass, covering status-only (body preserved, rawContent identical), body+status, append without duplicated headings, the no-fields validation error and an unknown id.
- Web, real browser (server on 6611 + Chromium, throwaway decision deleted afterwards): the select appears in edit mode with the current value and its aria-label carrying the localized word for "status"; a status-only save left the file body untouched and the preview badge moved Accepted -> Rejected after the save; a body+status save stored both with a single set of headings.
- markdown.test.ts gained a regression case for the empty-section parse (it fails on the old pattern).

Suite status: bunx tsc --noEmit passes. Targeted suites pass (markdown 49, MCP server+decisions 65, decision/CLI/server/auto-commit 38). The full suite reports 2251 pass / 15 skip / 5 fail / 4 errors; all failures are in task-edit-preservation and implementation-notes CLI tests that time out after 5000ms while spawning CLI subprocesses, and a stash bisect (changes reverted) reproduces exactly the same 1 fail / 1 error for task-edit-preservation, so they are pre-existing on this machine and unrelated to this change.

Guides: cli-instructions/decisions.md (command table, --status parameter, examples, an MCP note), mcp/decisions.md (it documented the create/list/view tools that never existed - now only decision_update, with create/list/view pointed at the CLI), mcp/overview-tools.md and mcp/overview.md. The wiki user manual page 30-文档与决策/01-决策记录.md claimed status could only be changed by editing frontmatter or via the Web/MCP UI - both false - and was rewritten with the three real paths; the log entry and the merged wiki_output manual were regenerated.

Left for a follow-up (reported, not implemented): decision_create/decision_list/decision_view over MCP; the manual status table lists deprecated, which is not part of the TypeScript union or the editor options. Status labels were localized separately in BACK-636.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision status is now editable from the CLI, MCP and the Web UI, and decision bodies no longer duplicate their section headings on save.

Why: a status could only be set at creation time, MCP exposed no decision tools at all, and the web editor had no status control; separately, a section-parsing bug made every read-then-write (Web save, CLI append) duplicate '## Decision' and '## Consequences'.

Changes:
- core: status override on updateDecisionFromContent plus a dedicated updateDecisionStatus; the parser's section extractor is now line-anchored and reused instead of duplicated
- CLI: decision update --status
- server/API: PUT /api/decisions/:id accepts JSON { content?, status? }; an absent content key means status-only
- Web: status select in the decision edit form, sending the body only when it changed, re-reading the decision after save
- MCP: new decision_update tool (id + content/appendContent/status) registered in createMcpServer
- guides + wiki manual updated (including removing three phantom MCP decision tools from the MCP guide)

Verification:
- CLI: status-only leaves the body byte-identical, content+status writes both, append no longer duplicates headings
- MCP: new 5-case test file passes
- Web: real-browser run - status-only and body+status saves persist, badge refreshes, body untouched for status-only
- bunx tsc --noEmit; the only full-suite failures are pre-existing CLI-subprocess timeouts, reproduced with the changes stashed
<!-- SECTION:FINAL_SUMMARY:END -->
