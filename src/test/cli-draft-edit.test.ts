import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

const cliPath = join(process.cwd(), "src", "cli.ts");

/** A draft fixture: the same shape the file system writes, so the CLI reads it like a real one. */
function draft(id: string, title: string): Task {
	return {
		id,
		title,
		status: "Draft",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-09-01 10:00",
		rawContent: title,
	};
}

async function writeDraft(filename: string, task: Task): Promise<string> {
	const dir = join(TEST_DIR, "backlog", "drafts");
	await mkdir(dir, { recursive: true });
	const path = join(dir, filename);
	await Bun.write(path, serializeTask(task));
	return path;
}

async function readDraftFile(filename: string): Promise<string> {
	return await readFile(join(TEST_DIR, "backlog", "drafts", filename), "utf8");
}

const runCli = (...args: string[]) => $`bun ${cliPath} ${args}`.cwd(TEST_DIR).nothrow().quiet();

describe("draft edit", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-draft-edit");
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Draft Edit Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	it("writes the shared field flags to the draft and keeps it a draft", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

		const result = await runCli(
			"draft",
			"edit",
			"DRAFT-1",
			"--title",
			"Renamed",
			"--priority",
			"high",
			"--add-ref",
			"src/cli.ts",
			"--ac",
			"first criterion",
			"--assignee",
			"@sara",
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Updated draft DRAFT-1");

		const core = new Core(TEST_DIR);
		const updated = await core.filesystem.loadDraft("DRAFT-1");
		expect(updated?.title).toBe("Renamed");
		expect(updated?.priority).toBe("high");
		expect(updated?.references).toEqual(["src/cli.ts"]);
		expect(updated?.assignee).toEqual(["@sara"]);
		expect(updated?.acceptanceCriteriaItems?.map((criterion) => criterion.text)).toEqual(["first criterion"]);
		// The whole point of editing a draft rather than a task: it stays a draft.
		expect(updated?.status).toBe("Draft");
	});

	it("accepts --status Draft and refuses any other status with a pointer at promote", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

		const accepted = await runCli("draft", "edit", "DRAFT-1", "--status", "Draft");
		expect(accepted.exitCode).toBe(0);

		const before = await readDraftFile("draft-1 - Alpha.md");
		const refused = await runCli("draft", "edit", "DRAFT-1", "--status", "In Progress");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr.toString()).toContain("backlog draft promote DRAFT-1");
		// A refused status change is not a partial edit: the file never moves.
		expect(await readDraftFile("draft-1 - Alpha.md")).toBe(before);
	});

	it("reports an id that names no draft, and a task id, without writing anything", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));
		const before = await readDraftFile("draft-1 - Alpha.md");

		const missing = await runCli("draft", "edit", "DRAFT-9", "--title", "Nope");
		expect(missing.exitCode).toBe(1);
		expect(missing.stderr.toString()).toContain("Draft DRAFT-9 not found.");

		const taskId = await runCli("draft", "edit", "TASK-1", "--title", "Nope");
		expect(taskId.exitCode).toBe(1);
		expect(taskId.stderr.toString()).toContain("Draft TASK-1 not found.");

		expect(await readDraftFile("draft-1 - Alpha.md")).toBe(before);
	});

	it("edits one draft at a time", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));
		await writeDraft("draft-2 - Beta.md", draft("DRAFT-2", "Beta"));

		const result = await runCli("draft", "edit", "DRAFT-1", "DRAFT-2", "--title", "Shared");

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("one at a time");
		expect((await readDraftFile("draft-1 - Alpha.md")).includes("title: Alpha")).toBe(true);
		expect((await readDraftFile("draft-2 - Beta.md")).includes("title: Beta")).toBe(true);
	});

	it("asks for a change before it touches the file", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

		const result = await runCli("draft", "edit", "DRAFT-1");

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("without any field flag");
	});

	it("fails closed when two files claim one draft identity", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));
		await writeDraft("draft-01 - Beta.md", draft("DRAFT-01", "Beta"));
		const alpha = await readDraftFile("draft-1 - Alpha.md");
		const beta = await readDraftFile("draft-01 - Beta.md");

		const result = await runCli("draft", "edit", "draft-1", "--title", "Renamed");

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Rename one file to a distinct numeric id");
		// Neither twin is edited, because neither is known to be the one the user meant.
		expect(await readDraftFile("draft-1 - Alpha.md")).toBe(alpha);
		expect(await readDraftFile("draft-01 - Beta.md")).toBe(beta);
	});

	it("prints the whole record with --plain", async () => {
		await writeDraft("draft-1 - Alpha.md", draft("DRAFT-1", "Alpha"));

		const result = await runCli("draft", "edit", "DRAFT-1", "--priority", "low", "--plain");

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString();
		expect(output).toContain("DRAFT-1");
		expect(output).toContain("Draft");
		expect(output).toContain("Low");
	});

	it("reads the same field options as task edit", async () => {
		const draftHelp = await runCli("draft", "edit", "--help");
		const taskHelp = await runCli("task", "edit", "--help");
		expect(draftHelp.exitCode).toBe(0);
		expect(taskHelp.exitCode).toBe(0);

		const flagsOf = (text: string) => new Set(text.match(/--[a-z-]+/g) ?? []);
		const draftFlags = flagsOf(draftHelp.stdout.toString());
		const taskFlags = flagsOf(taskHelp.stdout.toString());

		// A handful of flags that only exist on the shared registration, plus the rule that the draft
		// command offers nothing the task command does not.
		for (const flag of ["--title", "--priority", "--add-ref", "--check-dod", "--modified-file", "--clear-due-date"]) {
			expect(draftFlags.has(flag)).toBe(true);
			expect(taskFlags.has(flag)).toBe(true);
		}
		expect([...draftFlags].filter((flag) => flag !== "--help").every((flag) => taskFlags.has(flag))).toBe(true);
	});
});
