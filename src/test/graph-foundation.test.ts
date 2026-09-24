import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { coldStart, defaultMetaPath } from "../graph/cold-start";
import { computeAggregateFingerprint, computeFileHash, loadMetaCache, saveMetaCache } from "../graph/fingerprint";
import { parseTaskFile } from "../graph/parser";
import { resolveRelations } from "../graph/relations";
import { scanWhitelistedDirs } from "../graph/scanner";
import { MemoryGraphStore } from "../graph/store";

let root: string;

function taskMd(overrides: Record<string, unknown> = {}, body = ""): string {
	const data: Record<string, unknown> = {
		id: "back-1",
		title: "Task one",
		status: "To Do",
		assignee: [],
		...overrides,
	};
	return `---\n${Object.entries(data)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join("\n")}\n---\n${body}\n`;
}

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "backlog-graph-"));
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("graph scanner", () => {
	test("scans only the four whitelisted directories and only markdown files", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-scan-"));
		try {
			await seedProjectAt(dir, {
				"tasks/back-1 - A.md": taskMd(),
				"tasks/notes.txt": "not markdown",
				"drafts/draft-2 - D.md": taskMd({ id: "draft-2" }),
				"milestones/m-1 - M.md": taskMd({ id: "m-1", title: "Milestone one", status: "" }),
				"completed/back-0 - Done.md": taskMd({ id: "back-0", status: "Done" }),
				"archive/back-old - Old.md": taskMd({ id: "back-old" }),
				"assets/logo.bin": "binary-ish",
			});
			const scanned = await scanWhitelistedDirs(dir);
			const relPaths = scanned.map((f) => f.relPath).sort();
			expect(relPaths).toEqual([
				"completed/back-0 - Done.md",
				"drafts/draft-2 - D.md",
				"milestones/m-1 - M.md",
				"tasks/back-1 - A.md",
			]);
			const kinds = Object.fromEntries(scanned.map((f) => [f.relPath.split("/")[0], f.kind]));
			expect(kinds.tasks).toBe("task");
			expect(kinds.drafts).toBe("draft");
			expect(kinds.milestones).toBe("milestone");
			expect(kinds.completed).toBe("task");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("graph parser", () => {
	test("parses a valid record with dependencies as array or comma string", () => {
		const path = join(root, "parser-ok.md");
		writeFileSync(
			path,
			taskMd({ id: "back-9", dependencies: ["back-1", "back-2"], parentTaskId: "back-1", milestone: "M1" }),
		);
		const parsed = parseTaskFile(path, "tasks/back-9.md", "task");
		expect(parsed.warning).toBeUndefined();
		if (!parsed.record) throw new Error("expected a parsed record");
		const record = parsed.record;
		expect(record.id).toBe("back-9");
		expect(record.kind).toBe("task");
		expect(record.dependencies).toEqual(["back-1", "back-2"]);
		expect(record.parentTaskId).toBe("back-1");
		expect(record.milestone).toBe("M1");
		expect(record.filePath).toBe("tasks/back-9.md");
	});

	test("comma-separated dependency strings are split", () => {
		const path = join(root, "parser-csv.md");
		writeFileSync(path, taskMd({ id: "back-10", dependencies: "back-1, back-2" }));
		const parsedCsv = parseTaskFile(path, "tasks/x.md", "task");
		if (!parsedCsv.record) throw new Error("expected a parsed record");
		const record = parsedCsv.record;
		expect(record.dependencies).toEqual(["back-1", "back-2"]);
	});

	test("snake_case parent_task_id (the on-disk field) is honored", () => {
		const path = join(root, "parser-parent.md");
		writeFileSync(path, taskMd({ id: "back-11", parent_task_id: "BACK-24" }), "utf8");
		const parsed = parseTaskFile(path, "tasks/back-11.md", "task");
		expect(parsed.warning).toBeUndefined();
		expect(parsed.record?.parentTaskId).toBe("BACK-24");
	});

	test("a file without frontmatter id is skipped with a warning", () => {
		const path = join(root, "parser-bad.md");
		writeFileSync(path, "---\ntitle: No id\n---\nbody\n");
		const parsed = parseTaskFile(path, "tasks/bad.md", "task");
		expect(parsed.record).toBeUndefined();
		expect(parsed.warning).toContain("missing frontmatter id");
	});

	test("unparseable frontmatter is a warning, not a throw", () => {
		const path = join(root, "parser-worse.md");
		writeFileSync(path, "---\nid: a\nid: b\n---\nbody\n");
		const parsed = parseTaskFile(path, "tasks/worse.md", "task");
		expect(parsed.record).toBeUndefined();
		expect(parsed.warning).toContain("unparseable frontmatter");
	});
});

describe("fail-closed relation resolution", () => {
	function rec(
		partial: Partial<import("../graph/parser").ParsedRecord> & { id: string },
	): import("../graph/parser").ParsedRecord {
		return {
			title: partial.id,
			kind: "task",
			status: "To Do",
			filePath: `tasks/${partial.id}.md`,
			parentTaskId: null,
			milestone: null,
			dependencies: [],
			...partial,
		};
	}

	test("dangling parentTaskId and dependencies are reported and nodes still resolve", () => {
		const result = resolveRelations([rec({ id: "back-1", parentTaskId: "back-999", dependencies: ["back-888"] })]);
		expect(result.edges).toEqual([]);
		expect(result.invalidRelations).toHaveLength(1);
		expect(result.invalidRelations[0]).toContain("back-999");
		expect(result.missingDependencies).toHaveLength(1);
		expect(result.missingDependencies[0]).toContain("back-888");
		expect(result.ambiguousIds).toEqual([]);
	});

	test("cross-kind ParentOf is legal and dependencies may point at drafts", () => {
		const result = resolveRelations([
			rec({ id: "back-1" }),
			rec({ id: "draft-2", kind: "draft", parentTaskId: "back-1", dependencies: ["back-1"] }),
		]);
		expect(result.edges.map((e) => [e.type, e.from, e.to])).toEqual([
			["ParentOf", "draft-2", "back-1"],
			["DependsOn", "draft-2", "back-1"],
		]);
		expect(result.invalidRelations).toEqual([]);
		expect(result.missingDependencies).toEqual([]);
	});

	test("duplicate ids are ambiguous: no DependsOn or ParentOf edges from them", () => {
		const result = resolveRelations([
			rec({ id: "back-1", dependencies: ["back-dup"] }),
			rec({ id: "back-dup", filePath: "tasks/a.md" }),
			rec({ id: "back-dup", filePath: "tasks/b.md" }),
			rec({ id: "back-2", parentTaskId: "back-dup" }),
		]);
		expect(result.ambiguousIds).toEqual(["back-dup"]);
		expect(result.edges).toEqual([]);
	});

	test("milestone edges match unique titles; duplicate titles are invalid; dep on milestone is missing", () => {
		const result = resolveRelations([
			rec({ id: "back-1", milestone: "M1", dependencies: ["m-1"] }),
			rec({ id: "m-1", kind: "milestone", title: "M1" }),
		]);
		expect(result.edges.map((e) => e.type)).toEqual(["BelongsToMilestone"]);
		expect(result.missingDependencies).toHaveLength(1); // dependency target may not be a milestone

		const dup = resolveRelations([
			rec({ id: "back-1", milestone: "M1" }),
			rec({ id: "m-1", kind: "milestone", title: "M1" }),
			rec({ id: "m-2", kind: "milestone", title: "M1" }),
		]);
		expect(dup.edges).toEqual([]);
		expect(dup.invalidRelations).toHaveLength(1);
	});

	test("milestone edges match by id first (the on-disk field stores m-9), title as fallback", () => {
		const byId = resolveRelations([
			rec({ id: "back-1", milestone: "m-1" }),
			rec({ id: "m-1", kind: "milestone", title: "M one" }),
		]);
		expect(byId.edges.map((e) => [e.type, e.from, e.to])).toEqual([["BelongsToMilestone", "back-1", "m-1"]]);

		const noMatch = resolveRelations([rec({ id: "back-1", milestone: "m-404" }), rec({ id: "m-1", kind: "milestone", title: "M one" })]);
		expect(noMatch.edges).toEqual([]);
		expect(noMatch.invalidRelations).toHaveLength(1);
	});

	test("milestone parentTaskId is unsupported in Phase 1 and reported", () => {
		const result = resolveRelations([
			rec({ id: "m-1", kind: "milestone", parentTaskId: "back-1" }),
			rec({ id: "back-1" }),
		]);
		expect(result.edges).toEqual([]);
		expect(result.invalidRelations[0]).toContain("not supported");
	});
});

describe("fingerprint cache", () => {
	test("aggregate fingerprint is stable, content-sensitive, and parser-version sensitive", () => {
		const files = {
			"tasks/b.md": { size: 1, mtimeMs: 1, hash: "bbb" },
			"tasks/a.md": { size: 1, mtimeMs: 1, hash: "aaa" },
		};
		const base = computeAggregateFingerprint(files);
		expect(base).toBe(computeAggregateFingerprint({ ...files }));
		const reordered = {
			"tasks/a.md": { size: 1, mtimeMs: 1, hash: "aaa" },
			"tasks/b.md": { size: 1, mtimeMs: 1, hash: "bbb" },
		};
		expect(base).toBe(computeAggregateFingerprint(reordered)); // insertion order irrelevant
		expect(base).not.toBe(
			computeAggregateFingerprint({ ...files, "tasks/a.md": { size: 1, mtimeMs: 1, hash: "zzz" } }),
		);
		expect(base).not.toBe(computeAggregateFingerprint(files, 99)); // PARSER_VERSION mixed in
	});

	test("file hash is content sha256", () => {
		expect(computeFileHash("hello")).toBe(computeFileHash("hello"));
		expect(computeFileHash("hello")).not.toBe(computeFileHash("hellp"));
	});

	test("corrupt sidecar reads as null", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-meta-"));
		try {
			const sidecar = join(dir, "meta.json");
			await Bun.write(sidecar, "{not json");
			expect(loadMetaCache(sidecar)).toBeNull();
			await Bun.write(sidecar, '{"parserVersion":1,"fingerprint":null,"files":{}}');
			expect(loadMetaCache(sidecar)?.parserVersion).toBe(1);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("saveMetaCache round-trips and swap-writes atomically", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-meta-"));
		try {
			const sidecar = join(dir, "meta.json");
			saveMetaCache(sidecar, {
				parserVersion: 1,
				backend: "memory",
				fingerprint: "f",
				files: { "tasks/a.md": { size: 3, mtimeMs: 4, hash: "h" } },
			});
			const loaded = loadMetaCache(sidecar);
			if (!loaded) throw new Error("expected cache to load");
			expect(loaded.fingerprint).toBe("f");
			expect(loaded.files["tasks/a.md"]?.hash).toBe("h");
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});

describe("cold start", () => {
	test("first run rebuilds, second run reuses without parsing, edits rebuild incrementally", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-cold-"));
		try {
			await seedProjectAt(dir, {
				"tasks/back-1 - A.md": taskMd({ id: "back-1" }),
				"tasks/back-2 - B.md": taskMd({ id: "back-2", dependencies: ["back-1"] }),
				"milestones/m-1 - M.md": taskMd({ id: "m-1", title: "M one", status: "" }),
				"tasks/back-3 - C.md": taskMd({ id: "back-3", milestone: "M one" }),
			});

			const first = await coldStart(dir, { backend: "memory" });
			expect(first.reused).toBe(false);
			expect(first.nodeCount).toBe(4);
			expect(first.reports.missingDependencies).toEqual([]);
			expect(await readSidecarAt(dir)).toHaveProperty("fingerprint");

			const second = await coldStart(dir, { backend: "memory" });
			expect(second.reused).toBe(true);
			expect(second.nodeCount).toBe(4); // memory store is a per-root singleton; graph stays warm

			// Add a dangling dependency: rebuild runs, report is fail-closed, node still present.
			await writeFile(
				join(dir, "backlog", "tasks", "back-2 - B.md"),
				taskMd({ id: "back-2", dependencies: ["back-1", "back-404"] }),
				"utf8",
			);
			const third = await coldStart(dir, { backend: "memory" });
			expect(third.reused).toBe(false);
			expect(third.reports.missingDependencies).toHaveLength(1);
			expect(third.nodeCount).toBe(4);
			expect(await third.store.countEdges("DependsOn")).toBe(1); // only the valid edge survives
			expect(await third.store.countEdges("BelongsToMilestone")).toBe(1); // back-3 -> "M one" by title
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("missing or corrupt meta cache triggers a full rebuild", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-cold-"));
		try {
			await seedProjectAt(dir, { "tasks/back-1 - A.md": taskMd({ id: "back-1" }) });
			await coldStart(dir, { backend: "memory" });
			await rm(defaultMetaPath(dir));
			const result = await coldStart(dir, { backend: "memory" });
			expect(result.reused).toBe(false);
			expect(result.nodeCount).toBe(1);

			await Bun.write(defaultMetaPath(dir), "corrupt{");
			const corrupt = await coldStart(dir, { backend: "memory" });
			expect(corrupt.reused).toBe(false);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("the fast path never parses files (reuse carries no parse warnings)", async () => {
		const dir = await mkdtemp(join(tmpdir(), "backlog-cold-"));
		try {
			await seedProjectAt(dir, { "tasks/back-1 - A.md": taskMd({ id: "back-1" }) });
			const first = await coldStart(dir, { backend: "memory" });
			expect(first.reused).toBe(false);
			const sidecarBefore = await readSidecarAt(dir);
			expect(sidecarBefore.files).toBeTruthy();
			const second = await coldStart(dir, { backend: "memory" });
			expect(second.reused).toBe(true);
			expect(second.reports.warnings).toEqual([]); // nothing was read, nothing was parsed
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});

	test("memory store detach-delete and edge counting", async () => {
		const store = new MemoryGraphStore();
		await store.init();
		await store.upsertNodes([
			{ id: "a", title: "A", kind: "task", status: "", filePath: "tasks/a.md" },
			{ id: "b", title: "B", kind: "task", status: "", filePath: "tasks/b.md" },
		]);
		await store.upsertEdges([{ type: "DependsOn", from: "a", to: "b" }]);
		expect(await store.countEdges("DependsOn")).toBe(1);
		await store.deleteNodes(["a"]);
		expect(await store.countNodes()).toBe(1);
		expect(await store.countEdges("DependsOn")).toBe(0); // edges die with their endpoints
		await store.close();
	});
});

async function seedProjectAt(dir: string, files: Record<string, string>): Promise<void> {
	for (const [relPath, content] of Object.entries(files)) {
		const abs = join(dir, "backlog", relPath);
		await mkdir(abs.slice(0, abs.lastIndexOf(sep)), { recursive: true });
		await writeFile(abs, content, "utf8");
	}
}

async function readSidecarAt(dir: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(defaultMetaPath(dir), "utf8")) as Record<string, unknown>;
}
