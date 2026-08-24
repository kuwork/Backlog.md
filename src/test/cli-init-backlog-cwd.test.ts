import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { BACKLOG_CWD_ENV } from "../utils/runtime-cwd.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

describe("CLI init BACKLOG_CWD handling", () => {
	let processDir: string;
	let pinnedDir: string;
	const originalBacklogCwd = process.env[BACKLOG_CWD_ENV];

	beforeEach(async () => {
		processDir = createUniqueTestDir("test-init-cwd-process");
		pinnedDir = createUniqueTestDir("test-init-cwd-pinned");
		await mkdir(processDir, { recursive: true });
		await mkdir(pinnedDir, { recursive: true });
	});

	afterEach(async () => {
		if (originalBacklogCwd === undefined) {
			delete process.env[BACKLOG_CWD_ENV];
		} else {
			process.env[BACKLOG_CWD_ENV] = originalBacklogCwd;
		}
		await safeCleanup(processDir);
		await safeCleanup(pinnedDir);
	});

	test("initializes the pinned directory when BACKLOG_CWD is set", async () => {
		process.env[BACKLOG_CWD_ENV] = pinnedDir;

		const result = await $`bun ${CLI_PATH} init "Pinned Project" --no-git --defaults --integration-mode none`
			.cwd(processDir)
			.quiet();

		expect(result.exitCode).toBe(0);

		const core = new Core(pinnedDir);
		const config = await core.filesystem.loadConfig();
		expect(config?.projectName).toBe("Pinned Project");
		expect(await pathExists(join(pinnedDir, "backlog", "config.yml"))).toBe(true);
		// The process directory must stay untouched.
		expect(await pathExists(join(processDir, "backlog"))).toBe(false);
	});

	test("keeps initializing the process directory without an override", async () => {
		const result = await $`bun ${CLI_PATH} init "Process Project" --no-git --defaults --integration-mode none`
			.cwd(processDir)
			.quiet();

		expect(result.exitCode).toBe(0);

		const core = new Core(processDir);
		const config = await core.filesystem.loadConfig();
		expect(config?.projectName).toBe("Process Project");
		expect(await pathExists(join(pinnedDir, "backlog"))).toBe(false);
	});

	test("fails closed when BACKLOG_CWD points at a missing directory", async () => {
		process.env[BACKLOG_CWD_ENV] = join(pinnedDir, "missing");

		const result = await $`bun ${CLI_PATH} init "Should Not Land" --no-git --defaults --integration-mode none`
			.cwd(processDir)
			.nothrow()
			.quiet();

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain(`Invalid directory from ${BACKLOG_CWD_ENV}`);
		expect(await pathExists(join(processDir, "backlog"))).toBe(false);
		expect(await pathExists(join(pinnedDir, "backlog"))).toBe(false);
	});
});
