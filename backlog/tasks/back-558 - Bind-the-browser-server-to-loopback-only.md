---
id: BACK-558
title: Bind the browser server to loopback only
status: Done
assignee:
  - '@dsv4flash'
created_date: '2026-07-30 17:39'
updated_date: '2026-08-15 07:06'
labels:
  - server
dependencies: []
references:
  - src/server/index.ts
  - src/cli.ts
  - src/test/server-hostname.test.ts
priority: high
actual_start: '2026-08-16 06:30'
actual_end: '2026-08-15 06:38'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The local browser server previously omitted Bun hostname configuration, binding the unauthenticated read/write API to all network interfaces (0.0.0.0) while displaying a localhost URL. Bind it to 127.0.0.1 by default so only the local machine can reach it, keep displaying/opening the familiar http://localhost:PORT URL, and add an explicit --host option so users who understand the risk can opt into LAN access. On a wildcard binding, print the concrete LAN IPv4 addresses instead of the unreachable 0.0.0.0 and warn that the API is unauthenticated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Review upstream changes using git log --oneline v1.48.0..v1.49.3 --grep BACK-560 and git show fef6e76 as implementation reference.
- [x] #2 backlog browser binds to 127.0.0.1 by default and displays/opens the http://localhost:PORT URL, keeping the loopback-only default.
- [x] #3 Port availability probing stays on get-port@7.2.0 (its probe already covers the wildcard interface, so no macOS false-free regression).
- [x] #4 The --host option lets users explicitly bind a non-loopback interface (e.g. --host 0.0.0.0) to allow LAN access, with a warning that the API is unauthenticated.
- [x] #5 With --host 0.0.0.0, startup output shows the concrete LAN IPv4 addresses (http://IP:PORT) instead of the unreachable 0.0.0.0, and the browser opens the first concrete LAN address.
- [x] #6 CLI help and README/CLI-INSTRUCTIONS describe the loopback-only default and the --host opt-in for LAN access.
- [x] #7 Tests cover default loopback binding with localhost URL, no-open behavior, real HTTP 200 on 127.0.0.1, wildcard binding with concrete LAN URL and warning, and an explicitly given non-loopback host.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define BROWSER_HOST = 127.0.0.1 in src/server/index.ts; extend BacklogServer.start(port, openBrowser, host) with a host parameter defaulting to BROWSER_HOST.
2. Set hostname: host in the Bun.serve serveOptions (previously only port: bindPort, around :407-408).
3. URL/display logic: loopback host (127.0.0.1/localhost/::1) shows and opens http://localhost:PORT; wildcard (0.0.0.0/::) resolves concrete LAN IPv4 addresses via node:os networkInterfaces, shows http://IP:PORT lines and opens the first one; an explicit non-loopback IP is shown and opened directly. Print a warning that the API is unauthenticated on any non-loopback binding.
4. Add --host <host> to the browser command in src/cli.ts (default 127.0.0.1; use 0.0.0.0 to allow LAN access) and pass it to server.start.
5. Keep port probing on get-port@7.2.0 (its probe covers the wildcard interface, no macOS false-free regression; do not migrate the upstream isPortAvailable change).
6. Update README and CLI-INSTRUCTIONS with the loopback-only default and the --host opt-in.
7. Add regression tests in src/test/server-hostname.test.ts: default loopback binding with localhost URL, no-open behavior, HTTP 200 on 127.0.0.1, wildcard binding with concrete LAN URL and warning, explicit non-loopback host.
8. Run bunx tsc --noEmit, bun run check, focused server/CLI tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented.

Changes:
- src/server/index.ts adds BROWSER_HOST constant and a host parameter on start(); serveOptions gets hostname: host.
- URL/display logic distinguishes loopback (localhost URL), wildcard (concrete LAN IPs via networkInterfaces, warning), and explicit host.
- src/cli.ts browser command gains --host (default 127.0.0.1) and an updated description.
- README and CLI-INSTRUCTIONS document the loopback-only default and the --host opt-in.
- Port probing intentionally left on get-port@7.2.0 (no macOS false-free regression).

Tests:
- src/test/server-hostname.test.ts: 5 tests (default loopback + localhost URL, no-open, HTTP 200 on 127.0.0.1, --host 0.0.0.0 with concrete LAN URL + warning, explicit LAN IP) — 5 pass.
- src/test/server-port.test.ts: 6 pass (no regression).
- bunx tsc --noEmit pass; biome check pass.

Windows Defender Firewall (LAN reachability, not a code issue):
- Added inbound allow rules: bun.exe on Private; TCP 6420 on Private/Public.
- Live check returned HTTP 200 via the machine's LAN IP while 0.0.0.0:6420 was LISTENING.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bound the browser server to 127.0.0.1 by default with the familiar http://localhost:PORT display/opening, added an explicit --host option (e.g. --host 0.0.0.0) to opt into LAN access, and made wildcard bindings print concrete LAN IPv4 addresses with an unauthenticated-API warning. Updated CLI help and docs.

Verified by 5 new loopback/host tests, the existing server-port suite, typecheck, and biome. Also added Windows firewall inbound rules (bun.exe Private, TCP 6420 Private/Public) and confirmed live LAN access via the machine's LAN IP.
<!-- SECTION:FINAL_SUMMARY:END -->
