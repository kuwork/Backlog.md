import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { serializeDecision, serializeDocument } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Decision, Document } from "../types/index.ts";
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

function makeDecision(id: string, title: string): Decision {
	return {
		id,
		title,
		date: "2026-11-18 00:00",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		rawContent: "",
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

async function del(path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, {
		method: "DELETE",
		headers: { ...(body ? { "Content-Type": "application/json" } : {}), Connection: "close" },
		body: body ? JSON.stringify(body) : undefined,
	});
	let parsed: Record<string, unknown> = {};
	try {
		parsed = (await response.json()) as Record<string, unknown>;
	} catch {
		parsed = {};
	}
	return { status: response.status, body: parsed };
}

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("server-docs-decisions-delete");
	filesystem = new FileSystem(TEST_DIR);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server Docs Decisions Delete",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	await writeSeed("docs/doc-1 - Alpha.md", serializeDocument(makeDocument("doc-1", "Alpha")));
	await writeSeed("docs/guides/nested.md", serializeDocument(makeDocument("doc-2", "Nested")));
	await mkdir(join(TEST_DIR, "backlog", "docs", "folder-with-files", "sub"), { recursive: true });
	await writeSeed("docs/folder-with-files/sub/doc-3 - Deep.md", serializeDocument(makeDocument("doc-3", "Deep")));
	await writeSeed("decisions/decision-1 - Alpha.md", serializeDecision(makeDecision("decision-1", "Alpha")));

	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	const readiness = await fetch(`http://127.0.0.1:${serverPort}/api/statistics`, {
		headers: { Connection: "close" },
	});
	expect(readiness.status).toBe(200);
});

afterEach(async () => {
	if (server) {
		await server.stop();
		server = null;
	}
	await retry(() => safeCleanup(TEST_DIR), 3, 200);
});

describe("DELETE /api/docs/:id", () => {
	it("deletes a root document by id", async () => {
		const { status } = await del("/api/docs/doc-1");
		expect(status).toBe(204);
		expect(await pathExists("docs/doc-1 - Alpha.md")).toBe(false);
	});

	it("deletes a document stored in a subfolder", async () => {
		const { status } = await del("/api/docs/doc-2");
		expect(status).toBe(204);
		expect(await pathExists("docs/guides/nested.md")).toBe(false);
	});

	it("returns 404 when the document does not exist", async () => {
		const { status, body } = await del("/api/docs/doc-999");
		expect(status).toBe(404);
		expect(body.error).toBe("Document not found");
	});
});

describe("DELETE /api/decisions/:id", () => {
	it("deletes a decision by id", async () => {
		const { status } = await del("/api/decisions/decision-1");
		expect(status).toBe(204);
		expect(await pathExists("decisions/decision-1 - Alpha.md")).toBe(false);
	});

	it("returns 404 when the decision does not exist", async () => {
		const { status, body } = await del("/api/decisions/decision-999");
		expect(status).toBe(404);
		expect(body.error).toBe("Decision not found");
	});
});

describe("DELETE /api/docs/folder", () => {
	it("recursively deletes a folder and all of its documents", async () => {
		const { status } = await del("/api/docs/folder", { path: "folder-with-files" });
		expect(status).toBe(204);
		expect(await pathExists("docs/folder-with-files")).toBe(false);
	});

	it("returns 404 when the folder does not exist", async () => {
		const { status, body } = await del("/api/docs/folder", { path: "missing-folder" });
		expect(status).toBe(404);
		expect(body.error).toBe("Docs folder not found");
	});

	it("rejects path traversal", async () => {
		const { status } = await del("/api/docs/folder", { path: "../decisions" });
		expect(status).toBe(400);
		expect(await pathExists("decisions/decision-1 - Alpha.md")).toBe(true);
	});

	it("rejects an empty path", async () => {
		const { status } = await del("/api/docs/folder", { path: "" });
		expect(status).toBe(400);
	});
});
