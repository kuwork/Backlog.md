<h1 align="center">Backlog.md</h1>
<p align="center">:cn: <a href="./README.md">中文</a></p>
<p align="center">Markdown‑native Task Manager &amp; Kanban visualizer for any Git repository</p>

<p align="center">
<code>npm i -g @kuwork/backlog.md</code> or <code>bun add -g @kuwork/backlog.md</code> or <code>brew install backlog-md</code> (upstream) or <code>nix run github:MrLesk/Backlog.md</code> (upstream)
</p>

![Backlog demo GIF using: backlog board](./.github/backlog-v1.40.gif)


---

> **Backlog.md** turns any folder with a Git repo into a **self‑contained project board**
> powered by plain Markdown files and a zero‑config CLI.
> Built for **spec‑driven AI development** — structure your tasks so AI agents deliver predictable results.

## Features

* 📝 **Markdown-native tasks** -- manage every issue as a plain `.md` file

* 🤖 **AI-Ready** -- Works with Claude Code, Gemini CLI, Codex, Kiro & any other MCP or CLI compatible AI assistants

* 📊 **Instant terminal Kanban** -- `backlog board` paints a live board in your shell

* 🌐 **Modern web interface** -- `backlog browser` launches a sleek web UI for visual task management

* 🌍 **Multi-language UI** -- Web interface in English, Japanese, Simplified & Traditional Chinese. Switch instantly in Settings

* 🧠 **LLM Wiki Knowledge Base** -- AI-maintained pairing notebook with ingest, query, and lint

* 📄 **Rich-text paste & document upload** -- Paste from Word or web pages as Markdown, with .docx upload and auto image extraction

* 📅 **Tracking Gantt chart** -- Visual timeline based on `plannedStart` / `plannedEnd` / `actualStart` / `actualEnd` date fields, with planned vs. actual dual-layer comparison

* 🔍 **Powerful search** -- fuzzy search across tasks, docs & decisions with `backlog search`

* 📋 **Rich query commands** -- view, list, filter, or archive tasks with ease
* ✅ **Definition of Done defaults** -- add a reusable checklist to every new task

* 📤 **Board export** -- `backlog board export` creates shareable markdown reports

* 🔒 **100 % private & offline** -- backlog lives entirely inside your repo and you can manage everything locally

* 💻 **Cross-platform** -- runs on macOS, Linux, and Windows

* 🆓 **MIT-licensed & open-source** -- free for personal or commercial use


---

## 🧠 LLM Wiki Knowledge Base

Backlog.md includes an **LLM-managed Wiki** that turns every human–AI pairing session into reusable, compounding knowledge.

### Pairing Programming Flow

> Human drives strategy → AI breaks down tasks → Pair execution → Knowledge automatically crystallizes into Wiki

```
Brainstorm → doc → AI planning → tasks → pair execution → wiki
```

| Layer | Location | Content | Owner |
|-------|----------|---------|-------|
| **Planning** | `backlog/docs/` | Strategy, tech specs, requirements | Human-led, AI-assisted |
| **Execution** | `backlog/tasks/` | Tasks, acceptance criteria, notes | AI-created, human-reviewed |
| **Memory** | `backlog/wiki/` | Knowledge crystals, patterns, decisions | AI-maintained, human-reviewed |

### How to Use

The Wiki is fully maintained by the LLM—no manual file creation needed. Trigger it in conversation with these keywords:

| Trigger | Action |
|---------|--------|
| `build wiki` / `init wiki` | Initialize the Wiki directory structure and inject workflow guidelines |
| `ingest` / `process source` | Ingest backlog sources (tasks/docs/decisions) into the Wiki |
| `wiki query` | Query accumulated knowledge to answer questions or generate reports |
| `lint wiki` / `health check` | Scan for contradictions, orphan pages, and stale content |

The Wiki follows four principles: **informal, lightweight, AI-maintained, and challengeable**—it is not an enterprise knowledge base, but your "pairing notebook" with AI.

![Wiki as Pairing Memory](./backlog/assets/paste/Wiki-as-Pairing-Memory.png)

---

## <img src="./.github/5-minute-tour-256.png" alt="Getting started" width="28" height="28" align="center"> Getting started

```bash
# Install
bun i -g @kuwork/backlog.md
# or: npm i -g @kuwork/backlog.md
# or: brew install backlog-md

# Initialize in any Git repo
backlog init "My Awesome Project"

# Or initialize without Git for local/non-code projects
backlog init "Personal Planning" --no-git
```

The init wizard will ask how you want to connect AI tools:
- **CLI instructions** (recommended) — creates a short instruction file that tells agents to run `backlog instructions overview`.
- **MCP connector** — if you prefer MCP, auto-configures Claude Code, Codex, Gemini CLI, Kiro or Cursor.
- **Skip** — no AI setup; use Backlog.md purely as a task manager.

Backlog data is stored in a project-local backlog folder such as `backlog/`, `.backlog/`, or a custom project-relative path configured through `backlog.config.yml`. Tasks remain human-readable Markdown files (e.g. `task-10 - Add core search functionality.md`). Git is optional: `backlog init --no-git` creates a filesystem-only project and disables cross-branch checks, remote operations, and auto-commit.

---

### Working with AI agents

This is the recommended flow for Claude Code, Codex, Gemini CLI, Kiro and similar tools — following the **spec‑driven AI development** approach.
After running `backlog init`, agents should start by running `backlog instructions overview`, then work in this loop:

**Step 1 — Describe your idea.** Tell the agent what you want to build and ask it to split the work into small tasks with clear descriptions and acceptance criteria.

**🤖 Ask your AI Agent:**
> I want to add a search feature to the web view that searches tasks, docs, and decisions. Please decompose this into small Backlog.md tasks.

> [!NOTE]
> **Review checkpoint #1** — read the task descriptions and acceptance criteria.

**Step 2 — One task at a time.** Work on a single task per agent session, one PR per task. Good task splitting means each session can work independently without conflicts. Make sure each task is small enough to complete in a single conversation. You want to avoid running out of context window.

**Step 3 — Plan before coding.** Ask the agent to research and write an implementation plan in the task. Do this right before implementation so the plan reflects the current state of the codebase.

**🤖 Ask your AI Agent:**
> Work on BACK-10 only. Research the codebase and write an implementation plan in the task. Wait for my approval before coding.

> [!NOTE]
> **Review checkpoint #2** — read the plan. Does the approach make sense? Approve it or ask the agent to revise.

**Step 4 — Implement and verify.** Let the agent implement the task.

> [!NOTE]
> **Review checkpoint #3** — review the code, run tests, check linting, and verify the results match your expectations.

If the output is not good enough: clear the plan/notes/final summary, refine the task description and acceptance criteria, and run the task again in a fresh session.

---

### Working without AI agents

Use Backlog.md as a standalone task manager from the terminal or browser.

```bash
# Create and refine tasks
backlog task create "Render markdown as kanban"
backlog task edit BACK-1 -d "Detailed context" --ac "Clear acceptance criteria"

# Track work
backlog task list -s "To Do"
backlog task edit BACK-1 --comment "Can we split the UI work into a separate PR?" --comment-author @sara
backlog search "kanban"
backlog board

# Work visually in the browser
backlog browser
```

You can switch between AI-assisted and manual workflows at any time — both operate on the same Markdown task files. It is recommended to modify tasks via Backlog.md commands (CLI/MCP/Web) rather than editing task files manually, so field types and metadata stay consistent. Tasks can record project-root-relative modified files and later be found with `backlog search --modified-file src/path.ts --plain`. Use task comments for discussion and review notes; comment bodies may contain Markdown, but standalone `---` lines are reserved as comment delimiters. Use Implementation Notes for execution progress and Final Summary for PR-style completion notes.

**Learn more:** [CLI reference](CLI-INSTRUCTIONS.md) | [Advanced configuration](ADVANCED-CONFIG.md)

---

## <img src="./.github/web-interface-256.png" alt="Web Interface" width="28" height="28" align="center"> Web Interface

Launch a modern, responsive web interface for visual task management:

```bash
# Start the web server (opens browser automatically)
backlog browser

# Custom port
backlog browser --port 8080

# Don't open browser automatically
backlog browser --no-open
```

**Features:**
- Interactive Kanban board with drag-and-drop
- Task creation and editing with rich forms
- Interactive acceptance criteria editor with checklists
- Real-time updates across all views
- Responsive design for desktop and mobile
- Task archiving with confirmation dialogs
- Seamless CLI integration - all changes sync with markdown files

![Web Interface Screenshot](./.github/web.jpeg)

### Gantt Chart View

`backlog browser` includes a built-in Gantt chart view with five time granularities (day/week/month/quarter/year), implemented in pure React/CSS with zero external dependencies:

- **Planned time**: `plannedStart` / `plannedEnd` (`YYYY-MM-DD`) draws the planned border
- **Actual time**: `actualStart` / `actualEnd` (`YYYY-MM-DD HH:MM` UTC) auto-populates on status changes, drawn as status-colored solid bars
- **Tracking comparison**: Planned border and actual bar overlaid on the same row—delays and early starts visible at a glance
- **Dependency arrows**: SVG smart-connects task dependencies

Date fields can be set or cleared directly via CLI:

```bash
# Planned fields (Date-only)
backlog task edit BACK-10 --planned-start 2026-06-01 --planned-end 2026-06-07 --due-date 2026-06-10

# Actual fields (Date-time UTC), auto-populated on status change
backlog task edit BACK-10 --status "In Progress"  # actualStart auto-set to current time

# Clear any task date field
backlog task edit BACK-10 --clear-due-date --clear-planned-start --clear-planned-end --clear-actual-start --clear-actual-end

# Clear milestone date fields
backlog milestone edit "Release 1.0" --clear-due-date --clear-planned-start --clear-planned-end
```

![Gantt Chart View](./backlog/assets/paste/gantt.gif)

![Project Health](./backlog/assets/paste/0ca49969-1353-4303-820c-ea85df1cba65.png)

To keep the Web UI running as an auto-starting local service, see [Running Backlog.md as a Service](backlog/docs/doc-003%20-%20Running-Backlog-Browser-as-a-Service.md).

---

## 🔧 MCP Integration (Model Context Protocol)

CLI instructions are the default AI integration method. If you explicitly prefer an MCP connector, Backlog.md still supports AI coding assistants like Claude Code, Codex, Gemini CLI and Kiro.
You can run `backlog init` (even if you already initialized Backlog.md) and choose MCP integration, or follow the manual steps below.

### Client guides

<details>
  <summary><strong>Claude Code</strong></summary>

  ```bash
  claude mcp add backlog --scope user -- backlog mcp start
  ```

</details>

<details>
  <summary><strong>Codex</strong></summary>

  ```bash
  codex mcp add backlog -- backlog mcp start
  ```

</details>

<details>
  <summary><strong>Gemini CLI</strong></summary>

  ```bash
  gemini mcp add backlog -s user backlog mcp start
  ```

</details>

<details>
  <summary><strong>Kiro</strong></summary>

  ```bash
  kiro-cli mcp add --scope global --name backlog --command backlog --args mcp,start
  ```

</details>

Use the shared `backlog` server name everywhere – the MCP server auto-detects whether the current directory is initialized and falls back to `backlog://init-required` when needed.

### Manual config

```json
{
  "mcpServers": {
    "backlog": {
      "command": "backlog",
      "args": ["mcp", "start"],
      "env": {
        "BACKLOG_CWD": "/absolute/path/to/your/project"
      }
    }
  }
}
```

If your IDE can't set the process working directory for MCP servers, set `BACKLOG_CWD` as shown above.
If your IDE supports custom args but not env vars, you can also use `["mcp", "start", "--cwd", "/absolute/path/to/your/project"]`.

> [!IMPORTANT]
> When adding the MCP server manually, add a short instruction in your CLAUDE.md/AGENTS.md files telling the agent to read `backlog://workflow/overview`.
> This step is not required when using `backlog init` as it adds these instructions automatically.
> For CLI-based setups, use `backlog instructions overview` to fetch the current workflow guidance.


Once connected, agents can read the Backlog.md workflow instructions via `backlog://workflow/overview`, with detailed guides at `backlog://workflow/task-creation`, `backlog://workflow/task-execution`, and `backlog://workflow/task-finalization`.
Use `/mcp` command in your AI tool (Claude Code, Codex, Kiro) to verify if the connection is working.

---

## <img src="./.github/cli-reference-256.png" alt="CLI Reference" width="28" height="28" align="center"> CLI reference

Full command reference — task management, search, board, docs, decisions, and more: **[CLI-INSTRUCTIONS.md](CLI-INSTRUCTIONS.md)**

Quick examples: `backlog`, `backlog instructions`, `backlog task create`, `backlog task list`, `backlog task edit`, `backlog milestone add`, `backlog milestone edit`, `backlog milestone remove`, `backlog search`, `backlog board`, `backlog browser`.

Full help: `backlog --help`

---

## <img src="./.github/configuration-256.png" alt="Configuration" width="28" height="28" align="center"> Configuration

Backlog.md merges the following layers (highest → lowest):

1. CLI flags
2. Project config file:
   - `backlog.config.yml` when present
   - otherwise `backlog/config.yml` or `.backlog/config.yml`
3. Built‑ins

### Interactive wizard (`backlog config`)

Run `backlog config` with no arguments to launch the full interactive wizard. This is the same experience triggered from `backlog init` when you opt into advanced settings, and it walks through the complete configuration surface:
- Cross-branch accuracy: `checkActiveBranches`, `remoteOperations`, and `activeBranchDays`.
- Git workflow: `autoCommit` and `bypassGitHooks`.
- ID formatting: enable or size `zeroPaddedIds`.
- Editor integration: pick a `defaultEditor` with availability checks.
- Definition of Done defaults: interactively add/remove/reorder/clear project-level `definition_of_done` checklist items.
- Web UI defaults: choose `defaultPort` and whether `autoOpenBrowser` should run.

Skipping the wizard (answering "No" during init) applies the safe defaults that ship with Backlog.md:
- `checkActiveBranches=true`, `remoteOperations=true`, `activeBranchDays=30`.
- `autoCommit=false`, `bypassGitHooks=false`.
- `zeroPaddedIds` disabled.
- `defaultEditor` unset (falls back to your environment).
- `defaultPort=6420`, `autoOpenBrowser=true`.

For filesystem-only projects, run `backlog init --no-git`. Backlog.md will not run `git init`, and the saved config forces `checkActiveBranches=false`, `remoteOperations=false`, and `autoCommit=false` so CLI, Web, and MCP local-file workflows do not depend on a Git repository.

Whenever you revisit `backlog init` or rerun `backlog config`, the wizard pre-populates prompts with your current values so you can adjust only what changed.

### Definition of Done defaults

Set project-wide DoD items with `backlog config` (or during `backlog init` advanced setup), in the Web UI (Settings → Definition of Done Defaults), or by editing the project config file directly:

```yaml
definition_of_done:
  - Tests pass
  - Documentation updated
  - No regressions introduced
```

When a project uses root config discovery, edit `backlog.config.yml` instead of `backlog/config.yml`.

These items are added to every new task by default. You can add more on create with `--dod`, or disable defaults per task with `--no-dod-defaults`.

For the full configuration reference (all options, commands, and detailed notes), see **[ADVANCED-CONFIG.md](ADVANCED-CONFIG.md)**.

---

## 🌐 Community Tools

- **[vscode-backlog-md](https://marketplace.visualstudio.com/items?itemName=ysamlan.vscode-backlog-md)** - VS Code extension with issues panel, kanban view, and editing. ([ysamlan/vscode-backlog-md](https://github.com/ysamlan/vscode-backlog-md))

---

### License

Backlog.md is released under the **MIT License** – do anything, just give credit. See [LICENSE](LICENSE).
