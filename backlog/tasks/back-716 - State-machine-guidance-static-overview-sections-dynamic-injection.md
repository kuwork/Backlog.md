---
id: BACK-716
title: 'State machine guidance: static overview sections + dynamic injection'
status: Done
assignee:
  - '@kimi'
created_date: '2026-09-29 07:11'
updated_date: '2026-09-29 08:59'
labels:
  - agents
dependencies: []
references:
  - >-
    backlog/docs/PRDS/state-machine/doc-19 -
    PRD：默认状态机（7-列-·-三审查点落位-·-可重置-·-指引优先）.md
modified_files:
  - src/core/state-machine.ts
  - src/core/state-machine-guidance.ts
  - src/file-system/operations.ts
  - src/agent-instructions.ts
  - src/index.ts
  - src/cli.ts
  - src/core/init.ts
  - src/commands/help-schema.ts
  - src/commands/instructions.ts
  - src/mcp/resources/workflow/index.ts
  - src/mcp/tools/workflow/index.ts
  - src/server/index.ts
  - src/guidelines/cli-instructions/overview.md
  - src/guidelines/mcp/overview.md
  - src/guidelines/mcp/overview-tools.md
  - src/web/components/StateMachineEditor.tsx
  - src/test/state-machine.test.ts
  - src/test/state-machine-guidance.test.ts
  - src/test/config-statuses.test.ts
  - src/test/agent-instructions.test.ts
  - src/test/mcp-server.test.ts
  - src/test/server-statuses-endpoint.test.ts
  - src/test/web-state-machine-editor.test.tsx
priority: high
ordinal: 286400
actual_start: '2026-09-29 07:27'
actual_end: '2026-09-29 08:00'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the AI able to read the project's state machine, use it, and change it on request. Both parts are carried by the overview the AI already loads.

**1. Static (fixed) content in the agent-guidelines overviews.** Three shipped overview texts are the "required first read" on their surface (`src/mcp/workflow-guides.ts`), so all three need the section - leaving the MCP pair alone would let MCP clients never learn the machine:

- `src/guidelines/cli-instructions/overview.md` -> `CLI_WORKFLOW_OVERVIEW` (CLI: `backlog instructions overview`)
- `src/guidelines/mcp/overview.md` -> `MCP_WORKFLOW_OVERVIEW` (MCP resource `backlog://workflow/overview`)
- `src/guidelines/mcp/overview-tools.md` -> `MCP_WORKFLOW_OVERVIEW_TOOLS` (MCP tool `get_backlog_instructions` with no `instruction`)

The section teaches the AI the state-machine definition in `backlog/config.yml` and how to edit it:

- Where it lives: `backlog/config.yml` -> `statuses` (object form).
- Fields: `name`; `category` (`initial` / `active` / `wip` / `blocked` / `done` / `dropped`); `exit` (`complete` / `archive`); `next[]` (`to` / `when` / `ai` / `if` / `requires` / `evidence`); `display`.
- The legacy fallback, so an old project is not misread: a plain string array means "no transitions declared" - the last entry is the terminal one and a status whose name normalises to `inprogress` is wip.
- How to read it and how to change it safely on a user's request (write the whole object form back, never dropping a field; no CLI command sets `statuses`, so object-form edits go through the settings-page editor, FR-9 / BACK-715, or the file itself).

This part is static text: it describes the format, not any one project's statuses. It ends with a `{{STATE_MACHINE}}` placeholder, reusing the `{{TASK_ID:n}}` substitution precedent. It carries the **usage** half too, not just the format: a "Using the machine" instruction names the rendered block below as *this* project's machine (above any remembered or default status list) and walks the agent through moving a task - read the current `status`, find that status's `next` edge, obey its `ai` tier, gather its `evidence` first, never take an edge from the "stop and wait for a human" list alone - plus what to do in a project that declares no transitions. Placement follows the surface: the CLI overview puts it where it already tells the reader to load the project state (absorbing that section's "Pay special attention to statuses" and "Validate defaultStatus" paragraphs), and the two MCP texts, which have no statuses discussion of their own, append it as the final section.

**2. doc-19 FR-8 - the dynamic guidance, appended to the same overview.**
Render the project's own machine from the config (`StateMachine.describe()`): the statuses / categories / exit / board table, the four `ai` tiers, a per-status list of `next` edges carrying `when` / `ai` / `if` / `requires` / `evidence`, the terminal-status table, the archive rules, and the "stop and wait for a human" section derived from the edges whose `ai` is `forbidden` or `propose`. Per AC-23 a plain string-array project renders no tier table and says instead that no transitions are declared. The wording states config facts and nothing else: no "declares but never enforces" style commentary.

The three overview constants are shipped verbatim today (`overview.trim()` in each guidelines index), so carrying the dynamic machine means composing at runtime from the static text plus the rendered machine, on every surface that serves one: the `backlog://workflow/overview` resource, the tool-served `get_backlog_instructions` overview, and the CLI instructions. **No separate resource is introduced** - `backlog://workflow/state-machine` stays the M2 item doc-19 already lists it as, and the overview is the single carrier.

Injection into the project's own instruction files stays separate and is still required: a third marker kind (`state-machine`) in `src/agent-instructions.ts` with `<!-- BACKLOG.MD STATE MACHINE START/END -->`, idempotent (strip the old block, then append), re-rendered from the current `config.yml` on `init`, on `agents`, and after any `statuses` write served by the web server.

**3. Resilience - a broken `statuses` block is announced, not hidden.** The overview must survive a broken state-machine config and say so in-band. The read path is silent today: `parseStatusesConfig` maps every entry through `parseStatusEntry` and filters out whatever came back `undefined`, so an unparseable status or an edge with no `to` is dropped with no diagnostic; and when nothing survives (or the YAML will not parse) it returns the caller's fallback, so `loadConfig` leaves `config.statuses` unset and every reader collapses to `DEFAULT_STATUSES`. "The machine is broken" is therefore indistinguishable from "no machine declared", and a hand-edited or externally written `config.yml` is never validated on read at all (`validateStatusesShape` only guards the write path). Requirement: reading the machine, rendering `describe()`, and serving the overview all still return normally - no throw, no missing overview - when `statuses` is unparseable, absent, partly malformed, or semantically invalid; and the rendered guidance carries a notice naming what was rejected, which fallback is in use, and that the machine it reconstructed is not what the project declares. Losing the overview (the "required first read") is worse than losing fidelity.

Related: doc-19 FR-8 (M1's core deliverable), FR-9 / BACK-715 (the editor that writes `statuses`), AC-23 (the string-array rendering exception), doc-19 §11 (the seam with M2).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All three shipped overview texts gain the static section: src/guidelines/cli-instructions/overview.md, src/guidelines/mcp/overview.md and src/guidelines/mcp/overview-tools.md.
- [x] #2 The static section documents the object form of statuses in backlog/config.yml: name, category (six values), exit (complete/archive), next[] (to/when/ai/if/requires/evidence) and display.
- [x] #3 The static section states the legacy plain-string-array fallback (last entry is terminal; a name normalising to "inprogress" is wip) so a pre-object-form project is not misread.
- [x] #4 The static section tells the AI how to read the machine and how to change it on a user request without dropping a field, noting that no CLI command sets statuses (the settings-page editor and the config file are the writers).
- [x] #5 StateMachine.describe() renders the guidance from the config: the statuses/categories/exit/board table, the four ai tiers, per-status next lists carrying when/ai/if/requires/evidence, the terminal-status table, the archive rules, and the "stop and wait for a human" list derived from ai in {forbidden, propose}.
- [x] #6 AC-23: with a plain string array, describe() renders no ai tier table and states instead that no transitions are declared.
- [x] #7 describe() exposes config facts only: nothing on the machine answers allow/deny (its whole surface is pinned by a test), and the rendered text carries no meta-commentary about what the tool does or does not enforce.
- [x] #8 src/agent-instructions.ts gains the state-machine marker kind with <!-- BACKLOG.MD STATE MACHINE START/END --> and injects the rendered guidance idempotently: a second run leaves exactly one block, a changed machine replaces it, and an absent machine removes it.
- [x] #9 The guidance is re-rendered from the current config on backlog init, on backlog agents, and after any statuses write served by the web server; a refresh updates only instruction files that already exist and already carry Backlog guidance, never creating one.
- [x] #10 The overview served to the AI carries both parts - the static section and the rendered machine - on every surface that serves one: the backlog://workflow/overview resource text, the get_backlog_instructions tool text, and the CLI instructions. No separate resource is introduced (backlog://workflow/state-machine stays the M2 item).
- [x] #11 A broken statuses block never breaks the overview: reading the machine, rendering describe() and serving the overview all still return normally - no throw, no missing overview - when the state-machine config is unparseable, absent, partly malformed or semantically invalid.
- [x] #12 The rendered guidance announces a broken state-machine config in-band: it names what was rejected (the status, or the transition the parser had to drop, with its position), states which fallback is in use (plain-string-array semantics or DEFAULT_STATUSES), and warns that the reconstructed machine is not what the project declares.
- [x] #13 Placement follows each surface: the CLI overview puts the static section and the rendered machine where it already tells the reader to load the project state, absorbing its "Pay special attention to statuses" and "Validate defaultStatus" paragraphs (the defaultStatus membership rule survives inside the section); the two MCP texts, which have no statuses discussion, append it as the final section.
- [x] #14 The guidance says how to USE the machine, not only what it contains: a "Using the machine" step list sits before the rendered block, naming it as this project's machine (above any remembered or default list) and covering read the current status, follow that status's next edge, obey the edge's ai tier, satisfy evidence, write the status, and never take a "stop and wait for a human" edge alone - plus the no-transitions variant. The injected describe() block opens with the same procedure in its two variants.
- [x] #15 The shipped execution and finalization guides follow the machine rather than prescribing a sequence: task-execution (CLI and MCP) opens with "follow this project's state machine, not a fixed sequence", tells the reader to re-read the overview, moves only along a declared next edge while obeying its ai and satisfying its evidence, and no longer says to mark the task In Progress; the MCP finalization guide asks for the configured terminal status instead of naming Done.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Phase 1 is the static text and can land alone; phase 2 is FR-8.

### 1. Static overview section (three texts)
- Add one section (same wording, adapted to each surface's tool names) to:
  `src/guidelines/cli-instructions/overview.md`,
  `src/guidelines/mcp/overview.md`,
  `src/guidelines/mcp/overview-tools.md`.
- Content: where `statuses` lives and its object form; the six categories and the two exit channels; the `next[]` fields (`to` / `when` / `ai` / `if` / `requires` / `evidence`); `display`; the legacy plain-string-array fallback; how to read it and how to change it on request without dropping fields.
- The section ends with a `{{STATE_MACHINE}}` placeholder, reusing the `{{TASK_ID:n}}` substitution precedent already in `src/commands/help-schema.ts`, rather than rebuilding the constants as consumers.
- Place it as the **final** section of each file (appended, not inserted near the head), so a reader still meets "when to use Backlog" and the workflow first.
- These are bundled with `import ... with { type: "text" }`, so there is nothing to regenerate; check the existing tests that assert the overview headings (src/test/mcp-server.test.ts) still hold, and extend them for the new section.

### 2. describe() on the compiler
- src/core/state-machine.ts: add `describe(diagnostics?)` to the `StateMachine` interface and implement it. Read-only: it reports what the config declares and never returns a verdict.
- Render: header, the "problem" block (only when there is one), the statuses / categories / exit / board table, the `ai` tier table, a per-status `next` list, the terminal-status table, the archive rules, and the auto-derived "stop and wait for a human" list.
- No meta-disclaimer: the wording states config facts only (no "declares but never enforces" style line).
- AC-23 exception: for a plain string array, skip the tier table and render "no transitions declared, statuses may move between any non-terminal pair".

### 3. Injection and refresh
- src/agent-instructions.ts: widen `GuidelineMarkerKind` with `state-machine`, markers `<!-- BACKLOG.MD STATE MACHINE START/END -->`; reuse the existing strip-then-append so re-running never duplicates a block. A missing section still strips a stale block.
- Add `refreshStateMachineInAgentInstructions`, which touches only files that exist **and** already carry Backlog guidance - writing statuses must never be the reason an instruction file appears.
- Re-render from the current config on every `addAgentInstructions` call, on `backlog init`, on `backlog agents`, and after any `statuses` write served by the web server. There is no CLI command that sets `statuses` (see note), so the server write is the real "config changed" trigger.

### 4. Carry the dynamic machine in the overview
- Compose at runtime: `src/core/state-machine-guidance.ts` exposes the placeholder, `composeGuideText(staticText, inspection)`, `composeGuideTextWithProject(staticText, source)` and `renderProjectStateMachine(source)`. A text without the placeholder returns untouched, so only the overview pays for the config read.
- Serve the composed text from every surface that hands out an overview: the `backlog://workflow/overview` resource text, the `get_backlog_instructions` tool text, and the CLI instructions output.
- No new resource: do not add `backlog://workflow/state-machine` (doc-19 already files it as the M2 item) - the overview is the single carrier.
- The rendered machine lands right after the static section at the **end** of the text, so both halves stay together and out of the way of the workflow guidance.

### 5. Tests and gates
- describe(): the seven-column default renders every field; a string array renders the AC-23 exception and no tier table; the machine's whole surface is pinned by key so no verdict-returning method can appear.
- Injection: running twice leaves exactly one marker block; a changed machine replaces the block; no section removes it; a refresh never creates a file.
- Overview: each of the three texts contains the static section, ends with it, and the served overview carries both halves; the served text never still contains the placeholder.
- MCP: `backlog://workflow/overview` carries static + rendered text; the `task_create` / `task_edit` status enum still matches the configured statuses; no `backlog://workflow/state-machine` resource is registered.
- Server: saving `statuses` rewrites the injected block in an AGENTS.md that already carries Backlog guidance.
- tsc --noEmit / biome check / scoped bun test.

### 6. Resilience: a broken statuses block still yields an overview
- The drop is silent upstream of the compiler, which is the crux. `parseStatusesConfig` (src/file-system/operations.ts:186) maps each entry through `parseStatusEntry` and `.filter`s out the `undefined` ones; a surviving list is returned with no diagnostic, and an empty survivor list falls back to the caller's value, after which `loadConfig`'s `case "statuses"` (~1991) leaves `config.statuses` unset and the reader uses `DEFAULT_STATUSES`. Because the dropped entries are gone before `compileStateMachine` sees the array, `validate()` (src/core/state-machine.ts:311) cannot detect them either.
- So the diagnostic is produced where the drop happens: `inspectStatusesText(configText)` (src/file-system/operations.ts) parses the same way but keeps a rejection record, and `FileSystem.inspectStatuses()` reads it uncached. The rejected entry, or the transition that lost its `to`, is named with its position.
- When nothing usable comes out of the block, `inspectStatuses()` hands back `[...DEFAULT_STATUSES]` with a `fallback` label rather than an empty machine, so the guided machine is the one readers actually use; a wholly unparseable document is flagged `unreadable` so "declares 0" cannot mislead.
- `describe()` renders a "state machine config problem" block - the dropped entries, the fallback in use, and the issues from `validate()` - above whatever machine it could reconstruct.
- Guard the whole build so an unexpected exception still returns a minimal text carrying the error instead of propagating: the overview is the "required first read", and losing it entirely is worse than losing fidelity.
- Tests: a config whose `statuses` is unparseable, absent, has one malformed entry, or loses a transition target each still yields an overview, and each returned text names the problem and the fallback in use.

### 7. Wording and placement (user-directed)
- No "declares, it never enforces" style disclaimer anywhere in the guidance, in any of the three texts or in the rendered machine: state the config facts and stop. This is a deliberate departure from doc-19 R10's required disclaimer, at the user's instruction.
- The state machine section is reference material and is appended at the end of the overview, never inserted near the head.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Key decisions and pitfalls

- `describe()` is read-only and never returns a verdict: it renders config facts. `Object.keys(machine)` is pinned in the test so a future allow/deny method cannot slip in unnoticed.
- The wording carries no meta-disclaimer. An earlier draft opened with "Documentation, not enforcement ... M1 declares, it never enforces"; the user cut that class of phrasing, so the rendered machine now starts straight at its tables.
- The static section is **appended as the final section** of each overview. It was first inserted before the workflow guidance (MCP) and before "Detailed Guides" (CLI); the user moved it to the end, and three tests now assert it is the last `##` section.
- The `ai` bullet reads "`ai` says who may make the move", not "`ai` is a permission, not an enforcement" - same reason.
- Placeholder substitution over builders: the three overview constants stay static text and carry `{{STATE_MACHINE}}`, reusing the existing `{{TASK_ID:n}}` precedent. A text without the placeholder returns untouched, so only the overview triggers a config read.
- `inspectStatusesText` is the only place where a dropped entry can still be seen. `parseStatusesConfig` filters malformed entries out before returning, and `loadConfig` answers from a cache on top of that, so neither `loadConfig` nor `validate()` can report the loss. `FileSystem.inspectStatuses()` therefore reads the file uncached on purpose.
- A fallback renders as the real fallback. When nothing in the block parses, `inspectStatusesText` returns `[...DEFAULT_STATUSES]` plus a label, so the guided machine is the one readers actually use - an earlier draft announced a fallback while rendering an empty machine.
- `validateStatusesShape` only guards the write path (a bad payload is a 400); it never sees a hand-edited `config.yml`. Resilience therefore lives on the read path, not in the validator.
- Injection lives in its own marker block, so the machine can be replaced without disturbing the static guidelines. `refreshStateMachineInAgentInstructions` writes only to files that exist and already carry Backlog guidance.
- There is a fifth, optional positional argument on `addAgentInstructions`. Existing callers and tests are unaffected.

### Implementation notes

- `backlog config set statuses` does not exist: `statuses` is absent from `CONFIG_SET_KEYS`, the switch refuses it outright, and `config-commands.test.ts` asserts "statuses cannot be set directly". The AC asked to refresh "on `config set statuses`", so the real equivalent was wired instead - `backlog init`, `backlog agents`, and the server's `statuses` write paths (`handleUpdateConfig`, `handleUpdateStatuses`) via `refreshInjectedStateMachine()`. The three guide texts say plainly that no CLI command sets `statuses`.
- Two stale statements were corrected while editing the same files: the CLI overview claimed the default initialization is three statuses (BACK-715 changed it to the seven-column machine), and the MCP overview's `- \`task_list\`` line was missing `completed: true`, which had been failing `mcp-server.test.ts`'s schema-coverage test before this work (the schema is not in this change set).
- `biome.json` covers `src/**/*.ts` only, so the `.tsx` files here are guarded by tsc and tests alone - pre-existing configuration, untouched.
- Repeat pitfall: an `Edit` whose `old_string` is a function's first two signature lines deletes those lines. It happened twice here (`agent-instructions.ts`, `help-schema.ts`) and removed `getCliTaskPrefix`'s whole body; when inserting a helper, anchor on a single line and repeat it in `new_string`.
- `--plan` / `--notes` / `-d` are whole-field overrides, and `--check-ac 1 2 3` binds only the first index.

### Round 5: placement per surface

- The user first moved the section out of the head, to the end of each file, then pointed at the CLI overview's own statuses paragraphs (`Pay special attention to statuses` / `Validate defaultStatus`) and asked for the machine there instead. Both instructions are honoured, per surface: the CLI text carries the section exactly where it tells the reader to load the project state - absorbing those two paragraphs - while the two MCP texts, which have no statuses discussion of their own, keep it as the final section.
- The absorbed paragraphs are not lost: "read the configured `statuses` and `defaultStatus` ... never assume `To Do / In Progress / Done`" is now the section's opening sentence, and the `defaultStatus` membership rule is its own paragraph inside the section.
- Resulting CLI order: `### Start Every Request Here` (command list) -> `## The Project Status Machine` (static) -> `## This project's state machine` (rendered) -> `### Detailed Guides`. The heading levels mix because the shipped heading is `##`; the CLI overview already uses `##` for its major reference sections, so it reads consistently.
- The tests follow the split: one asserts the CLI placement (after "Start Every Request Here", before "Detailed Guides", old paragraphs gone, the `defaultStatus` rule present), and one per MCP text asserts it is the final `##` section.

### Round 6: tell the agent how to *use* the machine

- The user's catch: the static section explained the `statuses` format and ended with `{{STATE_MACHINE}}`, but nothing said "the block below is this project's machine" and nothing said how a current status decides the next one. The overview is the only place an agent is told how to act, so the format reference alone was not enough.
- Added `**Using the machine.**` to all three texts, immediately before the placeholder: it names the rendered block as this project's machine (outranking any remembered or default status list) and gives the six-step procedure - read the current `status`, look it up, pick the `next` edge whose `when` matches (none fits: do not move), obey `ai` (`forbidden` = ask and wait, `propose` = propose and wait, `allowed_if` = `if` must hold and `requires` be satisfiable, `allowed` = proceed), satisfy `evidence`, then write the status - plus the "Stop and wait for a human" rule and the no-transitions variant.
- The same gap existed on the other delivery channel: the block injected into AGENTS.md / CLAUDE.md is the `describe()` output, which had the tables but no procedure. `describe()` now opens (after the heading) with a one-line **Moving a task** instruction, in two variants - the `next`-edge form when the project declares transitions, and the "any pair of non-terminal statuses" form for a plain string array. Repeating it per channel is deliberate: each is served and read independently.
- The procedure is stated before the tables it points at, in both channels, and both are pinned by tests (per text for the overviews; per variant for `describe()`).

### Round 7: the execution guide prescribed a sequence instead of the machine

- The user's second gap: `task-execution` (CLI and MCP) taught "read the task -> mark it In Progress and assign yourself -> draft a plan -> get approval -> write code" as *the* correct sequence. That is only one machine (the default), and it is wrong twice over: it assumes a status name, and it ignores that the default machine reserves `Plan Review` -> `In Progress` for the user.
- CLI `task-execution.md` now opens the Planning Workflow with "Follow this project's state machine, not a fixed sequence": what `backlog/config.yml` declares, how to read the current status and pick the matching `next` edge, the `ai` tiers, `evidence`, and "never set a status the machine does not list" - plus "re-read the overview (`backlog instructions overview`) whenever you are about to move a task". Step 2 became "Move it along the machine and assign yourself" with a placeholder status and the `forbidden`/`propose` caveat; step 6 ties the approval to the edge into the implementing status. The Status rows in the field table and the `actualStart`/`actualEnd` note no longer name a status.
- MCP `task-execution.md` got the same preamble and step-1 rewrite, pointing at `backlog://workflow/overview` / `get_backlog_instructions`.
- MCP `task-finalization.md` was the odd one out: it said "Set status to 'Done'" in four places while its CLI twin already said "configured terminal status". It now asks for the status "this project's machine declares terminal".
- Checked but left alone: `cli-agent-nudge.md` and `mcp/agent-nudge.md` (what actually lands in AGENTS.md / CLAUDE.md) contain no status names; `agent-guidelines.md` is **not referenced by any shipped surface** - only `src/guidelines/index.ts` exports it and one test reads it - so its many hardcoded statuses are dead content, reported rather than rewritten.
- One existing test pinned the old placeholder (`-s "<active status>"`); it was updated to the new placeholder plus assertions that the guide says "Follow this project's state machine", points at the overview, and no longer carries the old sequence.
<!-- SECTION:NOTES:END -->
