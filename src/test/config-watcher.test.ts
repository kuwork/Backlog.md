import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig } from "../types/index.ts";
import { watchConfigFile } from "../utils/config-watcher.ts";
import { createUniqueTestDir, safeCleanup, sleep } from "./test-utils.ts";

const VALID_CONFIG = `project_name: "Watcher Test"
statuses: ["To Do", "In Progress", "Done"]
labels: []
date_format: "yyyy-mm-dd"
`;

async function waitForPublish(timeoutMs = 300): Promise<void> {
	await sleep(timeoutMs);
}

describe("config watcher", () => {
	let TEST_DIR: string;
	let filesystem: FileSystem;
	let stopWatcher: (() => void) | undefined;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("config-watcher");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
	});

	afterEach(async () => {
		stopWatcher?.();
		await safeCleanup(TEST_DIR);
	});

	it("publishes a valid config and reports it through the callback", async () => {
		await Bun.write(filesystem.configFilePath, VALID_CONFIG);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();

		expect(configs).toHaveLength(1);
		expect(configs[0]?.projectName).toBe("Watcher Test");
		expect(filesystem.getCachedConfigContent(filesystem.configFilePath)).toBe(VALID_CONFIG);
	});

	it("does not replace the cached config when the file becomes malformed", async () => {
		await Bun.write(filesystem.configFilePath, VALID_CONFIG);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();
		expect(configs).toHaveLength(1);

		await Bun.write(filesystem.configFilePath, `${VALID_CONFIG}statuses: not-a-list\n`);
		await waitForPublish(600);

		expect(configs).toHaveLength(1);
		const cached = await filesystem.loadConfig();
		expect(cached?.projectName).toBe("Watcher Test");
	});

	it("publishes default_assignee as a scalar", async () => {
		const content = `${VALID_CONFIG}default_assignee: "@alice"\n`;
		await Bun.write(filesystem.configFilePath, content);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();

		expect(configs).toHaveLength(1);
		expect(configs[0]?.defaultAssignee).toEqual(["@alice"]);
	});

	it("publishes default_assignee as an inline array", async () => {
		const content = `${VALID_CONFIG}default_assignee: ["@alice", "@bob"]\n`;
		await Bun.write(filesystem.configFilePath, content);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();

		expect(configs).toHaveLength(1);
		expect(configs[0]?.defaultAssignee).toEqual(["@alice", "@bob"]);
	});

	it("publishes default_assignee as a block sequence", async () => {
		const content = `${VALID_CONFIG}default_assignee:\n  - "@alice"\n  - "@bob"\n`;
		await Bun.write(filesystem.configFilePath, content);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();

		expect(configs).toHaveLength(1);
		expect(configs[0]?.defaultAssignee).toEqual(["@alice", "@bob"]);
	});

	it("does not publish a malformed default_assignee value", async () => {
		const goodContent = `${VALID_CONFIG}default_assignee: "@alice"\n`;
		await Bun.write(filesystem.configFilePath, goodContent);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();
		expect(configs).toHaveLength(1);

		await Bun.write(filesystem.configFilePath, `${VALID_CONFIG}default_assignee: [@alice\n`);
		await waitForPublish(600);

		expect(configs).toHaveLength(1);
		const cached = await filesystem.loadConfig();
		expect(cached?.defaultAssignee).toEqual(["@alice"]);
	});

	it("rejects an invalid task_prefix value", async () => {
		const goodContent = `${VALID_CONFIG}task_prefix: "back"\n`;
		await Bun.write(filesystem.configFilePath, goodContent);

		const configs: (BacklogConfig | null)[] = [];
		const handle = watchConfigFile(filesystem, {
			onConfigChanged: (config) => {
				configs.push(config);
			},
		});
		stopWatcher = handle.stop;

		await waitForPublish();
		expect(configs).toHaveLength(1);
		expect(configs[0]?.prefixes?.task).toBe("back");

		await Bun.write(filesystem.configFilePath, `${VALID_CONFIG}task_prefix: "back-1"\n`);
		await waitForPublish(600);

		expect(configs).toHaveLength(1);
		const cached = await filesystem.loadConfig();
		expect(cached?.prefixes?.task).toBe("back");
	});
});
