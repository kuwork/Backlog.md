#!/usr/bin/env node
"use strict";

/**
 * Post-install patch for `ryugraph-wasm` (the WebAssembly build of RyuGraph, used as the
 * Bun/Windows-compatible Cypher backend - see src/graph/store.ts).
 *
 * Problem: the published `sync/index.js` builds the kuzu/ryu `SystemConfig` with plain JS numbers
 * for its int64 fields and reads `maxDBSize` from a default `SystemConfig` whose getter returns
 * `undefined` under Bun's Emscripten embind. Bun (unlike Node) rejects non-BigInt values for int64
 * parameters with `Invalid argument type in ToBigInt operation`, so `new Database(...)` throws before
 * any Cypher can run. Node accepts numbers, so the patch is a no-op there semantically.
 *
 * Fix: pass `BigInt(...)` for the three int64 fields and an explicit `maxDBSize` literal.
 *
 * This script is idempotent and safe to run on every install: it no-ops when the marker is already
 * present, and warns (without failing the install) if the upstream block moved.
 */

const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "node_modules", "ryugraph-wasm", "sync", "index.js");
const MARKER = "4611686018427387904n";

const ORIGINAL = `        const defaultSystemConfig = new ryu.SystemConfig();
        const systemConfig = new ryu.SystemConfig(
          bufferPoolSize,
          maxNumThreads,
          !!enableCompression,
          !!readOnly,
          defaultSystemConfig.maxDBSize,
          !!autoCheckpoint,
          checkpointThreshold
        );
        defaultSystemConfig.delete();`;

const PATCHED = `        // Bun's Emscripten embind requires int64 parameters to be BigInt (Node accepts number).
        // The published default also reads maxDBSize from a SystemConfig whose getter returns
        // undefined under Bun, so we pass an explicit BigInt literal here.
        const systemConfig = new ryu.SystemConfig(
          BigInt(bufferPoolSize),
          BigInt(maxNumThreads),
          !!enableCompression,
          !!readOnly,
          4611686018427387904n,
          !!autoCheckpoint,
          BigInt(checkpointThreshold)
        );`;

function main() {
	if (!fs.existsSync(target)) {
		// ryugraph-wasm not installed in this environment - nothing to do.
		return;
	}
	const src = fs.readFileSync(target, "utf8");
	if (src.includes(MARKER)) return; // already patched
	if (!src.includes(ORIGINAL)) {
		console.warn(
			"[patch-ryugraph] Could not locate the SystemConfig block to patch; skipping. " +
				"The ryugraph-wasm version may have changed - revisit src/graph/store.ts's RyuGraphStore.",
		);
		return;
	}
	fs.writeFileSync(target, src.replace(ORIGINAL, PATCHED), "utf8");
	console.log("[patch-ryugraph] Applied Bun/BigInt compatibility patch to ryugraph-wasm/sync/index.js");
}

main();
