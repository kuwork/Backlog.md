import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { Core } from "../core/backlog.ts";
import { applyFileRenamePlan, buildFileRenamePlan, collectFileRenameReferences } from "../core/file-rename-plan.ts";
import { rewriteEntityTitleRoutes, rewriteFileRenameContent } from "../markdown/file-rename-references.ts";
import { parseFrontmatter } from "../markdown/frontmatter.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const OLD_PATH = "backlog/docs/PRDS/rename/doc-1 - Old-Title.md";
const NEW_PATH = "backlog/docs/PRDS/rename/doc-1 - New-标题.md";
const OLD_FILENAME = "doc-1 - Old-Title.md";
const NEW_FILENAME = "doc-1 - New-标题.md";

function frontmatter(title: string): string {
	return `---\ntitle: ${title}\n---\n`;
}

describe("file rename reference rewriting", () => {
	it("resolves links from each referencing file and preserves their relative style", () => {
		const cases = [
			{
				path: "backlog/tasks/back-1.md",
				link: "../docs/PRDS/rename/doc-1%20-%20Old-Title.md?mode=full#part:2-4",
				expected: "../docs/PRDS/rename/doc-1%20-%20New-%E6%A0%87%E9%A2%98.md?mode=full#part:2-4",
			},
			{
				path: "backlog/docs/PRDS/other.md",
				link: "./rename/doc-1 - Old-Title.md",
				expected: "./rename/doc-1 - New-标题.md",
			},
			{
				path: "backlog/decisions/decision-1.md",
				link: "../docs/PRDS/rename/doc-1 - Old-Title.md",
				expected: "../docs/PRDS/rename/doc-1 - New-标题.md",
			},
			{
				path: "backlog/wiki/concepts/deep/page.md",
				link: "../../../docs/PRDS/rename/doc-1 - Old-Title.md",
				expected: "../../../docs/PRDS/rename/doc-1 - New-标题.md",
			},
		];
		for (const testCase of cases) {
			const result = rewriteFileRenameContent({
				content: `${frontmatter(testCase.path)}[keep label](<${testCase.link}>)`,
				referencingPath: testCase.path,
				sourcePath: OLD_PATH,
				targetPath: NEW_PATH,
				kind: "document",
			});
			const expected = testCase.expected.includes("?")
				? `<${testCase.expected.split("?")[0]}>?${testCase.expected.split("?").slice(1).join("?")}`
				: `<${testCase.expected}>`;
			expect(result).toContain(`[keep label](${expected})`);
		}

		const unrelated = `${frontmatter("other")}[same spelling](../docs/PRDS/rename/doc-1 - Old-Title.md)`;
		expect(
			rewriteFileRenameContent({
				content: unrelated,
				referencingPath: "backlog/wiki/concepts/page.md",
				sourcePath: OLD_PATH,
				targetPath: NEW_PATH,
				kind: "wiki",
			}),
		).toBe(unrelated);
	});

	it("updates exact task fields and Wiki source_path without rewriting protected content", () => {
		const task = `---\nid: BACK-1\ntitle: Reference\ndocumentation: [${OLD_PATH}, backlog/docs/other.md]\nreferences: [${OLD_PATH}]\nmodified_files: [${OLD_PATH}]\n---\n[doc](../docs/PRDS/rename/doc-1 - Old-Title.md)\n\n\`[code](../docs/PRDS/rename/doc-1 - Old-Title.md)\`\n\n\`\`\`md\n[fence](../docs/PRDS/rename/doc-1 - Old-Title.md)\n\`\`\`\n\n[[sources/doc-1 - Old Title]]`;
		const result = rewriteFileRenameContent({
			content: task,
			referencingPath: "backlog/tasks/back-1.md",
			sourcePath: OLD_PATH,
			targetPath: NEW_PATH,
			kind: "task",
		});
		const parsed = parseFrontmatter(result);
		expect(parsed.data.documentation).toEqual([NEW_PATH, "backlog/docs/other.md"]);
		expect(parsed.data.references).toEqual([NEW_PATH]);
		expect(parsed.data.modified_files).toEqual([NEW_PATH]);
		expect(parsed.content).toContain(`[doc](../docs/PRDS/rename/${NEW_FILENAME})`);
		expect(parsed.content).toContain(`\`[code](../docs/PRDS/rename/${OLD_FILENAME})\``);
		expect(parsed.content).toContain(`[fence](../docs/PRDS/rename/${OLD_FILENAME})`);
		expect(parsed.content).toContain("[[sources/doc-1 - Old Title]]");

		const wiki = rewriteFileRenameContent({
			content: `---\ntitle: Source\nsource_path: ${OLD_PATH}\n---\nBody`,
			referencingPath: "backlog/wiki/sources/example.md",
			sourcePath: OLD_PATH,
			targetPath: NEW_PATH,
			kind: "wiki",
		});
		expect(parseFrontmatter(wiki).data.source_path).toBe(NEW_PATH);
	});

	it("supports legacy unquoted assignee and reporter handles while rewriting references", () => {
		const legacyTask = `---\nid: BACK-1\ntitle: Legacy\nassignee: @MrLesk\nreporter: @MrLesk\ndocumentation: [${OLD_PATH}]\n---\n[doc](../docs/PRDS/rename/${OLD_FILENAME})`;
		const result = rewriteFileRenameContent({
			content: legacyTask,
			referencingPath: "backlog/completed/back-1 - legacy.md",
			sourcePath: OLD_PATH,
			targetPath: NEW_PATH,
			kind: "task",
		});
		const parsed = parseFrontmatter(result);
		expect(parsed.data.assignee).toBe("@MrLesk");
		expect(parsed.data.reporter).toBe("@MrLesk");
		expect(parsed.data.documentation).toEqual([NEW_PATH]);
		expect(parsed.content).toContain(`[doc](../docs/PRDS/rename/${NEW_FILENAME})`);
	});

	it("normalizes document, task and decision title routes independently", () => {
		const document = rewriteEntityTitleRoutes(
			"[new](/documentation/doc-036/old-title?mode=full#part)\n[short](/documentation/doc-36)\n[other](/documentation/doc-37/old-title)\n[stale](/documentation/doc-36/other)",
			{ kind: "documentation", id: "doc-36", oldTitle: "Old Title", newTitle: "New Title" },
		);
		expect(document).toContain("/documentation/doc-036/new-title?mode=full#part");
		expect(document).toContain("[short](/documentation/doc-36)");
		expect(document).toContain("/documentation/doc-37/old-title");
		expect(document).toContain("/documentation/doc-36/other");

		const task = rewriteEntityTitleRoutes("[task](/task/BACK-0506/old-task:2-4)", {
			kind: "task",
			id: "BACK-506",
			oldTitle: "Old Task",
			newTitle: "New Task",
		});
		expect(task).toBe("[task](/task/BACK-0506/new-task:2-4)");

		const decision = rewriteEntityTitleRoutes("[decision](/decisions/decision-02/old-decision)", {
			kind: "decisions",
			id: "decision-2",
			oldTitle: "Old Decision",
			newTitle: "New Decision",
		});
		expect(decision).toBe("[decision](/decisions/decision-02/new-decision)");
	});

	it("builds no writes for an unchanged path and only changed references otherwise", () => {
		const input = {
			sourcePath: OLD_PATH,
			targetPath: NEW_PATH,
			sourceContent: `${frontmatter("Old")}Old`,
			targetContent: `${frontmatter("New")}New`,
			references: [
				{ path: "backlog/docs/unrelated.md", kind: "document" as const, content: `${frontmatter("Other")}Other` },
			],
		};
		expect(buildFileRenamePlan(input).changes).toHaveLength(1);
		expect(buildFileRenamePlan({ ...input, targetPath: OLD_PATH }).changes).toHaveLength(0);
	});
});

describe("file rename plan filesystem boundaries", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("file-rename-plan");
		await mkdir(join(testDir, "backlog", "tasks"), { recursive: true });
		await mkdir(join(testDir, "backlog", "completed"), { recursive: true });
		await mkdir(join(testDir, "backlog", "docs"), { recursive: true });
		await mkdir(join(testDir, "backlog", "decisions"), { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("treats a missing Wiki as empty and excludes Wiki maintenance files", async () => {
		const directories = {
			rootDir: testDir,
			tasksDir: join(testDir, "backlog", "tasks"),
			completedDir: join(testDir, "backlog", "completed"),
			docsDir: join(testDir, "backlog", "docs"),
			decisionsDir: join(testDir, "backlog", "decisions"),
			wikiDir: join(testDir, "backlog", "wiki"),
		};
		expect(await collectFileRenameReferences(directories, "backlog/docs/doc-1.md")).toEqual([]);

		const wikiFile = join(directories.wikiDir, "sources", "example.md");
		for (const path of ["index.md", "overview.md", "log.md", "wiki_output/result.md"]) {
			const absolute = join(directories.wikiDir, path);
			await mkdir(dirname(absolute), { recursive: true });
			await writeFile(absolute, `${frontmatter("Maintenance")}Body`);
		}
		expect(await collectFileRenameReferences(directories, "backlog/docs/doc-1.md")).toEqual([]);

		await mkdir(dirname(wikiFile), { recursive: true });
		await writeFile(wikiFile, `${frontmatter("Source")}Body`);
		const references = await collectFileRenameReferences(directories, "backlog/docs/doc-1.md");
		expect(references.map((reference) => reference.path)).toEqual(["backlog/wiki/sources/example.md"]);
	});

	it("does not modify the source or references when the rename target conflicts", async () => {
		const source = join(testDir, "old.md");
		const target = join(testDir, "new.md");
		const reference = join(testDir, "reference.md");
		await writeFile(source, "old");
		await writeFile(target, "occupied");
		await writeFile(reference, "[old](old.md)");
		const plan = buildFileRenamePlan({
			sourcePath: "old.md",
			targetPath: "new.md",
			sourceContent: "old",
			targetContent: "new",
			references: [{ path: "reference.md", kind: "document", content: "[old](old.md)" }],
		});
		await expect(applyFileRenamePlan(testDir, plan)).rejects.toThrow("target already exists");
		expect(await readFile(source, "utf8")).toBe("old");
		expect(await readFile(target, "utf8")).toBe("occupied");
		expect(await readFile(reference, "utf8")).toBe("[old](old.md)");
	});

	it("keeps the original rename and concurrent edits when preflight detects changed input", async () => {
		const source = join(testDir, "old.md");
		const target = join(testDir, "new.md");
		const reference = join(testDir, "reference.md");
		await writeFile(source, "old");
		await writeFile(reference, "[old](old.md)");
		const plan = buildFileRenamePlan({
			sourcePath: "old.md",
			targetPath: "new.md",
			sourceContent: "old",
			targetContent: "new",
			references: [{ path: "reference.md", kind: "document", content: "[old](old.md)" }],
		});
		await writeFile(reference, "concurrent edit");
		await expect(applyFileRenamePlan(testDir, plan)).rejects.toThrow("File changed while preparing");
		expect(await readFile(source, "utf8")).toBe("old");
		expect(await Bun.file(target).exists()).toBe(false);
		expect(await readFile(reference, "utf8")).toBe("concurrent edit");
	});
});
describe("document title rename integration", () => {
	let core: Core;
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("document-rename-core");
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Document rename test");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("updates local tasks, completed tasks, documents, decisions and Wiki content", async () => {
		const oldDocument = await core.createDocumentFromInput(
			{
				title: "Old Title",
				path: "PRDS/rename",
				content: `[self](<${OLD_FILENAME}>)\n[route](/documentation/doc-1/old-title)`,
			},
			false,
		);
		const oldProjectPath = `backlog/docs/${oldDocument.path}`;
		const newProjectPath = NEW_PATH;
		const oldRelative = `../docs/PRDS/rename/${OLD_FILENAME}`;
		const newRelative = `../docs/PRDS/rename/${NEW_FILENAME}`;

		const active = await core.createTaskFromInput({
			title: "Active reference",
			description: `[doc](${oldRelative})`,
			documentation: [oldProjectPath],
			references: [oldProjectPath],
			modifiedFiles: [oldProjectPath],
		});
		const completed = await core.createTaskFromInput({
			title: "Completed reference",
			description: `[doc](${oldRelative})`,
			documentation: [oldProjectPath],
		});
		await core.completeTask(completed.task.id, false);
		const otherDocument = await core.createDocumentFromInput({
			title: "Other Document",
			path: "guides",
			content: `[doc](../PRDS/rename/${OLD_FILENAME})`,
		});
		const decision = await core.createDecisionWithTitle("Decision Reference", false);
		await core.updateDecision({ ...decision, context: `[doc](${oldRelative})` }, false);

		const wikiPage = join(core.filesystem.wikiDir, "sources", "example.md");
		await mkdir(dirname(wikiPage), { recursive: true });
		await writeFile(
			wikiPage,
			`---\ntitle: Example\nsource_path: ${oldProjectPath}\n---\n[doc](../../docs/PRDS/rename/${OLD_FILENAME})`,
		);
		const maintenance = join(core.filesystem.wikiDir, "index.md");
		await writeFile(maintenance, `[do not change](../../docs/PRDS/rename/${OLD_FILENAME})`);

		const updated = await core.updateDocumentFromInput(
			{ id: oldDocument.id, title: "New 标题", content: oldDocument.rawContent },
			false,
		);
		const finalProjectPath = `backlog/docs/${updated.path}`;
		expect(finalProjectPath).toBe(newProjectPath);
		expect(await Bun.file(join(testDir, oldProjectPath)).exists()).toBe(false);
		expect(await Bun.file(join(testDir, finalProjectPath)).exists()).toBe(true);
		const primary = await readFile(join(testDir, finalProjectPath), "utf8");
		expect(primary).toContain(`[self](<${NEW_FILENAME}>)`);
		expect(primary).toContain("/documentation/doc-1/new");

		for (const taskId of [active.task.id, completed.task.id]) {
			const task = await core.getTask(taskId);
			expect(task).not.toBeNull();
			const taskContent = await readFile(task?.filePath ?? "", "utf8");
			const parsed = parseFrontmatter(taskContent);
			expect(parsed.data.documentation).toEqual([finalProjectPath]);
			expect(parsed.content).toContain(newRelative);
			if (taskId === active.task.id) {
				expect(parsed.data.references).toEqual([finalProjectPath]);
				expect(parsed.data.modified_files).toEqual([finalProjectPath]);
			}
		}

		const otherPath = join(core.filesystem.docsDir, otherDocument.path ?? "");
		expect(await readFile(otherPath, "utf8")).toContain(`../PRDS/rename/${NEW_FILENAME}`);
		const savedDecision = await core.fs.loadDecision(decision.id);
		expect(savedDecision?.context).toContain(newRelative);
		const wikiContent = await readFile(wikiPage, "utf8");
		expect(parseFrontmatter(wikiContent).data.source_path).toBe(finalProjectPath);
		expect(wikiContent).toContain(`../../docs/PRDS/rename/${NEW_FILENAME}`);
		expect(await readFile(maintenance, "utf8")).toContain(OLD_FILENAME);
	});

	it("renames normally when the Wiki directory does not exist and does not create it", async () => {
		await rm(core.filesystem.wikiDir, { recursive: true, force: true });
		const document = await core.createDocumentFromInput({ title: "Old Title", content: "Body" }, false);
		const oldPath = join(core.filesystem.docsDir, document.path ?? "");
		const updated = await core.updateDocumentFromInput(
			{ id: document.id, title: "New Title", content: document.rawContent },
			false,
		);
		expect(await Bun.file(oldPath).exists()).toBe(false);
		expect(await Bun.file(join(core.filesystem.docsDir, updated.path ?? "")).exists()).toBe(true);
		expect(await Bun.file(core.filesystem.wikiDir).exists()).toBe(false);
	});
});

describe("task title rename integration", () => {
	let core: Core;
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("task-rename-core");
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Task rename test");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("renames the task file and updates local references and only task title routes", async () => {
		const { task: source } = await core.createTaskFromInput({
			title: "Old Task Title",
			description: "[self](task-1 - Old-Task-Title.md)\n[route](/task/task-1/old-task-title)",
		});
		const sourcePath = source.filePath ?? "";
		const oldFilename = basename(sourcePath);
		const oldProjectPath = `backlog/tasks/${oldFilename}`;
		const newProjectPath = "backlog/tasks/task-1 - New-Task-Title.md";
		const oldRelative = `../tasks/${oldFilename}`;
		const active = await core.createTaskFromInput({
			title: "Active task reference",
			description: `[task](${oldFilename})`,
			documentation: [oldProjectPath],
			references: [oldProjectPath],
			modifiedFiles: [oldProjectPath],
		});
		const completed = await core.createTaskFromInput({
			title: "Completed task reference",
			status: "Done",
			description: `[task](${oldFilename})`,
		});
		const document = await core.createDocumentFromInput({
			title: "Task routes",
			content: `[task](${oldRelative})\n[task route](/task/task-1/old-task-title?x=1#part)\n[doc route](/documentation/doc-1/old-task-title)\n[decision route](/decisions/decision-1/old-task-title)`,
		});
		const decision = await core.createDecisionWithTitle("Task Reference", false);
		await core.updateDecision({ ...decision, context: `[task](${oldRelative})` }, false);
		const wikiPage = join(core.filesystem.wikiDir, "sources", "task.md");
		await mkdir(dirname(wikiPage), { recursive: true });
		await writeFile(
			wikiPage,
			`---\ntitle: Task\nsource_path: ${oldProjectPath}\n---\n[task](../../tasks/${oldFilename})`,
		);

		const updated = await core.updateTaskFromInput(source.id, { title: "New Task Title" }, false);
		const newFilename = "task-1 - New-Task-Title.md";
		expect(updated.filePath).toBe(join(core.filesystem.tasksDir, newFilename));
		expect(await Bun.file(sourcePath).exists()).toBe(false);
		expect(await Bun.file(updated.filePath ?? "").exists()).toBe(true);
		const primary = await readFile(updated.filePath ?? "", "utf8");
		expect(primary).toContain(`[self](${newFilename})`);
		expect(primary).toContain("/task/task-1/new-task-title");

		for (const reference of [active.task, completed.task]) {
			const saved = await core.fs.loadTask(reference.id);
			const content = await readFile(saved?.filePath ?? "", "utf8");
			expect(content).toContain(newFilename);
			if (reference.id === active.task.id) {
				const parsed = parseFrontmatter(content);
				expect(parsed.data.documentation).toEqual([newProjectPath]);
				expect(parsed.data.references).toEqual([newProjectPath]);
				expect(parsed.data.modified_files).toEqual([newProjectPath]);
			}
		}

		const documentContent = await readFile(join(core.filesystem.docsDir, document.path ?? ""), "utf8");
		expect(documentContent).toContain(`../tasks/${newFilename}`);
		expect(documentContent).toContain("/task/task-1/new-task-title?x=1#part");
		expect(documentContent).toContain("/documentation/doc-1/old-task-title");
		expect(documentContent).toContain("/decisions/decision-1/old-task-title");
		expect((await core.fs.loadDecision(decision.id))?.context).toContain(`../tasks/${newFilename}`);
		const wikiContent = await readFile(wikiPage, "utf8");
		expect(parseFrontmatter(wikiContent).data.source_path).toBe(newProjectPath);
		expect(wikiContent).toContain(`../../tasks/${newFilename}`);
	});

	it("renames a task with Done status without changing its status or directory", async () => {
		const { task } = await core.createTaskFromInput({ title: "Done Old", status: "Done" });
		const oldPath = task.filePath ?? "";
		const updated = await core.updateTaskFromInput(task.id, { title: "Done New" }, false);
		expect(updated.status).toBe("Done");
		expect(updated.filePath).toBe(join(core.filesystem.tasksDir, "task-1 - Done-New.md"));
		expect(await Bun.file(oldPath).exists()).toBe(false);
		expect(await Bun.file(updated.filePath ?? "").exists()).toBe(true);
	});

	it("keeps the existing path when different titles sanitize to the same filename", async () => {
		const { task } = await core.createTaskFromInput({ title: "Same Filename" });
		const oldPath = task.filePath ?? "";
		const updated = await core.updateTaskFromInput(task.id, { title: "Same   Filename" }, false);
		expect(updated.title).toBe("Same   Filename");
		expect(updated.filePath).toBe(oldPath);
		expect(await Bun.file(oldPath).exists()).toBe(true);
	});

	it("rejects a same-ID target conflict without changing either file", async () => {
		const { task } = await core.createTaskFromInput({ title: "Conflict Old", description: "Original body" });
		const sourcePath = task.filePath ?? "";
		const targetPath = join(core.filesystem.tasksDir, "task-1 - Conflict-New.md");
		await writeFile(targetPath, "conflicting target");
		const sourceBefore = await readFile(sourcePath, "utf8");
		await expect(core.updateTaskFromInput(task.id, { title: "Conflict New" }, false)).rejects.toThrow("Task not found");
		expect(await readFile(sourcePath, "utf8")).toBe(sourceBefore);
		expect(await readFile(targetPath, "utf8")).toBe("conflicting target");
	});
});

describe("decision title rename integration", () => {
	let core: Core;
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("decision-rename-core");
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Decision rename test");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("renames the decision file and updates local references and only decision title routes", async () => {
		const source = await core.createDecisionWithTitle("Old Decision Title", false);
		const oldFilename = "decision-1 - Old-Decision-Title.md";
		const newFilename = "decision-1 - New-Decision-Title.md";
		const sourcePath = join(core.filesystem.decisionsDir, oldFilename);
		const oldProjectPath = `backlog/decisions/${oldFilename}`;
		const newProjectPath = `backlog/decisions/${newFilename}`;
		const original = await core.fs.loadDecision(source.id);
		if (!original) throw new Error("Expected source decision");
		await core.updateDecision(
			{
				...original,
				context: `[self](${oldFilename})\n[route](/decisions/decision-1/old-decision-title)`,
			},
			false,
		);

		const { task: active } = await core.createTaskFromInput({
			title: "Active decision reference",
			description: `[decision](../decisions/${oldFilename})`,
			documentation: [oldProjectPath],
			references: [oldProjectPath],
			modifiedFiles: [oldProjectPath],
		});
		const { task: completed } = await core.createTaskFromInput({
			title: "Completed decision reference",
			status: "Done",
			description: `[decision](../decisions/${oldFilename})`,
		});
		const document = await core.createDocumentFromInput({
			title: "Decision routes",
			content: `[decision](../decisions/${oldFilename})\n[decision route](/decisions/decision-1/old-decision-title?x=1#part)\n[task route](/task/task-1/old-decision-title)\n[doc route](/documentation/doc-1/old-decision-title)`,
		});
		const otherDecision = await core.createDecisionWithTitle("Decision Reference", false);
		const otherOriginal = await core.fs.loadDecision(otherDecision.id);
		if (!otherOriginal) throw new Error("Expected referencing decision");
		await core.updateDecision({ ...otherOriginal, context: `[decision](${oldFilename})` }, false);
		const wikiPage = join(core.filesystem.wikiDir, "sources", "decision.md");
		await mkdir(dirname(wikiPage), { recursive: true });
		await writeFile(
			wikiPage,
			`---\ntitle: Decision\nsource_path: ${oldProjectPath}\n---\n[decision](../../decisions/${oldFilename})`,
		);

		const beforeUpdate = await core.fs.loadDecision(source.id);
		if (!beforeUpdate) throw new Error("Expected source decision before rename");
		await core.updateDecision({ ...beforeUpdate, title: "New Decision Title" }, false);

		const updated = await core.fs.loadDecision(source.id);
		const newPath = join(core.filesystem.decisionsDir, newFilename);
		expect(updated?.path).toBe(newFilename);
		expect(await Bun.file(sourcePath).exists()).toBe(false);
		expect(await Bun.file(newPath).exists()).toBe(true);
		const primary = await readFile(newPath, "utf8");
		expect(primary).toContain(`[self](${newFilename})`);
		expect(primary).toContain("/decisions/decision-1/new-decision-title");

		for (const reference of [active, completed]) {
			const saved = await core.fs.loadTask(reference.id);
			const content = await readFile(saved?.filePath ?? "", "utf8");
			expect(content).toContain(`../decisions/${newFilename}`);
			if (reference.id === active.id) {
				const parsed = parseFrontmatter(content);
				expect(parsed.data.documentation).toEqual([newProjectPath]);
				expect(parsed.data.references).toEqual([newProjectPath]);
				expect(parsed.data.modified_files).toEqual([newProjectPath]);
			}
		}

		const documentContent = await readFile(join(core.filesystem.docsDir, document.path ?? ""), "utf8");
		expect(documentContent).toContain(`../decisions/${newFilename}`);
		expect(documentContent).toContain("/decisions/decision-1/new-decision-title?x=1#part");
		expect(documentContent).toContain("/task/task-1/old-decision-title");
		expect(documentContent).toContain("/documentation/doc-1/old-decision-title");
		expect((await core.fs.loadDecision(otherDecision.id))?.context).toContain(newFilename);
		const wikiContent = await readFile(wikiPage, "utf8");
		expect(parseFrontmatter(wikiContent).data.source_path).toBe(newProjectPath);
		expect(wikiContent).toContain(`../../decisions/${newFilename}`);
	});

	it("keeps the existing path when different titles sanitize to the same filename", async () => {
		const source = await core.createDecisionWithTitle("Same Filename", false);
		const original = await core.fs.loadDecision(source.id);
		if (!original) throw new Error("Expected source decision");
		const oldPath = join(core.filesystem.decisionsDir, original.path ?? "");
		await core.updateDecision({ ...original, title: "Same   Filename" }, false);
		const updated = await core.fs.loadDecision(source.id);
		expect(updated?.title).toBe("Same   Filename");
		expect(updated?.path).toBe(original.path);
		expect(await Bun.file(oldPath).exists()).toBe(true);
	});

	it("rejects a same-ID target conflict without changing either file", async () => {
		const source = await core.createDecisionWithTitle("Conflict Old", false);
		const original = await core.fs.loadDecision(source.id);
		if (!original) throw new Error("Expected source decision");
		const sourcePath = join(core.filesystem.decisionsDir, original.path ?? "");
		const targetPath = join(core.filesystem.decisionsDir, "decision-1 - Conflict-New.md");
		const sourceBefore = await readFile(sourcePath, "utf8");
		await writeFile(targetPath, sourceBefore.replace("Conflict Old", "Conflict New"));
		const targetBefore = await readFile(targetPath, "utf8");

		await expect(core.updateDecision({ ...original, title: "Conflict New" }, false)).rejects.toThrow("ambiguous");
		expect(await readFile(sourcePath, "utf8")).toBe(sourceBefore);
		expect(await readFile(targetPath, "utf8")).toBe(targetBefore);
	});
});
