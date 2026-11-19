import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { parseFrontmatter } from "../markdown/frontmatter.ts";
import {
	createUniqueTestDir,
	initializeFilesystemTestProject,
	initializeTestProject,
	safeCleanup,
} from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("entity ID updates", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("entity-id-update");
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Entity ID update test");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("updates one duplicate document by exact path and synchronizes paths and routes", async () => {
		const source = await core.createDocumentFromInput(
			{
				title: "Old Title",
				path: "PRDS/rename",
				content: "[self route](/documentation/doc-1/old-title)",
			},
			false,
		);
		const sourceProjectPath = `backlog/docs/${source.path}`;
		const sourceAbsolutePath = join(core.filesystem.docsDir, source.path ?? "");
		const duplicatePath = join(core.filesystem.docsDir, "duplicate.md");
		const duplicateBefore = await readFile(sourceAbsolutePath, "utf8");
		await writeFile(duplicatePath, duplicateBefore);
		await expect(core.getDocument(source.id)).rejects.toThrow("AMBIGUOUS_ID");

		await expect(
			core.updateDocumentFromInput({ id: "doc-999", newId: "doc-10", content: source.rawContent }, false, {
				sourcePath: sourceProjectPath,
			}),
		).rejects.toThrow("SOURCE_MISMATCH");
		expect(await readFile(sourceAbsolutePath, "utf8")).toBe(duplicateBefore);

		const { task: reference } = await core.createTaskFromInput({
			title: "Document reference",
			documentation: [sourceProjectPath],
			references: [sourceProjectPath],
			modifiedFiles: [sourceProjectPath],
		});
		const milestonePath = join(core.filesystem.milestonesDir, "m-1.md");
		await mkdir(core.filesystem.milestonesDir, { recursive: true });
		await writeFile(
			milestonePath,
			`---\nid: m-1\ntitle: Milestone\ndocumentation: ["${sourceProjectPath}"]\n---\n[doc](../docs/${source.path})\n`,
		);
		const updated = await core.updateDocumentFromInput(
			{ id: source.id, newId: "10", title: "New Title", content: source.rawContent },
			false,
			{ sourcePath: sourceProjectPath },
		);

		const newProjectPath = "backlog/docs/PRDS/rename/doc-10 - New-Title.md";
		expect(updated.id).toBe("doc-10");
		expect(updated.path).toBe("PRDS/rename/doc-10 - New-Title.md");
		expect(await Bun.file(join(testDir, newProjectPath)).exists()).toBe(true);
		expect(await Bun.file(sourceAbsolutePath).exists()).toBe(false);
		expect(await readFile(duplicatePath, "utf8")).toBe(duplicateBefore);
		expect(await readFile(join(testDir, newProjectPath), "utf8")).toContain("/documentation/doc-10/new-title");
		const referenceContent = parseFrontmatter(await readFile(reference.filePath ?? "", "utf8"));
		expect(referenceContent.data.documentation).toEqual([newProjectPath]);
		expect(referenceContent.data.references).toEqual([newProjectPath]);
		expect(referenceContent.data.modified_files).toEqual([newProjectPath]);
		const milestoneContent = parseFrontmatter(await readFile(milestonePath, "utf8"));
		expect(milestoneContent.data.documentation).toEqual([newProjectPath]);
		expect(milestoneContent.content).toContain(`../docs/${updated.path}`);
	});

	it("updates task identity fields, drafts, relative links, and task routes", async () => {
		const { task: source } = await core.createTaskFromInput({
			title: "Old Task",
			description: "[route](/task/task-1/old-task)",
		});
		const oldFilename = basename(source.filePath ?? "");
		const { task: reference } = await core.createTaskFromInput({
			title: "Task reference",
			dependencies: [source.id],
			references: [source.id],
			description: `[task](${oldFilename})\n[route](/task/task-1/old-task)`,
		});
		const { task: draft } = await core.createTaskFromInput({
			title: "Draft reference",
			status: "Draft",
			dependencies: [source.id],
			references: [source.id],
		});

		const updated = await core.updateTaskFromInput(source.id, { newId: "10", title: "New Task" }, false);
		expect(updated.id).toBe("TASK-10");
		expect(updated.filePath).toBe(join(core.filesystem.tasksDir, "task-10 - New-Task.md"));
		expect(await readFile(updated.filePath ?? "", "utf8")).toContain("/task/TASK-10/new-task");

		const savedReference = await core.fs.loadTask(reference.id);
		expect(savedReference?.dependencies).toEqual(["TASK-10"]);
		expect(savedReference?.references).toEqual(["TASK-10"]);
		expect(savedReference?.description).toContain("task-10 - New-Task.md");
		expect(savedReference?.description).toContain("/task/TASK-10/new-task");
		const savedDraft = await core.fs.loadDraft(draft.id);
		expect(savedDraft?.dependencies).toEqual(["TASK-10"]);
		expect(savedDraft?.references).toEqual(["TASK-10"]);

		const { task: conflicting } = await core.createTaskFromInput({ title: "Existing target" });
		const before = await readFile(updated.filePath ?? "", "utf8");
		await expect(core.updateTaskFromInput(updated.id, { newId: conflicting.id }, false)).rejects.toThrow("ID_CONFLICT");
		expect(await readFile(updated.filePath ?? "", "utf8")).toBe(before);
	});

	it("enforces task hierarchy rules while allowing a subtask number change", async () => {
		const { task: parent } = await core.createTaskFromInput({ title: "Parent" });
		const { task: child } = await core.createTaskFromInput({ title: "Child", parentTaskId: parent.id });

		await expect(core.updateTaskFromInput(parent.id, { newId: "20" }, false)).rejects.toThrow("HIERARCHY_CONFLICT");
		await expect(core.updateTaskFromInput(child.id, { newId: "20" }, false)).rejects.toThrow("HIERARCHY_CONFLICT");
		await expect(core.updateTaskFromInput(child.id, { newId: "TASK-20.1" }, false)).rejects.toThrow(
			"HIERARCHY_CONFLICT",
		);
		const updated = await core.updateTaskFromInput(child.id, { newId: `${parent.id}.2` }, false);
		expect(updated.id).toBe(`${parent.id}.2`);
		expect(updated.parentTaskId).toBe(parent.id);
	});

	it("rejects an occupied target path without changing the source", async () => {
		const source = await core.createDocumentFromInput({ title: "Source", content: "Original" }, false);
		const sourcePath = join(core.filesystem.docsDir, source.path ?? "");
		const targetPath = join(core.filesystem.docsDir, "doc-10 - Target.md");
		await writeFile(
			targetPath,
			"---\nid: doc-99\ntitle: Unrelated\ntype: other\ncreated_date: '2026-01-01 00:00'\n---\nUnrelated\n",
		);
		const before = await readFile(sourcePath, "utf8");
		await expect(
			core.updateDocumentFromInput(
				{ id: source.id, newId: "doc-10", title: "Target", content: source.rawContent },
				false,
			),
		).rejects.toThrow("PATH_CONFLICT");
		expect(await readFile(sourcePath, "utf8")).toBe(before);
		expect(await readFile(targetPath, "utf8")).toContain("Unrelated");
	});

	it("updates a decision ID and title together, including routes", async () => {
		const source = await core.createDecisionWithTitle("Old Decision", false);
		const original = await core.fs.loadDecision(source.id);
		if (!original) throw new Error("Expected source decision");
		await core.updateDecision({ ...original, context: "[route](/decisions/decision-1/old-decision)" }, false);
		const document = await core.createDocumentFromInput(
			{ title: "Decision route", content: "[route](/decisions/decision-1/old-decision)" },
			false,
		);

		const beforeUpdate = await core.fs.loadDecision(source.id);
		if (!beforeUpdate) throw new Error("Expected decision before update");
		await core.updateDecisionFromContent(source.id, beforeUpdate.rawContent, {
			newId: "10",
			title: "New Decision",
			autoCommit: false,
		});
		const updated = await core.fs.loadDecision("decision-10");
		expect(updated?.title).toBe("New Decision");
		expect(updated?.path).toBe("decision-10 - New-Decision.md");
		expect(updated?.context).toContain("/decisions/decision-10/new-decision");
		const documentContent = await readFile(join(core.filesystem.docsDir, document.path ?? ""), "utf8");
		expect(documentContent).toContain("/decisions/decision-10/new-decision");
	});
});

describe("entity source path CLI", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("entity-source-cli");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		await initializeTestProject(new Core(testDir), "Entity source CLI test");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("allows an omitted positional ID and rejects a mismatching supplied ID", async () => {
		const core = new Core(testDir);
		const document = await core.createDocumentFromInput({ title: "CLI Old", content: "Body" }, false);
		const sourcePath = `backlog/docs/${document.path}`;
		const update = await $`bun ${CLI_PATH} doc update --source-path ${sourcePath} --id doc-10 --title ${"CLI New"}`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(update.exitCode).toBe(0);
		expect(update.stdout.toString()).toContain("Updated document doc-10");

		const newPath = "backlog/docs/doc-10 - CLI-New.md";
		const view = await $`bun ${CLI_PATH} doc view --source-path ${newPath} --plain`.cwd(testDir).quiet().nothrow();
		expect(view.exitCode).toBe(0);
		expect(view.stdout.toString()).toContain("id: doc-10");
		expect(view.stdout.toString()).toContain("title: CLI New");

		const mismatch = await $`bun ${CLI_PATH} doc view doc-999 --source-path ${newPath} --plain`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(mismatch.exitCode).toBe(1);
		expect(mismatch.stderr.toString()).toContain("SOURCE_MISMATCH");

		const { task } = await core.createTaskFromInput({ title: "Task Old" });
		const taskSource = `backlog/tasks/${basename(task.filePath ?? "")}`;
		const taskUpdate =
			await $`bun ${CLI_PATH} task edit --source-path ${taskSource} --id TASK-10 --title ${"Task New"} --plain`
				.cwd(testDir)
				.quiet()
				.nothrow();
		expect(taskUpdate.exitCode).toBe(0);
		expect(taskUpdate.stdout.toString()).toContain("Task TASK-10 - Task New");

		const decision = await core.createDecisionWithTitle("Decision Old", false);
		const storedDecision = await core.fs.loadDecision(decision.id);
		const decisionSource = `backlog/decisions/${storedDecision?.path}`;
		const decisionUpdate =
			await $`bun ${CLI_PATH} decision update --source-path ${decisionSource} --id decision-10 --title ${"Decision New"}`
				.cwd(testDir)
				.quiet()
				.nothrow();
		expect(decisionUpdate.exitCode).toBe(0);
		expect(decisionUpdate.stdout.toString()).toContain("Updated decision decision-10");
		expect((await core.fs.loadDecision("decision-10"))?.title).toBe("Decision New");
	}, 60000);
});
