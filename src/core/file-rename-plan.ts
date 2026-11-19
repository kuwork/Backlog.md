import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
	type EntityTitleRouteChange,
	type FileRenameReferenceKind,
	rewriteFileRenameContent,
} from "../markdown/file-rename-references.ts";

export interface FileRenameReferenceInput {
	path: string;
	kind: FileRenameReferenceKind;
	content: string;
}

export interface FileRenamePlanInput {
	sourcePath: string;
	targetPath: string;
	sourceContent: string;
	targetContent: string;
	entityRoute?: EntityTitleRouteChange;
	references: FileRenameReferenceInput[];
}

export interface FileRenameChange {
	sourcePath: string;
	targetPath: string;
	beforeContent: string;
	afterContent: string;
	kind: FileRenameReferenceKind;
}

export interface FileRenamePlan {
	changes: FileRenameChange[];
}

/** Build all writes in memory. No filesystem operation is performed here. */
export function buildFileRenamePlan(input: FileRenamePlanInput): FileRenamePlan {
	if (input.sourcePath === input.targetPath) return { changes: [] };
	const changes: FileRenameChange[] = [
		{
			sourcePath: input.sourcePath,
			targetPath: input.targetPath,
			beforeContent: input.sourceContent,
			afterContent: rewriteFileRenameContent({
				content: input.targetContent,
				referencingPath: input.sourcePath,
				sourcePath: input.sourcePath,
				targetPath: input.targetPath,
				kind: "source",
				...(input.entityRoute && { entityRoute: input.entityRoute }),
			}),
			kind: "source",
		},
	];
	const seen = new Set([input.sourcePath]);
	for (const reference of input.references) {
		if (seen.has(reference.path)) continue;
		seen.add(reference.path);
		const afterContent = rewriteFileRenameContent({
			content: reference.content,
			referencingPath: reference.path,
			sourcePath: input.sourcePath,
			targetPath: input.targetPath,
			kind: reference.kind,
			...(input.entityRoute && { entityRoute: input.entityRoute }),
		});
		if (afterContent === reference.content) continue;
		changes.push({
			sourcePath: reference.path,
			targetPath: reference.path,
			beforeContent: reference.content,
			afterContent,
			kind: reference.kind,
		});
	}
	return { changes };
}

export interface FileRenameReferenceDirectories {
	rootDir: string;
	tasksDir: string;
	completedDir: string;
	docsDir: string;
	decisionsDir: string;
	wikiDir: string;
}

function toProjectPath(rootDir: string, path: string): string {
	return relative(rootDir, path).split(sep).join("/");
}

async function scanMarkdownFiles(
	rootDir: string,
	directory: string,
	kind: FileRenameReferenceKind,
	optional = false,
): Promise<FileRenameReferenceInput[]> {
	let entries: string[];
	try {
		entries = await Array.fromAsync(
			new Bun.Glob("**/*.md").scan({ cwd: directory, followSymlinks: true, onlyFiles: true }),
		);
	} catch (error) {
		if (optional && (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return [];
		throw error;
	}

	const files: FileRenameReferenceInput[] = [];
	for (const entry of entries.sort()) {
		const normalizedEntry = entry.replace(/\\/g, "/").replace(/^\.\//, "");
		if (
			kind === "wiki" &&
			(normalizedEntry.startsWith("wiki_output/") ||
				normalizedEntry === "index.md" ||
				normalizedEntry === "overview.md" ||
				normalizedEntry === "log.md")
		) {
			continue;
		}
		const absolutePath = join(directory, entry);
		files.push({
			path: toProjectPath(rootDir, absolutePath),
			kind,
			content: await readFile(absolutePath, "utf8"),
		});
	}
	return files;
}

/** Read local reference candidates. A missing Wiki directory is an empty candidate set. */
export async function collectFileRenameReferences(
	directories: FileRenameReferenceDirectories,
	excludePath: string,
): Promise<FileRenameReferenceInput[]> {
	const groups = await Promise.all([
		scanMarkdownFiles(directories.rootDir, directories.tasksDir, "task"),
		scanMarkdownFiles(directories.rootDir, directories.completedDir, "task"),
		scanMarkdownFiles(directories.rootDir, directories.docsDir, "document"),
		scanMarkdownFiles(directories.rootDir, directories.decisionsDir, "decision"),
		scanMarkdownFiles(directories.rootDir, directories.wikiDir, "wiki", true),
	]);
	return groups.flat().filter((reference) => reference.path !== excludePath);
}

function absoluteProjectPath(rootDir: string, projectPath: string): string {
	if (isAbsolute(projectPath)) throw new Error(`Rename path must be project-relative: ${projectPath}`);
	const root = resolve(rootDir);
	const absolute = resolve(root, projectPath);
	if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Rename path escapes the project root: ${projectPath}`);
	}
	return absolute;
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return false;
		throw error;
	}
}

async function removeIfPresent(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw error;
	}
}

interface AppliedChange {
	change: FileRenameChange;
	source: string;
	target: string;
	staged: string;
	backup: string;
	backedUp: boolean;
	installed: boolean;
}

/**
 * Apply a plan as one all-or-nothing file batch. Existing contents are verified before staging;
 * original files are retained as backups until every new file has been installed.
 */
export async function applyFileRenamePlan(rootDir: string, plan: FileRenamePlan): Promise<void> {
	if (plan.changes.length === 0) return;
	const token = `${process.pid}-${randomUUID()}`;
	const applied: AppliedChange[] = plan.changes.map((change) => {
		const source = absoluteProjectPath(rootDir, change.sourcePath);
		const target = absoluteProjectPath(rootDir, change.targetPath);
		const suffix = `.file-rename-${token}`;
		return {
			change,
			source,
			target,
			staged: join(dirname(target), `.${basename(target)}${suffix}.new`),
			backup: join(dirname(source), `.${basename(source)}${suffix}.bak`),
			backedUp: false,
			installed: false,
		};
	});

	try {
		for (const item of applied) {
			const current = await readFile(item.source, "utf8");
			if (current !== item.change.beforeContent) {
				throw new Error(`File changed while preparing the rename: ${item.change.sourcePath}`);
			}
			if (item.source !== item.target && (await exists(item.target))) {
				throw new Error(`Rename target already exists: ${item.change.targetPath}`);
			}
		}
		for (const item of applied) {
			await mkdir(dirname(item.target), { recursive: true });
			await writeFile(item.staged, item.change.afterContent, { encoding: "utf8", flag: "wx" });
		}
		for (const item of applied) {
			await rename(item.source, item.backup);
			item.backedUp = true;
		}
		for (const item of applied) {
			// Hard-linking the staged file fails if a concurrent writer created the destination.
			await link(item.staged, item.target);
			item.installed = true;
			await unlink(item.staged);
		}
	} catch (error) {
		const rollbackErrors: unknown[] = [];
		for (const item of [...applied].reverse()) {
			try {
				if (item.installed) await removeIfPresent(item.target);
				if (item.backedUp) await rename(item.backup, item.source);
				await removeIfPresent(item.staged);
			} catch (rollbackError) {
				rollbackErrors.push(rollbackError);
			}
		}
		if (rollbackErrors.length > 0) throw new AggregateError([error, ...rollbackErrors], "File rename rollback failed");
		throw error;
	}

	await Promise.allSettled(applied.filter((item) => item.backedUp).map((item) => removeIfPresent(item.backup)));
}
