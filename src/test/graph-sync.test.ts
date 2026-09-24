import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations";
import { defaultMetaPath } from "../graph/cold-start";
import { computeFileHash, loadMetaCache, saveMetaCache } from "../graph/fingerprint";
import { computeChangeSet, RecordCache } from "../graph/incremental";
import { GraphService } from "../graph/service";
import { MemoryGraphStore } from "../graph/store";
import { computeRecordReadiness, findDependencyCycles, validateCounts } from "../graph/validation";

function taskMd(options: {
	id: string;
	status?: string;
	dependencies?: string[];
	parent_task_id?: string;
	milestone?: string;
	title?: string;
}): string {
	const lines = [
		"---",
		`id: ${options.id}`,
		`title: ${options.title ?? `Task ${options.id}`}`,
		`status: ${options.status ?? "To Do"}`,
	];
	if (options.dependencies?.length) lines.push(`dependencies: [${options.dependencies.join(", ")}]`);
	if (options.parent_task_id) lines.push(`parent_task_id: ${options.parent_task_id}`);
	if (options.milestone) lines.push(`milestone: ${options.milestone}`);
	lines.push("---", "", "body", "");
	return lines.join("\n");
}

async function retry<T>(fn: () => Promise<T>, attempts = 40, delayMs = 250): Promise<T> {
	let lastError: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
	throw lastError;
}

describe("graph change set", () => {
	const hash = (content: string) => computeFileHash(content);
	const fp = (content: string) => ({ size: content.length, mtimeMs: 1, hash: hash(content) });

	test("added/removed/changed are derived from hash comparison", () => {
		const a = "a".repeat(10);
		const a2 = "a".repeat(11);
		const b = "b".repeat(10);
		const previous = { "tasks/a.md": fp(a), "tasks/gone.md": fp("x") };
		const next = { "tasks/a.md": fp(a2), "tasks/b.md": fp(b) };
		expect(computeChangeSet(previous, next)).toEqual({
			added: ["tasks/b.md"],
			removed: ["tasks/gone.md"],
			changed: ["tasks/a.md"],
		});
	});

	test("identical content keeps the change set empty", () => {
		const a = "same";
		const previous = { "tasks/a.md": fp(a) };
		const next = { "tasks/a.md": { size: a.length, mtimeMs: 999, hash: hash(a) } };
		const changeSet = computeChangeSet(previous, next);
		expect(changeSet.added).toEqual([]);
		expect(changeSet.changed).toEqual([]);
		expect(changeSet.removed).toEqual([]);
	});

	test("RecordCache maintains one record per relPath", () => {
		const cache = new RecordCache();
		cache.set({
			id: "back-1",
			title: "t",
			kind: "task",
			status: "",
			filePath: "tasks/a.md",
			parentTaskId: null,
			milestone: null,
			dependencies: [],
		});
		cache.set({
			id: "back-1",
			title: "t2",
			kind: "task",
			status: "",
			filePath: "tasks/a.md",
			parentTaskId: null,
			milestone: null,
			dependencies: [],
		});
		expect(cache.size).toBe(1);
		expect(cache.get("tasks/a.md")?.title).toBe("t2");
	});
});

describe("graph validation", () => {
	test("counts validate node total; cycles are detected lazily", async () => {
		const store = new MemoryGraphStore();
		await store.init();
		await store.upsertNodes([
			{ id: "a", title: "a", kind: "task", status: "", filePath: "tasks/a.md" },
			{ id: "b", title: "b", kind: "task", status: "", filePath: "tasks/b.md" },
		]);
		await store.upsertEdges([
			{ type: "DependsOn", from: "a", to: "b" },
			{ type: "DependsOn", from: "b", to: "a" },
		]);
		const counts = await validateCounts(store, 2);
		expect(counts.nodeCountMatches).toBe(true);
		expect(counts.edgeCounts.DependsOn).toBe(2);
		expect(await findDependencyCycles(store)).toEqual(["a", "b"]);
	});

	test("readiness is delegated to readiness.ts (no duplicated status logic)", () => {
		const readiness = computeRecordReadiness([
			{
				id: "a",
				title: "",
				kind: "task",
				status: "To Do",
				filePath: "tasks/a.md",
				parentTaskId: null,
				milestone: null,
				dependencies: ["b"],
			},
			{
				id: "b",
				title: "",
				kind: "task",
				status: "Done",
				filePath: "tasks/b.md",
				parentTaskId: null,
				milestone: null,
				dependencies: [],
			},
		]);
		expect(readiness.find((r) => r.id === "a")).toMatchObject({ isReady: true, isBlocked: false });
	});
});

describe("GraphService hot update", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-graph-sync-"));
		for (const dir of ["tasks", "drafts", "milestones", "completed"]) {
			await mkdir(join(root, "backlog", dir), { recursive: true });
		}
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("single-holder lock: the second service cannot start while the first holds it", async () => {
		const first = new GraphService(root, { backend: "memory", reconcileMs: 3_600_000 });
		expect(await first.start()).toBe(true);
		const second = new GraphService(root, { backend: "memory", reconcileMs: 3_600_000 });
		expect(await second.start()).toBe(false);
		await first.stop();
		// After release the lock is free again.
		expect(await second.start()).toBe(true);
		await second.stop();
	});

	test("cold start fires one start phase before the build and one complete phase after", async () => {
		const phases: string[] = [];
		const service = new GraphService(root, { backend: "memory", reconcileMs: 3_600_000 });
		service.onColdStart = (phase) => phases.push(phase);
		expect(await service.start()).toBe(true);
		expect(phases).toEqual(["start", "complete"]);
		await service.stop();
	});

	test("a service blocked by the lock emits no cold-start phases", async () => {
		const first = new GraphService(root, { backend: "memory", reconcileMs: 3_600_000 });
		expect(await first.start()).toBe(true);
		const phases: string[] = [];
		const second = new GraphService(root, { backend: "memory", reconcileMs: 3_600_000 });
		second.onColdStart = (phase) => phases.push(phase);
		expect(await second.start()).toBe(false);
		expect(phases).toEqual([]);
		await first.stop();
		await second.stop();
	});

	test("notify dedupes and syncs: add -> edge rebuild -> same-id move preserves edges -> demote replaces", async () => {
		const broadcasts: number[] = [];
		const service = new GraphService(root, { backend: "memory", debounceMs: 30, reconcileMs: 3_600_000 });
		service.onGraphChanged = () => broadcasts.push(Date.now());
		expect(await service.start()).toBe(true);

		// Seed: A depends on B, B belongs to milestone m-1.
		await writeFile(
			join(root, "backlog", "tasks", "back-1 - A.md"),
			taskMd({ id: "back-1", dependencies: ["back-2"] }),
			"utf8",
		);
		await writeFile(
			join(root, "backlog", "tasks", "back-2 - B.md"),
			taskMd({ id: "back-2", milestone: "m-1" }),
			"utf8",
		);
		await writeFile(join(root, "backlog", "milestones", "m-1 - M.md"), "---\nid: m-1\ntitle: M\n---\n", "utf8");
		service.notify(["seed"]);
		const readyState = await retry(async () => {
			const payload = await service.getPayload();
			if (payload.nodeCount !== 3) throw new Error("waiting for seed import");
			return payload;
		});
		expect(readyState.status).toBe("ready");
		expect(readyState.edges.some((e) => e.type === "DependsOn" && e.from === "back-1" && e.to === "back-2")).toBe(true);
		expect(readyState.edges.some((e) => e.type === "BelongsToMilestone" && e.to === "m-1")).toBe(true);
		expect(broadcasts.length).toBeGreaterThanOrEqual(1);

		// Same-id path change: B completes (tasks/ -> completed/) - edges must survive.
		await rename(join(root, "backlog", "tasks", "back-2 - B.md"), join(root, "backlog", "completed", "back-2 - B.md"));
		service.notify(["completed-move"]);
		const afterMove = await retry(async () => {
			const payload = await service.getPayload();
			const node = payload.nodes.find((n) => n.id === "back-2");
			if (!node || node.filePath !== "completed/back-2 - B.md") throw new Error("waiting for in-place move");
			return payload;
		});
		expect(afterMove.nodeCount).toBe(3);
		expect(afterMove.nodes.find((n) => n.id === "back-2")?.status).toBe("To Do"); // content unchanged
		expect(afterMove.edges.some((e) => e.type === "DependsOn" && e.from === "back-1" && e.to === "back-2")).toBe(true);
		expect(afterMove.edges.some((e) => e.type === "BelongsToMilestone" && e.to === "m-1")).toBe(true);

		// Dependency edit on an unchanged node's neighbour: A gains a new dep on C.
		await writeFile(join(root, "backlog", "tasks", "back-3 - C.md"), taskMd({ id: "back-3" }), "utf8");
		await writeFile(
			join(root, "backlog", "tasks", "back-1 - A.md"),
			taskMd({ id: "back-1", dependencies: ["back-2", "back-3"] }),
			"utf8",
		);
		service.notify(["dep-edit"]);
		const afterDepEdit = await retry(async () => {
			const payload = await service.getPayload();
			if (!payload.edges.some((e) => e.type === "DependsOn" && e.from === "back-1" && e.to === "back-3")) {
				throw new Error("waiting for new edge");
			}
			return payload;
		});
		expect(afterDepEdit.edges.some((e) => e.type === "DependsOn" && e.from === "back-1" && e.to === "back-2")).toBe(
			true,
		);
		expect(afterDepEdit.nodeCount).toBe(4);

		// Demote A -> draft (id changes): old node goes away, new node carries the deps.
		await rename(join(root, "backlog", "tasks", "back-1 - A.md"), join(root, "backlog", "drafts", "draft-9 - A.md"));
		await writeFile(
			join(root, "backlog", "drafts", "draft-9 - A.md"),
			taskMd({ id: "draft-9", dependencies: ["back-2", "back-3"] }),
			"utf8",
		);
		service.notify(["demote"]);
		const afterDemote = await retry(async () => {
			const payload = await service.getPayload();
			if (payload.nodes.some((n) => n.id === "back-1")) throw new Error("waiting for old node removal");
			return payload;
		});
		expect(afterDemote.nodes.some((n) => n.id === "draft-9")).toBe(true);
		expect(afterDemote.nodeCount).toBe(4);
		expect(afterDemote.edges.some((e) => e.type === "DependsOn" && e.from === "draft-9" && e.to === "back-2")).toBe(
			true,
		);

		// Sidecar cache was rewritten and matches the aggregate of what is on disk.
		const sidecar = JSON.parse(await readFile(defaultMetaPath(root), "utf8")) as {
			fingerprint: string;
			files: Record<string, unknown>;
		};
		expect(Object.keys(sidecar.files).length).toBeGreaterThanOrEqual(4);

		await service.stop();
	});

	test("corrupt cache triggers a full rebuild", async () => {
		await writeFile(join(root, "backlog", "tasks", "back-1 - A.md"), taskMd({ id: "back-1" }), "utf8");
		const service = new GraphService(root, { backend: "memory", debounceMs: 30, reconcileMs: 3_600_000 });
		await service.start();
		await service.stop();

		await writeFile(defaultMetaPath(root), "{corrupt json", "utf8");
		const second = new GraphService(root, { backend: "memory", debounceMs: 30, reconcileMs: 3_600_000 });
		await second.start();
		const payload = await second.getPayload();
		expect(payload.nodeCount).toBe(1);
		const sidecar = loadMetaCache(defaultMetaPath(root));
		expect(sidecar).not.toBeNull();
		await second.stop();
	});
});

describe("core notify hook", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-graph-hook-"));
		await mkdir(join(root, "backlog", "tasks"), { recursive: true });
		await mkdir(join(root, "backlog", "completed"), { recursive: true });
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	function makeTask(id: string) {
		return {
			id,
			title: `Task ${id}`,
			status: "To Do",
			assignee: [],
			createdDate: "2026-09-24 00:00",
			labels: [],
			description: "",
			documentation: [],
			dependencies: [],
		};
	}

	test("saveTask reports every written path; completeTask reports both ends of the move", async () => {
		const fs = new FileSystem(root);
		const batches: string[][] = [];
		fs.onFilesChanged = (paths) => batches.push(paths);

		await fs.saveTask({ ...makeTask("back-1") });
		await fs.saveTask({ ...makeTask("back-2") });
		expect(batches.length).toBe(2);
		expect(batches[0]?.[0]).toContain("back-1");
		expect(batches[1]?.[0]).toContain("back-2");

		await fs.completeTask("back-1");
		const moveBatch = batches.at(-1);
		expect(moveBatch?.length).toBe(2);
		expect(moveBatch?.[0]).toContain("tasks");
		expect(moveBatch?.[1]).toContain("completed");

		// No-op default: a fresh FileSystem with no listener never throws.
		const quiet = new FileSystem(root);
		await quiet.saveTask({ ...makeTask("back-3") });
	});

	test("saveMetaCache round-trips through loadMetaCache", () => {
		const sidecar = join(root, "backlog", "graph.kuzu.meta.json");
		saveMetaCache(sidecar, {
			parserVersion: 1,
			backend: "memory",
			fingerprint: "f",
			files: { "tasks/a.md": { size: 1, mtimeMs: 2, hash: "h" } },
		});
		const loaded = loadMetaCache(sidecar);
		expect(loaded?.files["tasks/a.md"]?.hash).toBe("h");
	});
});

describe("/api/graph endpoint", () => {
	let root: string;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-graph-api-"));
		for (const dir of ["tasks", "drafts", "milestones", "completed"]) {
			await mkdir(join(root, "backlog", dir), { recursive: true });
		}
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("returns nodes, edges and reports; the server owns the single-holder lock", async () => {
		await writeFile(
			join(root, "backlog", "tasks", "back-1 - A.md"),
			taskMd({ id: "back-1", dependencies: ["back-404"] }),
			"utf8",
		);
		const { BacklogServer } = await import("../server/index");
		const server = new BacklogServer(root);
		const handle = server as unknown as { handleGetGraph(): Promise<Response>; stop(): Promise<void> };

		const response = await handle.handleGetGraph();
		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			status: string;
			backend: string;
			nodes: { id: string }[];
			edges: { type: string; from: string; to: string }[];
			reports: { missingDependencies: string[] };
			nodeCount: number;
		};
		expect(payload.status).toBe("ready");
		expect(payload.backend).toBe("memory");
		expect(payload.nodes.map((n) => n.id)).toContain("back-1");
		expect(payload.nodeCount).toBe(1);
		// Dangling dependency surfaced fail-closed for the frontend's gray dashed rendering.
		expect(payload.reports.missingDependencies.length).toBe(1);

		// While this server holds the lock, a second service cannot take it.
		const second = new GraphService(root, { backend: "memory", reconcileMs: 3_600_000 });
		expect(await second.start()).toBe(false);

		await handle.stop();
	});
});
