---
title: BACK-559 Honor BROWSER for devcontainer browser launch
created_date: '2026-08-17 23:00'
updated_date: '2026-08-17 23:00'
labels:
  - source
  - cli
  - server
  - browser
source_path: backlog/tasks/back-559 - Honor-BROWSER-for-devcontainer-browser-launch.md
---

# BACK-559 Honor BROWSER for devcontainer browser launch

When opening the Web UI, a non-empty `BROWSER` environment variable is now honored as the executable path, useful in devcontainer scenarios.

## Summary

- Added `src/utils/browser-launch.ts` with `resolveBrowserLaunchCommand(url, env, platform)` and `launchBrowser(url)`.
- `BROWSER` is treated as a single executable path: trimmed, wrapping quotes stripped, never split or shell-evaluated; the URL is passed as a separate argument.
- When `BROWSER` is unset or empty, platform fallbacks are used: `open` on macOS, `cmd /c start` on Windows, `xdg-open` otherwise.
- Replaced the two inline browser-opening implementations in `src/cli.ts` and `src/server/index.ts` with calls to `launchBrowser(url)`, preserving the fork's try/catch and manual-open guidance.
- Removed the now-unused `import { $ } from "bun"` from both files.

## Implementation Notes

`env` and `platform` are injectable for unit tests. Tests cover BROWSER override, whitespace trim, quote stripping, no split/shell evaluation, empty/whitespace/quoted-empty fallback, and all three platform fallbacks.

## Related Concepts

- [[concepts/web-server]] — Web Server and browser launch
- [[concepts/cli-entry]] — CLI command surface

## Related Sources

- [[sources/back-558-browser-server-loopback-only]] — Browser server loopback binding
