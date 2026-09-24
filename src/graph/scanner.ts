import type { GraphKind } from "./store";

/**
 * Whitelist directory scanner (doc-014 §1.1).
 *
 * Only backlog/tasks, backlog/drafts, backlog/milestones and backlog/completed are scanned.
 * archive/ is explicitly out of scope and a recursive *.md glob over the whole backlog tree is
 * forbidden: assets and binary attachments would poison hashing.
 */

export interface ScannedFile {
	/** Path relative to the backlog directory, e.g. "tasks/back-1 - Title.md". */
	relPath: string;
	absPath: string;
	kind: GraphKind;
	size: number;
	mtimeMs: number;
}

export interface WhitelistDirs {
	tasks: string;
	drafts: string;
	milestones: string;
	completed: string;
}

export const DEFAULT_WHITELIST: WhitelistDirs = {
	tasks: "tasks",
	drafts: "drafts",
	milestones: "milestones",
	completed: "completed",
};

function kindForDir(dir: keyof WhitelistDirs): GraphKind {
	if (dir === "drafts") return "draft";
	if (dir === "milestones") return "milestone";
	return "task";
}

/**
 * Stat-only scan of the whitelisted directories - file contents are never read here. The cold
 * start fast path compares size+mtime against the cached hashes before deciding to read anything.
 */
export async function scanWhitelistedDirs(
	projectRoot: string,
	dirs: WhitelistDirs = DEFAULT_WHITELIST,
): Promise<ScannedFile[]> {
	const { join } = await import("node:path");
	const { readdir, stat } = await import("node:fs/promises");
	const scanned: ScannedFile[] = [];
	for (const dirName of Object.keys(DEFAULT_WHITELIST) as (keyof WhitelistDirs)[]) {
		const absDir = join(projectRoot, "backlog", dirs[dirName]);
		let names: string[] = [];
		try {
			names = await readdir(absDir);
		} catch {
			continue; // directory may not exist in a fresh project
		}
		for (const file of names.sort()) {
			if (!file.endsWith(".md")) continue;
			const absPath = join(absDir, file);
			const st = await stat(absPath);
			if (!st.isFile()) continue;
			scanned.push({
				relPath: `${dirs[dirName].replace(/\\/g, "/")}/${file}`,
				absPath,
				kind: kindForDir(dirName),
				size: st.size,
				mtimeMs: st.mtimeMs,
			});
		}
	}
	return scanned.sort((a, b) => a.relPath.localeCompare(b.relPath));
}
