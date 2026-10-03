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

	describe("decision_list (BACK-742)", () => {
		it("lists decisions with the structured envelope", async () => {
			await mcpServer.createDecisionWithTitle("Adopt Bun");
			await mcpServer.createDecisionWithTitle("Use Postgres");

			const result = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: {} },
			});
			expect(result.isError).toBeFalsy();
			const text = getText(result.content);
			expect(text).toContain("Decisions:");
			expect(text).toContain("decision-1 - Adopt Bun");
			expect(text).toContain("decision-2 - Use Postgres");

			const structured = result.structuredContent as {
				items: { id: string }[];
				total: number;
				offset: number;
				limit: number;
				hasMore: boolean;
			};
			expect(structured.total).toBe(2);
			expect(structured.offset).toBe(0);
			expect(structured.limit).toBe(0);
			expect(structured.hasMore).toBe(false);
			expect(structured.items.map((decision) => decision.id)).toEqual(["decision-1", "decision-2"]);
		});

		it("paginates with limit and offset and exposes hasMore", async () => {
			await mcpServer.createDecisionWithTitle("First");
			await mcpServer.createDecisionWithTitle("Second");
			await mcpServer.createDecisionWithTitle("Third");

			const firstPage = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: { limit: 2 } },
			});
			const firstStructured = firstPage.structuredContent as {
				items: { id: string }[];
				total: number;
				offset: number;
				limit: number;
				hasMore: boolean;
			};
			expect(firstStructured.items.map((decision) => decision.id)).toEqual(["decision-1", "decision-2"]);
			expect(firstStructured.total).toBe(3);
			expect(firstStructured.hasMore).toBe(true);
			expect(getText(firstPage.content)).toContain("Showing 1-2 of 3 decisions.");

			const secondPage = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: { limit: 2, offset: 2 } },
			});
			const secondStructured = secondPage.structuredContent as {
				items: { id: string }[];
				total: number;
				offset: number;
				limit: number;
				hasMore: boolean;
			};
			expect(secondStructured.items.map((decision) => decision.id)).toEqual(["decision-3"]);
			expect(secondStructured.total).toBe(3);
			expect(secondStructured.offset).toBe(2);
			expect(secondStructured.limit).toBe(2);
			expect(secondStructured.hasMore).toBe(false);
			expect(getText(secondPage.content)).toContain("Showing 3-3 of 3 decisions.");
		});

		it("filters by status", async () => {
			await mcpServer.createDecisionWithTitle("Proposed decision");
			await mcpServer.createDecisionWithTitle("Accepted decision");
			await mcpServer.testInterface.callTool({
				params: { name: "decision_update", arguments: { id: "decision-2", status: "accepted" } },
			});

			const result = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: { status: "accepted" } },
			});
			const structured = result.structuredContent as {
				items: { id: string }[];
				total: number;
			};
			expect(structured.total).toBe(1);
			expect(structured.items.map((decision) => decision.id)).toEqual(["decision-2"]);
			expect(getText(result.content)).toContain("decision-2 - Accepted decision");
			expect(getText(result.content)).not.toContain("decision-1 - Proposed decision");
		});

		it("filters by search substring against id and title", async () => {
			await mcpServer.createDecisionWithTitle("Choose a runtime");
			await mcpServer.createDecisionWithTitle("Pick a database");

			const byTitle = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: { search: "database" } },
			});
			const titleStructured = byTitle.structuredContent as { items: { id: string }[]; total: number };
			expect(titleStructured.total).toBe(1);
			expect(titleStructured.items.map((decision) => decision.id)).toEqual(["decision-2"]);

			const byId = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: { search: "decision-1" } },
			});
			const idStructured = byId.structuredContent as { items: { id: string }[]; total: number };
			expect(idStructured.total).toBe(1);
			expect(idStructured.items.map((decision) => decision.id)).toEqual(["decision-1"]);
		});

		it("reports an empty decision list with a zeroed envelope", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: { name: "decision_list", arguments: {} },
			});
			expect(getText(result.content)).toContain("No decisions found.");
			const structured = result.structuredContent as {
				items: unknown[];
				total: number;
				offset: number;
				limit: number;
				hasMore: boolean;
			};
			expect(structured.items).toEqual([]);
			expect(structured.total).toBe(0);
			expect(structured.offset).toBe(0);
			expect(structured.limit).toBe(0);
			expect(structured.hasMore).toBe(false);
		});
	});
});
