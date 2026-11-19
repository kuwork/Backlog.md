import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
