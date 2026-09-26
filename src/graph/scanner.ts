import type { Dirent } from "node:fs";
import type { GraphKind } from "./store";

/**
 * Whitelist directory scanner (doc-014 §1.1, doc-15 "解析器注册").
 *
 * Only backlog/tasks, backlog/drafts, backlog/milestones, backlog/completed (phase 1) plus
 * backlog/wiki, backlog/docs, backlog/decisions (phase 3) are scanned. archive/ stays out of scope
 * and a recursive *.md glob over the whole backlog tree is forbidden: assets and binary
 * attachments would poison hashing.
 *
 * The knowledge directories are walked recursively because their pages live in subfolders
 * (sources/, concepts/, ...). Those subfolder names select the scan scope and nothing else: the
 * node type of a knowledge file comes from the top-level directory it belongs to, exactly like a
 * work file's does - it is never read from frontmatter and never inferred from a subfolder.
 */

export interface ScannedFile {
	/** Path relative to the backlog directory, e.g. "tasks/back-1 - Title.md". */
	relPath: string;
	absPath: string;
	/** The node type the whitelisted directory implies - the file's own declaration is not read. */
	kind: GraphKind;
	size: number;
	mtimeMs: number;
}

export interface WhitelistDirs {
	tasks: string;
	drafts: string;
	milestones: string;
	completed: string;
	wiki: string;
	docs: string;
	decisions: string;
}

export const DEFAULT_WHITELIST: WhitelistDirs = {
	tasks: "tasks",
	drafts: "drafts",
	milestones: "milestones",
	completed: "completed",
	wiki: "wiki",
	docs: "docs",
	decisions: "decisions",
};

/** Directories whose markdown is scanned recursively - knowledge pages live in subfolders. */
const RECURSIVE_DIRS = new Set<keyof WhitelistDirs>(["wiki", "docs", "decisions"]);

/**
 * The wiki's own navigation catalogue and append-only log are not knowledge pages and not graph
 * facts (doc-15 §1: `index.md` is a human index, not a source of relationships). They are left out
 * of the corpus entirely - no FileNode, no edges, no lint findings - which also keeps the log's
 * every wiki operation from re-triggering a rebuild.
 */
const IGNORED_KNOWLEDGE_FILES = new Set(["wiki/index.md", "wiki/log.md"]);

export function isIgnoredKnowledgeFile(relPath: string): boolean {
	return IGNORED_KNOWLEDGE_FILES.has(relPath);
}

/**
 * The node type a whitelisted directory implies. Work and knowledge directories are treated alike -
 * the directory *is* the declaration, and one top-level directory holds exactly one node type.
 * `wiki/output/` or `wiki/concepts/` are both wiki nodes: a subfolder never changes the type.
 */
function dirKind(dir: keyof WhitelistDirs): GraphKind {
	if (dir === "drafts") return "draft";
	if (dir === "milestones") return "milestone";
	if (dir === "wiki") return "wiki";
	if (dir === "decisions") return "decision";
	if (dir === "docs") return "document";
	return "task"; // tasks/ and completed/
}

interface MarkdownFile {
	absPath: string;
	/** Path relative to the scanned directory, always with forward slashes. */
	relFromDir: string;
}

async function listMarkdown(dir: string): Promise<MarkdownFile[]> {
	const { join } = await import("node:path");
	const { readdir } = await import("node:fs/promises");
	let names: string[] = [];
	try {
		names = await readdir(dir);
	} catch {
		return []; // directory may not exist in a fresh project
	}
	return names
		.sort()
		.filter((name) => name.endsWith(".md"))
		.map((name) => ({ absPath: join(dir, name), relFromDir: name }));
}

async function walkMarkdown(dir: string, prefix = ""): Promise<MarkdownFile[]> {
	const { join } = await import("node:path");
	const { readdir } = await import("node:fs/promises");
	let entries: Dirent[] = [];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const out: MarkdownFile[] = [];
	for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			out.push(...(await walkMarkdown(join(dir, entry.name), rel)));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			out.push({ absPath: join(dir, entry.name), relFromDir: rel });
		}
	}
	return out;
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
	const { stat } = await import("node:fs/promises");
	const scanned: ScannedFile[] = [];
	for (const dirName of Object.keys(DEFAULT_WHITELIST) as (keyof WhitelistDirs)[]) {
		const relDir = dirs[dirName].replace(/\\/g, "/");
		const absDir = join(projectRoot, "backlog", dirs[dirName]);
		const files = RECURSIVE_DIRS.has(dirName) ? await walkMarkdown(absDir) : await listMarkdown(absDir);
		for (const file of files) {
			const relPath = `${relDir}/${file.relFromDir}`;
			if (isIgnoredKnowledgeFile(relPath)) continue;
			const st = await stat(file.absPath);
			if (!st.isFile()) continue;
			scanned.push({
				relPath,
				absPath: file.absPath,
				kind: dirKind(dirName),
				size: st.size,
				mtimeMs: st.mtimeMs,
			});
		}
	}
	return scanned.sort((a, b) => a.relPath.localeCompare(b.relPath));
}
