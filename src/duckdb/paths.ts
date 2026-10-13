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

export const DUCKDB_EXTENSIONS = [".duckdb"] as const;

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

export type DuckdbSourceResult = { ok: true; path: string } | { ok: false; error: string };

function fail(error: string): DuckdbSourceResult {
	return { ok: false, error };
}

export function isDuckdbFileName(name: string): boolean {
	const lower = name.toLowerCase();
	return DUCKDB_EXTENSIONS.some((extension) => lower.endsWith(extension));
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

	// Gate 3: extension whitelist.
	if (!isDuckdbFileName(target)) {
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

	// Gate 4: not actually a DuckDB database.
	if (!hasDuckdbMagic(real)) return fail(`不是 DuckDB 数据库文件：${source}`);

	return { ok: true, path: real };
}
