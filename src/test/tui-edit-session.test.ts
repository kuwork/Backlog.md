import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { editTargetNoun } from "../ui/task-viewer-with-search.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

// Spawn a real editor subprocess; cold starts can exceed the 5s default under full-suite load.
setDefaultTimeout(20000);

function createMockScreen(): Parameters<Core["editTaskInTui"]>[1] {
	return {
		program: {
			disableMouse: () => {},
			enableMouse: () => {},
			hideCursor: () => {},
			showCursor: () => {},
			input: process.stdin,
			pause: () => () => {},
			flush: () => {},
			put: {
				keypad_local: () => {},
				keypad_xmit: () => {},
			},
		},
		leave: () => {},
		enter: () => {},
		render: () => {},
		clearRegion: () => {},
		width: 120,
		height: 40,
		emit: () => {},
	};
}

describe("Core.editTaskInTui", () => {
	let testDir: string;
	let core: Core;
	let taskId: string;
	let originalEditor: string | undefined;
	const screen = createMockScreen();

	const setEditor = async (editorCommand: string) => {
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected config to be initialized");
		}
		const updated: BacklogConfig = {
			...config,
			defaultEditor: editorCommand,
		};
		await core.filesystem.saveConfig(updated);
	};

	const createEditorScript = async (name: string, source: string): Promise<string> => {
		const scriptPath = join(testDir, name);
		await writeFile(scriptPath, source);
		return scriptPath;
	};

	beforeEach(async () => {
		originalEditor = process.env.EDITOR;
		delete process.env.EDITOR;

		testDir = createUniqueTestDir("test-tui-edit-session");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir, { enableWatchers: true });
		await initializeTestProject(core, "TUI Edit Session Test");

		const task: Task = {
			id: "task-1",
			title: "Editor Flow Task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-02-11 20:00",
			labels: [],
			dependencies: [],
			rawContent: "## Description\n\nOriginal body",
		};
		await core.createTask(task, false);
		taskId = task.id;
	});

	afterEach(async () => {
		if (originalEditor !== undefined) {
			process.env.EDITOR = originalEditor;
		} else {
			delete process.env.EDITOR;
		}
		await safeCleanup(testDir);
	});

	it("returns unchanged result when editor makes no file modifications", async () => {
		const noopScript = await createEditorScript("noop-editor.js", "process.exit(0);\n");
		await setEditor(`node ${noopScript}`);

		const result = await core.editTaskInTui(taskId, screen);
		expect(result.changed).toBe(false);
		expect(result.reason).toBeUndefined();

		const reloaded = await core.filesystem.loadTask(taskId);
		expect(reloaded?.updatedDate).toBeUndefined();
	});

	it("updates updated_date when editor changes task content", async () => {
		const editScript = await createEditorScript(
			"append-editor.js",
			`import { appendFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
	appendFileSync(filePath, "\\nEdited from test\\n");
}
process.exit(0);
`,
		);
		await setEditor(`node ${editScript}`);

		const result = await core.editTaskInTui(taskId, screen);
		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.task).toBeTruthy();
		expect(result.task?.updatedDate).toBeTruthy();

		const taskContent = await core.getTaskContent(taskId);
		expect(taskContent).toContain("updated_date:");
		expect(taskContent).toContain("Edited from test");
	});

	it("returns editor_failed without mutating metadata when editor exits non-zero", async () => {
		const failScript = await createEditorScript("fail-editor.js", "process.exit(2);\n");
		await setEditor(`node ${failScript}`);

		const beforeContent = await core.getTaskContent(taskId);
		const result = await core.editTaskInTui(taskId, screen);
		const afterContent = await core.getTaskContent(taskId);

		expect(result.changed).toBe(false);
		expect(result.reason).toBe("editor_failed");
		expect(afterContent).toBe(beforeContent);

		const reloaded = await core.filesystem.loadTask(taskId);
		expect(reloaded?.updatedDate).toBeUndefined();
	});
});

describe("Core.editTaskInTui with drafts", () => {
	let testDir: string;
	let core: Core;
	let originalEditor: string | undefined;
	const screen = createMockScreen();

	const setEditor = async (editorCommand: string) => {
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected config to be initialized");
		}
		await core.filesystem.saveConfig({ ...config, defaultEditor: editorCommand });
	};

	const createEditorScript = async (name: string, source: string): Promise<string> => {
		const scriptPath = join(testDir, name);
		await writeFile(scriptPath, source);
		return scriptPath;
	};

	beforeEach(async () => {
		originalEditor = process.env.EDITOR;
		delete process.env.EDITOR;

		testDir = createUniqueTestDir("test-tui-edit-drafts");
		await mkdir(testDir, { recursive: true });
		// No watchers here: the draft path never touches the content store, and a watcher keeps a handle
		// open, which is what makes Windows cleanup of a test project report EBUSY.
		core = new Core(testDir);
		await initializeTestProject(core, "TUI Draft Edit Test");
	});

	afterEach(async () => {
		if (originalEditor !== undefined) {
			process.env.EDITOR = originalEditor;
		} else {
			delete process.env.EDITOR;
		}
		await safeCleanup(testDir);
	});

	const draftTask = (id: string, title: string): Task => ({
		id,
		title,
		status: "Draft",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-09-01 10:00",
		rawContent: "## Description\n\nOriginal body",
	});

	const writeDraft = async (filename: string, task: Task): Promise<string> => {
		const draftsDir = await core.filesystem.getDraftsDir();
		await mkdir(draftsDir, { recursive: true });
		const path = join(draftsDir, filename);
		await writeFile(path, serializeTask(task));
		return path;
	};

	const appendEditor = async (): Promise<void> => {
		const script = await createEditorScript(
			"draft-append-editor.js",
			`import { appendFileSync } from "node:fs";
const filePath = process.argv[2];
if (filePath) {
appendFileSync(filePath, "\\nEdited from test\\n");
}
process.exit(0);
`,
		);
		await setEditor(`node ${script}`);
	};

	it("edits the draft row the TUI opened from the drafts list", async () => {
		const path = await writeDraft("draft-1 - Alpha.md", draftTask("DRAFT-1", "Alpha"));
		await appendEditor();

		// The row the list hands over carries its own file, exactly as `draft list` builds it.
		const result = await core.editTaskInTui("DRAFT-1", screen, {
			...draftTask("DRAFT-1", "Alpha"),
			filePath: path,
		});

		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.task?.status).toBe("Draft");
		expect(result.task?.updatedDate).toBeTruthy();

		const content = await readFile(path, "utf8");
		expect(content).toContain("Edited from test");
		expect(content).toContain("updated_date:");
		// The edit must not turn the draft into a task.
		expect(content).toContain("status: Draft");
	});

	it("edits a draft by id when no row was handed over", async () => {
		const path = await writeDraft("draft-2 - Beta.md", draftTask("DRAFT-2", "Beta"));
		await appendEditor();

		const result = await core.editTaskInTui("draft-2", screen);

		expect(result.changed).toBe(true);
		expect(result.task?.id).toBe("DRAFT-2");
		expect(await readFile(path, "utf8")).toContain("Edited from test");
	});

	it("still hands a task id to the task store", async () => {
		const task: Task = {
			id: "task-1",
			title: "A task, not a draft",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2026-09-01 10:00",
			rawContent: "## Description\n\nOriginal body",
		};
		await core.createTask(task, false);
		await appendEditor();

		const result = await core.editTaskInTui("task-1", screen);

		expect(result.changed).toBe(true);
		expect(result.task?.status).toBe("To Do");
		expect(await core.getTaskContent("task-1")).toContain("Edited from test");
	});

	it("fails closed when two files claim one draft identity", async () => {
		const first = await writeDraft("draft-1 - Alpha.md", draftTask("DRAFT-1", "Alpha"));
		const second = await writeDraft("draft-01 - Beta.md", draftTask("DRAFT-01", "Beta"));
		const before = await readFile(first, "utf8");
		const twin = await readFile(second, "utf8");
		await appendEditor();

		const result = await core.editTaskInTui("draft-1", screen);

		expect(result.changed).toBe(false);
		expect(result.reason).toBe("ambiguous");
		// Neither twin is edited, because neither is known to be the one the user is looking at.
		expect(await readFile(first, "utf8")).toBe(before);
		expect(await readFile(second, "utf8")).toBe(twin);
	});

	it("reports an id that is in neither store as not found", async () => {
		const result = await core.editTaskInTui("DRAFT-9", screen);

		expect(result.changed).toBe(false);
		expect(result.reason).toBe("not_found");
	});

	it("refuses a row whose numeric id is shared with another file", async () => {
		const first = await writeDraft("draft-1 - Alpha.md", draftTask("DRAFT-1", "Alpha"));
		const second = await writeDraft("draft-01 - Beta.md", draftTask("DRAFT-01", "Beta"));
		const before = await readFile(first, "utf8");
		const twin = await readFile(second, "utf8");
		await appendEditor();

		// The row is a real draft the reader picked out of the list, but two files answer to its
		// numeric id, so the session cannot tell which one the row stands for.
		const result = await core.editTaskInTui("DRAFT-1", screen, {
			...draftTask("DRAFT-1", "Alpha"),
			filePath: first,
		});

		expect(result.changed).toBe(false);
		expect(result.reason).toBe("ambiguous");
		expect(await readFile(first, "utf8")).toBe(before);
		expect(await readFile(second, "utf8")).toBe(twin);
	});

	// The row a list hands over names its own file, so its directory decides which store owns it.
	// Reading the store off `status` sent a draft whose status had drifted away from Draft into the
	// task store, which reported the row missing instead of opening it.
	it("edits a drafts-list row whose status drifted away from Draft", async () => {
		const drifted = await writeDraft("draft-7 - Drifted.md", {
			...draftTask("DRAFT-7", "Drifted"),
			status: "In Progress",
		});
		await appendEditor();

		// The row carries the drifted status, exactly as `draft list` enumerates it.
		const row = (await core.filesystem.listDrafts()).find((candidate) => candidate.id === "DRAFT-7");
		expect(row?.status).toBe("In Progress");
		if (!row?.filePath) throw new Error("Expected the drafts list to hand over the file path");
		expect(dirname(row.filePath)).toBe(await core.filesystem.getDraftsDir());

		const result = await core.editTaskInTui(row.id, screen, row);

		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		// The notices name the row the session resolved: this one is a draft, not a task.
		expect(result.entity).toBe("draft");
		expect(await readFile(drifted, "utf8")).toContain("Edited from test");
		// The edit belongs to the drafts store: it must not mint or touch a task file.
		expect(await core.filesystem.listTasks()).toHaveLength(0);
		expect(await readFile(drifted, "utf8")).toContain("status: In Progress");
	});

	it("edits the draft a demote produces", async () => {
		const task: Task = {
			id: "task-1",
			title: "Demote me",
			status: "In Progress",
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2026-09-01 10:00",
			rawContent: "## Description\n\nOriginal body",
		};
		await core.createTask(task, false);

		const draftId = await core.demoteTask(task.id, false);
		expect(draftId).toBeTruthy();

		const row = (await core.filesystem.listDrafts()).find((candidate) => candidate.id === draftId);
		if (!row?.filePath) throw new Error("Expected the demoted draft to be listed with its file path");
		const draftPath = row.filePath;
		// Demoting keeps the task's status, which is what used to misroute the row.
		expect(row.status).toBe("In Progress");
		await appendEditor();

		const result = await core.editTaskInTui(row.id, screen, row);

		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.entity).toBe("draft");
		const content = await readFile(draftPath, "utf8");
		expect(content).toContain("Edited from test");
		expect(content).toContain("status: In Progress");
		expect(await core.filesystem.listTasks()).toHaveLength(0);
	});

	it("hands a tasks-store row carrying status Draft to the task store", async () => {
		const taskPath = join(core.filesystem.tasksDir, "task-9 - Draft status.md");
		await writeFile(taskPath, serializeTask({ ...draftTask("task-9", "Draft status"), status: "Draft" }));
		await appendEditor();

		const row = (await core.filesystem.listTasks()).find((candidate) => candidate.id.toLowerCase() === "task-9");
		if (!row) throw new Error("Expected the tasks list to hand over the record");

		const result = await core.editTaskInTui(row.id, screen, row);

		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.entity).toBe("task");
		expect(await readFile(taskPath, "utf8")).toContain("Edited from test");
		// The mirror shape must not be looked up in the drafts store, and no draft is created.
		expect(await core.filesystem.listDrafts()).toHaveLength(0);
	});

	it("edits a drifted draft by bare id, where no row was handed over", async () => {
		const path = await writeDraft("draft-8 - Drifted by id.md", draftTask("DRAFT-8", "Drifted by id"));
		await appendEditor();

		const result = await core.editTaskInTui("DRAFT-8", screen);

		expect(result.changed).toBe(true);
		expect(result.reason).toBeUndefined();
		expect(result.entity).toBe("draft");
		expect(await readFile(path, "utf8")).toContain("Edited from test");
	});

	it("keeps naming a draft in the notice when the editor fails on it", async () => {
		const path = await writeDraft("draft-9 - Editor fails.md", {
			...draftTask("DRAFT-9", "Editor fails"),
			status: "To Do",
		});
		const before = await readFile(path, "utf8");
		const failScript = await createEditorScript("draft-fail-editor.js", "process.exit(2);\n");
		await setEditor(`node ${failScript}`);

		const row = (await core.filesystem.listDrafts()).find((candidate) => candidate.id === "DRAFT-9");
		if (!row?.filePath) throw new Error("Expected the drafts list to hand over the file path");

		const result = await core.editTaskInTui(row.id, screen, row);

		expect(result.reason).toBe("editor_failed");
		expect(result.entity).toBe("draft");
		expect(await readFile(path, "utf8")).toBe(before);
	});
});

describe("editTargetNoun", () => {
	it("names a draft row a draft, and anything else a task", () => {
		expect(editTargetNoun("draft")).toEqual({ plain: "draft", titled: "Draft" });
		expect(editTargetNoun("task")).toEqual({ plain: "task", titled: "Task" });
		expect(editTargetNoun(undefined)).toEqual({ plain: "task", titled: "Task" });
	});
});
