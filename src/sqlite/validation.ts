/**
 * Read-only SQL validation (doc-16 §4, layers 1 and 2).
 *
 * Layer 3 - the readonly handle plus `PRAGMA query_only` - lives in query.ts. This file only has to
 * be right *most* of the time; the engine is what makes "wrong" harmless. The one thing it must not
 * do is let a keyword smuggled inside a string literal or a comment reject a legitimate query, so
 * the scan is quote- and comment-aware rather than a plain regex over the whole statement.
 */

const FORBIDDEN_KEYWORDS = [
	"INSERT",
	"UPDATE",
	"DELETE",
	"REPLACE",
	"CREATE",
	"ALTER",
	"DROP",
	"ATTACH",
	"DETACH",
	"PRAGMA",
	"VACUUM",
	"REINDEX",
	"ANALYZE",
	"BEGIN",
	"COMMIT",
	"ROLLBACK",
	"SAVEPOINT",
	"RELEASE",
	// Write / extension-management statements a read-only query block must never carry. `INSTALL` and
	// `LOAD` are how an extension (the official `excel` one, or anything else) would be pulled in by
	// user SQL - extension loading is reserved for engine autoload. `COPY` is the write path that the
	// server performs on behalf of a block via `copy_to`; a block must not smuggle its own.
	"INSTALL",
	"LOAD",
	"COPY",
] as const;

export type SqliteSqlValidation = { ok: true; sql: string } | { ok: false; error: string };

function fail(error: string): SqliteSqlValidation {
	return { ok: false, error };
}

/**
 * Remove string literals and quoted identifiers, keeping only the text a check may legitimately
 * look at, so `WHERE action = 'drop'` and `"delete_log"` survive.
 *
 * Comments are handled by `keepComments`, and the two callers want opposite things:
 * - statement shape (first word, semicolon) needs comments *gone*, or a trailing `-- 1; 2` would
 *   read as a second statement;
 * - the keyword blacklist needs comments *kept*, so failing closed - a commented-out `DROP` is
 *   still refused rather than reasoned about.
 */
function stripLiterals(sql: string, options: { keepComments: boolean }): string {
	let out = "";
	let i = 0;
	while (i < sql.length) {
		const ch = sql[i];
		// 'string literal' - '' is an escaped quote, not a terminator
		if (ch === "'") {
			i++;
			while (i < sql.length) {
				if (sql[i] === "'") {
					if (sql[i + 1] === "'") {
						i += 2;
						continue;
					}
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		// "identifier", `identifier`, [identifier]
		if (ch === '"' || ch === "`" || ch === "[") {
			const close = ch === "[" ? "]" : ch;
			i++;
			while (i < sql.length && sql[i] !== close) i++;
			i++;
			continue;
		}
		// -- line comment
		if (ch === "-" && sql[i + 1] === "-") {
			const start = i;
			while (i < sql.length && sql[i] !== "\n") i++;
			if (options.keepComments) out += ` ${sql.slice(start, i)}`;
			continue;
		}
		/* block comment */
		if (ch === "/" && sql[i + 1] === "*") {
			const start = i;
			i += 2;
			while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
			i = Math.min(i + 2, sql.length);
			if (options.keepComments) out += ` ${sql.slice(start, i)}`;
			continue;
		}
		out += ch;
		i++;
	}
	return out;
}

export function validateReadOnlySql(raw: string): SqliteSqlValidation {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return fail("SQL 不能为空。");

	const code = stripLiterals(trimmed, { keepComments: false });
	// One statement only: a single trailing semicolon is tolerated, anything else is a second query.
	const semicolon = code.indexOf(";");
	const statement = semicolon === -1 ? code : code.slice(0, semicolon).trimEnd();
	const sql = semicolon === -1 ? trimmed : trimmed.replace(/;\s*$/, "");
	if (semicolon !== -1 && code.slice(semicolon + 1).trim().length > 0) {
		return fail("只允许一条语句：请不要在查询中间写分号。");
	}

	const head = /^\s*([A-Za-z_]+)/.exec(statement);
	if (!head) return fail("无法识别查询语句。");
	const first = (head[1] ?? "").toUpperCase();
	if (first !== "SELECT" && first !== "WITH") {
		return fail(`只支持只读查询：语句必须以 SELECT 或 WITH … SELECT 开头，收到 "${first}"。`);
	}
	if (first === "WITH" && !/\bSELECT\b/i.test(statement)) return fail("WITH 语句里没有 SELECT。");

	// Scanned on the original text, not the comment-stripped one: a commented-out keyword is still
	// a keyword as far as this check is concerned.
	const scan = stripLiterals(sql, { keepComments: true });
	for (const keyword of FORBIDDEN_KEYWORDS) {
		if (new RegExp(`\\b${keyword}\\b`, "i").test(scan)) {
			return fail(`只读查询不允许出现 ${keyword}。`);
		}
	}

	return { ok: true, sql };
}
