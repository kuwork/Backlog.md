import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { WikiTreeNode } from "../types/index.ts";
import { createUniqueTestDir, installCloseConnectionFetch, safeCleanup } from "./test-utils.ts";

installCloseConnectionFetch();

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;

async function writeSeed(relativePath: string, content: string): Promise<string> {
	const filePath = join(TEST_DIR, "backlog", ...relativePath.split("/"));
	await Bun.write(filePath, content);
	return filePath;
}

async function fetchJson(path: string): Promise<{ status: number; body: unknown }> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`);
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		body = null;
	}
	return { status: response.status, body };
}

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("server-wiki-tree-endpoint");
	filesystem = new FileSystem(TEST_DIR);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server Wiki Tree Endpoint",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	// Titles deliberately unrelated to the file names, one nested page, one page without frontmatter.
	await writeSeed("wiki/index.md", "---\ntitle: Wiki Content Catalog\n---\n# Wiki");
	await writeSeed("wiki/guides/setup.md", "---\ntitle: Setup Guide\n---\n# Setup");
	await writeSeed("wiki/plain-page.md", "# No frontmatter here");

	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
});

afterEach(async () => {
	if (server) {
		await server.stop();
		server = null;
	}
	await safeCleanup(TEST_DIR);
});

describe("GET /api/wiki/tree", () => {
	it("titles every page from the corpus, at every level, and leaves folders untitled", async () => {
		const { status, body } = await fetchJson("/api/wiki/tree");
		expect(status).toBe(200);

		const tree = body as WikiTreeNode[];
		const byName = (nodes: WikiTreeNode[], name: string) => nodes.find((node) => node.name === name);

		expect(byName(tree, "index.md")?.title).toBe("Wiki Content Catalog");

		const guides = byName(tree, "guides");
		expect(guides?.title).toBeUndefined();
		expect(byName(guides?.children ?? [], "setup.md")?.title).toBe("Setup Guide");

		// Pages without a frontmatter title carry their file name, which is also the client fallback.
		expect(byName(tree, "plain-page.md")?.title).toBe("plain-page");
	});

	it("leaves the file names untouched so the sidebar can still list them", async () => {
		const { body } = await fetchJson("/api/wiki/tree");
		const tree = body as WikiTreeNode[];

		expect(tree.map((node) => node.name).sort()).toEqual(["guides", "index.md", "plain-page.md"]);
	});
});
