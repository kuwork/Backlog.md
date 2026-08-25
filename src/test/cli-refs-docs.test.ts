import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const cliPath = join(process.cwd(), "src", "cli.ts");

describe("CLI --ref and --doc flags", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-refs-docs");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "CLI Refs Docs Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	describe("task create with --ref flag", () => {
		it("creates task with single reference", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --ref https://github.com/issue/123 --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://github.com/issue/123");
		});

		it("creates task with multiple references", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --ref https://github.com/issue/123 --ref src/api.ts --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://github.com/issue/123, src/api.ts");
		});

		it("creates task with comma-separated references", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --ref "file1.ts,file2.ts" --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: file1.ts, file2.ts");
		});
	});

	describe("task create with --doc flag", () => {
		it("creates task with single documentation", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --doc https://design-docs.example.com --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://design-docs.example.com");
		});

		it("creates task with multiple documentation entries", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --doc https://design-docs.example.com --doc docs/spec.md --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://design-docs.example.com, docs/spec.md");
		});

		it("creates task with comma-separated documentation", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --doc "doc1.md,doc2.md" --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: doc1.md, doc2.md");
		});
	});

	describe("task create with both --ref and --doc flags", () => {
		it("creates task with both references and documentation", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --ref src/api.ts --doc https://design-docs.example.com --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: src/api.ts");
			expect(out).toContain("Documentation: https://design-docs.example.com");
		});
	});

	describe("task create with --modified-file flag", () => {
		it("creates task with multiple modified files", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --modified-file src/api.ts --modified-file src/ui.ts --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Modified files: src/api.ts, src/ui.ts");
		});
	});

	describe("task edit with --ref flag", () => {
		it("replaces references on existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --ref https://example.com`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref https://github.com/issue/456 --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://github.com/issue/456");
		});

		it("sets multiple references on existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --ref existing.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref file1.ts --ref file2.ts --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: file1.ts, file2.ts");
		});
	});

	describe("task edit with --add-ref flag", () => {
		it("appends a reference to existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --ref https://example.com`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --add-ref https://github.com/issue/456 --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://example.com, https://github.com/issue/456");
		});

		it("appends multiple references to existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --ref existing.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --add-ref file1.ts --add-ref file2.ts --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: existing.ts, file1.ts, file2.ts");
		});

		it("rejects combining --ref with --add-ref", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref file1.ts --add-ref file2.ts --plain`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();

			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot combine --ref");
		});
	});

	describe("task edit with --doc flag", () => {
		it("replaces documentation on existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --doc https://design-docs.example.com`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc https://api-docs.example.com --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://api-docs.example.com");
		});

		it("sets multiple documentation entries on existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --doc existing.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc doc1.md --doc doc2.md --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: doc1.md, doc2.md");
		});
	});

	describe("task edit with --add-doc flag", () => {
		it("appends documentation to existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --doc https://design-docs.example.com`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --add-doc https://api-docs.example.com --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://design-docs.example.com, https://api-docs.example.com");
		});

		it("appends multiple documentation entries to existing task", async () => {
			await $`bun ${cliPath} task create "Feature" --doc existing.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --add-doc doc1.md --add-doc doc2.md --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: existing.md, doc1.md, doc2.md");
		});

		it("rejects combining --doc with --add-doc", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc doc1.md --add-doc doc2.md --plain`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();

			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot combine --ref/--doc/--depends-on/--dep with --add-ref");
		});
	});

	describe("task edit with --modified-file flag", () => {
		it("sets modified files on existing task", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --modified-file src/api.ts --modified-file src/ui.ts --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Modified files: src/api.ts, src/ui.ts");
		});
	});

	describe("persistence in markdown files", () => {
		it("persists references in task markdown file", async () => {
			await $`bun ${cliPath} task create "Feature" --ref https://example.com --ref src/index.ts`.cwd(TEST_DIR).quiet();

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("references:");
			expect(taskFile).toContain("https://example.com");
			expect(taskFile).toContain("src/index.ts");
		});

		it("persists documentation in task markdown file", async () => {
			await $`bun ${cliPath} task create "Feature" --doc https://docs.example.com --doc spec.md`.cwd(TEST_DIR).quiet();

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("documentation:");
			expect(taskFile).toContain("https://docs.example.com");
			expect(taskFile).toContain("spec.md");
		});

		it("persists modified files in task markdown file", async () => {
			await $`bun ${cliPath} task create "Feature" --modified-file src/index.ts --modified-file src/ui.ts`
				.cwd(TEST_DIR)
				.quiet();

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("modified_files:");
			expect(taskFile).toContain("src/index.ts");
			expect(taskFile).toContain("src/ui.ts");
		});
	});

	describe("task edit --clear-refs and --clear-docs", () => {
		it("clears references with --clear-refs", async () => {
			const resultCreate = await $`bun ${cliPath} task create "With refs" --ref https://example.com`
				.cwd(TEST_DIR)
				.quiet();
			expect(resultCreate.exitCode).toBe(0);

			const result = await $`bun ${cliPath} task edit 1 --clear-refs --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).not.toContain("References:");
		});

		it("clears documentation with --clear-docs", async () => {
			const resultCreate = await $`bun ${cliPath} task create "With docs" --doc docs/spec.md`.cwd(TEST_DIR).quiet();
			expect(resultCreate.exitCode).toBe(0);

			const result = await $`bun ${cliPath} task edit 1 --clear-docs --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).not.toContain("Documentation:");
		});
	});

	describe("empty setter value rejection", () => {
		it("task create rejects empty --ref", async () => {
			const result = await $`bun ${cliPath} task create "Bad" --ref=""`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --ref");
			expect(result.stderr.toString()).toContain("Omit the flag");
		});

		it("task create rejects empty --doc", async () => {
			const result = await $`bun ${cliPath} task create "Bad" --doc=""`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --doc");
			expect(result.stderr.toString()).toContain("Omit the flag");
		});

		it("task edit rejects empty --ref and suggests --clear-refs", async () => {
			await $`bun ${cliPath} task create "Task"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref=""`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --ref");
			expect(result.stderr.toString()).toContain("Use --clear-refs");
		});

		it("task edit rejects empty --doc and suggests --clear-docs", async () => {
			await $`bun ${cliPath} task create "Task"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc=""`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --doc");
			expect(result.stderr.toString()).toContain("Use --clear-docs");
		});

		it("task edit rejects mixed empty and non-empty --ref values", async () => {
			await $`bun ${cliPath} task create "Task"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref="" --ref=file.ts`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --ref");
		});
	});

	describe("clear flag conflict rejection", () => {
		it("rejects combining --clear-refs with --ref", async () => {
			await $`bun ${cliPath} task create "Task" --ref https://example.com`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --clear-refs --ref=file.ts`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot combine --clear-refs with --ref");
		});

		it("rejects combining --clear-docs with --doc", async () => {
			await $`bun ${cliPath} task create "Task" --doc docs/spec.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --clear-docs --doc=other.md`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot combine --clear-docs with --doc");
		});
	});

	describe("task edit --remove-ref flag", () => {
		it("removes a single reference and leaves others", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --ref=file1.ts --ref=file2.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --remove-ref=file1.ts --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("References: file2.ts");
		});

		it("supports repeated flags and comma-separated values", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --ref=file1.ts --ref=file2.ts --ref=file3.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --remove-ref=file1.ts --remove-ref=file2.ts,file3.ts --plain`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).not.toContain("file1.ts");
			expect(result.stdout.toString()).not.toContain("file2.ts");
			expect(result.stdout.toString()).not.toContain("file3.ts");

			const task = await new Core(TEST_DIR).filesystem.loadTask("task-1");
			expect(task?.references).toEqual([]);
		});

		it("rejects blank values and leaves the task unchanged", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --ref=file1.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --remove-ref=""`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --remove-ref");

			const task = await new Core(TEST_DIR).filesystem.loadTask("task-1");
			expect(task?.references).toEqual(["file1.ts"]);
		});

		it("rejects combining --clear-refs with --remove-ref", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --ref=file1.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --clear-refs --remove-ref=file1.ts`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot combine --clear-refs with --remove-ref");
		});

		it("allows combining --ref with --remove-ref", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --ref=file1.ts`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref=file2.ts --remove-ref=file1.ts --plain`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("References: file2.ts");

			const task = await new Core(TEST_DIR).filesystem.loadTask("task-1");
			expect(task?.references).toEqual(["file2.ts"]);
		});
	});

	describe("task edit --remove-doc flag", () => {
		it("removes a single documentation entry and leaves others", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --doc=doc1.md --doc=doc2.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --remove-doc=doc1.md --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Documentation: doc2.md");
		});

		it("supports repeated flags and comma-separated values", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --doc=doc1.md --doc=doc2.md --doc=doc3.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --remove-doc=doc1.md --remove-doc=doc2.md,doc3.md --plain`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).not.toContain("doc1.md");
			expect(result.stdout.toString()).not.toContain("doc2.md");
			expect(result.stdout.toString()).not.toContain("doc3.md");

			const task = await new Core(TEST_DIR).filesystem.loadTask("task-1");
			expect(task?.documentation).toEqual([]);
		});

		it("rejects blank values and leaves the task unchanged", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --doc=doc1.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --remove-doc=""`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --remove-doc");

			const task = await new Core(TEST_DIR).filesystem.loadTask("task-1");
			expect(task?.documentation).toEqual(["doc1.md"]);
		});

		it("rejects combining --clear-docs with --remove-doc", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --doc=doc1.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --clear-docs --remove-doc=doc1.md`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot combine --clear-docs with --remove-doc");
		});

		it("allows combining --doc with --remove-doc", async () => {
			const cliPath = join(process.cwd(), "src", "cli.ts");
			await $`bun ${cliPath} task create "Task" --doc=doc1.md`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc=doc2.md --remove-doc=doc1.md --plain`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Documentation: doc2.md");

			const task = await new Core(TEST_DIR).filesystem.loadTask("task-1");
			expect(task?.documentation).toEqual(["doc2.md"]);
		});
	});
});
