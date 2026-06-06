---
id: BACK-514
title: Use available port for browser web UI
status: Done
assignee:
  - '@kimi'
created_date: '2026-06-06 01:40'
updated_date: '2026-06-06 07:56'
labels:
  - web-ui
  - enhancement
  - port
  - server
dependencies: []
priority: medium
actual_start: '2026-06-06 01:45'
actual_end: '2026-06-06 07:55'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The browser/web UI server currently binds directly to the configured/default port and exits with EADDRINUSE when another Backlog.md browser instance is already running. Add an `autoPort` configuration option (default `true`) so multiple browser instances can run concurrently by automatically selecting an available port starting from the requested/default port.

When `autoPort` is enabled (the default), the server resolves an available port before binding. The configured `defaultPort` remains the preferred starting port. If the preferred port is occupied, a temporary port is selected. Startup logs and browser opening must always use the actual bound port, distinguishing the default/preferred port from any temporary port that was chosen.

This task ports the upstream `get-port` based solution into this fork, adapted to respect the new `autoPort` behavior and config-driven default port.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `autoPort` configuration field exists in `BacklogConfig`, defaults to `true`, and is written into the config during `init`.
- [x] #2 Starting a second browser UI while the default port is occupied chooses a temporary port instead of crashing, but only when `autoPort` is enabled. The temporary port must be within the scanned 100-port range.
- [x] #3 When `autoPort` is disabled, the existing EADDRINUSE behavior is preserved (exit with error).
- [x] #4 Explicit `--port` and configured `defaultPort` are treated as the preferred starting port.
- [x] #5 Startup logs and browser opening use the actual bound port. When the bound port differs from the preferred port, log it as the "temporary port".
- [x] #6 Port selection scans the next 100 user ports (1024–65535) from the preferred port before falling back.
- [x] #7 Regression tests cover occupied requested/default ports with `autoPort: true`, and the disabled case with `autoPort: false`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `get-port` as a dependency.
   - `bun add get-port`
   - Verify `package.json`, `bun.lock`, and `bun.nix` are updated.

2. Add `autoPort` to the config system.
   - Add `autoPort?: boolean` to `BacklogConfig` in `src/types/index.ts`.
   - Add `autoPort: true` to `DEFAULT_INIT_CONFIG` in `src/constants/index.ts`.
   - Add `autoPort?: boolean` to `InitializeProjectOptions.advancedConfig` in `src/core/init.ts`.
   - In `initializeProject()`, merge `autoPort` into the generated config (preserve existing value on re-init, default to `true`).

3. Update `src/server/index.ts` to resolve an available port before binding.
   - Import `getPort` and `portNumbers` from `get-port`.
   - In `BacklogServer.start()`, read `autoPort` from the loaded config.
   - When `autoPort` is enabled (or undefined, treated as true):
     ```ts
     const preferredPort = port ?? config?.defaultPort ?? 6420;
     const portCandidates =
         preferredPort >= 1024 && preferredPort < 65535
             ? portNumbers(preferredPort, Math.min(preferredPort + 100, 65535))
             : preferredPort;
     const temporaryPort = await getPort({ port: portCandidates });
     ```
   - After `getPort` returns, verify `temporaryPort` falls within the candidate range (`preferredPort` to `preferredPort + 100`). If `getPort` fell back to an OS-assigned port outside that range because all 100 candidates were occupied, treat it as a failure—do not silently accept it.
   - Ensure `Bun.serve`, console logs, and `openBrowser` all use `temporaryPort`.
   - When the bound `temporaryPort` differs from `preferredPort`, log that a temporary port is being used.
   - When `autoPort` is explicitly `false`, skip `getPort` and bind directly to `preferredPort`, preserving the existing EADDRINUSE error handling.

4. Handle the case where all 100 candidate ports are occupied.
   - The `get-port` library falls back to an OS-assigned port when all supplied candidates are occupied. Detect this fallback and treat it as a startup failure—do not let the server bind to an unexpected port.
   - Print a clear terminal message explaining that the default port is occupied and the automatic port switch failed after scanning 100 ports, then exit with a non-zero code.
   - Example message:
     ```
     ❌ Error: Default port {preferredPort} is occupied, and automatic port switching failed.
        Scanned ports {preferredPort}-{preferredPort + 100}: all in use.
     💡 Suggestions:
        1. Free up port {preferredPort} or a port in the range {preferredPort}-{preferredPort + 100}
        2. Disable auto-port selection: backlog config set autoPort false
        3. Specify a different default port: backlog config set defaultPort <port>
     ```
   - Keep generic error handling for other startup failures.
   - When `autoPort` is disabled, the existing EADDRINUSE handler must remain intact.

5. Update settings UI to expose `autoPort`.
   - Add an `autoPort` toggle in `web/components/Settings.tsx` (or equivalent settings panel).
   - The toggle label/help text should inform the user: "When enabled, if the default port is occupied, the server will automatically try the next 100 available ports. If all are occupied, startup fails and reports that the default port is occupied and automatic switching failed."
   - Ensure the setting is persisted through the existing config update API.

6. Add regression coverage.
   - Create `src/test/server-port.test.ts` with tests for:
     - A second server binds to a temporary port when the requested port is occupied and `autoPort: true`.
     - Configured `defaultPort` is treated as the preferred starting port.
     - When `autoPort: false`, the server exits on EADDRINUSE as before.
   - Use `BacklogServer` with `openBrowser: false` in tests to avoid side effects.

7. Validate and regression-check.
   - `bunx tsc --noEmit`
   - `bun run check .`
   - `bun test src/test/server-port.test.ts`
   - `bun test` (full suite)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Config behavior:
- `autoPort` defaults to `true` in `DEFAULT_INIT_CONFIG` so all new projects get automatic port selection out of the box.
- Existing projects without `autoPort` in their config should also behave as if it is `true` (backward-compatible opt-out).
- When `autoPort` is `false`, the server binds directly to the preferred port and crashes on EADDRINUSE, matching pre-task behavior.

`get-port` behavior:
- When given a `portNumbers` iterable, it tests each candidate in order.
- If all candidates are occupied, the library falls back to its own OS-assigned port search.
- **Because the requirement is to fail with a clear message when all 100 ports are occupied, the implementation must verify the returned port is within the requested candidate range.** If `getPort` returns a port outside that range, treat it as a failure and exit with an explanatory error.
- This means `port: 0` is never needed; the preferred port range is always honored first, and falling back to an OS-assigned port is explicitly disallowed.

Port candidate logic:
- `portNumbers(preferredPort, Math.min(preferredPort + 100, 65535))` generates an ascending sequence.
- The `>= 1024` guard prevents scanning privileged ports if someone sets `defaultPort` below 1024.

Terminology:
- "Preferred port": the port explicitly requested via `--port` or configured via `defaultPort`.
- "Temporary port": the actual bound port when it differs from the preferred port.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented autoPort feature for dynamic port selection in web UI server.

Changes:
- Added get-port@7.2.0 dependency
- Extended BacklogConfig with autoPort field (default true)
- Updated BacklogServer.start() to scan next 100 ports when autoPort enabled
- Rejects OS-assigned fallback ports outside the scanned range
- Preserves EADDRINUSE crash behavior when autoPort is disabled
- Added autoPort toggle to Settings UI below Default Port input
- Added regression tests in src/test/server-port.test.ts (11 tests pass)
- Fixed config serialization/deserialization bugs for auto_port field
- Updated translations across en/zh-CN/zh-TW/ja locales
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->
