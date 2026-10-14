/**
 * Best-effort screening of SQL string literals for DuckDB data-file sources (doc-25 §11.4, AC #8).
 *
 * The hard security boundary is still `source` plus the four containment gates in paths.ts: a file
 * referenced by the SQL is never opened by the resolver, only by the engine's replacement scan, and
 * that scan is anchored to the project root. This module is a *secondary* fence that tightens the
 * obvious exfiltration paths a bare path opens up:
 *
 *  1. URL scheme literals (`http(s)://`, `s3://`, `file://`, ...) are refused outright, because
 *     they are exactly how `replacement scan` would reach through the `httpfs` extension to fetch a
 *     remote file instead of reading something inside the project.
 *  2. Literals that look like a filesystem path (contain `/` or `\`, or end in a data extension) are
 *     run through the same in-project gates `source` already passed. Anything that would escape, be
 *     absolute, or land in a skipped directory is refused.
 *
 * It cannot reason about a path built dynamically (concatenation, a parameter, a macro), and that is
 * fine: such a query simply is not covered here, and `source` remains the guarantee that matters.
 */

import { resolve } from "node:path";
import { isNonRelativeSource, segmentsInsideProject } from "../sqlite/paths.ts";
import { isScanSkippedDir } from "../utils/project-scan.ts";

/** A scheme followed by `//` - `http://`, `https://`, `s3://`, `file://`, ... */
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

/** Extensions that make a literal look like a concrete data file worth gating. */
const DATA_EXTENSIONS = [".duckdb", ".csv", ".xlsx", ".sqlite", ".sqlite3", ".db"] as const;

export type LiteralScreenResult = { ok: true } | { ok: false; error: string };

/** A literal is path-like when it carries a separator or names a data file. */
function isPathLikeLiteral(literal: string): boolean {
	if (/[/\\]/.test(literal)) return true;
	const lower = literal.toLowerCase();
	return DATA_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Walks the SQL the same way SQLite's validator skips string literals, but collects their contents
 * instead of discarding them. `''` is an escaped quote, not a terminator.
 */
function extractStringLiterals(sql: string): string[] {
	const literals: string[] = [];
	let i = 0;
	while (i < sql.length) {
		if (sql[i] === "'") {
			i += 1;
			let content = "";
			while (i < sql.length) {
				if (sql[i] === "'") {
					if (sql[i + 1] === "'") {
						content += "'";
						i += 2;
						continue;
					}
					i += 1;
					break;
				}
				content += sql[i];
				i += 1;
			}
			literals.push(content);
			continue;
		}
		i += 1;
	}
	return literals;
}

/** Runs one literal through the in-project gates used for `source`. */
function gatePathLiteral(projectRoot: string, literal: string): LiteralScreenResult {
	if (literal.trim().length === 0) return { ok: true };
	if (literal.startsWith("/") || isNonRelativeSource(literal)) {
		return { ok: false, error: `SQL 字面量路径不在项目内（${literal}），已拒绝。` };
	}
	const target = resolve(projectRoot, literal);
	const segments = segmentsInsideProject(projectRoot, target);
	if (!segments) return { ok: false, error: `SQL 字面量路径指向项目目录之外（${literal}），已拒绝。` };
	for (const segment of segments) {
		if (isScanSkippedDir(segment)) {
			return { ok: false, error: `SQL 字面量路径位于被忽略的目录内（${segment}），已拒绝。` };
		}
	}
	return { ok: true };
}

/**
 * Screens every string literal in `sql`. Returns the first refusal, or `{ ok: true }` when nothing
 * obviously escapes. Intended for data-file (CSV / XLSX) sources where the file is named inside the
 * SQL rather than handed to the resolver - `.duckdb` sources reference tables, not files, so their
 * literals are left to the read-only validator.
 */
export function screenDuckdbSqlLiterals(projectRoot: string, sql: string): LiteralScreenResult {
	for (const literal of extractStringLiterals(sql)) {
		if (URL_SCHEME.test(literal)) {
			return {
				ok: false,
				error: `SQL 字符串字面量包含外部地址（${literal}）：replacement scan 可能经 httpfs 外联，已拒绝。`,
			};
		}
		if (isPathLikeLiteral(literal)) {
			const gate = gatePathLiteral(projectRoot, literal);
			if (!gate.ok) return gate;
		}
	}
	return { ok: true };
}
