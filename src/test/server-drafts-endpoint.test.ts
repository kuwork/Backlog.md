import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let core: Core;

/** The draft handlers under test, reached directly because the socket layer adds no logic here. */
function draftHandlers(target: BacklogServer): {
	handleGetDraft(draftId: string): Promise<Response>;
	handlePromoteDraft(draftId: string): Promise<Response>;
} {
	return target as unknown as {
		handleGetDraft(draftId: string): Promise<Response>;
		handlePromoteDraft(draftId: string): Promise<Response>;
	};
}

function makeDraft(overrides: Partial<Task>): Task {
	return {
		id: "DRAFT-1",
		title: "Draft",
		status: "Draft",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		...overrides,
	};
}

describe("BacklogServer draft handlers fail closed on ambiguous identities", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-drafts");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Drafts",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		server = new BacklogServer(TEST_DIR);
	});

	afterEach(async () => {
		if (server) {
			try {
				await server.stop();
			} catch {
				// The server was never started for these handler-level assertions.
			}
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	async function writeAmbiguousTwins(): Promise<{ first: string; second: string }> {
		const draftsDir = join(TEST_DIR, "backlog", "drafts");
		const first = await core.filesystem.saveDraft(makeDraft({ id: "DRAFT-1", title: "Alpha" }));
		const second = join(draftsDir, "draft-01 - Beta.md");
		await Bun.write(
			second,
			["---", "id: DRAFT-01", "title: Beta", "status: Draft", "created_date: '2026-01-01 00:00'", "---", "", ""].join(
				"\n",
			),
		);
		return { first, second };
	}

	it("returns a single draft through the GET handler", async () => {
		await core.filesystem.saveDraft(makeDraft({ id: "DRAFT-3", title: "Unique" }));

		const response = await draftHandlers(server as BacklogServer).handleGetDraft("draft-3");

		expect(response.status).toBe(200);
		const draft = (await response.json()) as Task;
		expect(draft.id).toBe("DRAFT-3");
	});

	it("returns 409 naming both files for an ambiguous draft and mutates neither", async () => {
		const { first, second } = await writeAmbiguousTwins();
		const firstBefore = await Bun.file(first).text();
		const secondBefore = await Bun.file(second).text();

		const response = await draftHandlers(server as BacklogServer).handleGetDraft("draft-1");

		expect(response.status).toBe(409);
		const payload = (await response.json()) as { error: string; candidates: string[] };
		expect(payload.candidates).toEqual(["draft-01 - Beta.md", "draft-1 - Alpha.md"]);
		expect(payload.error).toContain("ambiguous");
		expect(await Bun.file(first).text()).toBe(firstBefore);
		expect(await Bun.file(second).text()).toBe(secondBefore);
	});

	it("returns 409 instead of promoting an ambiguous draft", async () => {
		const { first, second } = await writeAmbiguousTwins();
		const tasksBefore = await core.filesystem.listTasks();

		const response = await draftHandlers(server as BacklogServer).handlePromoteDraft("draft-1");

		expect(response.status).toBe(409);
		const payload = (await response.json()) as { candidates: string[] };
		expect(payload.candidates).toHaveLength(2);
		expect(await core.filesystem.listTasks()).toHaveLength(tasksBefore.length);
		expect(await Bun.file(first).exists()).toBe(true);
		expect(await Bun.file(second).exists()).toBe(true);
	});
});
