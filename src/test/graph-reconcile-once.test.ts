import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { graphPaths } from "../graph/paths";
import { derivedSnapshotPath, reconcileGraphStoreOnce } from "../graph/reconcile-once";
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

	test("a cold store hydrates the derived snapshot instead of re-parsing the corpus", async () => {
		// First run: nothing to reuse, so it builds and writes a snapshot.
		const first = await openGraphStore(paths.dbPath, { backend: "ryu" });
		expect(first.backend).toBe("ryu");
		let built: Awaited<ReturnType<typeof reconcileGraphStoreOnce>>;
		try {
			built = await reconcileGraphStoreOnce(root, first, paths, { reuseSnapshot: true });
		} finally {
			await first.close();
		}
		expect(built.built).toBe(true);
		expect(built.hydrated).toBe(false);

		// Second run in a FRESH store - exactly what the next CLI process gets - must hydrate.
		const second = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			const reused = await reconcileGraphStoreOnce(root, second, paths, { reuseSnapshot: true });
			expect(reused.reused).toBe(true);
			expect(reused.hydrated).toBe(true);
			const counted = await second.runCypher("MATCH (n:FileNode) RETURN count(n)");
			expect(String(counted.rows[0]?.[0])).toBe("2");
		} finally {
			await second.close();
		}
	});

	test("a changed corpus rebuilds instead of hydrating the snapshot", async () => {
		const first = await openGraphStore(paths.dbPath, { backend: "ryu" });
		expect(first.backend).toBe("ryu");
		try {
			await reconcileGraphStoreOnce(root, first, paths, { reuseSnapshot: true });
		} finally {
			await first.close();
		}
		await seed(root, { "backlog/tasks/back-3 - C.md": taskMd("back-3", "C") });

		const second = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			const outcome = await reconcileGraphStoreOnce(root, second, paths, { reuseSnapshot: true });
			expect(outcome.hydrated).toBe(false);
			expect(outcome.built).toBe(true);
			const counted = await second.runCypher("MATCH (n:FileNode) RETURN count(n)");
			expect(String(counted.rows[0]?.[0])).toBe("3");
		} finally {
			await second.close();
		}
	});

	test("a corrupt snapshot is never served: the store is rebuilt instead", async () => {
		const first = await openGraphStore(paths.dbPath, { backend: "ryu" });
		expect(first.backend).toBe("ryu");
		try {
			await reconcileGraphStoreOnce(root, first, paths, { reuseSnapshot: true });
		} finally {
			await first.close();
		}
		// Overwrite the snapshot with something that cannot be hydrated.
		const broken = JSON.parse(readFileSync(derivedSnapshotPath(paths), "utf8")) as { nodeTables: unknown[] };
		broken.nodeTables = [
			{ name: "FileNode", properties: [{ name: "notARealColumn", type: "STRING", primaryKey: true }] },
		];
		writeFileSync(derivedSnapshotPath(paths), `${JSON.stringify(broken, null, 2)}\n`, "utf8");

		const second = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			const outcome = await reconcileGraphStoreOnce(root, second, paths, { reuseSnapshot: true });
			expect(outcome.hydrated).toBe(false);
			expect(outcome.built).toBe(true);
			const counted = await second.runCypher("MATCH (n:FileNode) RETURN count(n)");
			expect(String(counted.rows[0]?.[0])).toBe("2");
		} finally {
			await second.close();
		}
	});

	test("runs a Cypher query against the seeded graph when the ryu backend is available", async () => {
		const store = await openGraphStore(paths.dbPath, { backend: "ryu" });
		try {
			expect(store.backend).toBe("ryu"); // fail loudly: a memory fallback would make the assertions vacuous
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
			expect(store.backend).toBe("ryu"); // fail loudly: a memory fallback would make the assertions vacuous
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
