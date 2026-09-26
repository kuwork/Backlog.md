---
title: doc-003 Running Backlog Browser as a Service
created_date: '2026-09-26 14:15'
updated_date: '2026-09-26 14:15'
labels:
  - source
  - web-ui
  - documentation
  - ops
source_path: backlog/docs/doc-003 - Running-Backlog-Browser-as-a-Service.md
---

# doc-003 Running Backlog Browser as a Service

Ops guide for running `backlog browser --no-open` as a long-lived per-project service that starts on boot and restarts on failure, with copy-paste recipes for systemd (Linux/WSL2), launchd (macOS), and Task Scheduler/NSSM (Windows).

## Summary

- Core command: `backlog browser --no-open` keeps the Web UI running without opening a browser tab
- Multi-project rule: each project needs its own service name and its own port (examples use `<project>` placeholder with ports 6420/6421)
- Linux: systemd **user** unit `backlog-browser-<project>.service` with `Restart=on-failure`; requires `loginctl enable-linger` to start at boot without a session; template units (`backlog-browser@.service` with `%i`) suggested for many projects
- macOS: launchd LaunchAgent plist with `RunAtLoad` + `KeepAlive`; Label must be unique per project; `/opt/homebrew/bin/backlog` vs `/usr/local/bin/backlog` per architecture
- Windows: Scheduled Task (`New-ScheduledTaskAction`, `-AtLogOn`) for login-time start, or NSSM wrap for a true pre-login background service with auto-restart
- Working directory must be the project root in every recipe; binary path should match `which backlog`

## Acceptance Criteria

- Not applicable (ops guide); each recipe is self-verifying via `systemctl --user status`, `launchctl load`, or `nssm start`.

## Related Concepts

- [[concepts/web-server]] — the browser server being daemonized
- [[concepts/auto-port]] — port assignment concerns behind the per-project-port rule

## Related Sources

- [[sources/web-server-task]] — the browser server feature this guide operationalizes
- [[sources/back-514-auto-port]] — automatic port selection relevant when running multiple projects
- [[sources/back-558-browser-server-loopback-only]] — loopback-only binding of the server being exposed as a service
