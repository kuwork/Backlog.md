import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeDecision } from "../markdown/serializer.ts";
import type { Decision } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

const cliPath = join(process.cwd(), "src", "cli.ts");

function makeDecision(id: string, title: string): Decision {
	return {
		id,
		title,
		date: "2026-08-01 00:00",
		status: "proposed",
		context: "",
		decision: "",
		consequences: "",
		alternatives: "",
		rawContent: "",
	};
}

describe("CLI decision delete command", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-decision-delete");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Decision Delete Project");
		await core.createDecision(makeDecision("decision-1", "Use PostgreSQL"));

		await Bun.write(
			join(core.filesystem.decisionsDir, "decision-14 - First-Choice.md"),
			serializeDecision(makeDecision("decision-14", "First Choice")),
		);
		await Bun.write(
			join(core.filesystem.decisionsDir, "decision-14 - Second-Choice.md"),
			serializeDecision(makeDecision("decision-14", "Second Choice")),
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("deletes a decision by id", async () => {
		const result = await $`bun ${cliPath} decision delete decision-1`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Deleted decision decision-1");
		expect(await core.filesystem.loadDecision("decision-1")).toBeNull();
	});

	it("reports a missing decision with a non-zero exit code", async () => {
		const result = await $`bun ${cliPath} decision delete decision-999`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Decision decision-999 not found.");
	});

	it("reports an ambiguous id with a non-zero exit code", async () => {
		const result = await $`bun ${[cliPath, "decision", "delete", "14"]}`.cwd(TEST_DIR).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("ambiguous");
	});
});
