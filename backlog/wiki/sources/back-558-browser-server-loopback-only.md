---
title: BACK-558 Bind browser server to loopback only
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - server
  - security
source_path: backlog/tasks/back-558 - Bind-the-browser-server-to-loopback-only.md
---

# BACK-558 Bind browser server to loopback only

Changed the browser server default binding from `0.0.0.0` to `127.0.0.1` and added an explicit `--host` option for users who need LAN access.

## Summary

- Added `BROWSER_HOST = 127.0.0.1` in `src/server/index.ts` and extended `BacklogServer.start(port, openBrowser, host)` with a `host` parameter defaulting to loopback.
- Set `hostname: host` in `Bun.serve` `serveOptions`.
- Loopback bindings display and open the familiar `http://localhost:PORT` URL.
- Wildcard (`0.0.0.0`) binding prints concrete LAN IPv4 addresses (via `os.networkInterfaces`) and warns that the API is unauthenticated; the browser opens the first concrete LAN address.
- Added `--host <host>` to `backlog browser` in `src/cli.ts` (default `127.0.0.1`).
- Port availability probing stays on `get-port@7.2.0`; its probe already covers the wildcard interface.
- Updated README and CLI-INSTRUCTIONS with loopback-only default and `--host` opt-in.

## Acceptance Criteria

- Default binding is `127.0.0.1` with `http://localhost:PORT` display/open.
- `--host 0.0.0.0` allows LAN access with a warning and concrete LAN URLs.
- Tests cover default loopback, no-open, HTTP 200 on `127.0.0.1`, wildcard binding, and explicit non-loopback host.

## Related Concepts

- [[concepts/web-server]] — Web Server HTTP API and browser launch

## Related Sources

- [[sources/back-559-browser-launch-honor-browser-env]] — BROWSER environment variable launch
- [[sources/readme-md]] — README loopback documentation
- [[sources/cli-instructions-md]] — CLI reference loopback documentation
