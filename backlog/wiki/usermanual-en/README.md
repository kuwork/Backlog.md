---
title: Backlog.md User Manual
labels: [usermanual]
created_date: 2026-05-07 00:00
updated_date: 2026-11-03 00:00
---

# Backlog.md User Manual

**A Markdown-native task and kanban visualization tool**

---

Backlog.md turns any Git repository directory into a self-contained project board. Every task is a standalone Markdown file, 100% offline and private, with no internet connection required.

## Core Features

- **Markdown-native**: all data is stored as `.md` files, Git-friendly
- **AI-Ready**: supports Claude Code, Gemini CLI, Codex, Kiro, Cursor, and other AI assistants
- **Dual-mode interface**: terminal TUI board + modern Web browser interface
- **Rich-text paste**: paste from Word or Google Docs as Markdown, with `.docx` file upload support
- **Dates & planning**: tasks and milestones support `dueDate`, `plannedStart`, and `plannedEnd`; board cards show planning windows and overdue highlights in real time
- **Project health**: four dimensions—due, overdue, stale, and blocked—unified in the Web statistics page and the CLI `overview` command
- **Wiki knowledge base**: LLM-maintained incremental knowledge base, human-readable and editable; browser supports file-tree navigation, in-place editing, labels, and live sync; built-in skill installable to Claude/Codex
- **Task graph**: knowledge graph of task relationships with Cypher queries (CLI `backlog graph` and MCP graph tools) and Web visualization; default RyuGraph WASM backend with zero native dependencies
- **Office document preview**: preview `.docx` / `.pdf` / `.pptx` / `.xlsx` documents in-app; Word and Excel support editing and write-back to source files; unsupported formats show a conversion hint
- **Live SQL query blocks**: embed `sqlite-query` / `duckdb-query` / `mdb-query` fenced blocks in documents; Web reading view renders read-only live query results (SQLite / DuckDB / Access, 500-row limit) with in-place editing
- **Chart blocks**: draw flowcharts and data charts with `mermaid` / `echarts` fenced blocks; ECharts covers all built-in series and follows light/dark themes; query results can feed charts directly, or reference named query blocks via `fromQuery`
- **Quick notes (Memos)**: lightweight capture inbox under `backlog/memos/`; terminal / Web / MCP / search share the same storage; entity IDs and `[[wikilink]]` automatically connect to the knowledge web
- **Cross-platform**: macOS, Linux, Windows

## Two Usage Paths

1. **MCP spec-driven (recommended)**: AI agents manage tasks directly through the MCP protocol, no manual commands needed
2. **Manual CLI mode**: users operate tasks, boards, and documents through terminal commands

## Installation

```bash
npm i -g @kuwork/backlog.md
```

Other installation options:
- `bun add -g @kuwork/backlog.md`
- `brew install backlog-md` (upstream formula)
- `nix run github:MrLesk/Backlog.md` (upstream flake)

## Quick Start

```bash
# Initialize a project
backlog init my-project

# Create a task
backlog task create "Implement user login"

# View the TUI board
backlog board

# Start the Web interface
backlog browser
```

---

This manual covers the complete guide from basic installation to advanced AI integration.

## Related Concepts

- [Product Overview](00-快速开始/00-产品概述.md) — Backlog.md core positioning and feature overview
- [Installation & Initialization](00-快速开始/01-安装与初始化.md) — install methods and project initialization steps
- [AI Integration Setup](00-快速开始/02-AI集成设置.md) — AI integration configuration and workflow
