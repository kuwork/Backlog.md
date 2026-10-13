/**
 * Project-wide DuckDB discovery (mirrors doc-16 §2.1, §2.5; sqlite/discover.ts).
 *
 * Reuses the same walk that backs project search - same excluded directories, same dot-directory
 * rule - and caches the result, because a page with ten blocks should not mean ten full walks.
 */

import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { isScanSkippedDir } from "../utils/project-scan.ts";
import { isDuckdbFileName } from "./paths.ts";

export interface DuckdbFileEntry {
	/** Project-relative path, the same shape a block's `source` takes. */
	path: string;
	size: number;
	mtime: string;
}

const CACHE_TTL_MS = 30_000;

/** A runaway walk (a huge monorepo, a bind mount) stops here rather than scanning forever. */
const MAX_VISITED_FILES = 50_000;

const cache = new Map<string, { at: number; entries: DuckdbFileEntry[] }>();

async function walk(
	root: string,
	dir: string,
	relativeDir: string,
	out: DuckdbFileEntry[],
	budget: { left: number },
): Promise<void> {
	if (budget.left <= 0) return;
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return; // an unreadable directory is not a reason to fail discovery
	}
	for (const entry of entries) {
		if (budget.left <= 0) return;
		const entryRelative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			if (isScanSkippedDir(entry.name)) continue;
			await walk(root, `${dir}/${entry.name}`, entryRelative, out, budget);
			continue;
		}
		if (!entry.isFile()) continue;
		budget.left -= 1;
		if (!isDuckdbFileName(entry.name)) continue;
		try {
			const stats = await stat(`${dir}/${entry.name}`);
			out.push({ path: entryRelative, size: stats.size, mtime: stats.mtime.toISOString() });
		} catch {
			/* a file that disappears mid-walk is simply not listed */
		}
	}
}

export async function listDuckdbFiles(projectRoot: string, now = Date.now()): Promise<DuckdbFileEntry[]> {
	const root = resolve(projectRoot);
	const cached = cache.get(root);
	if (cached && now - cached.at < CACHE_TTL_MS) return cached.entries;

	const entries: DuckdbFileEntry[] = [];
	await walk(root, root, "", entries, { left: MAX_VISITED_FILES });
	entries.sort((a, b) => a.path.localeCompare(b.path));
	cache.set(root, { at: now, entries });
	return entries;
}

/** Tests only: forget cached walks. */
export function clearDuckdbDiscoveryCache(): void {
	cache.clear();
}
