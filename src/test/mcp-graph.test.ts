import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
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
});
