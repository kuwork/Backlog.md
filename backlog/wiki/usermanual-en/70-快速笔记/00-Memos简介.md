---
title: Memos Overview
labels: [usermanual]
created_date: 2026-10-03 01:14
updated_date: 2026-11-04 00:00
---

# Memos Overview

Memos (quick notes) are the fifth file entity in Backlog.md, designed for **one-off casual notes**: a meeting conclusion, a critical log snippet during debugging, or a fleeting idea. Previously anything worth remembering had to become a task or document—even a single-line meeting record had to fit the ID scheme, title, and paragraph structure. Memos make "write it down now, decide later" possible.

## Differences from Other Entities

| | Tasks / Drafts | Documents / Decisions | Memo |
|---|---|---|---|
| **Purpose** | Executable, trackable work items | Formal knowledge assets | Lightweight capture inbox |
| **ID** | `back-123` / `draft-3` | `doc-5` / `decision-3` | `20261003-1` (date + daily sequence) |
| **Title** | Required | Required | No title; derived from first body line |
| **Structural requirements** | Status, acceptance criteria, and other metadata | Type, directory organization | Body only + optional tags |

Memos are deliberately lightweight: no status flow, no milestones, no acceptance criteria, and they do not enter the dependency graph ([Graph View](../40-Web界面/11-图谱视图.md)). Their value lies in **outbound connections**—bare entity IDs and `[[wiki/path]]` written in the body automatically become links, turning casual notes into growable nodes of the knowledge network (see [Search & Knowledge Linking](03-搜索与知识互联.md)).

## Storage Format

All memos are saved under the `backlog/memos/` directory, one Markdown file per note:

```markdown
---
id: 20261003-1
created_date: 2026-10-03 01:14
updated_date: 2026-10-03 01:14
tags: [meeting]
---

Weekly meeting conclusion: v2 release delayed by one week; fix performance regressions first. Related task back-123.
```

- **ID rule**: `YYYYMMDD-N` format; `N` is the max existing memo sequence of the day + 1, resetting to `1` across days.
- **Frontmatter**: only `id`, `created_date`, `updated_date`, and optional `tags` (omitted when the tag list is empty); there is no `title` field.
- **Card title**: derived from the first non-empty line of the body; if the body starts with blank lines, falls back to the first 40 characters.
- **Temporary data**: `backlog/memos/` is treated as a temporary capture area and is deliberately not version-controlled by default (adjust `.gitignore` yourself if you want to keep them).

## Four Entry Points

The same storage is shared by four surfaces, with identical ID scheme and file format:

- **CLI**: `backlog memo create/list/view/update/delete`, the fastest terminal capture path. See [CLI Memo Commands](01-CLI备忘命令.md).
- **Web**: the `/memos` page stream for quick capture + calendar mode. See [Web Memo Page](02-Web备忘页面.md).
- **MCP**: `memo_create` / `memo_list` / `memo_view` / `memo_update` / `memo_delete` tool group, directly readable and writable by AI agents.
- **HTTP API**: `/api/memos*` routes (list, calendar counts, read/write by ID) for scripts and third-party tools.

In addition, memos are integrated into [Global Search](../40-Web界面/10-全局搜索.md); the CLI provides `backlog instructions memos` usage guide, and the MCP side provides the `backlog://workflow/memos` workflow resource.

## Usage Recommendations

- **Capture lightly**: one memo says one thing; write it and forget it, relying on search and links to find it later.
- **Use tags**: use `--tags` or inline `#tag` in the Web UI to create coarse-grained partitions of the inbox.
- **Write entity IDs**: casually include IDs like `back-123`, `doc-5` in the body; they automatically become links when rendered.
- **Digest regularly**: memos are an inbox, not a destination; important conclusions should be promoted to tasks or documents. This release does not provide an automatic promotion path; the bridging method is to reference the memo ID in a task body.
