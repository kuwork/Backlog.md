import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerDecisionTools } from "../mcp/tools/decisions/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

// Helper to extract text from MCP content (handles union types)
const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let mcpServer: McpServer;

describe("MCP decision tools", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-decisions");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await initializeTestProject(mcpServer, "Decisions Project");
		registerDecisionTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// ignore shutdown issues in tests
		}
		await safeCleanup(TEST_DIR);
	});

	it("changes only the status and leaves the body alone", async () => {
		await mcpServer.createDecisionWithTitle("Adopt Bun test runner");
		const before = await mcpServer.filesystem.loadDecision("decision-1");
		if (!before) throw new Error("decision not created");

		const result = await mcpServer.testInterface.callTool({
			params: { name: "decision_update", arguments: { id: "decision-1", status: "accepted" } },
		});

		expect(result.isError).toBeFalsy();
		expect(getText(result.content)).toContain("Updated decision decision-1 (status: accepted)");

		const after = await mcpServer.filesystem.loadDecision("decision-1");
		expect(after?.status).toBe("accepted");
		expect(after?.context).toBe(before.context);
		expect(after?.decision).toBe(before.decision);
		expect(after?.consequences).toBe(before.consequences);
		expect(after?.rawContent).toBe(before.rawContent);
	});

	it("replaces the body together with an explicit status", async () => {
		await mcpServer.createDecisionWithTitle("Choose a runtime");

		const result = await mcpServer.testInterface.callTool({
			params: {
				name: "decision_update",
				arguments: {
					id: "decision-1",
					status: "superseded",
					content: "## Context\n\nOld choice\n\n## Decision\n\nSwitch to Bun",
				},
			},
		});

		expect(result.isError).toBeFalsy();
		const updated = await mcpServer.filesystem.loadDecision("decision-1");
		expect(updated?.status).toBe("superseded");
		expect(updated?.context).toBe("Old choice");
		expect(updated?.decision).toBe("Switch to Bun");
	});

	it("appends a block without duplicating the existing section headings", async () => {
		await mcpServer.createDecisionWithTitle("Add alternatives");

		const result = await mcpServer.testInterface.callTool({
			params: {
				name: "decision_update",
				arguments: { id: "decision-1", appendContent: ["## Alternatives\n\n- Node.js"] },
			},
		});

		expect(result.isError).toBeFalsy();
		const updated = await mcpServer.filesystem.loadDecision("decision-1");
		expect(updated?.alternatives).toBe("- Node.js");
		expect(updated?.rawContent.split("## Consequences")).toHaveLength(2);
	});

	it("rejects an update with no fields to change", async () => {
		await mcpServer.createDecisionWithTitle("No-op guard");

		const result = await mcpServer.testInterface.callTool({
			params: { name: "decision_update", arguments: { id: "decision-1" } },
		});

		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("Provide content, appendContent or status");
	});

	it("reports an unknown decision id", async () => {
		const result = await mcpServer.testInterface.callTool({
			params: { name: "decision_update", arguments: { id: "decision-99", status: "accepted" } },
		});

		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("Decision not found");
	});
});
