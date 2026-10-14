/**
 * Source resolution and the four fail-closed gates for DuckDB (mirrors doc-16 §2.2-§2.4; sqlite/paths.ts).
 *
 * The containment logic is identical to the SQLite variant and is shared from there; only the
 * extension whitelist and the file-magic check differ, because a DuckDB file looks nothing like a
 * SQLite one.
 */

import { closeSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isNonRelativeSource, segmentsInsideProject } from "../sqlite/paths.ts";
import { isScanSkippedDir } from "../utils/project-scan.ts";

/**
 * The whitelist of source files a `duckdb-query` block may open. `.duckdb` is a real database that
 * is attached read-only; `.csv` / `.xlsx` are data files opened on an in-memory instance via the
 * engine's replacement scan (doc-25 §11). CSV needs no extension; xlsx uses the official `excel`
 * extension, which the engine autoloads on first use.
 */
export const DUCKDB_EXTENSIONS = [".duckdb", ".csv", ".xlsx"] as const;

/** What kind of source a resolved path is - decides how `runDuckdbQuery` opens it. */
export type DuckdbSourceKind = "database" | "data-file";

/** Maps a file name to its source kind, or `null` when it is outside the whitelist. */
export function duckdbSourceKind(name: string): DuckdbSourceKind | null {
	const lower = name.toLowerCase();
	if (lower.endsWith(".duckdb")) return "database";
	if (lower.endsWith(".csv") || lower.endsWith(".xlsx")) return "data-file";
	return null;
}

/**
 * DuckDB's on-disk magic: the literal bytes `DUCK`, sitting at byte offset 8 (the first eight bytes
 * are a version/checksum header). Verified empirically against a freshly created `.duckdb` file.
 */
const DUCKDB_MAGIC = Buffer.from("DUCK", "latin1");
const DUCKDB_MAGIC_OFFSET = 8;

export interface DuckdbSourceRequest {
	projectRoot: string;
	/** The `source:` value exactly as written in the block: always a project-relative path. */
	source: string;
}

export type DuckdbSourceResult = { ok: true; path: string; kind: DuckdbSourceKind } | { ok: false; error: string };

function fail(error: string): DuckdbSourceResult {
	return { ok: false, error };
}

export function isDuckdbFileName(name: string): boolean {
	return duckdbSourceKind(name) !== null;
}

/** True when the file starts with the DuckDB header at offset 8 - cheaper than letting the engine guess. */
export function hasDuckdbMagic(path: string): boolean {
	let fd = -1;
	try {
		fd = openSync(path, "r");
		const buffer = Buffer.alloc(DUCKDB_MAGIC.length);
		const read = readSync(fd, buffer, 0, buffer.length, DUCKDB_MAGIC_OFFSET);
		return read === DUCKDB_MAGIC.length && buffer.equals(DUCKDB_MAGIC);
	} catch {
		return false;
	} finally {
		if (fd >= 0) closeSync(fd);
	}
}

export function resolveDuckdbSource(request: DuckdbSourceRequest): DuckdbSourceResult {
	const source = request.source.trim();
	if (source.length === 0) return fail("source 不能为空。");
	if (source.startsWith("/")) {
		return fail("source 不接受前导 /：请写项目相对路径，如 backlog/databases/shop.duckdb。");
	}
	if (isNonRelativeSource(source)) {
		return fail("source 必须是项目内的相对路径，不接受绝对路径、盘符、UNC、URL 或 ~。");
	}

	// The root itself goes through realpath too, so an 8.3 / symlink mismatch cannot fake an escape.
	let projectRoot: string;
	try {
		projectRoot = realpathSync(resolve(request.projectRoot));
	} catch {
		projectRoot = resolve(request.projectRoot);
	}
	const target = resolve(projectRoot, source);

	// Gate 2: no escape above the project root.
	const segments = segmentsInsideProject(projectRoot, target);
	if (!segments) return fail(`source 指向项目目录之外：${source}`);

	// Gate 2b: the same directories a project walk skips are off limits here too.
	for (const segment of segments) {
		if (isScanSkippedDir(segment)) return fail(`source 位于被忽略的目录内（${segment}）：${source}`);
	}

	// Gate 3: extension whitelist. Also fixes the source kind that drives query dispatch.
	const kind = duckdbSourceKind(target);
	if (!kind) {
		return fail(`只支持 ${DUCKDB_EXTENSIONS.join(" / ")} 文件：${source}`);
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

	// Gate 4: only a real DuckDB database is magic-checked. CSV / XLSX are plain data files the
	// engine reads through its replacement scan, so there is no header to verify.
	if (kind === "database" && !hasDuckdbMagic(real)) {
		return fail(`不是 DuckDB 数据库文件：${source}`);
	}

	return { ok: true, path: real, kind };
}

export interface DuckdbWriteTargetRequest {
	projectRoot: string;
	/** The `copy_to:` value exactly as written in the block: always a project-relative path. */
	target: string;
}

export type DuckdbWriteTargetResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Gates the *write* target of the optional `copy_to` path (doc-25 §11.4 / AC #6).
 *
 * A write target must stay inside the project, may only be a brand-new or existing `.csv` / `.xlsx`
 * file, and may never be (or overwrite) a `.duckdb` database. The read gates are reused so a write
 * cannot escape the project through a relative path, a `..` climb, or a symlink the file already is.
 */
export function resolveDuckdbWriteTarget(request: DuckdbWriteTargetRequest): DuckdbWriteTargetResult {
	const target = request.target.trim();
	if (target.length === 0) return fail("copy_to 目标不能为空。");
	if (target.startsWith("/")) {
		return fail("copy_to 目标不接受前导 /：请写项目相对路径，如 backlog/databases/out.csv。");
	}
	if (isNonRelativeSource(target)) {
		return fail("copy_to 目标必须是项目内的相对路径，不接受绝对路径、盘符、UNC、URL 或 ~。");
	}

	let projectRoot: string;
	try {
		projectRoot = realpathSync(resolve(request.projectRoot));
	} catch {
		projectRoot = resolve(request.projectRoot);
	}
	const resolved = resolve(projectRoot, target);

	const segments = segmentsInsideProject(projectRoot, resolved);
	if (!segments) return fail(`copy_to 目标指向项目目录之外：${target}`);
	for (const segment of segments) {
		if (isScanSkippedDir(segment)) return fail(`copy_to 目标位于被忽略的目录内（${segment}）：${target}`);
	}

	const lower = target.toLowerCase();
	if (lower.endsWith(".duckdb")) {
		return fail(`copy_to 不允许写入 .duckdb 数据库文件：${target}`);
	}
	if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
		return fail(`copy_to 只允许写入项目内的 .csv / .xlsx 文件：${target}`);
	}

	// An existing target must not sneak a symlink out of the project, nor be a DuckDB database.
	let stats: ReturnType<typeof statSync> | null = null;
	try {
		stats = statSync(resolved);
	} catch {
		stats = null;
	}
	if (stats?.isFile()) {
		let real: string;
		try {
			real = realpathSync(resolved);
		} catch {
			return fail(`无法解析 copy_to 目标路径：${target}`);
		}
		if (!segmentsInsideProject(projectRoot, real)) {
			return fail(`copy_to 目标指向项目目录之外（符号链接）：${target}`);
		}
	}

	return { ok: true, path: resolved };
}
