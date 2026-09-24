---
name: agent-guide-contract-editing
description: Use when editing the shipped agent-facing guides (src/guidelines/**) or the MCP tool schema descriptions so they document a CLI/MCP behaviour. Covers where each surface lives, the reference/link syntax rules the code actually enforces, and a script that verifies every documented example resolves through the real consumer.
---

# Editing the agent-facing guides

The `src/guidelines/**` markdown is shipped product surface: `backlog instructions <guide>` prints it, the MCP server serves it as workflow resources, and `agent-guidelines.md` is copied into consuming repos. Text here is a contract an agent will follow verbatim — treat a wrong example as a bug, not a typo.

## Where the surfaces live

| Surface | Path | Notes |
| --- | --- | --- |
| CLI guides | `src/guidelines/cli-instructions/*.md` | Served by `backlog instructions <key>`; keys registered in `cli-instructions/index.ts` |
| MCP guides | `src/guidelines/mcp/*.md` | Same content shape, different audience; `mcp/index.ts` |
| Shared agent rules | `src/guidelines/agent-guidelines.md` | Longest-lived surface; contains the create/edit command tables |
| MCP tool schemas | `src/mcp/utils/schema-generators.ts` | `description` strings are user-visible contract, not internal docs — update them with the guides |

When you change a behaviour, grep for its old wording across all four: a fix that lands in only one surface leaves the others contradicting it. Guides are US English.

## Rules the code actually enforces (do not restate them wrongly)

- **`--ref` / `--add-ref` values are comma-split.** `src/cli.ts` parses them with `parseDelimitedStringList`, so `--ref path:2193,2465` stores a second entry `2465`. Teach "one location per entry" rather than the parser detail.
- **Reference forms are decided by one consumer.** `FileSystem.readProjectFile` (`src/file-system/operations.ts`) parses `/^(.+?)(?::(\d+)(?:-(\d+))?)?$/` — a bare path, `path:LINE`, or `path:START-END`. Out-of-range or reversed ranges throw `Invalid line range`.
- **The web task details view treats every non-URL reference as a project-relative path** and hands the raw string to the file preview.
- **`removeReferences` matches the stored string exactly** — a suffix that is not present does not match.
- **Short local links take the same suffix on the id segment**: `/task/506:15`, `/documentation/13:319-329`, `/draft/:id`, `/decisions/:id`, `/wiki/:path`. An optional title slug follows the id segment; a custom label is kept verbatim; an unlabelled link renders the alias with the range appended (`DOC#13:319-329`). A suffixed link opens the preview modal scoped to those lines instead of navigating.
- **Relative project paths are not short local links** — but they *do* accept the line suffix and preview at those lines, same parser.

## Rules the user has set for guide prose

1. **Every example resolves.** Paths and line numbers must exist in this repo at the time you write them. No `src/api.ts`, `docs/spec.md`, `github.com/issue/123`, `example.com/spec`.
2. **No `# Wrong` counter-examples.** They read as documentation of a supported form and get copied. State the constraint in prose instead.
3. **No bracketed asides or long parentheticals** — prefer a premodifier or a separate sentence.
4. **State the supported forms explicitly** (URL / project-relative path / path with single-line or multi-line range) rather than leaving the reader to infer them from one example.
5. **Examples name a scenario, not the whole collection.** A bare `backlog task list --json --watch` reads as "dump everything"; every documented example carries the filters that make it a real question (`--status "In Progress" --assignee @sara`). Use the same example across the CLI guide, `CLI-INSTRUCTIONS.md` and the `task list` help schema `examples` array so the surfaces agree, then confirm the shipped text with `bun src/cli.ts instructions <key>` and `bun src/cli.ts task list --help`.

## Verification

Run from the repo root:

```bash
bun .codex/skills/agent-guide-contract-editing/verify-guide-examples.ts
```

It extracts every `--ref` value and every markdown link from the four guides and resolves each through the real consumer — `readProjectFile` for file targets, the same entity-to-path mapping the server uses for short links — then asserts no placeholder path survived. It exits non-zero on failure, so it works as a gate. Add new guide files to its `guides` array.

Then:

```bash
bunx tsc --noEmit                      # required only if a .ts file changed (schema descriptions count)
bun run check .                        # biome; markdown is not linted, but the ts surfaces are
bun test --timeout 240000 src/test/cli.test.ts src/test/mcp-server.test.ts   # guide assembly smoke
```

Guide markdown has no snapshot assertions, so editing it cannot fake a red test — but the assembly test proves the key still resolves and the resource still serves. When a guide documents a *new* parsing contract, pin it with a real unit test instead of relying on the prose (e.g. `src/test/mermaid-markdown.test.tsx` for the line-suffix parser).

## Checklist

- [ ] Changed behaviour grep'd across CLI guide, MCP guide, `agent-guidelines.md`, and the MCP schema descriptions.
- [ ] Reference/link syntax in the prose matches `readProjectFile` and the short-link parser.
- [ ] Every example path and line exists; no placeholder, no `# Wrong` block.
- [ ] `verify-guide-examples.ts` passes.
- [ ] `tsc` / `biome` / assembly tests as applicable.
- [ ] Guide edits are documentation, not migration artefacts: keep them in the working tree unless the task says otherwise.
