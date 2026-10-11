#!/usr/bin/env bash
# Start the dev server with the kuzu graph backend (BACK-765 Cypher search).
# The kuzu native binding resolves its host by the process name node.exe on
# Windows and segfaults under any other name (kuzudb/kuzu#5672), so this runs
# a copy of bun renamed to node.exe. See DEVELOPMENT.md "Graph backend (kuzu)".
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHIM="$ROOT/tmp/kuzu-shim"
if [ ! -f "$SHIM/node.exe" ]; then
	mkdir -p "$SHIM"
	cp "$(command -v bun)" "$SHIM/node.exe"
fi
export BACKLOG_GRAPH_BACKEND=kuzu
exec "$SHIM/node.exe" "$ROOT/src/cli.ts" browser "$@"
