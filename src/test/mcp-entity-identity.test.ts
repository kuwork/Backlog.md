import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { $ } from "bun";
import { serializeDocument } from "../markdown/serializer.ts";
import { McpServer } from "../mcp/server.ts";
import { registerDecisionTools } from "../mcp/tools/decisions/index.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import type { Document } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let mcpServer: McpServer;

function getText(content: unknown[] | undefined): string {
	return ((content?.[0] ?? {}) as { text?: string }).text ?? "";
}

function projectPath(filePath: string): string {
	return relative(TEST_DIR, filePath).replace(/\\/g, "/");
}

async function callTool(name: string, args: Record<string, unknown>) {
	return await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
}

describe("MCP entity identity updates and exact source selection", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-entity-identity");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await initializeTestProject(mcpServer, "Identity Project");
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		registerTaskTools(mcpServer, config);
		registerDocumentTools(mcpServer, config);
		registerDecisionTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// Ignore shutdown failures during cleanup.
		}
		await safeCleanup(TEST_DIR);
	});

	it("adds identity fields without rewriting existing tool descriptions", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const byName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const expectedDescriptionPrefixes = {
			task_edit:
				"Edit a Backlog.md task, including metadata, implementation plan/notes, dependencies, acceptance criteria, and task-specific Definition of Done items",
			document_update:
				"Update an existing Backlog.md document's content, optional title, metadata, and optional docs subdirectory path",
			decision_update: "Update an existing Backlog.md decision's status, body, or both",
		};

		for (const [name, prefix] of Object.entries(expectedDescriptionPrefixes)) {
			const tool = byName.get(name);
			expect(tool?.description?.startsWith(prefix)).toBe(true);
			const schema = tool?.inputSchema as JsonSchema;
			expect(schema.properties?.newId).toBeDefined();
			expect(schema.properties?.sourcePath).toBeDefined();
			expect(schema.required ?? []).not.toContain("id");
		}

		expect(byName.has("decision_view")).toBe(true);
		for (const name of ["task_view", "document_view", "decision_view"]) {
			const schema = byName.get(name)?.inputSchema as JsonSchema;
			expect(schema.properties?.sourcePath).toBeDefined();
			expect(schema.required ?? []).not.toContain("id");
		}
	});

	it("updates a task ID and title through MCP and views the exact renamed source", async () => {
		const { task } = await mcpServer.createTaskFromInput({ title: "Original Task" });
		const result = await callTool("task_edit", { id: task.id, newId: "10", title: "Renamed Task" });
		expect(result.isError).toBeFalsy();
		expect(getText(result.content)).toContain("Task TASK-10 - Renamed Task");

		const renamedPath = join(mcpServer.filesystem.tasksDir, "TASK-10 - Renamed-Task.md");
		expect(existsSync(renamedPath)).toBe(true);
		const sourcePath = projectPath(renamedPath);
		const view = await callTool("task_view", { sourcePath });
		expect(view.isError).toBeFalsy();
		expect(getText(view.content)).toContain("Task TASK-10 - Renamed Task");

		const mismatch = await callTool("task_view", { id: task.id, sourcePath });
		expect(mismatch.isError).toBe(true);
		expect((mismatch.structuredContent as { code?: string }).code).toBe("SOURCE_MISMATCH");
	});

	it("updates one duplicate document by source path without requiring content", async () => {
		const original = await mcpServer.createDocumentFromInput({ title: "Original", content: "Original body" });
		const duplicate: Document = { ...original, id: "doc-01", title: "Duplicate", path: undefined };
		const duplicatePath = join(mcpServer.filesystem.docsDir, "doc-01 - Duplicate.md");
		await Bun.write(duplicatePath, serializeDocument(duplicate));
		const sourcePath = projectPath(duplicatePath);

		const result = await callTool("document_update", {
			sourcePath,
			newId: "10",
			title: "Renamed Duplicate",
		});
		expect(result.isError).toBeFalsy();
		expect(getText(result.content)).toContain("Document doc-10 - Renamed Duplicate");
		expect(getText(result.content)).toContain("Original body");

		const renamedPath = join(mcpServer.filesystem.docsDir, "doc-10 - Renamed-Duplicate.md");
		expect(existsSync(renamedPath)).toBe(true);
		expect(existsSync(join(mcpServer.filesystem.docsDir, original.path ?? ""))).toBe(true);
		const view = await callTool("document_view", { sourcePath: projectPath(renamedPath) });
		expect(getText(view.content)).toContain("Original body");
	});

	it("adds decision_view and supports source-only identity and title updates", async () => {
		const created = await mcpServer.createDecisionWithTitle("Original Decision");
		const existing = await mcpServer.filesystem.loadDecision(created.id);
		if (!existing?.path) throw new Error("Missing decision path");
		const sourcePath = `backlog/decisions/${existing.path}`;
		const beforeBody = existing.rawContent;

		const view = await callTool("decision_view", { sourcePath });
		expect(view.isError).toBeFalsy();
		expect(getText(view.content)).toContain("Decision decision-1 - Original Decision");
		expect(getText(view.content)).toContain(beforeBody);

		const result = await callTool("decision_update", {
			sourcePath,
			newId: "10",
			title: "Renamed Decision",
		});
		expect(result.isError).toBeFalsy();
		expect(getText(result.content)).toContain("Updated decision decision-10");
		const updated = await mcpServer.filesystem.loadDecision("decision-10");
		expect(updated?.title).toBe("Renamed Decision");
		expect(updated?.rawContent).toBe(beforeBody);
	});
});
