import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("init cursor agent instructions", () => {
	beforeEach(async () => {
		TEST_DIR = join(process.cwd(), `.tmp-test-init-cursor-${Math.random().toString(36).slice(2)}`);
		await rm(TEST_DIR, { recursive: true, force: true });
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	it("writes AGENTS.md with HTML markers and no .cursorrules artifacts", async () => {
		const result = await $`bun ${CLI_PATH} init MyProj --defaults --agent-instructions cursor`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const agentsFile = join(TEST_DIR, "AGENTS.md");
		const agentsContent = await Bun.file(agentsFile).text();
		// HTML-comment markers only; the obsolete .cursorrules markdown-style branch is gone
		expect(agentsContent).toContain("<!-- BACKLOG.MD GUIDELINES START -->");
		expect(agentsContent).not.toContain("# === BACKLOG.MD GUIDELINES START ===");

		const cursorRulesExists = await Bun.file(join(TEST_DIR, ".cursorrules")).exists();
		expect(cursorRulesExists).toBe(false);
	});

	it("preserves existing AGENTS.md content and keeps a single marker block on repeated init", async () => {
		// Seed user content before init
		await Bun.write(join(TEST_DIR, "AGENTS.md"), "# My Team Rules\n\n- custom user guidance\n");

		const first = await $`bun ${CLI_PATH} init MyProj --defaults --agent-instructions cursor`.cwd(TEST_DIR).quiet();
		expect(first.exitCode).toBe(0);
		const afterFirst = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		expect(afterFirst).toContain("# My Team Rules");
		expect(afterFirst).toContain("- custom user guidance");

		const second = await $`bun ${CLI_PATH} init MyProj --defaults --agent-instructions cursor`.cwd(TEST_DIR).quiet();
		expect(second.exitCode).toBe(0);
		const afterSecond = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
		const startCount = afterSecond.split("<!-- BACKLOG.MD GUIDELINES START -->").length - 1;
		expect(startCount).toBe(1);
		expect(afterSecond).toContain("# My Team Rules");
	});
});
