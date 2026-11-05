import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import {
	isSensitiveReference,
	projectPathForCollection,
	referenceCandidates,
	splitReferenceRange,
} from "../file-system/reference-paths.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, installCloseConnectionFetch, retry, safeCleanup } from "./test-utils.ts";

installCloseConnectionFetch();

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;

function url(path: string): string {
	return `http://127.0.0.1:${serverPort}${path}`;
}

describe("BACK-835 reference resolution", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-reference-paths");
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Reference Paths",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		const backlogDir = filesystem.backlogDir;
		await mkdir(join(backlogDir, "docs", "PRDS", "sqlite"), { recursive: true });
		await mkdir(join(backlogDir, "assets"), { recursive: true });
		await mkdir(join(TEST_DIR, "scripts"), { recursive: true });
		await mkdir(join(TEST_DIR, ".git"), { recursive: true });

		await mkdir(join(backlogDir, "docs", "PRDS", "cypher", "test"), { recursive: true });
		await writeFile(join(backlogDir, "docs", "PRDS", "sqlite", "fig.png"), "PNG");
		await writeFile(join(backlogDir, "docs", "PRDS", "sqlite", "doc.md"), "line1\nline2\nline3");
		await writeFile(
			join(backlogDir, "docs", "PRDS", "cypher", "test", "doc-34 - test-doc.md"),
			"---\nid: doc-34\ntitle: test-doc\ntype: other\ncreated_date: '2026-11-06 01:34'\n---\n[auto-port](../../../../wiki/concepts/auto-port.md)\n",
		);
		await writeFile(join(backlogDir, "assets", "legacy.png"), "LEGACY");
		await writeFile(join(TEST_DIR, "scripts", "note.md"), "sibling\nsecond\nthird");
		await writeFile(join(TEST_DIR, "scripts", "report.docx"), "DOCX");
		await writeFile(join(TEST_DIR, ".git", "config"), "secret");
		await writeFile(join(TEST_DIR, "big.png"), Buffer.alloc(5 * 1024 * 1024 + 1));

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		serverPort = server.getPort() ?? 0;
		await retry(
			async () => {
				const response = await fetch(url("/api/status"));
				if (!response.ok) throw new Error("server not ready");
			},
			10,
			50,
		);
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("serves a joined sibling image through the try_files fallback", async () => {
		const response = await fetch(url("/backlog/docs/PRDS/sqlite/fig.png"));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(await response.text()).toBe("PNG");
	});

	it("serves files in a directory beside the configured data directory", async () => {
		const response = await fetch(url("/scripts/note.md"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("sibling\nsecond\nthird");
	});

	it("keeps registered /assets/* route priority", async () => {
		const response = await fetch(url("/assets/legacy.png"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("LEGACY");
	});

	it("resolves the legacy assets tail of a joined path", async () => {
		const response = await fetch(url("/backlog/docs/PRDS/sqlite/assets/legacy.png"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("LEGACY");
	});

	it("keeps /api routes out of the fallback", async () => {
		const response = await fetch(url("/api/status"));
		expect(response.status).toBe(200);
		expect((await response.json()) as { initialized: boolean }).toBeTruthy();
	});

	it("resolves /api/file-content through the shared resolver with a line range", async () => {
		const response = await fetch(url("/api/file-content?path=scripts/note.md:2"));
		expect(response.status).toBe(200);
		const body = (await response.json()) as { content: string; path: string; lineStart: number };
		expect(body.content).toBe("second");
		expect(body.path).toBe("scripts/note.md");
		expect(body.lineStart).toBe(2);
	});

	it("opens an Office binary outside the data directory through /api/raw-file", async () => {
		const response = await fetch(url("/api/raw-file?path=scripts/report.docx"));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("wordprocessingml");
		expect(await response.text()).toBe("DOCX");
	});

	it("resolves a legacy assets/... body path through /api/raw-file", async () => {
		const response = await fetch(url("/api/raw-file?path=assets/legacy.png"));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("LEGACY");
	});

	it("rejects traversal and sensitive files", async () => {
		expect((await fetch(url("/api/file-content?path=../../../../etc/passwd"))).status).toBeGreaterThanOrEqual(400);
		expect((await fetch(url("/api/raw-file?path=../../../../etc/passwd"))).status).toBeGreaterThanOrEqual(400);
		expect((await fetch(url("/.git/config"))).status).toBe(404);
		expect((await fetch(url("/api/preview?type=wiki&id=../../src/foo"))).status).toBe(403);
	});

	it("rejects files larger than 5MB", async () => {
		expect((await fetch(url("/big.png"))).status).toBe(400);
	});

	it("honours a custom data directory name in the ordered candidate list", () => {
		const candidates = referenceCandidates("fig.png", { dataDir: ".backlog", docsDir: ".backlog/docs" });
		expect(candidates[0]).toBe("fig.png");
		expect(candidates[1]).toBe(".backlog/fig.png");
		expect(candidates).toContain(".backlog/assets/fig.png");
		expect(candidates).toContain(".backlog/docs/fig.png");
	});

	it("splits a line range without touching the path", () => {
		expect(splitReferenceRange("/scripts/note.md:12-20")).toEqual({
			path: "scripts/note.md",
			range: ":12-20",
		});
	});

	it("flags dot-directory references as sensitive", () => {
		expect(isSensitiveReference("backlog/assets/.temp/x.png")).toBe(true);
		expect(isSensitiveReference("scripts/note.md")).toBe(false);
	});

	it("derives a project-relative collection path without hard-coding the data directory", () => {
		expect(projectPathForCollection("backlog/docs", "PRDS/cypher/test/doc-34 - test-doc.md")).toBe(
			"backlog/docs/PRDS/cypher/test/doc-34 - test-doc.md",
		);
		expect(projectPathForCollection(".backlog\\docs\\", "\\PRDS\\doc.md")).toBe(".backlog/docs/PRDS/doc.md");
		expect(projectPathForCollection("", "doc.md")).toBe("doc.md");
	});

	it("exposes a project-relative path for the render-time join on both document endpoints", async () => {
		const projectPath = "backlog/docs/PRDS/cypher/test/doc-34 - test-doc.md";
		const list = (await (await fetch(url("/api/docs"))).json()) as {
			id: string;
			path?: string;
			projectPath?: string;
		}[];
		const entry = list.find((doc) => doc.id === "doc-34");
		expect(entry?.path).toBe("PRDS/cypher/test/doc-34 - test-doc.md");
		expect(entry?.projectPath).toBe(projectPath);

		const single = (await (await fetch(url("/api/doc/doc-34"))).json()) as { projectPath?: string };
		expect(single.projectPath).toBe(projectPath);
	});
});
