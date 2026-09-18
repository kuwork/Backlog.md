---
id: BACK-651
title: Document line-numbered references and line-range links in the agent guides
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-09-18 05:47'
updated_date: '2026-09-18 06:13'
labels:
  - agent-guidelines
dependencies: []
references:
  - src/guidelines/cli-instructions/task-creation.md
  - src/guidelines/mcp/task-creation.md
  - src/guidelines/agent-guidelines.md
  - 'src/guidelines/cli-instructions/documents.md:123'
  - 'src/guidelines/mcp/documents.md:106'
  - 'src/mcp/utils/schema-generators.ts:93'
  - 'src/file-system/operations.ts:2193'
  - 'src/web/components/MermaidMarkdown.tsx:135'
  - 'src/web/components/TaskDetailsModal.tsx:1381'
  - 'src/server/index.ts:2465'
priority: medium
ordinal: 246400
actual_start: '2026-09-18 06:04'
actual_end: '2026-09-18 06:13'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Task creation guides tell agents to attach references, but every example is an external URL or an issue link, so agents writing local code references either drop the line number or invent a range syntax that reads as if it pointed at one place.

The field is free text, and the first non-URL consumer treats each entry as a project-relative file path: the web task details view passes the raw string to the file preview, and readProjectFile parses a trailing :LINE or :START-END suffix and returns just those lines. Usable forms are therefore src/foo.ts:120 for one line and src/foo.ts:120-140 for a contiguous range, written one location per entry. A single entry cannot carry two unrelated locations, and a range spanning several hundred lines (for example :1247-2382) previews the wrong region, so agents should prefer a separate entry per location.

Document this in the CLI and MCP task creation guides plus the shared agent guidelines, and state the accepted form in the MCP tool schema descriptions for references so create and edit agree.

Document bodies have the same gap in the other direction: short local links already accept an optional line suffix, but the documents guides never mention it. A link such as /documentation/13:319-329 or /task/506:15 opens the target in the preview modal scoped to those lines instead of navigating. The suffix belongs to the id segment, so an optional title slug still follows it; a link with a custom label keeps that label, while an unlabelled link renders the system alias with the range appended (DOC#13:319-329, TASK#506:15). A relative project path is not a short local link and keeps its existing file-preview behaviour. Document that in the CLI and MCP documents guides.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLI task creation guide (backlog instructions task-creation) documents the reference format: one location per entry as src/file.ts:LINE, with src/file.ts:START-END reserved for a contiguous range, and it no longer implies that references are URLs or issues only.
- [x] #2 The MCP task creation guide carries the same convention, including the rule to prefer two entries over one wide range.
- [x] #3 Every reference example in the guides names a path and line that exist in this repo, so the convention is copy-pasteable without placeholder paths.
- [x] #4 src/guidelines/agent-guidelines.md create and edit reference examples show the line-number form instead of a bare path.
- [x] #5 The MCP create-task and update-task schemas describe references as accepting a project-relative path:LINE / path:START-END or a URL.
- [x] #6 The documented syntax matches the consumer: previewing a documented example through readProjectFile resolves to the expected lines.
- [x] #7 The CLI documents guide documents the optional :LINE / :START-END suffix on short local links (/task/:id, /draft/:id, /documentation/:id, /decisions/:id, /wiki/:path): the suffix sits on the id segment, a custom label is kept as-is, an unlabelled link renders the alias with the range appended, and a relative project path is not a short local link.
- [x] #8 The CLI documents guide states the click behaviour: a suffixed link opens the preview modal scoped to those lines instead of navigating, and an unsuffixed link behaves as before.
- [x] #9 The MCP documents guide carries the same line-suffix syntax and click behaviour.
- [x] #10 The CLI task creation guide, the MCP task creation guide, and the MCP references schema each state the supported forms explicitly: a URL, a project-relative file path, and a file path with a line range — a single line (path:LINE) and a multi-line range (path:START-END).
- [x] #11 The CLI and MCP documents guides name the three link destinations a document can use: an external URL, a backlog item path, and a project-relative file path with an optional single-line or multi-line range.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- `--ref` / `--add-ref` values go through `parseDelimitedStringList` (`src/cli.ts:1944`), so a comma always splits one flag into two entries: `--ref src/file-system/operations.ts:2193,2465` stores `2465` as its own reference. Documented as "one location per entry" instead of restating the split, so the guides stay about intent rather than parser trivia.
- `readProjectFile` (`src/file-system/operations.ts:2193`) is the single consumer that decides the accepted forms: `/^(.+?)(?::(\d+)(?:-(\d+))?)?$/`, so `path`, `path:LINE` and `path:START-END` all resolve and anything else (reversed or out-of-range) fails with `Invalid line range`. The guides now list exactly those three forms, and every example path/line pair is a real one in this repo.
- Code file links and short backlog links reach the same parser: `MermaidMarkdown` keeps the `:LINE` / `:START-END` suffix on the target and forwards it (`parseLineRange`, `src/web/components/MermaidMarkdown.tsx:135`), the short-link branch resolves the entity path server-side (`src/server/index.ts:2465`), and the file branch calls `readProjectFile` directly. Both therefore open the preview scoped to the range; an earlier draft of the documents guides wrongly claimed relative paths take no line suffix - corrected.
- The documents guides now separate the three destinations a document can link to: external URL, backlog item short link (`/task/:id`, `/draft/:id`, `/documentation/:id`, `/decisions/:id`, `/wiki/:path`) and project-relative file path, the latter two accepting an optional single-line or multi-line range.
- MCP schema descriptions for `references`, `addReferences` and `removeReferences` (`src/mcp/utils/schema-generators.ts`) now name the same three forms; `removeReferences` states it matches the exact stored string, since `src/core/backlog.ts:1912` filters by equality and a suffix must match too.
- Examples avoid placeholders: `github.com/issue/123`, `src/api.ts` and `docs/spec.md` were replaced with real targets. Counter-examples (`# Wrong ...`) were removed from the guides as well - they read as documentation of a supported form and were being copied; the constraint is stated in prose instead.
- Verification: `tmp/verify-doc-examples.ts` extracts every `--ref` value and every markdown link from the four guides and resolves each through the real consumer (`readProjectFile` for file targets, the server's entity resolution for short links). 24 reference values plus all link examples resolve to the expected lines and no placeholder path remains. Targeted tests passed for the guides: `mermaid-markdown.test.tsx` (incl. two new cases - a title slug after a suffixed id, and the line range surviving a code file link click), `cli-refs-docs.test.ts`, `cli.test.ts`, `mcp-server.test.ts`; the remaining suite run was stopped per instruction.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The agent guides now teach references and document links the way the code actually consumes them.

- Task references are documented as one location per entry, in three forms: a URL, a project-relative file path, or a file path with a line range - `path:LINE` for a single line and `path:START-END` for a contiguous range. `src/guidelines/cli-instructions/task-creation.md` gained a References section, `src/guidelines/mcp/task-creation.md` carries the same convention, the `references` / `addReferences` / `removeReferences` MCP schema descriptions name the same forms, and `src/guidelines/agent-guidelines.md` uses line-numbered examples in its create/edit tables.
- Document links are documented as three destinations: an external URL, a backlog item short link, or a project-relative file path, the last two accepting the same optional single-line or multi-line suffix. The suffix sits on the id segment so an optional title slug still follows it; a custom label is kept, an unlabelled link renders the alias with the range appended (`DOC#13:319-329`), and a suffixed link opens the preview scoped to those lines instead of navigating. Both `cli-instructions/documents.md` and `mcp/documents.md` state this.
- Every example resolves: the documented paths and lines exist in this repo, and each one was checked against the real consumer rather than asserted by hand - `readProjectFile` for file targets, the server's entity resolution for short links. Placeholder paths and `# Wrong` counter-examples were removed because they were being copied as valid syntax.

Verification: `tmp/verify-doc-examples.ts` (24 reference values and all link examples, all resolving); `bunx tsc --noEmit` clean; `bun run check .` 0 errors; targeted tests green (`mermaid-markdown.test.tsx` with two new cases for the newly documented contracts, `cli-refs-docs.test.ts`, `cli.test.ts`, `mcp-server.test.ts`). The remaining suite run was stopped on request and the task was closed as passing.
<!-- SECTION:FINAL_SUMMARY:END -->
