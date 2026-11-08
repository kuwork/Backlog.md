import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { backlogCacheDir } from "../utils/cache-dir.ts";
import { isCacheDisabled } from "../utils/cache-policy.ts";
import { logError, logLine } from "../utils/log.ts";

/**
 * Disk cache for the built browser UI.
 *
 * `Bun.serve` builds an imported HTML entry lazily, on the first request that needs it. In this
 * project that build takes ~2 minutes (24 MB of JS from mermaid/echarts/Univer/pdf.js/docx/pptx),
 * and it runs on the server's own thread: while it runs, every pending startup continuation -
 * corpus loading, wiki/document listing, the terminal log - is stalled. That is what made the page
 * look like a 2 minute hang even after the caches made the corpus load take ~2s.
 *
 * So: build once into a cache directory keyed by a fingerprint of the UI sources, serve the files
 * statically from then on, and rebuild in a child process when the sources change. The child
 * process keeps the server responsive (and its logs flowing) during the rebuild; the shell is
 * served from the last good bundle in the meantime.
 */

const CACHE_VERSION = 2;
const BUNDLE_SUBDIR = "web-bundle";
const INDEX_FILE = "index.html";

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".wasm": "application/wasm",
	".txt": "text/plain; charset=utf-8",
	".pdf": "application/pdf",
};

export type WebBundleState = "ready" | "building" | "failed";

/**
 * A compiled executable embeds the UI bundle at build time (`scripts/build.ts`), so it never needs
 * this cache and has no sources to fingerprint.
 */
export function isCompiledRuntime(): boolean {
	return Array.isArray(Bun.embeddedFiles) && Bun.embeddedFiles.length > 0;
}

function resolveCacheBase(): string {
	return backlogCacheDir(BUNDLE_SUBDIR);
}

/** Where the build for a given fingerprint lives; also the default output of `bun run web:build`. */
export function defaultBundleDir(fingerprint: string): string {
	return join(resolveCacheBase(), fingerprint);
}

/** `src/web` next to this module, or null when running from a compiled binary. */
export function resolveWebSourceDir(): string | null {
	const projectRoot = resolve(import.meta.dir, "..", "..");
	const webDir = join(projectRoot, "src", "web");
	return existsSync(webDir) ? webDir : null;
}

function listFiles(dir: string, baseDir = dir, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) listFiles(full, baseDir, out);
		else if (entry.isFile()) out.push(relative(baseDir, full).replaceAll(sep, "/"));
	}
	return out.sort();
}

/**
 * Content signature, not a timestamp: a touch, a checkout or an editor rewriting identical bytes
 * must not cost a two-minute rebuild, and a real edit must invalidate even when the size is equal.
 */
function signatureOf(path: string): string {
	try {
		const bytes = readFileSync(path);
		return `${bytes.length}:${Bun.hash(bytes).toString(16)}`;
	} catch {
		return "missing";
	}
}

/**
 * Fingerprint of everything the bundle is built from: the UI sources plus the dependency manifest.
 * Cheap on purpose - sizes and timestamps of ~190 files, no file reads.
 */
export function computeWebFingerprint(webDir: string, projectRoot = resolve(webDir, "..", "..")): string {
	// Only the dependency set matters from package.json: editing a script or a description must not
	// throw away a two-minute build. The Bun version is deliberately absent: `bun run` executes
	// through node_modules/bun while `bun src/cli.ts` uses the globally installed binary, and those
	// report different versions - including it would split the cache between the two, and a cached
	// JS/CSS bundle stays valid across a runtime upgrade anyway.
	const parts = [`v${CACHE_VERSION}`];
	try {
		const manifest = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")) as Record<string, unknown>;
		const relevant = {
			dependencies: manifest.dependencies ?? null,
			devDependencies: manifest.devDependencies ?? null,
			peerDependencies: manifest.peerDependencies ?? null,
			optionalDependencies: manifest.optionalDependencies ?? null,
			overrides: manifest.overrides ?? null,
			resolutions: manifest.resolutions ?? null,
		};
		parts.push(`deps:${JSON.stringify(relevant)}`);
	} catch {
		parts.push("deps:missing");
	}
	for (const lockfile of ["bun.lock", "bun.lockb"]) {
		const signature = signatureOf(join(projectRoot, lockfile));
		if (signature !== "missing") parts.push(`${lockfile}:${signature}`);
	}
	for (const relativePath of listFiles(webDir)) {
		parts.push(`${relativePath}:${signatureOf(join(webDir, relativePath))}`);
	}
	return Bun.hash(parts.join("\n")).toString(16);
}

export class WebBundle {
	constructor(readonly dir: string) {}

	get indexPath(): string {
		return join(this.dir, INDEX_FILE);
	}

	readIndexHtml(): string | null {
		try {
			return readFileSync(this.indexPath, "utf8");
		} catch {
			return null;
		}
	}

	/** Resolve a URL path to a file inside the bundle, or null when it is not a bundle asset. */
	resolveAsset(pathname: string): string | null {
		let decoded: string;
		try {
			decoded = decodeURIComponent(pathname);
		} catch {
			return null;
		}
		if (decoded.includes("\0")) return null;
		const target = resolve(join(this.dir, decoded));
		const rel = relative(this.dir, target);
		if (!rel || rel.startsWith("..") || rel.includes(`..${sep}`)) return null;
		try {
			if (!statSync(target).isFile()) return null;
		} catch {
			return null;
		}
		return target;
	}

	contentTypeFor(filePath: string): string {
		const dot = filePath.lastIndexOf(".");
		return (dot >= 0 ? CONTENT_TYPES[filePath.slice(dot).toLowerCase()] : undefined) ?? "application/octet-stream";
	}
}

export type WebBundleProviderOptions = {
	/** Build output directory for a fingerprint; defaults to the cache root. */
	buildRoot?: string;
	/** Runs the build; defaults to `scripts/build-web.ts` in a child process. */
	build?: (outDir: string) => Promise<boolean>;
	/** Fingerprint override, for tests. */
	fingerprint?: string;
};

/**
 * Owns the on-disk bundle: resolves the cached build for the current sources, and rebuilds it in the
 * background when it is missing or stale while the previous bundle keeps being served.
 */
export class WebBundleProvider {
	readonly fingerprint: string;
	private bundle: WebBundle | null = null;
	private building: Promise<void> | null = null;
	private stateValue: WebBundleState = "building";

	private constructor(
		readonly webDir: string,
		readonly cacheRoot: string,
		fingerprint: string,
	) {
		this.fingerprint = fingerprint;
	}

	/** Null when the UI is embedded (compiled binary) or the sources are not on disk. */
	static create(options: WebBundleProviderOptions = {}): WebBundleProvider | null {
		if (isCompiledRuntime()) return null;
		const webDir = resolveWebSourceDir();
		if (!webDir) return null;
		const cacheRoot = options.buildRoot ?? resolveCacheBase();
		const fingerprint = options.fingerprint ?? computeWebFingerprint(webDir);
		return new WebBundleProvider(webDir, cacheRoot, fingerprint);
	}

	get state(): WebBundleState {
		return this.stateValue;
	}

	get isReady(): boolean {
		return this.bundle !== null;
	}

	get bundleDir(): string {
		return join(this.cacheRoot, this.fingerprint);
	}

	/** Serve the cached bundle when its fingerprint matches; otherwise start a background rebuild. */
	async initialize(build?: (outDir: string) => Promise<boolean>): Promise<void> {
		const disabled = isCacheDisabled();
		const cached = disabled ? null : this.adoptCached();
		if (cached) {
			logLine("web", `bundle cache hit @ ${this.fingerprint} (${this.countFiles(cached)} files)`);
			return;
		}
		if (disabled) logLine("web", "bundle cache skipped: rebuilding because caching is disabled");
		// A stale bundle is still a working UI: keep serving it while the new one is produced.
		const stale = this.adoptLatestStale();
		if (stale) {
			logLine("web", `bundle ${disabled ? "ignored" : "outdated"}, serving the previous build while rebuilding`);
		}
		await this.startBuild(build);
	}

	private adoptCached(): WebBundle | null {
		const bundle = new WebBundle(this.bundleDir);
		if (!bundle.readIndexHtml()) return null;
		this.bundle = bundle;
		this.stateValue = "ready";
		return bundle;
	}

	private adoptLatestStale(): WebBundle | null {
		if (!existsSync(this.cacheRoot)) return null;
		let best: { dir: string; mtimeMs: number } | null = null;
		for (const entry of readdirSync(this.cacheRoot, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const dir = join(this.cacheRoot, entry.name);
			try {
				const mtimeMs = statSync(join(dir, INDEX_FILE)).mtimeMs;
				if (!best || mtimeMs > best.mtimeMs) best = { dir, mtimeMs };
			} catch {
				// not a completed bundle
			}
		}
		if (!best) return null;
		const bundle = new WebBundle(best.dir);
		if (!bundle.readIndexHtml()) return null;
		this.bundle = bundle;
		return bundle;
	}

	/**
	 * Each slot holds ~24MB, so keep the current build plus the newest other one (the fallback used
	 * while a rebuild runs) and drop the rest.
	 */
	private pruneOldBundles(): void {
		if (!existsSync(this.cacheRoot)) return;
		const keep = new Set([this.bundleDir]);
		let newestOther: { dir: string; mtimeMs: number } | null = null;
		const stale: string[] = [];
		for (const entry of readdirSync(this.cacheRoot, { withFileTypes: true })) {
			const dir = join(this.cacheRoot, entry.name);
			if (!entry.isDirectory() || keep.has(dir)) continue;
			if (entry.name.endsWith(".building")) {
				stale.push(dir);
				continue;
			}
			try {
				const mtimeMs = statSync(join(dir, INDEX_FILE)).mtimeMs;
				if (!newestOther || mtimeMs > newestOther.mtimeMs) {
					if (newestOther) stale.push(newestOther.dir);
					newestOther = { dir, mtimeMs };
				} else {
					stale.push(dir);
				}
			} catch {
				stale.push(dir);
			}
		}
		for (const dir of stale) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				// A slot another instance is serving stays until it exits; nothing to do here.
			}
		}
	}

	/** Build the current sources if they are not cached yet. Concurrent callers share one build. */
	async ensureBuilt(build?: (outDir: string) => Promise<boolean>): Promise<void> {
		if (this.stateValue === "ready" && this.bundle?.dir === this.bundleDir) return;
		if (this.building) return this.building;
		return this.startBuild(build);
	}

	private async startBuild(build?: (outDir: string) => Promise<boolean>): Promise<void> {
		if (this.building) return this.building;
		const run = build ?? ((outDir: string) => runBuildProcess(outDir));
		this.stateValue = "building";
		const promise = (async () => {
			const target = this.bundleDir;
			const tempDir = `${target}.building`;
			logLine("web", `building UI bundle from sources (${this.fingerprint})`);
			const startedAt = performance.now();
			let ok = false;
			try {
				rmSync(tempDir, { recursive: true, force: true });
				ok = await run(tempDir);
			} catch (error) {
				logError("web", "UI bundle build failed:", error);
			}
			if (!ok || !existsSync(join(tempDir, INDEX_FILE))) {
				rmSync(tempDir, { recursive: true, force: true });
				this.stateValue = this.bundle ? "ready" : "failed";
				if (!this.bundle) logLine("web", "UI bundle unavailable: the page cannot be served from this source tree");
				return;
			}
			rmSync(target, { recursive: true, force: true });
			renameSync(tempDir, target);
			this.bundle = new WebBundle(target);
			this.stateValue = "ready";
			logLine("web", `bundle built in ${Math.round(performance.now() - startedAt)}ms`);
			this.pruneOldBundles();
		})().finally(() => {
			this.building = null;
		});
		this.building = promise;
		return promise;
	}

	private countFiles(bundle: WebBundle): number {
		try {
			return listFiles(bundle.dir).length;
		} catch {
			return 0;
		}
	}

	get indexHtml(): string | null {
		return this.bundle?.readIndexHtml() ?? null;
	}

	resolveAsset(pathname: string): string | null {
		return this.bundle?.resolveAsset(pathname) ?? null;
	}

	contentTypeFor(filePath: string): string {
		return this.bundle?.contentTypeFor(filePath) ?? "application/octet-stream";
	}
}

/**
 * Served while there is no bundle to serve yet. Self-refreshing on purpose: the build runs in a
 * child process, so this page can show progress instead of a blank tab.
 */
export const WEB_BUILDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Backlog.md - preparing the UI</title>
<meta http-equiv="refresh" content="2">
<style>
	:root { color-scheme: light dark; }
	body {
		margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
		font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
		background: Canvas; color: CanvasText;
	}
	main { max-width: 32rem; padding: 2rem; text-align: center; line-height: 1.6; }
	h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.75rem; }
	p { margin: 0; opacity: 0.75; font-size: 0.9rem; }
	code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; }
</style>
</head>
<body>
<main>
	<h1>Building the web UI bundle</h1>
	<p>This is the first start for these UI sources, so the browser bundle is being compiled in the
	background. It takes about two minutes; the page reloads itself, and the terminal shows the build
	progress. The next start reuses the cached bundle and is instant. Rebuild by hand with
	<code>bun run web:build</code>.</p>
</main>
</body>
</html>`;

async function runBuildProcess(outDir: string): Promise<boolean> {
	const projectRoot = resolve(import.meta.dir, "..", "..");
	const script = join(projectRoot, "scripts", "build-web.ts");
	if (!existsSync(script)) return false;
	try {
		const child = Bun.spawn({
			cmd: [process.execPath, script, outDir],
			cwd: projectRoot,
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		for (const line of `${stdout}\n${stderr}`.split("\n")) {
			if (line.trim()) logLine("web", line.trim());
		}
		return exitCode === 0;
	} catch (error) {
		logError("web", "could not spawn the UI bundle build:", error);
		return false;
	}
}
