import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

setDefaultTimeout(60_000);

let TEST_DIR: string;
let server: McpServer;

describe("MCP re-parent via task_edit", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-reparent");
		server = new McpServer(TEST_DIR, "Test instructions");
		await server.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await initializeTestProject(server, "Test Project");

		const config = await server.filesystem.loadConfig();
		if (!config) throw new Error("Failed to load config");
		registerTaskTools(server, config);

		await server.testInterface.callTool({ params: { name: "task_create", arguments: { title: "Parent" } } });
		await server.testInterface.callTool({ params: { name: "task_create", arguments: { title: "Child" } } });
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore
		}
		await safeCleanup(TEST_DIR);
	});

	it("sets parentTaskId with a string, clears it with null, and rejects an unknown parent", async () => {
		await server.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-2", parentTaskId: "task-1" } },
		});
		expect((await server.getTask("task-2"))?.parentTaskId).toBe("TASK-1");

		await server.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-2", parentTaskId: null } },
		});
		expect((await server.getTask("task-2"))?.parentTaskId).toBeUndefined();

		const unknown = await server.testInterface.callTool({
			params: { name: "task_edit", arguments: { id: "task-2", parentTaskId: "task-999" } },
		});
		expect(unknown.isError).toBe(true);
	}, 30_000);
});
