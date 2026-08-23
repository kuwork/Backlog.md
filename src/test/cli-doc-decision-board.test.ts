import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("CLI Integration", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-doc-decision-board");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc Decision Board Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("decision commands", () => {
		it("should accept --plain when creating a decision", async () => {
			const result = await $`bun ${CLI_PATH} decision create "Choose Stack" --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stderr.toString()).toBe("");

			const stdout = result.stdout.toString();
			expect(stdout.trim()).toBe("Created decision decision-1");
			expect(stdout.includes("[")).toBe(false);

			const core = new Core(TEST_DIR);
			const decisions = await core.filesystem.listDecisions();
			expect(decisions).toHaveLength(1);
			expect(decisions[0]?.title).toBe("Choose Stack");
		});

		it("should list decisions with id, title, and status as plain text", async () => {
			await $`bun ${CLI_PATH} decision create "Choose Stack" -s accepted`.cwd(TEST_DIR).quiet();
			await $`bun ${CLI_PATH} decision create "Adopt Free Form Status" -s "Under Review"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${CLI_PATH} decision list --plain`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			const lines = result.stdout.toString().trim().split("\n");
			expect(lines).toEqual([
				"decision-1 - Choose Stack (accepted)",
				"decision-2 - Adopt Free Form Status (Under Review)",
			]);
		});

		it("should default to text output when stdout is not a TTY", async () => {
			await $`bun ${CLI_PATH} decision create "Choose Stack"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${CLI_PATH} decision list`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString().trim()).toBe("decision-1 - Choose Stack (proposed)");
		});

		it("should report an empty decision log in both output modes", async () => {
			const plain = await $`bun ${CLI_PATH} decision list --plain`.cwd(TEST_DIR).quiet();
			expect(plain.exitCode).toBe(0);
			expect(plain.stdout.toString().trim()).toBe("No decisions found.");

			const json = await $`bun ${CLI_PATH} decision list --json`.cwd(TEST_DIR).quiet();
			expect(json.exitCode).toBe(0);
			expect(JSON.parse(json.stdout.toString())).toEqual({
				schemaVersion: 1,
				kind: "decision-list",
				decisions: [],
			});
		});

		it("should view a decision as plain markdown", async () => {
			await $`bun ${CLI_PATH} decision create "Choose Stack" -s accepted`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${CLI_PATH} decision view decision-1 --plain`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			const stdout = result.stdout.toString();
			expect(stdout).toContain("id: decision-1");
			expect(stdout).toContain("title: Choose Stack");
			expect(stdout).toContain("status: accepted");
			expect(stdout).toContain("## Context");
		});

		it("should update a decision with --content", async () => {
			await $`bun ${CLI_PATH} decision create "Choose Stack"`.cwd(TEST_DIR).quiet();

			const update =
				await $`bun ${CLI_PATH} decision update decision-1 --content ${"## Context\\n\\nNeed a runtime\\n\\n## Decision\\n\\nUse Bun\\n\\n## Consequences\\n\\nFast tests"}`
					.cwd(TEST_DIR)
					.quiet();
			expect(update.exitCode).toBe(0);
			expect(update.stdout.toString().trim()).toBe("Updated decision decision-1");

			const view = await $`bun ${CLI_PATH} decision view decision-1 --plain`.cwd(TEST_DIR).quiet();
			expect(view.exitCode).toBe(0);
			const body = view.stdout.toString();
			expect(body).toContain("## Context");
			expect(body).toContain("Need a runtime");
			expect(body).toContain("## Decision");
			expect(body).toContain("Use Bun");
			expect(body).toContain("## Consequences");
			expect(body).toContain("Fast tests");
		});

		it("should append content to a decision with --append-content", async () => {
			await $`bun ${CLI_PATH} decision create "Choose Stack"`.cwd(TEST_DIR).quiet();
			await $`bun ${CLI_PATH} decision update decision-1 --content ${"## Context\\n\\nNeed a runtime\\n\\n## Decision\\n\\nUse Bun\\n\\n## Consequences\\n\\nFast tests"}`
				.cwd(TEST_DIR)
				.quiet();

			const append =
				await $`bun ${CLI_PATH} decision update decision-1 --append-content ${"## Alternatives\\n\\nConsider Node.js"}`
					.cwd(TEST_DIR)
					.quiet();
			expect(append.exitCode).toBe(0);

			const view = await $`bun ${CLI_PATH} decision view decision-1 --plain`.cwd(TEST_DIR).quiet();
			expect(view.exitCode).toBe(0);
			const body = view.stdout.toString();
			expect(body).toContain("## Alternatives");
			expect(body).toContain("Consider Node.js");
		});
	});

	describe("document commands", () => {
		it("should create a document", async () => {
			const result = await $`bun ${CLI_PATH} doc create "API Guidelines"`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stderr.toString()).toBe("");

			const stdout = result.stdout.toString();
			expect(stdout).toContain("Created document doc-1");

			const core = new Core(TEST_DIR);
			const docs = await core.filesystem.listDocuments();
			expect(docs).toHaveLength(1);
			expect(docs[0]?.title).toBe("API Guidelines");
		});

		it("should list documents with id and title as plain text", async () => {
			await $`bun ${CLI_PATH} doc create "API Guidelines" -t guide`.cwd(TEST_DIR).quiet();
			await $`bun ${CLI_PATH} doc create "Runbook" -t other`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${CLI_PATH} doc list --plain`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			const lines = result.stdout.toString().trim().split("\n");
			expect(lines).toEqual(["doc-1 - API Guidelines", "doc-2 - Runbook"]);
		});

		it("should default to text output when stdout is not a TTY", async () => {
			await $`bun ${CLI_PATH} doc create "API Guidelines"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${CLI_PATH} doc list`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString().trim()).toBe("doc-1 - API Guidelines");
		});

		it("should report an empty document list in both output modes", async () => {
			const plain = await $`bun ${CLI_PATH} doc list --plain`.cwd(TEST_DIR).quiet();
			expect(plain.exitCode).toBe(0);
			expect(plain.stdout.toString().trim()).toBe("No docs found.");

			const json = await $`bun ${CLI_PATH} doc list --json`.cwd(TEST_DIR).quiet();
			expect(json.exitCode).toBe(0);
			expect(JSON.parse(json.stdout.toString())).toEqual({
				schemaVersion: 1,
				kind: "document-list",
				documents: [],
			});
		});
	});
});
