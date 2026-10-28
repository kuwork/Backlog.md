import { isAbsolute, resolve } from "node:path";
import type { Core } from "../../../core/backlog.ts";
import { describeDatabases } from "../../../graph/browser.ts";
import {
	type CsvImportResult,
	type CsvRelationResult,
	type CsvTableData,
	importCsvRelations,
	importCsvTable,
	readCsvFile,
} from "../../../graph/csv-import.ts";
import { createDatabase } from "../../../graph/databases.ts";
import { loadLegendConfig, saveLegendConfig } from "../../../graph/legend-store.ts";
import { BacklogToolError } from "../../errors/mcp-errors.ts";
import type { CallToolResult } from "../../types.ts";
import { isWriteStatement, queryDatabase, schemaDatabase, withUserDatabaseWrite } from "./graph-access.ts";

export type GraphQueryArgs = {
	db: string;
	statement?: string;
};

export type GraphSchemaArgs = {
	db: string;
};

export type GraphListDatabasesArgs = Record<string, never>;

export type GraphDescribeDatabaseArgs = {
	db: string;
};

export type GraphCreateDatabaseArgs = {
	name: string;
	description: string;
	acknowledged: boolean;
};

export type GraphImportCsvArgs = {
	db: string;
	csv: string;
	node?: string;
	map?: Record<string, string>;
	header?: boolean;
	rel?: string;
	from?: string;
	to?: string;
	fromNode?: string;
	toNode?: string;
};

export type GraphLegendGetArgs = {
	db: string;
};

export type GraphLegendSetArgs = {
	db: string;
	config: unknown;
};

export type GraphLegendRemoveArgs = {
	db: string;
};

/** A legend payload is only acceptable when it is a plain object; arrays and scalars are rejected. */
function isPlainMapping(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Format a Cypher result set for an agent: machine-readable JSON plus a short summary line. */
function formatCypherResult(result: { columns: string[]; rows: unknown[][]; truncated?: boolean }): string {
	const rowCount = result.rows.length;
	const truncated = result.truncated ? " | truncated (500 row cap)" : "";
	const summary = `Matched rows: ${rowCount}${truncated}`;
	return `${JSON.stringify(result, null, 2)}\n\n${summary}`;
}

/** Validate the `map` argument as a `{ csvHeader: propertyName }` object; anything else is rejected. */
function normalizeColumnMap(map: unknown): Record<string, string> | undefined {
	if (map === undefined || map === null) return undefined;
	if (typeof map !== "object" || Array.isArray(map)) {
		throw new BacklogToolError("map must be an object of { csvHeader: propertyName } pairs.", "VALIDATION_ERROR");
	}
	const normalized: Record<string, string> = {};
	for (const [header, name] of Object.entries(map as Record<string, unknown>)) {
		if (typeof name !== "string" || name.length === 0) {
			throw new BacklogToolError(`map["${header}"] must be a non-empty property name.`, "VALIDATION_ERROR");
		}
		normalized[header] = name;
	}
	return normalized;
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

	async schemaGraph(args: GraphSchemaArgs): Promise<CallToolResult> {
		const db = args.db;
		if (!db) {
			throw new BacklogToolError("Missing required argument: db", "VALIDATION_ERROR");
		}
		const schema = await schemaDatabase(this.core.filesystem.rootDir, db);
		return {
			content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
		};
	}

	async listDatabases(_args: GraphListDatabasesArgs): Promise<CallToolResult> {
		const databases = describeDatabases(this.core.filesystem.rootDir);
		return {
			content: [{ type: "text", text: JSON.stringify(databases, null, 2) }],
		};
	}

	async describeDatabase(args: GraphDescribeDatabaseArgs): Promise<CallToolResult> {
		const db = args.db;
		if (!db) {
			throw new BacklogToolError("Missing required argument: db", "VALIDATION_ERROR");
		}
		const databases = describeDatabases(this.core.filesystem.rootDir);
		const found = databases.find((database) => database.name === db);
		if (!found) {
			throw new BacklogToolError(
				`Database "${db}" does not exist. Available: ${databases.map((database) => database.name).join(", ")}.`,
				"RESOURCE_NOT_FOUND",
			);
		}
		return {
			content: [{ type: "text", text: JSON.stringify(found, null, 2) }],
		};
	}

	async createDatabase(args: GraphCreateDatabaseArgs): Promise<CallToolResult> {
		const name = args.name;
		const description = args.description;
		if (!name || !description) {
			throw new BacklogToolError("Missing required argument: name and description", "VALIDATION_ERROR");
		}
		if (!args.acknowledged) {
			throw new BacklogToolError(
				`graph_create_database is a write operation; pass acknowledged: true to confirm creating user database "${name}".`,
				"VALIDATION_ERROR",
			);
		}
		try {
			const database = createDatabase(this.core.filesystem.rootDir, name, description);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								name: database.name,
								kind: database.kind,
								description: database.description,
								createdAt: database.createdAt,
								updatedAt: database.updatedAt,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error) {
			throw new BacklogToolError(error instanceof Error ? error.message : String(error), "RESOURCE_CONFLICT");
		}
	}

	/** Read and validate a CSV file, surfacing its (clear, user-facing) errors as validation errors. */
	private readCsvInput(
		filePath: string,
		options: { table?: string; hasHeader: boolean; map?: Record<string, string> },
	): CsvTableData {
		try {
			return readCsvFile(filePath, options);
		} catch (error) {
			throw new BacklogToolError(error instanceof Error ? error.message : String(error), "VALIDATION_ERROR");
		}
	}

	async importCsv(args: GraphImportCsvArgs): Promise<CallToolResult> {
		const db = args.db;
		const csvPath = args.csv;
		if (!db || !csvPath) {
			throw new BacklogToolError("Missing required argument: db and csv", "VALIDATION_ERROR");
		}
		const asRelations = args.rel !== undefined;
		if (asRelations && (!args.from || !args.to)) {
			throw new BacklogToolError(
				"graph_import_csv with rel requires from and to: the two CSV columns holding each edge's endpoint keys.",
				"VALIDATION_ERROR",
			);
		}
		const map = normalizeColumnMap(args.map);
		// A relative path is resolved against the project root, not the MCP process's cwd.
		const filePath = isAbsolute(csvPath) ? csvPath : resolve(this.core.filesystem.rootDir, csvPath);
		// Parse and validate the whole file before a store is opened: a malformed file must leave the
		// database untouched, and failing here - before the snapshot is even hydrated - is what makes
		// that a guarantee rather than a likelihood.
		const prepared = this.readCsvInput(filePath, { table: args.node, hasHeader: args.header !== false, map });

		type ImportOutcome = { kind: "nodes"; result: CsvImportResult } | { kind: "relations"; result: CsvRelationResult };
		let outcome: ImportOutcome;
		try {
			outcome = await withUserDatabaseWrite<ImportOutcome>(this.core.filesystem.rootDir, db, async (store) => {
				if (asRelations) {
					return {
						kind: "relations",
						result: await importCsvRelations(store, prepared, {
							rel: args.rel as string,
							from: args.from as string,
							to: args.to as string,
							fromNode: args.fromNode ?? args.node,
							toNode: args.toNode ?? args.node,
						}),
					};
				}
				return { kind: "nodes", result: await importCsvTable(store, prepared) };
			});
		} catch (error) {
			// An unknown database and other coded errors pass through; everything else (the read-only
			// default database, a busy lock, a CSV that clashes with the existing schema) is reported
			// with its own message rather than the generic "An unexpected error occurred".
			if (error instanceof BacklogToolError) throw error;
			throw new BacklogToolError(error instanceof Error ? error.message : String(error), "OPERATION_FAILED");
		}
		return {
			content: [{ type: "text", text: JSON.stringify(outcome.result, null, 2) }],
		};
	}

	/**
	 * Read one database's legend config from the shared store file. An absent config is a normal
	 * answer (configured: false), not an error - a database nobody styled yet is the common case.
	 */
	async getLegend(args: GraphLegendGetArgs): Promise<CallToolResult> {
		const db = args.db;
		if (!db) {
			throw new BacklogToolError("Missing required argument: db", "VALIDATION_ERROR");
		}
		const config = loadLegendConfig(this.core.filesystem.rootDir, db);
		if (config === null) {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{ database: db, configured: false, message: `No legend config is stored for database "${db}".` },
							null,
							2,
						),
					},
				],
			};
		}
		return {
			content: [{ type: "text", text: JSON.stringify({ database: db, configured: true, config }, null, 2) }],
		};
	}

	/** Write one database's legend config into the shared store file (validated before any write). */
	async setLegend(args: GraphLegendSetArgs): Promise<CallToolResult> {
		const db = args.db;
		if (!db) {
			throw new BacklogToolError("Missing required argument: db", "VALIDATION_ERROR");
		}
		if (!isPlainMapping(args.config)) {
			throw new BacklogToolError(
				"config must be a legend config object (a mapping of captionsVisible / types / relations / hidden). " +
					"Arrays and scalars are rejected; the store file was not modified.",
				"VALIDATION_ERROR",
			);
		}
		saveLegendConfig(this.core.filesystem.rootDir, db, args.config);
		return {
			content: [{ type: "text", text: JSON.stringify({ database: db, saved: true, config: args.config }, null, 2) }],
		};
	}

	/** Delete one database's legend entry. Idempotent: an absent entry is a successful no-op. */
	async removeLegend(args: GraphLegendRemoveArgs): Promise<CallToolResult> {
		const db = args.db;
		if (!db) {
			throw new BacklogToolError("Missing required argument: db", "VALIDATION_ERROR");
		}
		const existed = loadLegendConfig(this.core.filesystem.rootDir, db) !== null;
		saveLegendConfig(this.core.filesystem.rootDir, db, null);
		return {
			content: [{ type: "text", text: JSON.stringify({ database: db, removed: existed }, null, 2) }],
		};
	}
}
