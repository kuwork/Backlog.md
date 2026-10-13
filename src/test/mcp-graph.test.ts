import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { createDatabase } from "../graph/databases.ts";
import { McpServer } from "../mcp/server.ts";
import { registerGraphTools } from "../mcp/tools/graph/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let server: McpServer;

async function callTool(name: string, args: Record<string, unknown>) {
	return server.testInterface.callTool({ params: { name, arguments: args } });
}

async function listToolNames(): Promise<string[]> {
	const result = await server.testInterface.listTools();
	return result.tools.map((tool) => tool.name);
}

describe("MCP graph tools", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-graph");
		server = new McpServer(TEST_DIR, "Test instructions");
		await server.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await initializeTestProject(server, "Test Project");
		registerGraphTools(server);
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore
		}
		await safeCleanup(TEST_DIR);
	});

	it("registers graph_query in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_query");
	});

	it("runs a read-only Cypher statement against the default derived graph", async () => {
		const result = await callTool("graph_query", { db: "default", statement: "RETURN 1 AS n" });
		expect(result.isError).toBeFalsy();
		const text = getText(result.content);
		expect(text).toContain('"columns"');
		expect(text).toContain('"n"');
		expect(text).toContain("匹配行数：1");
	});

	it("rejects write keywords with a clear error", async () => {
		const result = await callTool("graph_query", {
			db: "default",
			statement: "CREATE (n:TestNode {id: 'x'})",
		});
		expect(result.isError).toBe(true);
		const text = getText(result.content);
		expect(text).toContain("read-only");
	});

	it("returns a labels overview when no statement is given", async () => {
		const result = await callTool("graph_query", { db: "default" });
		expect(result.isError).toBeFalsy();
		const text = getText(result.content);
		expect(text).toContain("labels");
	});

	it("registers graph_schema in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_schema");
	});

	it("introspects the default derived graph schema (node tables + relationship tables)", async () => {
		const result = await callTool("graph_schema", { db: "default" });
		expect(result.isError).toBeFalsy();
		const schema = JSON.parse(getText(result.content)) as {
			nodeTables: { name: string; properties: { name: string; type: string; primaryKey: boolean }[] }[];
			relTables: { name: string; from: string; to: string }[];
		};
		expect(Array.isArray(schema.nodeTables)).toBe(true);
		expect(schema.nodeTables.length).toBeGreaterThan(0);
		expect(Array.isArray(schema.nodeTables[0]?.properties)).toBe(true);
		expect(Array.isArray(schema.relTables)).toBe(true);
	});

	it("introspects a user database schema", async () => {
		createDatabase(TEST_DIR, "schemadb", "schema test database");
		const result = await callTool("graph_schema", { db: "schemadb" });
		expect(result.isError).toBeFalsy();
		const schema = JSON.parse(getText(result.content)) as { nodeTables: unknown[]; relTables: unknown[] };
		expect(Array.isArray(schema.nodeTables)).toBe(true);
		expect(Array.isArray(schema.relTables)).toBe(true);
	});

	it("returns a clear error for an unknown database", async () => {
		const result = await callTool("graph_schema", { db: "does-not-exist" });
		expect(result.isError).toBe(true);
		const text = getText(result.content);
		expect(text).toContain("不存在");
	});

	it("registers graph_list_databases in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_list_databases");
	});

	it("lists the default derived graph plus a user database with metadata", async () => {
		createDatabase(TEST_DIR, "listdb", "list test database");
		const result = await callTool("graph_list_databases", {});
		expect(result.isError).toBeFalsy();
		const databases = JSON.parse(getText(result.content)) as {
			name: string;
			kind: string;
			nodes: number | null;
			edges: number | null;
		}[];
		expect(Array.isArray(databases)).toBe(true);
		const names = databases.map((db) => db.name);
		expect(names).toContain("default");
		expect(names).toContain("listdb");
		const derived = databases.find((db) => db.name === "default");
		expect(derived?.kind).toBe("derived");
		const user = databases.find((db) => db.name === "listdb");
		expect(user?.kind).toBe("user");
		expect(typeof user?.nodes).toBe("number");
		expect(typeof user?.edges).toBe("number");
	});

	it("registers graph_describe_database in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_describe_database");
	});

	it("describes the default derived graph with its metadata", async () => {
		const result = await callTool("graph_describe_database", { db: "default" });
		expect(result.isError).toBeFalsy();
		const db = JSON.parse(getText(result.content)) as {
			name: string;
			kind: string;
			description: string;
			nodes: number | null;
			edges: number | null;
		};
		expect(db.name).toBe("default");
		expect(db.kind).toBe("derived");
		expect(typeof db.description).toBe("string");
		expect(db.nodes).toBeNull();
		expect(db.edges).toBeNull();
	});

	it("returns a clear error for an unknown database", async () => {
		const result = await callTool("graph_describe_database", { db: "does-not-exist" });
		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("不存在");
	});

	it("registers graph_create_database in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_create_database");
	});

	it("creates a user database when acknowledged", async () => {
		const result = await callTool("graph_create_database", {
			name: "createdb",
			description: "created in test",
			acknowledged: true,
		});
		expect(result.isError).toBeFalsy();
		const db = JSON.parse(getText(result.content)) as { name: string; kind: string };
		expect(db.name).toBe("createdb");
		expect(db.kind).toBe("user");
	});

	it("refuses to create without acknowledgement", async () => {
		const result = await callTool("graph_create_database", {
			name: "unacked",
			description: "no ack",
			acknowledged: false,
		});
		expect(result.isError).toBe(true);
	});

	it("returns a clear error on a duplicate name", async () => {
		await callTool("graph_create_database", { name: "dupdb", description: "first", acknowledged: true });
		const result = await callTool("graph_create_database", {
			name: "dupdb",
			description: "second",
			acknowledged: true,
		});
		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("已存在");
	});

	it("returns a clear error on an illegal name", async () => {
		const result = await callTool("graph_create_database", {
			name: "bad name!",
			description: "illegal",
			acknowledged: true,
		});
		expect(result.isError).toBe(true);
	});

	it("registers graph_import_csv in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_import_csv");
	});

	it("imports a node CSV into a user database, creating the table", async () => {
		createDatabase(TEST_DIR, "importdb", "import test database");
		const csv = join(TEST_DIR, "people.csv");
		await writeFile(csv, "name,age\nAlice,30\nBob,41\n", "utf8");
		const result = await callTool("graph_import_csv", { db: "importdb", csv, node: "Person" });
		expect(result.isError).toBeFalsy();
		const imported = JSON.parse(getText(result.content)) as {
			table: string;
			created: boolean;
			inserted: number;
			columns: { name: string; type: string }[];
		};
		expect(imported.table).toBe("Person");
		expect(imported.created).toBe(true);
		expect(imported.inserted).toBe(2);
		expect(imported.columns.map((column) => column.type)).toEqual(["STRING", "INT64"]);
	});

	it("imports a relationship CSV as edges between existing nodes", async () => {
		createDatabase(TEST_DIR, "reldb", "relation test database");
		const people = join(TEST_DIR, "people.csv");
		await writeFile(people, "name,age\nAlice,30\nBob,41\n", "utf8");
		await callTool("graph_import_csv", { db: "reldb", csv: people, node: "Person" });
		const knows = join(TEST_DIR, "knows.csv");
		await writeFile(knows, "person,friend\nAlice,Bob\n", "utf8");
		const result = await callTool("graph_import_csv", {
			db: "reldb",
			csv: knows,
			rel: "KNOWS",
			from: "person",
			to: "friend",
			fromNode: "Person",
			toNode: "Person",
		});
		expect(result.isError).toBeFalsy();
		const imported = JSON.parse(getText(result.content)) as { rel: string; created: boolean; inserted: number };
		expect(imported.rel).toBe("KNOWS");
		expect(imported.created).toBe(true);
		expect(imported.inserted).toBe(1);
	});

	it("returns a clear error for a malformed CSV", async () => {
		createDatabase(TEST_DIR, "baddb", "bad csv database");
		const csv = join(TEST_DIR, "ragged.csv");
		await writeFile(csv, "name,age\nFrank,60,extra\n", "utf8");
		const result = await callTool("graph_import_csv", { db: "baddb", csv, node: "Person" });
		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("第 2 行有 3 列");
	});

	it("refuses to import into the read-only default database", async () => {
		const csv = join(TEST_DIR, "p.csv");
		await writeFile(csv, "name\nAlice\n", "utf8");
		const result = await callTool("graph_import_csv", { db: "default", csv });
		expect(result.isError).toBe(true);
	});
});
