---
title: Cross-Compiling Backlog.md for ARM64 Linux
labels: [report, guide]
created_date: '2026-05-23 14:55'
updated_date: '2026-05-24 21:15'
---

# Cross-Compiling Backlog.md for ARM64 Linux

> Real-world deployment recipe extracted from the MensNetwork fork. Covers building an x86-64 development binary on one machine and running it on an ARM64 (aarch64) Linux server.

## The Problem

Bun's `--compile` flag produces a native binary for the **host architecture**. If you build on an x86-64 (AMD64) laptop and `scp` the result to an ARM64 server (e.g. Hetzner CAX21, AWS Graviton, Raspberry Pi 4/5), the binary will not execute:

```bash
$ ./backlog
-bash: ./backlog: cannot execute binary file: Exec format error
```

**You must cross-compile.** Bun supports this natively via `--target`.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Development machine | x86-64 Linux/macOS/Windows with Bun installed |
| Target machine | ARM64 (aarch64) Linux with systemd |
| Network access | `scp` and `ssh` between the two machines |
| Backlog.md source | Checked out and `bun install` completed |

---

## 1. Build the ARM64 Binary

On your **development machine** (x86-64):

```bash
# 1. Build/minify CSS assets first
bun run build:css

# 2. Extract version from package.json
VER=$(bun -e 'console.log(require("./package.json").version)')

# 3. Cross-compile for ARM64 Linux
bun build --production --compile --minify \
  --define __EMBEDDED_VERSION__="\"$VER\"" \
  --target=bun-linux-arm64 \
  --outfile=dist/backlog-arm64 \
  src/cli.ts
```

### What each flag does

| Flag | Purpose |
|------|---------|
| `--production` | Omits devDependencies from the bundle |
| `--compile` | Produces a single self-contained executable |
| `--minify` | Shrinks bundle size |
| `--define __EMBEDDED_VERSION__="..."` | Injects the version string so `backlog --version` reports correctly without reading `package.json` at runtime |
| `--target=bun-linux-arm64` | **Cross-compilation target** — the critical flag for ARM64 |
| `--outfile=dist/backlog-arm64` | Output path (name it however you like) |
| `src/cli.ts` | Entry point — same as `bun run build` |

### Verify the binary architecture

```bash
file dist/backlog-arm64
# Expected output:
# dist/backlog-arm64: ELF 64-bit LSB executable, ARM aarch64, version 1 (SYSV), statically linked, ...
```

---

## 2. Deploy to the ARM64 Server

```bash
# Copy to target machine
scp dist/backlog-arm64 <target-host>:/tmp/backlog-new

# Move into place, set permissions, and restart service
ssh <target-host> 'sudo mv /tmp/backlog-new /usr/local/bin/backlog && \
  sudo chmod 755 /usr/local/bin/backlog && \
  systemctl --user restart backlog-browser'
```

> If you do not use `sudo` for the binary location, adjust the path (e.g. `~/.local/bin/backlog`) and omit `sudo`.

---

## 3. Verify

```bash
# Check service status
ssh <target-host> 'systemctl --user status backlog-browser --no-pager | head -5'

# Check binary version
ssh <target-host> '/usr/local/bin/backlog --version'

# Confirm the web UI loads in a browser
open https://<your-domain>
```

---

## Systemd User Service Template

Create `~/.config/systemd/user/backlog-browser.service` on the **target ARM64 machine**:

```ini
[Unit]
Description=Backlog.md kanban browser
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/your/project
ExecStart=/usr/local/bin/backlog browser --port 3001 --no-open
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable --now backlog-browser
```

### Why `Restart=on-failure`?

Backlog.md's `bun build --compile` bundles the runtime, but if the process crashes (e.g. port conflict, file-system error), systemd will restart it automatically. Set to `Restart=no` during debugging if you want to see errors in `journalctl` without immediate restart loops.

---

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| Forgot `--target` | `Exec format error` on ARM64 | Always specify `--target=bun-linux-arm64` |
| Forgot `build:css` | Web UI loads but has no styles / looks broken | Run `bun run build:css` before `bun build` |
| Wrong `WorkingDirectory` | Tasks not found, empty board | Ensure `WorkingDirectory` points to a directory containing `backlog/config.yml` |
| Port already in use | `EADDRINUSE` crash on start | Change `--port` or kill the existing process |
| Missing `__EMBEDDED_VERSION__` | `--version` reports `unknown` or crashes | Include the `--define` flag in the build command |

---

## One-Shot Deploy Script

Save this as `deploy-arm64.sh` in your project root:

```bash
#!/usr/bin/env bash
set -euo pipefail

TARGET_HOST="${1:-}"  # pass host as first argument
if [[ -z "$TARGET_HOST" ]]; then
  echo "Usage: $0 <target-host>"
  exit 1
fi

echo "→ Building CSS..."
bun run build:css

echo "→ Cross-compiling for ARM64..."
VER=$(bun -e 'console.log(require("./package.json").version)')
bun build --production --compile --minify \
  --define __EMBEDDED_VERSION__="\"$VER\"" \
  --target=bun-linux-arm64 \
  --outfile=dist/backlog-arm64 \
  src/cli.ts

echo "→ Deploying to $TARGET_HOST..."
scp dist/backlog-arm64 "$TARGET_HOST":/tmp/backlog-new
ssh "$TARGET_HOST" 'sudo mv /tmp/backlog-new /usr/local/bin/backlog && \
  sudo chmod 755 /usr/local/bin/backlog && \
  systemctl --user restart backlog-browser'

echo "→ Verifying..."
ssh "$TARGET_HOST" 'systemctl --user status backlog-browser --no-pager | head -5'

echo "✅ Done"
```

Usage:

```bash
chmod +x deploy-arm64.sh
./deploy-arm64.sh my-arm64-server
```

---

## Source

This guide was extracted from the [MensNetwork/backlog.md](https://github.com/MensNetwork/backlog.md) fork, which runs Backlog.md in production on a Hetzner CAX21 ARM64 instance behind Caddy + Google OAuth.
