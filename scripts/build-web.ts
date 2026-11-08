/**
 * Builds the browser UI (`src/web/index.html` and everything it imports) into an output directory.
 *
 * Two callers:
 *  - `bun run web:build` - a developer rebuilding the bundle by hand; no argument means the cache
 *    slot the server would use for the current sources.
 *  - the Web server (`src/server/web-bundle.ts`), which spawns this script so a rebuild never
 *    blocks the request path. Building in-process costs ~2 minutes here and starves the event
 *    loop, which is why the bundle is cached on disk and produced out-of-process.
 */
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { BunPlugin } from "bun";
import tailwind from "bun-plugin-tailwind";
import { computeWebFingerprint, defaultBundleDir, resolveWebSourceDir } from "../src/server/web-bundle.ts";

const explicitDir = process.argv[2];
let targetDir = explicitDir;
if (!targetDir) {
	const webDir = resolveWebSourceDir();
	if (!webDir) {
		console.error("cannot locate src/web; pass an output directory explicitly");
		process.exit(1);
	}
	targetDir = defaultBundleDir(computeWebFingerprint(webDir));
}
// Without an explicit target this is a swap over a cache slot, so build beside it and rename. With
// an explicit target the caller owns the directory (the server passes its own temporary path).
const outputDir = explicitDir ? targetDir : `${targetDir}.building`;
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

// Pulled in through the docx-editor chain: its Node entry needs `readable-stream`, its browser entry
// is self-contained. Mirrors scripts/build.ts.
const jszipBrowserPlugin: BunPlugin = {
	name: "jszip-browser-dist",
	setup(build) {
		build.onResolve({ filter: /^jszip$/ }, () => ({
			path: join(process.cwd(), "node_modules", "jszip", "dist", "jszip.min.js"),
		}));
	},
};

const startedAt = performance.now();
const result = await Bun.build({
	entrypoints: ["src/web/index.html"],
	outdir: outputDir,
	target: "browser",
	minify: true,
	define: { "process.env.NODE_ENV": JSON.stringify("production") },
	plugins: [tailwind, jszipBrowserPlugin],
	throw: false,
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	await rm(outputDir, { recursive: true, force: true });
	process.exit(1);
}

const totalBytes = result.outputs.reduce((sum, output) => sum + output.size, 0);
if (explicitDir) {
	console.log(`web bundle built in ${Math.round(performance.now() - startedAt)}ms (${result.outputs.length} files)`);
} else {
	await rm(targetDir, { recursive: true, force: true });
	await rename(outputDir, targetDir);
	console.log(
		`web bundle built in ${Math.round(performance.now() - startedAt)}ms (${result.outputs.length} files) into ${targetDir}`,
	);
}
if (totalBytes === 0) process.exitCode = 1;
