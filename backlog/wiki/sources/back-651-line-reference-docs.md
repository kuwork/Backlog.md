---
title: BACK-651 Document line-numbered references and line-range links in the agent guides
created_date: '2026-09-26 14:30'
updated_date: '2026-09-26 14:30'
labels:
  - source
  - agent-guidelines
  - docs
  - mcp
source_path: backlog/tasks/back-651 - Document-line-numbered-references-and-line-range-links-in-the-agent-guides.md
---

# BACK-651 Document line-numbered references and line-range links in the agent guides

Task creation guides showed only URL/issue reference examples, so agents dropped line numbers or invented range syntax; the documents guides never mentioned the line suffix on short local links at all. The CLI/MCP guides, shared agent guidelines, and MCP tool schemas now document the forms exactly as the code consumes them.

## Summary

- References documented as one location per entry in three forms: a URL, a project-relative file path, or a path with a line range — `path:LINE` single line, `path:START-END` contiguous range; `readProjectFile` (`/^(.+?)(?::(\d+)(?:-(\d+))?)?$/`) is the single consumer that decides the accepted forms
- `cli-instructions/task-creation.md` gained a References section, `mcp/task-creation.md` carries the same convention (prefer two entries over one wide range), `agent-guidelines.md` uses line-numbered create/edit examples, and the MCP `references`/`addReferences`/`removeReferences` schema descriptions name the same forms (`removeReferences` matches the exact stored string, suffix included)
- Documents guides (CLI and MCP) now separate three link destinations: external URL, backlog item short link (`/task/:id`, `/draft/:id`, `/documentation/:id`, `/decisions/:id`, `/wiki/:path`), and project-relative file path — the latter two accept the optional line suffix; it sits on the id segment so a title slug still follows, a custom label is kept, an unlabelled link renders the alias with the range appended (`DOC#13:319-329`), and a suffixed link opens the preview modal scoped to those lines
- Both link kinds reach the same parser: `MermaidMarkdown` forwards the suffix (`parseLineRange`), the short-link branch resolves the entity path server-side, and both preview scoped to the range; an earlier guide draft wrongly claimed relative paths take no suffix and was corrected
- Examples avoid placeholders: every documented path/line exists in this repo, verified by `tmp/verify-doc-examples.ts` resolving all 24 reference values and every link example through the real consumers; `# Wrong` counter-examples were removed because they were being copied as valid syntax
- CLI note: `--ref` values go through `parseDelimitedStringList`, so a comma always splits one flag into two entries — documented as "one location per entry" rather than restating parser trivia
- Tests: two new `mermaid-markdown.test.tsx` cases (title slug after a suffixed id, line range surviving a code-file link click) plus cli-refs-docs, cli, and mcp-server suites green

## Acceptance Criteria

- CLI and MCP task creation guides document `path:LINE` / `path:START-END` with one location per entry, no longer implying references are URLs only
- MCP create/update-task schemas describe the same three reference forms
- Every guide example names a path and line that exist in this repo and resolves through `readProjectFile`
- CLI and MCP documents guides document the line suffix on short local links, its placement on the id segment, label/alias rendering, and the scoped-preview click behavior

## Related Concepts

- [[concepts/cli-instructions]] — agent instruction guides updated here
- [[concepts/mcp-workflow]] — MCP tool schema descriptions as public contract
- [[concepts/file-preview]] — preview modal the suffixed links open scoped to lines
- [[concepts/wikilink]] — short local link destinations and alias rendering

## Related Sources

- [[sources/back-531-local-link-line-range]] — original implementation of line-range links this task documents
- [[sources/back-526-create-task-references-and-backlog-autocomplete]] — task references field and autocomplete
- [[sources/back-572-agent-guides-date-fields-multiline-input]] — adjacent agent-guide documentation pass
