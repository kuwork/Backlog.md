import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContentStore } from "../core/content-store.ts";
import { createMemo, deleteMemo, listMemos, memosSignature } from "../core/memos.ts";
import { SearchService } from "../core/search-service.ts";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { MemoSearchResult, SearchResult, Task } from "../types/index.ts";
import { getPlatformTimeout, installCloseConnectionFetch, retry, sleep } from "./test-utils.ts";

installCloseConnectionFetch();

/**
 * Memo search tests run against a scratch project built with mkdtemp OUTSIDE the repo. The scratch
 * project must contain backlog/config.yml, otherwise root resolution walks up to the real repository
 * and mutates its real backlog/ folder.
 */
const baseTask: Task = {
	id: "task-1",
	title: "Unrelated alpha task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-09-19 09:00",
	labels: [],
	dependencies: [],
	rawContent: "## Description\nDoes not mention the needle",
};

describe("SearchService memos", () => {
	let root: string;
	let filesystem: FileSystem;
	let store: ContentStore;
	let search: SearchService;

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "backlog-memo-search-"));
		await Bun.write(join(root, "backlog", "config.yml"), "project_name: Memo Search Test\n");
		filesystem = new FileSystem(root);
		await filesystem.ensureBacklogStructure();
		store = new ContentStore(filesystem);
		search = new SearchService(store, () => listMemos(filesystem.rootDir));
	});

	afterEach(async () => {
		search?.dispose();
		store?.dispose();
		await removeRetrying(root);
	});

	it("matches memo body text and reports highlight ranges through the shared match mapping", async () => {
		await createMemo(root, "Standup notes\nTalked about the kubernetes quota");
		await search.ensureInitialized();

		const results = search.search({ query: "kubernetes" }).filter(isMemoResult);
		expect(results).toHaveLength(1);
		expect(results[0]?.memo.rawContent).toContain("kubernetes quota");
		expect(results[0]?.score).not.toBeNull();
		const matchKeys = results[0]?.matches?.map((match) => match.key) ?? [];
		expect(matchKeys.length).toBeGreaterThan(0);
	});

	it("exposes routing information on memo results", async () => {
		const memo = await createMemo(root, "Routing fixture note");
		await search.ensureInitialized();

		const result = search.search({ query: "Routing fixture" }).find(isMemoResult);
		expect(result?.memo.id).toBe(memo.id);
		expect(result?.memo.path).toBe(join(root, "backlog", "memos", `${memo.id}.md`));
	});

	it("filters to memos only when the memo type is requested", async () => {
		await filesystem.saveTask(baseTask);
		await createMemo(root, "Only memos should surface here");
		await search.ensureInitialized();

		const results = search.search({ query: "surface", types: ["memo"] });
		expect(results).toHaveLength(1);
		expect(results.every(isMemoResult)).toBe(true);
	});

	it("includes memos in an unfiltered search alongside the other kinds", async () => {
		await filesystem.saveTask(baseTask);
		await createMemo(root, "Shared needle across kinds");
		await search.ensureInitialized();

		const results = search.search({ query: "needle" });
		expect(results.filter(isMemoResult)).toHaveLength(1);
		expect(results.filter((result) => result.type === "task")).toHaveLength(1);
	});

	it("lists memos through the no-query collection path", async () => {
		await createMemo(root, "Captured without any query text");
		await search.ensureInitialized();

		const all = search.search();
		const memos = all.filter(isMemoResult);
		expect(memos).toHaveLength(1);
		expect(memos[0]?.score).toBeNull();

		const memosOnly = search.search({ types: ["memo"] }).filter(isMemoResult);
		expect(memosOnly).toHaveLength(1);
	});

	it("finds memos written after initialization without rebuilding the service", async () => {
		await search.ensureInitialized();
		await createMemo(root, "Wrote this memo after startup");

		await waitFor(
			async () => search.search({ query: "after startup" }).filter(isMemoResult),
			(results) => {
				return results.length === 1;
			},
		);
	});

	it("stays empty and queryable when no memo directory exists", async () => {
		await filesystem.saveTask(baseTask);
		await search.ensureInitialized();

		expect(search.search().filter(isMemoResult)).toEqual([]);
		expect(search.search({ query: "anything", types: ["memo"] })).toEqual([]);
	});

	it("skips the full memo read while the corpus signature is unchanged", async () => {
		let loads = 0;
		const signature = memosSignature(root);
		const counting = new SearchService(
			store,
			async () => {
				loads++;
				return listMemos(root);
			},
			() => signature,
		);
		try {
			await counting.ensureInitialized();
			expect(loads).toBe(1);
			// Explicit refresh with an untouched corpus: the read is skipped and the TTL clock resets.
			await counting.refreshMemos();
			expect(loads).toBe(1);
		} finally {
			counting.dispose();
		}
	});

	it("reloads when the signature changes and surfaces a newly captured memo", async () => {
		let loads = 0;
		let signature = memosSignature(root);
		const counting = new SearchService(
			store,
			async () => {
				loads++;
				return listMemos(root);
			},
			() => signature,
		);
		try {
			await counting.ensureInitialized();
			await createMemo(root, "Signature gate fresh memo");
			signature = memosSignature(root);
			await counting.refreshMemos();
			expect(loads).toBe(2);
			expect(counting.search({ query: "Signature gate fresh" }).filter(isMemoResult)).toHaveLength(1);
		} finally {
			counting.dispose();
		}
	});

	it("reloads when the signature changes and drops a deleted memo", async () => {
		let loads = 0;
		let signature = memosSignature(root);
		const counting = new SearchService(
			store,
			async () => {
				loads++;
				return listMemos(root);
			},
			() => signature,
		);
		try {
			const memo = await createMemo(root, "Signature gate doomed memo");
			signature = memosSignature(root);
			await counting.ensureInitialized();
			await deleteMemo(root, memo.id);
			signature = memosSignature(root);
			await counting.refreshMemos();
			expect(loads).toBe(2);
			expect(counting.search({ query: "doomed" }).filter(isMemoResult)).toHaveLength(0);
		} finally {
			counting.dispose();
		}
	});

	it("reloads the corpus after dispose and re-initialization", async () => {
		let signature = memosSignature(root);
		await createMemo(root, "Dispose resilience memo");
		signature = memosSignature(root);
		const counting = new SearchService(
			store,
			() => listMemos(root),
			() => signature,
		);
		try {
			await counting.ensureInitialized();
			expect(counting.search({ query: "Dispose resilience" }).filter(isMemoResult)).toHaveLength(1);
			counting.dispose();
			await counting.ensureInitialized();
			expect(counting.search({ query: "Dispose resilience" }).filter(isMemoResult)).toHaveLength(1);
		} finally {
			counting.dispose();
		}
	});

	it("store events do not reload a fresh memo corpus", async () => {
		let loads = 0;
		const counting = new SearchService(
			store,
			async () => {
				loads++;
				return listMemos(root);
			},
			() => memosSignature(root),
		);
		try {
			await counting.ensureInitialized();
			expect(loads).toBe(1);
			// Task edits fire store events; the memo corpus is fresh, so no reload may happen.
			// Even if a watcher event lands past the 500ms TTL, the unchanged signature skips the read.
			await filesystem.saveTask(baseTask);
			await filesystem.saveTask({ ...baseTask, id: "task-2", title: "Second alpha task" });
			await sleep(100);
			expect(loads).toBe(1);
		} finally {
			counting.dispose();
		}
	});
});

/**
 * The HTTP layer only forwards the query and `types` to the shared SearchService, so this covers the
 * `/api/search` path memos travel: `?type=memo` needs "memo" in the server's own allowlist.
 */
describe("GET /api/search memos", () => {
	// Everything lives in the test body: server startup is slower than the default hook timeout.
	it(
		"returns memos in the unfiltered result set with routing information",
		async () => {
			const root = await mkdtemp(join(tmpdir(), "backlog-memo-endpoint-"));
			const filesystem = new FileSystem(root);
			await filesystem.ensureBacklogStructure();
			await filesystem.saveConfig({
				projectName: "Memo Endpoint",
				statuses: ["To Do", "In Progress", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
			});
			await filesystem.saveTask(baseTask);
			await createMemo(root, "Endpoint memo about zeppelins");

			const server = new BacklogServer(root);
			try {
				await server.start(0, false);
				const port = server.getPort() ?? 0;
				const get = async <T>(path: string): Promise<T> => {
					const response = await fetch(`http://127.0.0.1:${port}${path}`);
					if (!response.ok) throw new Error(`Request failed: ${response.status}`);
					return response.json();
				};
				await retry(
					async () => {
						const tasks = await get<Task[]>("/api/tasks");
						if (tasks.length === 0) throw new Error("Server not ready");
						return tasks;
					},
					40,
					150,
				);

				const results = await retry(
					async () => {
						const data = await get<SearchResult[]>("/api/search?query=zeppelins");
						if (!data.some(isMemoResult)) throw new Error("Memo not indexed yet");
						return data;
					},
					20,
					100,
				);

				const memo = results.find(isMemoResult);
				expect(memo?.memo.path).toBe(join(root, "backlog", "memos", `${memo?.memo.id}.md`));
				expect(results.filter((result) => result.type === "task")).toHaveLength(0);
			} finally {
				await server.stop();
				await removeRetrying(root);
			}
		},
		getPlatformTimeout(30000),
	);
});

function isMemoResult(result: SearchResult): result is MemoSearchResult {
	return result.type === "memo";
}

/** Windows keeps a watcher on the scratch project briefly after shutdown, so cleanup retries EBUSY. */
async function removeRetrying(root: string): Promise<void> {
	for (let attempt = 0; attempt < 10; attempt++) {
		try {
			await rm(root, { recursive: true, force: true });
			return;
		} catch (error) {
			if (attempt === 9) throw error;
			await sleep(50);
		}
	}
}

async function waitFor<T>(
	operation: () => Promise<T> | T,
	predicate: (value: T) => boolean,
	timeout = getPlatformTimeout(),
): Promise<T> {
	const deadline = Date.now() + timeout;
	let lastValue: T = await operation();
	while (Date.now() < deadline) {
		if (predicate(lastValue)) {
			return lastValue;
		}
		await sleep(25);
		lastValue = await operation();
	}
	if (predicate(lastValue)) {
		return lastValue;
	}
	throw new Error("Timed out waiting for search results to satisfy predicate");
}
