import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { serializeDecision, serializeDocument } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Decision, Document } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;

function makeDocument(id: string, title: string): Document {
	return {
		id,
		title,
		type: "other",
		createdDate: "2026-08-01 00:00",
		rawContent: `${title} body`,
	};
}

function makeDecision(id: string, title: string): Decision {
	return {
		id,
		title,
		date: "2026-08-01 00:00",
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

/**
 * Every request opens its own connection. Bun 1.3.14 on Windows answers only the first request of a
 * keep-alive connection with a route: the second goes to the fallback (404) even though the path is
 * the same one that just matched. A real client - curl and the browser included - is unaffected, and
 * on a healthy runtime this only gives up connection reuse.
 */
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

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("server-documents-endpoint");
	filesystem = new FileSystem(TEST_DIR);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Server Documents Endpoints",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
	});

	// Equivalent-ID fixtures: doc-1/doc-01 and decision-1/decision-001.
	await writeSeed("docs/doc-1 - Alpha.md", serializeDocument(makeDocument("doc-1", "Alpha")));
	await writeSeed("docs/nested/doc-01 - Beta.md", serializeDocument(makeDocument("doc-01", "Beta")));
	await writeSeed("decisions/decision-1 - Alpha.md", serializeDecision(makeDecision("decision-1", "Alpha")));
	await writeSeed("decisions/decision-001 - Beta.md", serializeDecision(makeDecision("decision-001", "Beta")));

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

describe("ambiguous identity over HTTP", () => {
	it("GET /api/docs/:id answers 409 with candidates and leaves files byte-identical", async () => {
		const before = await Bun.file(join(TEST_DIR, "backlog", "docs", "doc-1 - Alpha.md")).text();

		const { status, body } = await fetchJson("/api/docs/doc-1");

		expect(status).toBe(409);
		expect(String(body.error)).toContain("ambiguous");
		expect(Array.isArray(body.candidates)).toBe(true);
		expect(body.candidates).toHaveLength(2);

		const after = await Bun.file(join(TEST_DIR, "backlog", "docs", "doc-1 - Alpha.md")).text();
		expect(after).toBe(before);
	});

	it("PUT /api/docs/:id answers 409 instead of mutating one winner", async () => {
		const before = await Bun.file(join(TEST_DIR, "backlog", "docs", "nested", "doc-01 - Beta.md")).text();

		const { status, body } = await fetchJson("/api/docs/doc-01", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "# Overwritten" }),
		});

		expect(status).toBe(409);
		expect(String(body.error)).toContain("ambiguous");
		const after = await Bun.file(join(TEST_DIR, "backlog", "docs", "nested", "doc-01 - Beta.md")).text();
		expect(after).toBe(before);
	});

	it("GET /api/decisions/:id answers 409 with candidates", async () => {
		const { status, body } = await fetchJson("/api/decisions/decision-1");

		expect(status).toBe(409);
		expect(String(body.error)).toContain("ambiguous");
		expect(body.candidates).toHaveLength(2);
	});

	it("PUT /api/decisions/:id answers 409 with candidates", async () => {
		const before = await Bun.file(join(TEST_DIR, "backlog", "decisions", "decision-001 - Beta.md")).text();

		const { status, body } = await fetchJson("/api/decisions/decision-001", {
			method: "PUT",
			headers: { "Content-Type": "text/plain" },
			body: "## Decision\nOverwritten\n",
		});

		expect(status).toBe(409);
		expect(String(body.error)).toContain("ambiguous");
		const after = await Bun.file(join(TEST_DIR, "backlog", "decisions", "decision-001 - Beta.md")).text();
		expect(after).toBe(before);
	});
});
