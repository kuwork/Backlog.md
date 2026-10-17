import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { $ } from "bun";
import { graphLegendsPath, loadLegendConfig } from "../graph/legend-store.ts";
import { McpServer } from "../mcp/server.ts";
import { registerGraphTools } from "../mcp/tools/graph/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

/**
 * MCP graph legend tools (BACK-809). The server endpoints are covered by
 * server-graph-legend-endpoint.test.ts and the browser pane by web-graph-legend-persistence.test.tsx;
 * this file pins the MCP surface: registration, get hit/miss, set + get round-trip through the shared
 * YAML store, payload validation before any write, and remove idempotency - all through the same
 * legend-store module the CLI and web panel use, so there is no second storage path.
 */

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

const SAMPLE_CONFIG = {
	captionsVisible: true,
	types: {
		Person: {
			caption: "{{name}} ({{age}})",
			color: "#204af3",
			rules: [{ id: "r1", name: "young", expression: "age < 30" }],
		},
	},
	relations: { KNOWS: { dash: "dashed", arrow: "both" } },
	hidden: [],
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

describe("MCP graph legend tools", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-graph-legend");
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

	it("registers the three legend tools in the MCP tool list", async () => {
		const names = await listToolNames();
		expect(names).toContain("graph_legend_get");
		expect(names).toContain("graph_legend_set");
		expect(names).toContain("graph_legend_remove");
	});

	it("graph_legend_get reports no config for an unstyled database without erroring", async () => {
		const result = await callTool("graph_legend_get", { db: "default" });
		expect(result.isError).toBeFalsy();
		const payload = JSON.parse(getText(result.content)) as { database: string; configured: boolean };
		expect(payload.database).toBe("default");
		expect(payload.configured).toBe(false);
	});

	it("graph_legend_set stores a config and graph_legend_get reads it back", async () => {
		const setResult = await callTool("graph_legend_set", { db: "demo", config: SAMPLE_CONFIG });
		expect(setResult.isError).toBeFalsy();
		const setPayload = JSON.parse(getText(setResult.content)) as { saved: boolean };
		expect(setPayload.saved).toBe(true);

		const getResult = await callTool("graph_legend_get", { db: "demo" });
		expect(getResult.isError).toBeFalsy();
		const getPayload = JSON.parse(getText(getResult.content)) as { configured: boolean; config: unknown };
		expect(getPayload.configured).toBe(true);
		expect(getPayload.config).toEqual(SAMPLE_CONFIG);
	});

	it("writes the same YAML store file the server, CLI and web panel read", async () => {
		await callTool("graph_legend_set", { db: "demo", config: SAMPLE_CONFIG });
		// The shared store module - what the server endpoints and the CLI read through - sees the write.
		expect(loadLegendConfig(TEST_DIR, "demo")).toEqual(SAMPLE_CONFIG);
		expect(existsSync(graphLegendsPath(TEST_DIR))).toBe(true);
		expect(readFileSync(graphLegendsPath(TEST_DIR), "utf8")).toContain("captionsVisible:");
	});

	it("rejects a non-object config and leaves the store untouched", async () => {
		const result = await callTool("graph_legend_set", { db: "demo", config: [1, 2, 3] });
		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("config must be");
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();
	});

	it("rejects a scalar config", async () => {
		const result = await callTool("graph_legend_set", { db: "demo", config: "not-an-object" });
		expect(result.isError).toBe(true);
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();
	});

	it("rejects a set without a config argument", async () => {
		const result = await callTool("graph_legend_set", { db: "demo" });
		expect(result.isError).toBe(true);
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();
	});

	it("set overwrites an existing config", async () => {
		await callTool("graph_legend_set", { db: "demo", config: SAMPLE_CONFIG });
		const replacement = { captionsVisible: false, types: {}, relations: {}, hidden: ["t:Meta|s:type:only"] };
		const result = await callTool("graph_legend_set", { db: "demo", config: replacement });
		expect(result.isError).toBeFalsy();
		expect(loadLegendConfig(TEST_DIR, "demo")).toEqual(replacement);
	});

	it("graph_legend_remove deletes the entry and is idempotent", async () => {
		await callTool("graph_legend_set", { db: "demo", config: SAMPLE_CONFIG });

		const first = await callTool("graph_legend_remove", { db: "demo" });
		expect(first.isError).toBeFalsy();
		expect((JSON.parse(getText(first.content)) as { removed: boolean }).removed).toBe(true);
		expect(loadLegendConfig(TEST_DIR, "demo")).toBeNull();

		const second = await callTool("graph_legend_remove", { db: "demo" });
		expect(second.isError).toBeFalsy();
		expect((JSON.parse(getText(second.content)) as { removed: boolean }).removed).toBe(false);

		const get = await callTool("graph_legend_get", { db: "demo" });
		expect((JSON.parse(getText(get.content)) as { configured: boolean }).configured).toBe(false);
	});

	it("rejects a get without a db argument", async () => {
		const result = await callTool("graph_legend_get", {});
		expect(result.isError).toBe(true);
	});
});
