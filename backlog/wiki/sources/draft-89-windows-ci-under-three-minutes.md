---
title: draft-89 Bring Windows CI tests below three minutes
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - draft
  - ci
  - testing
source_path: backlog/drafts/draft-89 - Bring-Windows-CI-tests-below-three-minutes.md
---

# draft-89 Bring Windows CI tests below three minutes

Reduced Windows CI wall-clock from ~16 minutes to under three minutes by splitting OS responsibilities and tightening test execution architecture.

## Summary

- Ubuntu runs the full behavioral suite; Windows and macOS run an explicit 37-file / 373-test platform-contract profile.
- Profile covers filesystem/path/locking, real Git/worktrees, shipped CLI/process/editor boundaries, MCP stdio, network lifecycle, and Unicode.
- Mechanisms: prebuilt CLI bundle (`BACKLOG_TEST_CLI_BUNDLE`), filesystem-only fixtures by default, explicit Git boundaries only where needed, single `test-preload.ts` for Git identity, `withTimeout`/`observeChildClose` helpers, `listenOnEphemeralPort`/`closeServer` test utilities, `Bun.which` for editor discovery, and bounded profile concurrency.
- Removed exact duplicate coverage (`implementation-notes-append.test.ts` was a subset of `append-implementation-notes.test.ts`).
- Replaced nested signal/ENOEXEC process fixtures with pure architecture-signal classification tests and retained one real installed-binary launcher integration test.

## Results

- GitHub Actions run 30842619172: Windows platform-contract tests in **2m17s**, Windows compile/smoke in **1m19s**, Ubuntu full suite in **2m57s**, macOS contracts in **35s**.

## Related Concepts

- [[entities/backlog-cli]] — CLI tool and test architecture
- [[concepts/mcp-server]] — MCP stdio testing

## Related Sources

- [[sources/back-562-stable-json-output]] — One of the contract-profile-covered areas
