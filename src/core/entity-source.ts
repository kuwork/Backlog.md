import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parseDecision, parseDocument, parseTask } from "../markdown/parser.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { documentIdsEqual } from "../utils/document-id.ts";
import { entityIdsEqual } from "../utils/entity-id.ts";
import { taskIdsEqual } from "../utils/task-id.ts";
import type { Core } from "./backlog.ts";

export interface EntitySourceSelector {
	id?: string;
	sourcePath?: string;
}

export class SourceMismatchError extends Error {
	readonly code = "SOURCE_MISMATCH";

	constructor(entity: string, suppliedId: string, actualId: string, sourcePath: string) {
		super(
			`SOURCE_MISMATCH: Positional ID "${suppliedId}" does not match ${entity} "${actualId}"\nSource: ${sourcePath}`,
		);
		this.name = "SourceMismatchError";
	}
}

function resolveSourceAbsolutePath(core: Core, sourcePath: string, allowedDirectories: string[]): string {
	const trimmed = sourcePath.trim();
	if (!trimmed || isAbsolute(trimmed)) {
		throw new Error(`Source path must be a project-relative Markdown file: ${sourcePath}`);
	}
	const absolutePath = resolve(core.filesystem.rootDir, trimmed.replace(/\\/g, "/"));
	const insideAllowedDirectory = allowedDirectories.some((directory) => {
		const relativePath = relative(resolve(directory), absolutePath);
		return (
			relativePath !== "" && !relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath)
		);
	});
	if (!insideAllowedDirectory || !absolutePath.toLowerCase().endsWith(".md")) {
		throw new Error(`Source path is not a Markdown file in the expected entity directory: ${sourcePath}`);
	}
	return absolutePath;
}

async function readSource(absolutePath: string, sourcePath: string): Promise<string> {
	try {
		return await readFile(absolutePath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
			throw new Error(`Source file not found: ${sourcePath}`);
		}
		throw error;
	}
}

export async function loadTaskFromSource(core: Core, selector: EntitySourceSelector): Promise<Task> {
	if (!selector.sourcePath) throw new Error("A task source path is required.");
	const sourcePath = selector.sourcePath;
	const filePath = resolveSourceAbsolutePath(core, sourcePath, [
		core.filesystem.tasksDir,
		core.filesystem.completedDir,
	]);
	const task = { ...parseTask(await readSource(filePath, sourcePath)), filePath };
	if (selector.id && !taskIdsEqual(selector.id, task.id)) {
		throw new SourceMismatchError("task", selector.id, task.id, sourcePath);
	}
	return task;
}

export async function loadDocumentFromSource(core: Core, selector: EntitySourceSelector): Promise<Document> {
	if (!selector.sourcePath) throw new Error("A document source path is required.");
	const sourcePath = selector.sourcePath;
	const filePath = resolveSourceAbsolutePath(core, sourcePath, [core.filesystem.docsDir]);
	const document = {
		...parseDocument(await readSource(filePath, sourcePath)),
		path: relative(core.filesystem.docsDir, filePath).split(sep).join("/"),
	};
	if (selector.id && !documentIdsEqual(selector.id, document.id)) {
		throw new SourceMismatchError("document", selector.id, document.id, sourcePath);
	}
	return document;
}

export async function loadDecisionFromSource(core: Core, selector: EntitySourceSelector): Promise<Decision> {
	if (!selector.sourcePath) throw new Error("A decision source path is required.");
	const sourcePath = selector.sourcePath;
	const filePath = resolveSourceAbsolutePath(core, sourcePath, [core.filesystem.decisionsDir]);
	const decision = {
		...parseDecision(await readSource(filePath, sourcePath)),
		path: relative(core.filesystem.decisionsDir, filePath).split(sep).join("/"),
	};
	if (selector.id && !entityIdsEqual("decision", selector.id, decision.id)) {
		throw new SourceMismatchError("decision", selector.id, decision.id, sourcePath);
	}
	return decision;
}
