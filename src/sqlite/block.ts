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

export type QueryView = "table" | "list" | "value" | "graph" | "echarts";

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
	/**
	 * Optional ECharts chart config (JSON) for `view: echarts`. The block body carries it as a
	 * `chart:` field; the value is the raw text (block scalar or inline JSON) the renderer parses.
	 * Absent unless the block declares `view: echarts`.
	 */
	chart?: string;
	/**
	 * Optional stable id for referencing this block's result from a standalone `echarts` block's
	 * `fromQuery` (Approach A, BACK-814). Scoped to the containing document; a block without an
	 * `id` is never registered, so its behaviour is unchanged.
	 */
	id?: string;
}

export type QueryBlockParse = { ok: true; block: QueryBlock } | { ok: false; error: string };

export const SQLITE_BLOCK_LANG = "sqlite-query";

/** Backwards-compatible aliases kept so existing SQLite callers and tests need no change. */
export type SqliteQueryView = QueryView;
export type SqliteQueryBlock = QueryBlock;
export type SqliteBlockParse = QueryBlockParse;

const FIELD_LINE = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/;

function fail(error: string): QueryBlockParse {
	return { ok: false, error };
}

/** The views every engine accepts. `graph` is the Cypher explorer's alone (BACK-803). */
const DEFAULT_VIEWS: readonly QueryView[] = ["table", "list", "value", "echarts"];

/**
 * Parse one block body. `statementField` is the name of the statement field: `sql` for the SQL
 * explorers, `query` for the Cypher explorer (doc-27 §3) - everything else about the grammar is
 * identical, so the engines share this one parser. `views` lists the `view` values the calling
 * engine accepts; only the Cypher explorer widens it with `graph`. `refreshModes` lists the
 * `refresh` values accepted; only the Cypher explorer widens it with `auto` (BACK-804).
 */
export function parseQueryBlock(
	raw: string,
	statementField: "sql" | "query" = "sql",
	views: readonly QueryView[] = DEFAULT_VIEWS,
	refreshModes: readonly string[] = ["manual"],
): QueryBlockParse {
	const knownFields: readonly string[] = ["id", "source", statementField, "view", "refresh", "copy_to", "chart"];
	const lines = raw.replace(/\r\n?/g, "\n").split("\n");
	const fields = new Map<string, string>();
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		if (line.trim().length === 0) {
			i++;
			continue;
		}
		if (/^\s/.test(line)) return fail(`第 ${i + 1} 行不该缩进：字段必须顶格写，多行内容用 "${statementField}: |"。`);
		const match = FIELD_LINE.exec(line);
		if (!match) return fail(`第 ${i + 1} 行无法解析：应为 "字段: 值"。`);

		const key = (match[1] ?? "").toLowerCase();
		const inline = (match[2] ?? "").trim();
		if (!knownFields.includes(key)) {
			return fail(`第 ${i + 1} 行：未知字段 "${key}"，可用字段为 ${knownFields.join(" / ")}。`);
		}
		const field = key;
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
	const sql = fields.get(statementField)?.trim() ?? "";
	if (sql.length === 0) return fail(`缺少必填字段 ${statementField}（查询语句）。`);

	const view = (fields.get("view") ?? "table").trim().toLowerCase();
	if (!(views as readonly string[]).includes(view)) {
		return fail(`view 只支持 ${views.join(" / ")}，收到 "${view}"。`);
	}
	const refresh = (fields.get("refresh") ?? "manual").trim().toLowerCase();
	if (!refreshModes.includes(refresh))
		return fail(`refresh 目前只支持 ${refreshModes.join(" / ")}，收到 "${refresh}"。`);

	const copyTo = fields.get("copy_to")?.trim() ?? undefined;
	const chart = fields.get("chart")?.trim() || undefined;
	const id = fields.get("id")?.trim() || undefined;

	return {
		ok: true,
		block: { source, sql, view: view as QueryView, refresh, copyTo, chart, id },
	};
}

/** Backwards-compatible alias kept so existing SQLite callers and tests need no change. */
export const parseSqliteQueryBlock = parseQueryBlock;
