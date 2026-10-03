import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { memoDir } from "../core/memos.ts";
import { stringifyFrontmatter } from "../markdown/frontmatter.ts";
import { McpServer } from "../mcp/server.ts";
import { registerMemoTools } from "../mcp/tools/memos/index.ts";
import type { BacklogConfig } from "../types/index.ts";
import { formatLocalDateKey, localDateTimeToStoredUtc } from "../utils/date-utc.ts";
import { initializeTestProject } from "./test-utils.ts";

/**
 * MCP memo tool tests run against a scratch project built with mkdtemp OUTSIDE the repo. The scratch
 * project must be fully initialized, otherwise anything that resolves a project root walks up the
 * tree, finds the real repository and writes into its real backlog/ folder.
 */

// Helper to extract text from MCP content (handles union types)
const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let mcpServer: McpServer;

function today(): string {
	return formatLocalDateKey(new Date());
}

/** Seeds a memo for a chosen day; `created_date` is stored UTC, so the local day is converted. */
async function seedOldMemo(
	id: string,
	localDay: string,
	time: string,
	body: string,
	tags: string[] = [],
): Promise<void> {
	await Bun.write(
		join(memoDir(TEST_DIR), `${id}.md`),
		stringifyFrontmatter(body, {
			id,
			created_date: localDateTimeToStoredUtc(`${localDay} ${time}`),
			updated_date: localDateTimeToStoredUtc(`${localDay} ${time}`),
			...(tags.length > 0 && { tags }),
		}),
	);
}

describe("MCP memo tools", () => {
	beforeEach(async () => {
		TEST_DIR = await mkdtemp(join(tmpdir(), "backlog-mcp-memos-"));
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await initializeTestProject(mcpServer, "Memo Project");
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load backlog configuration for tests");
		}
		registerMemoTools(mcpServer, config as BacklogConfig);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// ignore shutdown issues in tests
		}
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	it("registers all five memo tools with schemas and descriptions", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const names = tools.tools.map((tool) => tool.name);
		expect(names).toEqual(
			expect.arrayContaining(["memo_create", "memo_list", "memo_view", "memo_update", "memo_delete"]),
		);
		for (const name of ["memo_create", "memo_list", "memo_view", "memo_update", "memo_delete"]) {
			const tool = tools.tools.find((entry) => entry.name === name);
			expect(tool?.description).toBeTruthy();
			expect(tool?.inputSchema?.type).toBe("object");
		}
	});

	it("creates, views and lists memos", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "memo_create",
				arguments: { content: "Idea about memo tools\n\nSecond line", tags: ["idea"] },
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Memo created successfully.");
		expect(createText).toMatch(/Memo \d{8}-1 - Idea about memo tools/);
		expect(createText).toContain("Tags: idea");
		expect(createText).toContain("Second line");

		const id = /Memo (\d{8}-1) -/.exec(createText)?.[1] as string;

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_view", arguments: { id } },
		});
		const viewText = getText(viewResult.content);
		expect(viewText).toContain(`Memo ${id} - Idea about memo tools`);
		expect(viewText).toContain("Tags: idea");
		expect(viewText).toContain("Second line");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: {} },
		});
		const listText = getText(listResult.content);
		expect(listText).toContain("Memos:");
		expect(listText).toContain(`${id} - Idea about memo tools`);
		expect(listText).toContain("tags: idea");
	});

	it("reports an empty memo list", async () => {
		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: {} },
		});
		expect(getText(listResult.content)).toContain("No memos found.");
		const structured = listResult.structuredContent as {
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

	it("paginates with limit and offset and exposes items plus hasMore", async () => {
		for (const body of ["one", "two", "three"]) {
			await mcpServer.testInterface.callTool({
				params: { name: "memo_create", arguments: { content: body } },
			});
		}

		const firstPage = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: { limit: 2 } },
		});
		const firstStructured = firstPage.structuredContent as {
			items: { id: string; displayTitle: string }[];
			total: number;
			offset: number;
			limit: number;
			hasMore: boolean;
		};
		expect(firstStructured.items.map((memo) => memo.displayTitle)).toEqual(["three", "two"]);
		expect(firstStructured.total).toBe(3);
		expect(firstStructured.offset).toBe(0);
		expect(firstStructured.limit).toBe(2);
		expect(firstStructured.hasMore).toBe(true);
		expect(getText(firstPage.content)).toContain("Showing 1-2 of 3 memos.");

		const secondPage = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: { limit: 2, offset: 2 } },
		});
		const secondStructured = secondPage.structuredContent as {
			items: { id: string; displayTitle: string }[];
			total: number;
			offset: number;
			limit: number;
			hasMore: boolean;
		};
		expect(secondStructured.items.map((memo) => memo.displayTitle)).toEqual(["one"]);
		expect(secondStructured.total).toBe(3);
		expect(secondStructured.offset).toBe(2);
		expect(secondStructured.limit).toBe(2);
		expect(secondStructured.hasMore).toBe(false);
		expect(getText(secondPage.content)).toContain("Showing 3-3 of 3 memos.");
	});

	it("filters by date and tags", async () => {
		await mcpServer.testInterface.callTool({
			params: { name: "memo_create", arguments: { content: "tagged note", tags: ["idea"] } },
		});
		await mcpServer.testInterface.callTool({
			params: { name: "memo_create", arguments: { content: "untagged note" } },
		});
		await seedOldMemo("20200101-1", "2020-01-01", "09:00", "old note", ["idea"]);

		const dateFiltered = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: { date: today() } },
		});
		const dateText = getText(dateFiltered.content);
		expect(dateText).toContain("tagged note");
		expect(dateText).toContain("untagged note");
		expect(dateText).not.toContain("old note");

		const pastFiltered = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: { date: "2020-01-01" } },
		});
		const pastStructured = pastFiltered.structuredContent as { items: { id: string }[] };
		expect(pastStructured.items.map((memo) => memo.id)).toEqual(["20200101-1"]);

		const tagFiltered = await mcpServer.testInterface.callTool({
			params: { name: "memo_list", arguments: { tags: ["IDEA"] } },
		});
		const tagText = getText(tagFiltered.content);
		expect(tagText).toContain("tagged note");
		expect(tagText).toContain("old note");
		expect(tagText).not.toContain("untagged note");
	});

	it("replaces or appends the memo body", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_create", arguments: { content: "original body", tags: ["draft"] } },
		});
		const id = /Memo (\d{8}-1) -/.exec(getText(createResult.content))?.[1] as string;

		const replaceResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_update", arguments: { id, content: "replaced body", tags: ["done"] } },
		});
		const replaceText = getText(replaceResult.content);
		expect(replaceText).toContain("Memo updated successfully.");
		expect(replaceText).toContain("replaced body");
		expect(replaceText).toContain("Tags: done");

		const appendResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_update", arguments: { id, append: "appended line" } },
		});
		const appendText = getText(appendResult.content);
		expect(appendText).toContain("Memo updated successfully.");
		expect(appendText).toContain("replaced body\nappended line");
	});

	it("requires exactly one of content or append on update", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_create", arguments: { content: "body" } },
		});
		const id = /Memo (\d{8}-1) -/.exec(getText(createResult.content))?.[1] as string;

		const neither = await mcpServer.testInterface.callTool({
			params: { name: "memo_update", arguments: { id } },
		});
		expect(neither.isError).toBe(true);
		expect(getText(neither.content)).toContain("Exactly one of 'content'");

		const both = await mcpServer.testInterface.callTool({
			params: { name: "memo_update", arguments: { id, content: "a", append: "b" } },
		});
		expect(both.isError).toBe(true);
		expect(getText(both.content)).toContain("Exactly one of 'content'");
	});

	it("returns a not-found error for unknown memo ids", async () => {
		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_view", arguments: { id: "20991231-9" } },
		});
		expect(viewResult.isError).toBe(true);
		expect((viewResult.structuredContent as { code?: string }).code).toBe("MEMO_NOT_FOUND");
		expect(getText(viewResult.content)).toContain("Memo not found: 20991231-9");

		const updateResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_update", arguments: { id: "20991231-9", content: "nope" } },
		});
		expect(updateResult.isError).toBe(true);
		expect((updateResult.structuredContent as { code?: string }).code).toBe("MEMO_NOT_FOUND");

		const deleteResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_delete", arguments: { id: "20991231-9" } },
		});
		expect(deleteResult.isError).toBe(true);
		expect((deleteResult.structuredContent as { code?: string }).code).toBe("MEMO_NOT_FOUND");
	});

	it("deletes a memo", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_create", arguments: { content: "to be deleted" } },
		});
		const id = /Memo (\d{8}-1) -/.exec(getText(createResult.content))?.[1] as string;

		const deleteResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_delete", arguments: { id } },
		});
		expect(getText(deleteResult.content)).toContain(`Memo deleted: ${id}`);

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "memo_view", arguments: { id } },
		});
		expect(viewResult.isError).toBe(true);
		expect((viewResult.structuredContent as { code?: string }).code).toBe("MEMO_NOT_FOUND");
	});
});
