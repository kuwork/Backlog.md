import { statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { backlogCacheDir } from "../utils/cache-dir.ts";
import { isCacheDisabled } from "../utils/cache-policy.ts";
import { logLine } from "../utils/log.ts";

/**
 * Stat-signature cache for the content collections (documents, decisions, wiki pages).
 *
 * Tasks got this first: a file whose size and timestamps are unchanged is served from the last
 * parse instead of being read again. The wiki is the reason it matters here - 700+ markdown pages
 * are read and parsed on every boot, which is ~700ms of the startup, while checking timestamps for
 * the same set costs ~40ms. The cache is a per-collection JSON file under the same cache root the
 * task snapshot uses.
 */

const CACHE_VERSION = 1;

export type ContentSignature = {
	size: number;
	mtimeMs: number;
	ctimeMs: number;
};

type StoredEntry<T> = ContentSignature & { v: T };

type StoredFile<T> = {
	version: number;
	entries: Record<string, StoredEntry<T>>;
};

/** Signature of a file, or null when it cannot be stat'ed (deleted, permission denied, ...). */
export function contentSignature(filePath: string): ContentSignature | null {
	try {
		const stats = statSync(filePath);
		if (!stats.isFile()) return null;
		return { size: stats.size, mtimeMs: math(stats.mtimeMs), ctimeMs: math(stats.ctimeMs) };
	} catch {
		return null;
	}
}

function math(value: number): number {
	return Math.round(value);
}

export function contentCacheFilePath(projectRoot: string, name: string): string {
	const rootHash = Bun.hash(resolve(projectRoot)).toString(16);
	return backlogCacheDir("content-cache", `${rootHash}-${name}.json`);
}

function sameSignature(entry: StoredEntry<unknown>, signature: ContentSignature): boolean {
	return entry.size === signature.size && entry.mtimeMs === signature.mtimeMs && entry.ctimeMs === signature.ctimeMs;
}

/**
 * One collection's cache. Callers enumerate their files as usual, then ask `reuse()` before
 * reading; anything read or dropped marks the cache dirty and is rewritten once at the end.
 */
export class ContentCache<T> {
	private entries = new Map<string, StoredEntry<T>>();
	private loaded = false;
	private dirty = false;
	private hits = 0;
	private reads = 0;

	constructor(
		readonly name: string,
		readonly filePath: string,
	) {}

	async load(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		if (isCacheDisabled()) return;
		try {
			const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as StoredFile<T>;
			if (parsed?.version !== CACHE_VERSION || typeof parsed.entries !== "object") return;
			for (const [key, entry] of Object.entries(parsed.entries)) {
				if (entry && typeof entry === "object") this.entries.set(key, entry);
			}
		} catch {
			// Missing or corrupt cache: fall back to reading the files.
		}
	}

	/** The remembered value for `key` when the file still matches its signature. */
	reuse(key: string, signature: ContentSignature | null): T | null {
		if (!signature || isCacheDisabled()) return null;
		const entry = this.entries.get(key);
		if (!entry || !sameSignature(entry, signature)) return null;
		this.hits += 1;
		return entry.v;
	}

	remember(key: string, signature: ContentSignature | null, value: T): void {
		if (!signature) return;
		this.entries.set(key, { ...signature, v: value });
		this.reads += 1;
		this.dirty = true;
	}

	/** Drop every entry the last scan did not see, so deleted files stop coming back. */
	retainOnly(seen: ReadonlySet<string>): void {
		for (const key of [...this.entries.keys()]) {
			if (seen.has(key)) continue;
			this.entries.delete(key);
			this.dirty = true;
		}
	}

	/** Rewrite the snapshot when the scan changed something. */
	async flush(): Promise<void> {
		const total = this.hits + this.reads;
		if (total > 0) {
			logLine("cache", `content ${this.name} files: ${this.hits} from cache, ${this.reads} read (${total} files)`);
		}
		if (!this.dirty) return;
		this.dirty = false;
		const payload: StoredFile<T> = { version: CACHE_VERSION, entries: Object.fromEntries(this.entries) };
		try {
			await mkdir(dirname(this.filePath), { recursive: true });
			const tmp = `${this.filePath}.tmp`;
			await writeFile(tmp, JSON.stringify(payload), "utf8");
			await rename(tmp, this.filePath);
		} catch {
			// Best-effort cache; never let cache I/O fail a listing.
		}
	}
}
