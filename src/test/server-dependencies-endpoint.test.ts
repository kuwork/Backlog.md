import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, installCloseConnectionFetch, retry, safeCleanup } from "./test-utils.ts";

installCloseConnectionFetch();

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

/** The shape the popup reads: one subject, both directions, the unresolved references, the pool. */
interface DependencyAnswer {
	subject: { id: string; hops: number; terminal: boolean };
	dependencies: { direction: string; rows: Array<{ id: string; hops: number }>; truncated: boolean };
	dependents: { rows: Array<{ id: string; hops: number }> };
	unresolved: Array<{ source: string; reference: string; kind: string }>;
	corpus: { tasks: number; completed: number };
}

function makeTask(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		title: "Task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		rawContent: "Task body",
		...overrides,
	};
}

async function get(path: string): Promise<Response> {
	return await fetch(`http://127.0.0.1:${serverPort}${path}`);
}

describe("BacklogServer dependency endpoint", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-dependencies");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Dependencies",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			// The corpus is scanned by prefix, so a project that names its files back-* has to say so.
			prefixes: { task: "back" },
		});

		// A project whose prefix is not the default one, so a bare number has to be resolved against
		// the stored ids rather than against whatever canonicalTaskId would assume.
		await core.createTask(makeTask({ id: "BACK-414", title: "Root" }), false);
		await core.createTask(makeTask({ id: "BACK-2", title: "Middle", dependencies: ["BACK-414"] }), false);
		// A reference that resolves to nothing can only be stored, never introduced (BACK-707), so the
		// corpus is handed one the way a repository that predates the gate would have it.
		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const [root] = (await readdir(tasksDir)).filter((name) => name.startsWith("back-414"));
		const rootPath = join(tasksDir, root as string);
		await writeFile(
			rootPath,
			(await readFile(rootPath, "utf8")).replace(/^dependencies: \[\]$/m, "dependencies: [task-404]"),
			"utf8",
		);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetch(`http://127.0.0.1:${serverPort}/api/tasks`);
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("answers both directions from one request", async () => {
		const response = await get("/api/task/BACK-414/dependencies");
		expect(response.status).toBe(200);

		const answer = (await response.json()) as DependencyAnswer;
		expect(answer.subject).toMatchObject({ id: "BACK-414", hops: 0, terminal: false });
		expect(answer.dependencies.rows.map((row) => `${row.id}@${row.hops}`)).toEqual([]);
		expect(answer.dependents.rows.map((row) => `${row.id}@${row.hops}`)).toEqual(["BACK-2@1"]);
		// The dangling reference contributes no edge, so the empty row list above would otherwise read
		// as "this task depends on nothing" when the file says it depends on task-404.
		expect(answer.unresolved).toEqual([
			expect.objectContaining({ source: "BACK-414", reference: "task-404", kind: "unresolvable" }),
		]);
		expect(answer.corpus.tasks).toBe(2);
	});

	it("accepts the bare number, and refuses one no record answers to", async () => {
		const bare = await get("/api/task/414/dependencies");
		expect(bare.status).toBe(200);
		expect(((await bare.json()) as DependencyAnswer).subject.id).toBe("BACK-414");

		// A different explicit prefix is a different identity, which is the rule the write gate uses.
		expect((await get("/api/task/TASK-414/dependencies")).status).toBe(404);
		expect((await get("/api/task/BACK-999/dependencies")).status).toBe(404);
	});

	it("narrows to one direction and rejects a malformed hop bound", async () => {
		const one = (await (await get("/api/task/414/dependencies?direction=dependencies")).json()) as {
			direction: string;
			subject: { id: string };
		};
		expect(one.direction).toBe("dependencies");
		expect(one.subject.id).toBe("BACK-414");

		expect((await get("/api/task/414/dependencies?maxHops=0")).status).toBe(400);
		expect((await get("/api/task/414/dependencies?maxHops=1")).status).toBe(200);
	});
});
