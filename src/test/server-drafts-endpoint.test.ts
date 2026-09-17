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

/** The task routes under test; they serve drafts as well, which is the point of the block below. */
function taskHandlers(target: BacklogServer): {
	handleGetTask(taskId: string): Promise<Response>;
	handleUpdateTask(req: Request, taskId: string): Promise<Response>;
} {
	return target as unknown as {
		handleGetTask(taskId: string): Promise<Response>;
		handleUpdateTask(req: Request, taskId: string): Promise<Response>;
	};
}

function updateRequest(taskId: string, updates: unknown): Request {
	return new Request(`http://localhost/api/tasks/${encodeURIComponent(taskId)}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(updates),
	});
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

describe("BacklogServer draft handlers fail closed on ambiguous identities", () => {
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

describe("BacklogServer task routes serve drafts", () => {
	it("returns a draft through the task GET handler", async () => {
		const created = await core.createTaskFromInput({ title: "Only draft", status: "Draft" }, false);

		const response = await taskHandlers(server as BacklogServer).handleGetTask(created.task.id);

		expect(response.status).toBe(200);
		const draft = (await response.json()) as Task;
		expect(draft.id).toBe(created.task.id);
		expect(draft.title).toBe("Only draft");
	});

	// Reporter flow: a draft opened from the web Drafts page is saved on the task route it uses.
	it("saves an edit to a draft instead of reporting it as a missing task", async () => {
		await core.createTaskFromInput({ title: "First draft", status: "Draft" }, false);
		const second = await core.createTaskFromInput({ title: "Second draft", status: "Draft" }, false);
		const draftId = second.task.id;

		const response = await taskHandlers(server as BacklogServer).handleUpdateTask(
			updateRequest(draftId, {
				title: "Second draft edited",
				description: "Edited from the drafts page",
				status: "Draft",
				acceptanceCriteriaItems: [{ text: "Draft edits persist", checked: false }],
			}),
			draftId,
		);

		expect(response.status).toBe(200);
		const updated = (await response.json()) as Task;
		expect(updated.id).toBe(draftId);
		expect(updated.title).toBe("Second draft edited");
		expect(updated.status).toBe("Draft");

		const stored = await core.filesystem.loadDraft(draftId);
		expect(stored?.title).toBe("Second draft edited");
		expect(stored?.description).toContain("Edited from the drafts page");
		expect(stored?.acceptanceCriteriaItems?.[0]?.text).toBe("Draft edits persist");

		// The edit must not move the draft into the task folder.
		expect(await core.filesystem.loadTask(draftId)).toBeNull();
	});

	it("promotes a draft when the request sets a configured status", async () => {
		const created = await core.createTaskFromInput({ title: "Promote me", status: "Draft" }, false);

		const response = await taskHandlers(server as BacklogServer).handleUpdateTask(
			updateRequest(created.task.id, { title: "Promote me", status: "To Do" }),
			created.task.id,
		);

		expect(response.status).toBe(200);
		const promoted = (await response.json()) as Task;
		expect(promoted.id.startsWith("TASK-")).toBe(true);
		expect(promoted.status).toBe("To Do");
		expect(await core.filesystem.loadDraft(created.task.id)).toBeNull();
		expect(await core.filesystem.loadTask(promoted.id)).not.toBeNull();
	});

	it("keeps a prefix-less id pointing at the task with that number", async () => {
		const task = await core.createTaskFromInput({ title: "Real task one" }, false);
		const bareId = task.task.id.replace(/^[a-zA-Z]+-/, "");
		// A draft sharing the task's number must stay out of reach of the bare id.
		const draftId = `DRAFT-${bareId}`;
		await core.filesystem.saveDraft(makeDraft({ id: draftId, title: "Only draft" }));

		const read = await taskHandlers(server as BacklogServer).handleGetTask(bareId);
		expect(read.status).toBe(200);
		expect(((await read.json()) as Task).id).toBe(task.task.id);

		const write = await taskHandlers(server as BacklogServer).handleUpdateTask(
			updateRequest(bareId, { title: "Real task one edited" }),
			bareId,
		);
		expect(write.status).toBe(200);
		expect(((await write.json()) as Task).id).toBe(task.task.id);
		expect((await core.filesystem.loadDraft(draftId))?.title).toBe("Only draft");
	});

	it("reports an unknown draft id as missing", async () => {
		const read = await taskHandlers(server as BacklogServer).handleGetTask("DRAFT-9");

		expect(read.status).toBe(404);

		const write = await taskHandlers(server as BacklogServer).handleUpdateTask(
			updateRequest("DRAFT-9", { title: "Nope" }),
			"DRAFT-9",
		);

		expect(write.status).toBe(404);
		expect(((await write.json()) as { error: string }).error).toBe("Draft not found");
	});
});
