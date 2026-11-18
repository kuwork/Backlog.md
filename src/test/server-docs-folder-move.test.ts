import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { serializeDocument } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Document } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;

function makeDocument(id: string, title: string): Document {
	return {
		id,
		title,
		type: "other",
		createdDate: "2026-11-18 00:00",
		rawContent: `${title} body`,
	};
}

async function writeSeed(relativePath: string, content: string): Promise<string> {
	const filePath = join(TEST_DIR, "backlog", ...relativePath.split("/"));
	await Bun.write(filePath, content);
	return filePath;
}

async function pathExists(relativePath: string): Promise<boolean> {
	try {
		await stat(join(TEST_DIR, "backlog", ...relativePath.split("/")));
		return true;
	} catch {
		return false;
	}
}

async function fetchJson(path: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> }> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, {
		...init,
		headers: { ...(init?.headers as Record<string, string> | undefined), Connection: "close" },
	});
	let body: Record<string, unknown> = {};
	try {
		body = (await response.json()) as Record<string, unknown>;
	} catch {
		body = {};
	}
	return { status: response.status, body };
}

async function moveFolder(sourcePath: string, targetParentPath: string) {
	return fetchJson("/api/docs/folder", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sourcePath, targetParentPath }),
	});
}

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("server-docs-folder-move");
	filesystem = new FileSystem(TEST_DIR);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server Docs Folder Move",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	await writeSeed("docs/source/nested/doc-1 - Alpha.md", serializeDocument(makeDocument("doc-1", "Alpha")));
	await mkdir(join(TEST_DIR, "backlog", "docs", "source", "empty"), { recursive: true });
	await mkdir(join(TEST_DIR, "backlog", "docs", "empty-source"), { recursive: true });
	await mkdir(join(TEST_DIR, "backlog", "docs", "destination"), { recursive: true });
	await writeSeed("docs/container/inside/doc-2 - Beta.md", serializeDocument(makeDocument("doc-2", "Beta")));
	await writeSeed("docs/file-source.md", "not a directory");
	await writeSeed("docs/target-file.md", "not a directory");

	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	// Wait for the warm-up started by BacklogServer.start() before tests can stop the server.
	// Otherwise initialization can continue after stop() and recreate files during cleanup.
	const readiness = await fetchJson("/api/statistics");
	expect(readiness.status).toBe(200);
});

afterEach(async () => {
	if (server) {
		await server.stop();
		server = null;
	}
	await retry(() => safeCleanup(TEST_DIR), 3, 200);
});

describe("PATCH /api/docs/folder", () => {
	it("moves nested documents and empty directories without changing file content", async () => {
		const oldDocumentPath = join(TEST_DIR, "backlog", "docs", "source", "nested", "doc-1 - Alpha.md");
		const before = await Bun.file(oldDocumentPath).text();

		const { status, body } = await moveFolder("source", "destination");

		expect(status).toBe(200);
		expect(body).toEqual({ success: true, path: "destination/source" });
		expect(await pathExists("docs/source")).toBe(false);
		expect(await pathExists("docs/destination/source/empty")).toBe(true);
		const movedDocument = join(TEST_DIR, "backlog", "docs", "destination", "source", "nested", "doc-1 - Alpha.md");
		expect(await Bun.file(movedDocument).text()).toBe(before);

		const treeResponse = await fetchJson("/api/docs/tree");
		expect(treeResponse.status).toBe(200);
		expect(JSON.stringify(treeResponse.body)).toContain("destination/source/nested/doc-1 - Alpha.md");
	});

	it("moves an empty-only folder", async () => {
		const { status, body } = await moveFolder("empty-source", "destination");

		expect(status).toBe(200);
		expect(body.path).toBe("destination/empty-source");
		expect(await pathExists("docs/empty-source")).toBe(false);
		expect(await pathExists("docs/destination/empty-source")).toBe(true);
	});

	it("moves a nested folder to the docs root", async () => {
		const { status, body } = await moveFolder("container/inside", "");

		expect(status).toBe(200);
		expect(body.path).toBe("inside");
		expect(await pathExists("docs/container/inside")).toBe(false);
		expect(await pathExists("docs/inside/doc-2 - Beta.md")).toBe(true);
	});

	it("returns the current path without moving a folder dropped into its current parent", async () => {
		const { status, body } = await moveFolder("source", "");

		expect(status).toBe(200);
		expect(body).toEqual({ success: true, path: "source" });
		expect(await pathExists("docs/source/nested/doc-1 - Alpha.md")).toBe(true);
	});

	it("rejects moving a folder into itself or a descendant", async () => {
		for (const targetParentPath of ["source", "source/nested"]) {
			const { status, body } = await moveFolder("source", targetParentPath);
			expect(status).toBe(400);
			expect(String(body.error)).toContain("itself or a descendant");
			expect(await pathExists("docs/source/nested/doc-1 - Alpha.md")).toBe(true);
		}
	});

	it("returns 404 for missing source or target parent folders", async () => {
		const missingSource = await moveFolder("missing", "destination");
		expect(missingSource.status).toBe(404);
		expect(missingSource.body.error).toBe("Docs folder not found");

		const missingTarget = await moveFolder("source", "missing");
		expect(missingTarget.status).toBe(404);
		expect(missingTarget.body.error).toBe("Target docs folder not found");
		expect(await pathExists("docs/source/nested/doc-1 - Alpha.md")).toBe(true);
	});

	it("returns 409 when the destination already exists", async () => {
		await writeSeed(
			"docs/destination/source/doc-3 - Existing.md",
			serializeDocument(makeDocument("doc-3", "Existing")),
		);

		const { status, body } = await moveFolder("source", "destination");

		expect(status).toBe(409);
		expect(body.error).toBe("Docs folder already exists");
		expect(await pathExists("docs/source/nested/doc-1 - Alpha.md")).toBe(true);
		expect(await pathExists("docs/destination/source/doc-3 - Existing.md")).toBe(true);
	});

	it("rejects traversal, absolute paths, and non-directory endpoints", async () => {
		for (const sourcePath of ["../source", "C:\\outside", "/outside"]) {
			const { status } = await moveFolder(sourcePath, "destination");
			expect(status).toBe(400);
		}
		for (const targetParentPath of ["../destination", "C:\\outside", "/outside"]) {
			const { status } = await moveFolder("source", targetParentPath);
			expect(status).toBe(400);
		}

		const fileSource = await moveFolder("file-source.md", "destination");
		expect(fileSource.status).toBe(400);
		expect(fileSource.body.error).toBe("Source is not a docs folder");

		const fileTarget = await moveFolder("source", "target-file.md");
		expect(fileTarget.status).toBe(400);
		expect(fileTarget.body.error).toBe("Target is not a docs folder");
		expect(await pathExists("docs/source/nested/doc-1 - Alpha.md")).toBe(true);
	});

	it("validates the request payload", async () => {
		const { status } = await fetchJson("/api/docs/folder", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sourcePath: "source" }),
		});
		expect(status).toBe(400);
	});
});
