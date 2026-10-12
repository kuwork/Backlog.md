import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { graphPaths } from "../graph/paths";
import { reconcileGraphStoreOnce } from "../graph/reconcile-once";
import { openGraphStore } from "../graph/store";

function taskMd(id: string, title: string): string {
	return `---\nid: ${id}\ntitle: ${title}\nstatus: To Do\n---\n\nbody\n`;
}

async function seed(root: string, files: Record<string, string>): Promise<void> {
	for (const [rel, content] of Object.entries(files)) {
		const abs = join(root, rel);
		await mkdir(join(abs, ".."), { recursive: true });
		await writeFile(abs, content, "utf8");
	}
}

describe("reconcileGraphStoreOnce", () => {
	let root: string;
	let paths: ReturnType<typeof graphPaths>;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-reconcile-"));
		await seed(root, {
			"backlog/tasks/back-1 - A.md": taskMd("back-1", "A"),
			"backlog/tasks/back-2 - B.md": taskMd("back-2", "B"),
		});
		paths = graphPaths(root, "reconcile-test");
	});

	afterEach(async () => {
		await rm(root, { recursive: true, force: true });
	});

	test("builds on first run and reuses on an unchanged second run", async () => {
		const store = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			const first = await reconcileGraphStoreOnce(root, store, paths);
			expect(first.reused).toBe(false);
			expect(first.built).toBe(true);

			const second = await reconcileGraphStoreOnce(root, store, paths);
			expect(second.reused).toBe(true);
			expect(second.built).toBe(false);
		} finally {
			if (store.backend === "ryu") await store.close();
		}
	});

	test("applies an incremental update when a file changes (no full rebuild), then reuses", async () => {
		const store = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			await reconcileGraphStoreOnce(root, store, paths);

			// change one file's content -> hash changes -> incremental apply, not full rebuild
			await writeFile(join(root, "backlog/tasks/back-1 - A.md"), taskMd("back-1", "A-changed"), "utf8");
			const afterChange = await reconcileGraphStoreOnce(root, store, paths);
			expect(afterChange.reused).toBe(false);
			expect(afterChange.built).toBe(true);

			// an unchanged third run reuses
			const third = await reconcileGraphStoreOnce(root, store, paths);
			expect(third.reused).toBe(true);
			expect(third.built).toBe(false);
		} finally {
			if (store.backend === "ryu") await store.close();
		}
	});

	test("runs a Cypher query against the seeded graph when the ryu backend is available", async () => {
		const store = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			if (store.backend !== "ryu") return; // WASM unavailable in this env; skip Cypher assertion
			await reconcileGraphStoreOnce(root, store, paths);
			const result = await store.runCypher("MATCH (n:FileNode) RETURN n.id ORDER BY n.id");
			expect(result.columns).toEqual(["n.id"]);
			expect(result.rows.map((r) => r[0])).toEqual(["back-1", "back-2"]);
		} finally {
			if (store.backend === "ryu") await store.close();
		}
	});

	// The CLI always opens a fresh (empty) MEMFS store, so it must force a full build every time and
	// never trust a stale on-disk fingerprint that would point at data the process cannot see.
	test("forceBuild always rebuilds and yields a queryable graph", async () => {
		const store = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			if (store.backend !== "ryu") return; // WASM unavailable in this env; skip Cypher assertion
			const first = await reconcileGraphStoreOnce(root, store, paths, { forceBuild: true });
			expect(first.built).toBe(true);
			expect(first.reused).toBe(false);

			// A second forced build must still rebuild (ryu's MEMFS is empty on every process start).
			const second = await reconcileGraphStoreOnce(root, store, paths, { forceBuild: true });
			expect(second.built).toBe(true);
			expect(second.reused).toBe(false);

			const result = await store.runCypher("MATCH (n:FileNode) RETURN count(n) AS c");
			expect(result.rows[0]?.[0]).toBe(2);
		} finally {
			if (store.backend === "ryu") await store.close();
		}
	});
});
