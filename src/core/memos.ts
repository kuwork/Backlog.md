import { mkdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { DEFAULT_DIRECTORIES } from "../constants/index.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../markdown/frontmatter.ts";

/**
 * Lightweight, file-backed storage for memos: throwaway notes that must not be forced into the
 * task or document shapes (no title, no section structure, no doc-NNN id).
 *
 * This module is the single owner of the memo file format and does all of its own IO against
 * `backlog/memos/<id>.md`. It deliberately stays out of the ContentStore snapshot machinery, so the
 * HTTP/CLI/UI layers are free to consume it without dragging memos into the task+wiki graph.
 */

export interface Memo {
	/** Date + per-day sequence, e.g. `20261001-1` */
	id: string;
	/** `YYYY-MM-DD HH:mm` */
	createdDate: string;
	updatedDate?: string;
	tags: string[];
	/** Derived from the first non-empty body line, else the first 40 characters of the body */
	displayTitle: string;
	/** Body without frontmatter */
	rawContent: string;
	path: string;
}

export interface MemoPageOptions {
	limit?: number;
	/** id of the last memo of the previous page */
	cursor?: string;
	/** `YYYY-MM-DD` — when set, only memos created on that date are returned */
	date?: string;
	/** when set, only memos carrying at least one of these tags (case-insensitive) are returned */
	tags?: string[];
}

export interface MemoPage {
	items: Memo[];
	nextCursor: string | null;
}

export const MEMO_PAGE_SIZE = 30;

/** Absolute path of the memo directory for a project root. */
export function memoDir(root: string): string {
	return join(root, DEFAULT_DIRECTORIES.BACKLOG, DEFAULT_DIRECTORIES.MEMOS);
}

function nowStamp(): string {
	return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function dateStamp(): string {
	return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/** Mirror of `FileSystem.ensureDirectoryExists`: a missing dir is fine, other failures are swallowed. */
async function ensureDir(dir: string): Promise<void> {
	try {
		await mkdir(dir, { recursive: true });
	} catch (_error) {
		// Directory creation failed, ignore
	}
}

/** Files are LF-only on disk; a single trailing newline is the whole contract. */
function normalizeBody(content: string): string {
	const body = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "");
	return body ? `${body}\n` : "";
}

function deriveDisplayTitle(body: string): string {
	const firstLine = (body.split("\n")[0] ?? "").trim();
	if (firstLine) return firstLine;
	// No usable heading line (body starts blank): fall back to a short preview of the whole body.
	return body.trim().slice(0, 40);
}

/** A project that never captured a memo has no memo directory at all; listing it must stay empty. */
async function directoryExists(dir: string): Promise<boolean> {
	try {
		return (await stat(dir)).isDirectory();
	} catch (_error) {
		return false;
	}
}

async function listMemoFiles(root: string): Promise<string[]> {
	const dir = memoDir(root);
	if (!(await directoryExists(dir))) return [];
	const files: string[] = [];
	for await (const file of new Bun.Glob("**/*.md").scan({ cwd: dir, followSymlinks: true })) {
		files.push(join(dir, file));
	}
	return files.sort();
}

async function toMemo(file: string): Promise<Memo> {
	const raw = await Bun.file(file).text();
	const { data, content } = parseFrontmatter(raw);
	const body = content.replace(/\n+$/, "");
	return {
		id: String(data.id ?? ""),
		createdDate: String(data.created_date ?? ""),
		updatedDate: data.updated_date ? String(data.updated_date) : undefined,
		tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
		displayTitle: deriveDisplayTitle(body),
		rawContent: body,
		path: file,
	};
}

/**
 * `YYYYMMDD-N` where N is the highest sequence already used today plus one. A new day restarts at 1.
 */
export async function nextMemoId(root: string): Promise<string> {
	const today = dateStamp();
	const files = await listMemoFiles(root);
	const prefix = `${today}-`;
	let max = 0;
	for (const file of files) {
		const base = basename(file, ".md");
		if (!base.startsWith(prefix)) continue;
		const seq = Number.parseInt(base.slice(prefix.length), 10);
		if (Number.isFinite(seq) && seq > max) max = seq;
	}
	return `${prefix}${max + 1}`;
}

/** All memos, newest first (`createdDate` desc, `id` desc as a stable tiebreaker). Files without a usable id are corrupt leftovers and skipped. */
export async function listMemos(root: string): Promise<Memo[]> {
	const memos = await Promise.all((await listMemoFiles(root)).map(toMemo));
	return sortMemos(memos.filter((memo) => memo.id.length > 0));
}

function sortMemos(memos: Memo[]): Memo[] {
	return memos.sort((a, b) => b.createdDate.localeCompare(a.createdDate) || b.id.localeCompare(a.id));
}

/**
 * Cursor pagination over the newest-first memo list. `cursor` is the id of the last memo of the
 * previous page; `nextCursor` is null once the end of the (optionally filtered) set is reached.
 */
export async function listMemosPage(root: string, options: MemoPageOptions = {}): Promise<MemoPage> {
	let all = await listMemos(root);
	if (options.date) {
		all = all.filter((memo) => memo.createdDate.slice(0, 10) === options.date);
	}
	if (options.tags && options.tags.length > 0) {
		const wanted = new Set(options.tags.map((tag) => tag.toLowerCase()));
		all = all.filter((memo) => memo.tags.some((tag) => wanted.has(tag.toLowerCase())));
	}
	const limit = options.limit ?? MEMO_PAGE_SIZE;
	const start = options.cursor ? all.findIndex((memo) => memo.id === options.cursor) + 1 : 0;
	const items = all.slice(start, start + limit);
	const last = items[items.length - 1];
	const nextCursor = last && start + limit < all.length ? last.id : null;
	return { items, nextCursor };
}

/** Read a single memo by id, or null when no such file exists. */
export async function getMemo(root: string, id: string): Promise<Memo | null> {
	const file = join(memoDir(root), `${id}.md`);
	if (!(await Bun.file(file).exists())) return null;
	return toMemo(file);
}

/** Create a memo: allocates the next id, writes `backlog/memos/<id>.md` with LF endings. */
export async function createMemo(root: string, content: string, tags: string[] = []): Promise<Memo> {
	const dir = memoDir(root);
	await ensureDir(dir);
	const id = await nextMemoId(root);
	const now = nowStamp();
	const frontmatter: Record<string, unknown> = {
		id,
		created_date: now,
		updated_date: now,
		...(tags.length > 0 && { tags }),
	};
	const file = join(dir, `${id}.md`);
	await Bun.write(file, stringifyFrontmatter(normalizeBody(content), frontmatter));
	return toMemo(file);
}

/** Replace body and/or tags, bumping `updatedDate` while preserving `id` and `createdDate`. */
export async function updateMemo(
	root: string,
	id: string,
	patch: { content?: string; tags?: string[] },
): Promise<Memo | null> {
	const file = join(memoDir(root), `${id}.md`);
	if (!(await Bun.file(file).exists())) return null;
	const current = await toMemo(file);
	const body = patch.content === undefined ? current.rawContent : normalizeBody(patch.content);
	const tags = patch.tags ?? current.tags;
	const frontmatter: Record<string, unknown> = {
		id: current.id,
		created_date: current.createdDate,
		updated_date: nowStamp(),
		...(tags.length > 0 && { tags }),
	};
	await Bun.write(file, stringifyFrontmatter(body, frontmatter));
	return toMemo(file);
}

/** Remove the memo file. */
export async function deleteMemo(root: string, id: string): Promise<boolean> {
	const file = join(memoDir(root), `${id}.md`);
	if (!(await Bun.file(file).exists())) return false;
	await Bun.file(file).delete();
	return true;
}
