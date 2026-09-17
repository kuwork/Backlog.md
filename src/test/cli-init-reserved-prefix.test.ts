import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("CLI init task prefix reservation", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-init-reserved-prefix");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	async function loadConfig() {
		return new Core(TEST_DIR).filesystem.loadConfig();
	}

	test.each([
		"draft",
		"DRAFT",
		"doc",
		"Doc",
		"decision",
		"DECISION",
	])("rejects %s as --task-prefix and writes no config", async (prefix) => {
		const result =
			await $`bun ${CLI_PATH} init "Reserved Prefix Project" --no-git --defaults --integration-mode none --task-prefix ${prefix}`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("is reserved for drafts, docs, or decisions");
		expect(await loadConfig()).toBeNull();
	});

	test("rejects a padded prefix instead of persisting it", async () => {
		const result =
			await $`bun ${CLI_PATH} init "Padded Prefix Project" --no-git --defaults --integration-mode none --task-prefix " JIRA "`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("must contain only letters");
		expect(await loadConfig()).toBeNull();
	});

	test("accepts a non-reserved prefix and persists it", async () => {
		const result =
			await $`bun ${CLI_PATH} init "Jira Project" --no-git --defaults --integration-mode none --task-prefix JIRA`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();

		expect(result.exitCode).toBe(0);
		expect((await loadConfig())?.prefixes?.task).toBe("JIRA");
	});

	test("rejects a reserved prefix on re-init without touching the existing config", async () => {
		await $`bun ${CLI_PATH} init "Jira Project" --no-git --defaults --integration-mode none --task-prefix JIRA`
			.cwd(TEST_DIR)
			.quiet();

		const reInit =
			await $`bun ${CLI_PATH} init "Jira Project" --no-git --defaults --integration-mode none --task-prefix draft`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();

		expect(reInit.exitCode).toBe(1);
		expect(reInit.stderr.toString()).toContain("is reserved for drafts, docs, or decisions");
		expect((await loadConfig())?.prefixes?.task).toBe("JIRA");
	});

	test("lists the reserved names in init help", async () => {
		const result = await $`bun ${CLI_PATH} init --help`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString();

		expect(result.exitCode).toBe(0);
		expect(output).toContain("draft, doc, and decision are reserved");
	});
});
