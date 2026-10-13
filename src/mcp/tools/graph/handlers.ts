import type { Core } from "../../../core/backlog.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";
import type { CallToolResult } from "../../types.ts";
import { isWriteStatement, queryDatabase } from "./graph-access.ts";

export type GraphQueryArgs = {
	db: string;
	statement?: string;
};

/** Format a Cypher result set for an agent: machine-readable JSON plus a short summary line. */
function formatCypherResult(result: { columns: string[]; rows: unknown[][]; truncated?: boolean }): string {
	const rowCount = result.rows.length;
	const truncated = result.truncated ? " ｜ 已截断（上限 500 行）" : "";
	const summary = `匹配行数：${rowCount}${truncated}`;
	return `${JSON.stringify(result, null, 2)}\n\n${summary}`;
}

export class GraphHandlers {
	constructor(private readonly core: Core) {}

	/** `default` overview when no statement is given. */
	private defaultOverview(): string {
		return "MATCH (n) RETURN DISTINCT labels(n) AS labels LIMIT 50";
	}

	async queryGraph(args: GraphQueryArgs): Promise<CallToolResult> {
		const db = args.db;
		if (!db) {
			throw new BacklogToolError("Missing required argument: db", "VALIDATION_ERROR");
		}
		const statement = (args.statement ?? this.defaultOverview()).trim();
		if (isWriteStatement(statement)) {
			throw new BacklogToolError(
				"graph_query is read-only; the statement contains a write keyword (CREATE/MERGE/SET/DELETE/DROP/INSERT/UPDATE). " +
					"Use graph_import_csv / a user database write tool for mutations.",
				"VALIDATION_ERROR",
			);
		}
		const result = await queryDatabase(this.core.filesystem.rootDir, db, statement);
		return {
			content: [{ type: "text", text: formatCypherResult(result) }],
		};
	}
}
