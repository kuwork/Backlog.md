/**
 * Parser for `*-query` fenced blocks (doc-16 §3), shared by the SQLite and DuckDB explorers.
 *
 * The block body is a deliberately tiny YAML subset: top-level `key: value` pairs plus a `|`
 * block scalar for the SQL. Anything else is an error on purpose - a silently ignored typo in
 * `source` or `view` would render a block that quietly means something else.
 *
 * The parser is engine-agnostic: it never inspects the fence language, so both `sqlite-query` and
 * `duckdb-query` blocks reuse it through `parseSqliteQueryBlock` / `parseDuckdbQueryBlock`.
 */

export type QueryView = "table" | "list" | "value";

export interface QueryBlock {
	/** Database path as written in the block; resolved later (see * /paths.ts). */
	source: string;
	/** The statement, trailing semicolon already stripped. */
	sql: string;
	view: QueryView;
	refresh: string;
	/**
	 * Optional write target (project-relative `.csv` / `.xlsx`). Only the DuckDB explorer honours
	 * it - the SQLite explorer rejects a block that sets it. The server gates and performs the copy.
	 */
	copyTo?: string;
}

export type QueryBlockParse = { ok: true; block: QueryBlock } | { ok: false; error: string };

export const SQLITE_BLOCK_LANG = "sqlite-query";

/** Backwards-compatible aliases kept so existing SQLite callers and tests need no change. */
export type SqliteQueryView = QueryView;
export type SqliteQueryBlock = QueryBlock;
export type SqliteBlockParse = QueryBlockParse;

const KNOWN_FIELDS = ["source", "sql", "view", "refresh", "copy_to"] as const;
type FieldName = (typeof KNOWN_FIELDS)[number];

const FIELD_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/;

function fail(error: string): QueryBlockParse {
	return { ok: false, error };
}

export function parseQueryBlock(raw: string): QueryBlockParse {
	const lines = raw.replace(/\r\n?/g, "\n").split("\n");
	const fields = new Map<FieldName, string>();
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		if (line.trim().length === 0) {
			i++;
			continue;
		}
		if (/^\s/.test(line)) return fail(`第 ${i + 1} 行不该缩进：字段必须顶格写，多行内容用 "sql: |"。`);
		const match = FIELD_LINE.exec(line);
		if (!match) return fail(`第 ${i + 1} 行无法解析：应为 "字段: 值"。`);

		const key = (match[1] ?? "").toLowerCase();
		const inline = (match[2] ?? "").trim();
		if (!(KNOWN_FIELDS as readonly string[]).includes(key)) {
			return fail(`第 ${i + 1} 行：未知字段 "${key}"，可用字段为 source / sql / view / refresh / copy_to。`);
		}
		const field = key as FieldName;
		if (fields.has(field)) return fail(`字段 "${field}" 重复定义。`);

		if (inline === "|" || inline === "|-") {
			const scalar: string[] = [];
			let j = i + 1;
			for (; j < lines.length; j++) {
				const candidate = lines[j] ?? "";
				// A blank line belongs to the scalar; a non-indented line ends it.
				if (candidate.trim().length === 0) {
					scalar.push("");
					continue;
				}
				if (!/^\s/.test(candidate)) break;
				scalar.push(candidate);
			}
			// YAML block scalars are stripped by their *least* indented content line, not the first.
			let indent = Number.POSITIVE_INFINITY;
			for (const candidate of scalar) {
				if (candidate.trim().length === 0) continue;
				indent = Math.min(indent, candidate.length - candidate.trimStart().length);
			}
			if (!Number.isFinite(indent)) indent = 0;
			const text = scalar
				.map((candidate) => (candidate.trim().length === 0 ? "" : candidate.slice(indent)))
				.join("\n")
				.replace(/\s+$/, "");
			fields.set(field, text);
			i = j;
			continue;
		}

		fields.set(field, inline);
		i++;
	}

	const source = fields.get("source")?.trim() ?? "";
	if (source.length === 0) return fail("缺少必填字段 source（数据库路径）。");
	const sql = fields.get("sql")?.trim() ?? "";
	if (sql.length === 0) return fail("缺少必填字段 sql（查询语句）。");

	const view = (fields.get("view") ?? "table").trim().toLowerCase();
	if (view !== "table" && view !== "list" && view !== "value") {
		return fail(`view 只支持 table / list / value，收到 "${view}"。`);
	}
	const refresh = (fields.get("refresh") ?? "manual").trim().toLowerCase();
	if (refresh !== "manual") return fail(`refresh 目前只支持 manual，收到 "${refresh}"。`);

	const copyTo = fields.get("copy_to")?.trim() ?? undefined;

	return { ok: true, block: { source, sql, view, refresh, copyTo } };
}

/** Backwards-compatible alias kept so existing SQLite callers and tests need no change. */
export const parseSqliteQueryBlock = parseQueryBlock;
