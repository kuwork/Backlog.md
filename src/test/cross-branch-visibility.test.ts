import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import type { ContentStore } from "../core/content-store.ts";
import { SearchService } from "../core/search-service.ts";
import { FileSystem } from "../file-system/operations.ts";
import { resolveCrossBranchVisibility } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

const minimalConfig = (extra: string): string =>
	['project_name: "Test"', "statuses:", '  - name: "To Do"', "date_format: yyyy-mm-dd", "labels: []", extra, ""].join(
		"\n",
	);

describe("cross-branch visibility resolution", () => {
	it("falls back to the config when the parameter is absent", () => {
		expect(resolveCrossBranchVisibility(null, { includeCrossBranch: true } as never)).toBe(true);
		expect(resolveCrossBranchVisibility(null, { includeCrossBranch: false } as never)).toBe(false);
		expect(resolveCrossBranchVisibility(null, {} as never)).toBe(false);
		expect(resolveCrossBranchVisibility(null, null)).toBe(false);
	});

	it("lets an explicit parameter override the config in both directions", () => {
		expect(resolveCrossBranchVisibility("true", { includeCrossBranch: false } as never)).toBe(true);
		expect(resolveCrossBranchVisibility("false", { includeCrossBranch: true } as never)).toBe(false);
	});

	it("reads the parameter out of a query string", () => {
		expect(resolveCrossBranchVisibility(new URLSearchParams().get("crossBranch"), null)).toBe(false);
		expect(resolveCrossBranchVisibility(new URLSearchParams("crossBranch=true").get("crossBranch"), null)).toBe(true);
		expect(
			resolveCrossBranchVisibility(new URLSearchParams("crossBranch=false").get("crossBranch"), {
				includeCrossBranch: true,
			} as never),
		).toBe(false);
	});
});

describe("include_cross_branch config key", () => {
	beforeEach(() => {
		TEST_DIR = createUniqueTestDir("cross-branch-config");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// ignore cleanup errors between tests
		}
	});

	async function writeConfig(extra: string): Promise<void> {
		const filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await Bun.write(join(TEST_DIR, "backlog", "config.yml"), minimalConfig(extra));
	}

	it("parses the snake_case key", async () => {
		await writeConfig("include_cross_branch: true");
		const config = await new FileSystem(TEST_DIR).loadConfig();
		expect(config?.includeCrossBranch).toBe(true);
	});

	it("parses the camelCase alias", async () => {
		await writeConfig("includeCrossBranch: true");
		const config = await new FileSystem(TEST_DIR).loadConfig();
		expect(config?.includeCrossBranch).toBe(true);
	});

	it("round-trips through saveConfig without losing the value", async () => {
		await writeConfig("include_cross_branch: true");
		const filesystem = new FileSystem(TEST_DIR);
		const config = await filesystem.loadConfig();
		expect(config?.includeCrossBranch).toBe(true);

		await filesystem.saveConfig({ ...(config ?? ({} as never)), includeCrossBranch: false });
		const raw = await Bun.file(join(TEST_DIR, "backlog", "config.yml")).text();
		expect(raw).toContain("include_cross_branch: false");

		const reread = await new FileSystem(TEST_DIR).loadConfig();
		expect(reread?.includeCrossBranch).toBe(false);
	});
});

describe("SearchService cross-branch filtering", () => {
	const local: Task = {
		id: "task-1",
		title: "Local row",
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
	};
	const fromBranch: Task = { ...local, id: "task-2", title: "Row from another branch", source: "local-branch" };
	const fromRemote: Task = { ...local, id: "task-3", title: "Row from a remote", source: "remote" };

	function stubStore(tasks: Task[]): ContentStore {
		const snapshot = {
			tasks,
			documents: [],
			decisions: [],
			wikis: [],
			taskCorpus: { activeTasks: tasks, completedTasks: [] },
		};
		return {
			ensureInitialized: () => Promise.resolve(snapshot),
			subscribe: () => () => {},
		} as unknown as ContentStore;
	}

	it("keeps other-branch tasks by default and drops them when cross-branch is off", async () => {
		const search = new SearchService(stubStore([local, fromBranch, fromRemote]));
		await search.ensureInitialized();
		try {
			const ids = (crossBranch: boolean) =>
				search
					.search({ includeCrossBranch: crossBranch })
					.filter((result) => result.type === "task")
					.map((result) => (result.type === "task" ? result.task.id : ""))
					.sort();

			expect(ids(true)).toEqual(["task-1", "task-2", "task-3"]);
			expect(ids(false)).toEqual(["task-1"]);
		} finally {
			search.dispose();
		}
	});

	it("applies the same rule on the fuzzy path", async () => {
		const search = new SearchService(stubStore([local, fromBranch]));
		await search.ensureInitialized();
		try {
			const ids = (crossBranch: boolean) =>
				search
					.search({ query: "Row", includeCrossBranch: crossBranch })
					.filter((result) => result.type === "task")
					.map((result) => (result.type === "task" ? result.task.id : ""));

			expect(ids(false)).toEqual(["task-1"]);
			expect(ids(true).sort()).toEqual(["task-1", "task-2"]);
		} finally {
			search.dispose();
		}
	});
});
