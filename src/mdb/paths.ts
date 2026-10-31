/**
 * Source resolution and discovery for the MDB (Access) live query explorer.
 *
 * Mirrors sqlite/paths.ts and duckdb/paths.ts: the four fail-closed containment gates are shared
 * from sqlite/paths.ts, only the extension whitelist differs. There is no file-magic check because
 * Access files have no single reliable header (Jet `.mdb` and ACE `.accdb` differ), and the parser
 * itself rejects anything that is not a readable database at query time.
 */

import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isNonRelativeSource, segmentsInsideProject } from "../sqlite/paths.ts";
import { isScanSkippedDir } from "../utils/project-scan.ts";

/** The extensions a `mdb-query` block may open. */
export const MDB_EXTENSIONS = [".mdb", ".accdb"] as const;

export interface MdbSourceRequest {
	projectRoot: string;
	/** The `source:` value exactly as written in the block: always a project-relative path. */
	source: string;
}

export type MdbSourceResult = { ok: true; path: string } | { ok: false; error: string };

function fail(error: string): MdbSourceResult {
	return { ok: false, error };
}

export function isMdbFileName(name: string): boolean {
	const lower = name.toLowerCase();
	return MDB_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function resolveMdbSource(request: MdbSourceRequest): MdbSourceResult {
	const source = request.source.trim();
	if (source.length === 0) return fail("source 不能为空。");
	if (source.startsWith("/")) {
		return fail("source 不接受前导 /：请写项目相对路径，如 backlog/assets/sample.mdb。");
	}
	if (isNonRelativeSource(source)) {
		return fail("source 必须是项目内的相对路径，不接受绝对路径、盘符、UNC、URL 或 ~。");
	}

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
	if (!isMdbFileName(target)) {
		return fail(`只支持 ${MDB_EXTENSIONS.join(" / ")} 文件：${source}`);
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

	return { ok: true, path: real };
}
