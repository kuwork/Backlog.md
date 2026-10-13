---
id: m-14
title: Graph MCP
created_date: '2026-10-13 05:54'
updated_date: '2026-10-13 07:56'
actual_start: '2026-10-13 06:11'
actual_end: '2026-10-13 07:56'
---
## Description

Expose the CLI's `graph` subcommands to AI agents as MCP tools (query / schema / list_databases / describe_database / create_database / import_csv). The tools mirror the CLI's one-shot model — open, prepare, run, close — instead of holding a long-lived GraphService, so MCP startup never triggers a full corpus rebuild.
