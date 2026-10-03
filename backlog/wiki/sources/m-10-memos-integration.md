---
title: m-10 Memos Integration
created_date: '2026-10-03 01:25'
updated_date: '2026-10-03 01:25'
labels:
  - source
  - milestone
  - memos
source_path: backlog/milestones/m-10 - memos-integration.md
---

# m-10 Memos Integration

Milestone covering the Memos quick-capture feature line, executed 2026-10-01 in a single day (actual_start 10:14 → actual_end 2026-10-02 01:27). Its `documentation` field references the design doc doc-20.

## Summary

- Scope: bring Memos' "quick capture + calendar" into Backlog.md — a lightweight memo entity (`backlog/memos/*.md`) mirroring docs, wired into the existing file storage / HTTP API / search / markdown rendering pipelines, shipped as a single `/memos` page with linked Feed and Calendar modes
- Design doc of record: `backlog/docs/memos/doc-20 - 快速笔记：Memos-集成.md`
- Tasks: BACK-728 (storage layer) → BACK-729 (HTTP API) → BACK-730 (CLI subcommand) → BACK-731 (feed page) → BACK-732 (calendar mode) → BACK-733 (global search) → BACK-734 (knowledge web links) → BACK-735 (realtime sync) → BACK-736 (regression & acceptance pass) → BACK-737 (UI polish) → BACK-738 (card menu / modal background fix) → BACK-740 (MCP tools)

## Acceptance Criteria

- Not applicable (milestone record); the task chain above serves as completion definition.

## Related Concepts

- [[concepts/memos]] — the memo entity and its deliberate boundary against the ContentStore-heavy entity system

## Related Sources

- [[sources/doc-20-memos-integration]] — the design doc this milestone implements
- [[sources/back-728-memo-storage-layer]] — first task of the chain (core storage layer)
