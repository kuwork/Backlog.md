/**
 * Source resolution and the four fail-closed gates (doc-16 §2.2-§2.4).
 *
 * The gates no longer decide *which* databases are interesting - the whole project is fair game -
 * their only job is to pin access inside the project directory. Everything past that last gate is
 * readable by design; read-only-ness is query.ts's problem, not this file's.
 */

import { closeSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { isScanSkippedDir } from "../utils/project-scan.ts";

export const SQLITE_EXTENSIONS = [".sqlite", ".sqlite3", ".db"] as const;

/** The 16-byte header every SQLite database file starts with. */
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "latin1");

export interface SqliteSourceRequest {
	projectRoot: string;
	/** The `source:` value exactly as written in the block: always a project-relative path. */
	source: string;
}

export type SqliteSourceResult = { ok: true; path: string } | { ok: false; error: string };

function fail(error: string): SqliteSourceResult {
	return { ok: false, error };
}

export function isSqliteFileName(name: string): boolean {
	const lower = name.toLowerCase();
	return SQLITE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** True when the file starts with the SQLite header - cheaper than letting the engine guess. */
export function hasSqliteMagic(path: string): boolean {
	let fd = -1;
	try {
		fd = openSync(path, "r");
		const buffer = Buffer.alloc(SQLITE_MAGIC.length);
		const read = readSync(fd, buffer, 0, buffer.length, 0);
		return read === SQLITE_MAGIC.length && buffer.equals(SQLITE_MAGIC);
	} catch {
		return false;
	} finally {
		if (fd >= 0) closeSync(fd);
	}
}

/**
 * Reject anything that is not a plain relative path: absolute, drive-letter, UNC, scheme, `~`.
 *
 * A leading `/` is an absolute path as far as node is concerned (`isAbsolute("/x")` is true on
 * Windows too), and the project's own rule for client-supplied paths is "relative or refused"
 * (wiki/developer-notes/security-gotchas.md §1), so there is no `/`-means-project-root syntax
 * here: a source is always written relative to the project root, `backlog/databases/shop.sqlite`.
 */
function isNonRelativeSource(source: string): boolean {
	if (isAbsolute(source)) return true;
	if (/^[A-Za-z]:/.test(source)) return true;
	if (source.startsWith("\\\\")) return true;
	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(source)) return true;
	return source.startsWith("~");
}

function segmentsInsideProject(projectRoot: string, target: string): string[] | null {
	const rel = relative(projectRoot, target);
	if (rel.length === 0 || rel.startsWith("..") || isAbsolute(rel)) return null;
	return rel.split(/[\\/]/);
}

/**
 * True when `target` sits strictly inside `projectRoot`.
 *
 * The CSV export re-checks its own write target through this before touching disk (BACK-776), so
 * there is exactly one containment rule in the module rather than two that can drift apart.
 */
export function isInsideProjectRoot(projectRoot: string, target: string): boolean {
	return segmentsInsideProject(projectRoot, target) !== null;
}

export function resolveSqliteSource(request: SqliteSourceRequest): SqliteSourceResult {
	const source = request.source.trim();
	if (source.length === 0) return fail("source 不能为空。");
	if (source.startsWith("/")) {
		return fail("source 不接受前导 /：请写项目相对路径，如 backlog/databases/shop.sqlite。");
	}
	if (isNonRelativeSource(source)) {
		return fail("source 必须是项目内的相对路径，不接受绝对路径、盘符、UNC、URL 或 ~。");
	}

	// The root itself goes through realpath too. On Windows a project can be handed over as an 8.3
	// short path while a file's realpath is the long one, and comparing those two directly makes
	// every in-project file look like it escaped.
	let projectRoot: string;
	try {
		projectRoot = realpathSync(resolve(request.projectRoot));
	} catch {
		projectRoot = resolve(request.projectRoot);
	}
	// One meaning only: relative to the project root. No document-relative variant, because two
	// readings of the same string is exactly how a containment check gets reasoned about past.
	const target = resolve(projectRoot, source);

	// Gate 2: no escape above the project root.
	const segments = segmentsInsideProject(projectRoot, target);
	if (!segments) return fail(`source 指向项目目录之外：${source}`);

	// Gate 2b: the same directories a project walk skips are off limits here too.
	for (const segment of segments) {
		if (isScanSkippedDir(segment)) return fail(`source 位于被忽略的目录内（${segment}）：${source}`);
	}

	// Gate 3: extension whitelist.
	if (!isSqliteFileName(target)) {
		return fail(`只支持 ${SQLITE_EXTENSIONS.join(" / ")} 文件：${source}`);
	}

	let stats: ReturnType<typeof statSync>;
	try {
		stats = statSync(target);
	} catch {
		return fail(`找不到数据库文件：${source}`);
	}
	if (!stats.isFile()) return fail(`source 不是文件：${source}`);

	// Gate 2c: symlinks are resolved before the containment check, so one cannot point outside.
	let real: string;
	try {
		real = realpathSync(target);
	} catch {
		return fail(`无法解析数据库路径：${source}`);
	}
	const realSegments = segmentsInsideProject(projectRoot, real);
	if (!realSegments) return fail(`source 指向项目目录之外（符号链接）：${source}`);

	// Gate 4: not actually a SQLite database.
	if (!hasSqliteMagic(real)) return fail(`不是 SQLite 数据库文件：${source}`);

	return { ok: true, path: real };
}
