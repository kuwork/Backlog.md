import { link, lstat, mkdtemp, rename, unlink } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { EntityType, type Task } from "../types/index.ts";
import { type DuplicateGroup, detectDuplicateTaskIds } from "../utils/duplicate-detection.ts";
import { escapeRegex, generateNextId, generateNextSubtaskId, idForFilename } from "../utils/prefix-config.ts";
import { normalizeTaskId, taskIdsEqual } from "../utils/task-path.ts";
import type { Core } from "./backlog.ts";

export type DuplicateTaskLocation = "active" | "completed";

export interface DuplicateRepairChange {
	sourcePath: string;
	targetPath: string;
	oldId: string;
	newId: string;
	title: string;
	location: DuplicateTaskLocation;
}

export interface DuplicateRepairPlan {
	groups: DuplicateGroup[];
	changes: DuplicateRepairChange[];
	references: DuplicateReferenceReview[];
	referenceScanComplete: boolean;
	blockedReasons: string[];
	repairable: boolean;
}

export interface DuplicateRepairResult {
	repairedFiles: number;
	changes: DuplicateRepairChange[];
	references: DuplicateReferenceReview[];
	remainingGroups: DuplicateGroup[];
}

export interface DuplicateReferenceReview {
	path: string;
	line: number;
	text: string;
	ids: string[];
}

function normalizeRelativePath(rootDir: string, path: string): string {
	return relative(rootDir, path).split(sep).join("/");
}

function absoluteProjectPath(rootDir: string, projectPath: string): string {
	const absolute = resolve(rootDir, projectPath);
	const rootPrefix = `${resolve(rootDir)}${sep}`;
	if (absolute !== resolve(rootDir) && !absolute.startsWith(rootPrefix)) {
		throw new Error(`Repair path escapes the project root: ${projectPath}`);
	}
	return absolute;
}

function sha256(value: string | Uint8Array): string {
	return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

interface FileOwnershipIdentity {
	device: bigint;
	inode: bigint;
	contentHash: string;
}

async function readFileOwnershipIdentity(path: string): Promise<FileOwnershipIdentity> {
	const [stats, content] = await Promise.all([lstat(path, { bigint: true }), Bun.file(path).arrayBuffer()]);
	return {
		device: stats.dev,
		inode: stats.ino,
		contentHash: sha256(new Uint8Array(content)),
	};
}

function isSameOwnedFile(left: FileOwnershipIdentity, right: FileOwnershipIdentity): boolean {
	return left.device === right.device && left.inode === right.inode && left.contentHash === right.contentHash;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function removeIfPresent(path: string): Promise<void> {
	try {
		await unlink(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw error;
	}
}

function getTaskLocation(task: Task): DuplicateTaskLocation {
	return task.source === "completed" ? "completed" : "active";
}

function matchesConfiguredPadding(taskId: string, zeroPaddedIds?: number): boolean {
	const body = taskId.replace(/^[A-Za-z]+-/, "");
	const segments = body.split(".");
	if (!segments.every((segment) => /^\d+$/.test(segment))) return false;
	if (zeroPaddedIds && zeroPaddedIds > 0) {
		return segments.every((segment, index) => segment.length === (index === 0 ? zeroPaddedIds : 2));
	}
	return segments.every((segment) => (segment.replace(/^0+/, "") || "0") === segment);
}

function sortGroupTasks(tasks: Task[], zeroPaddedIds?: number): Task[] {
	return [...tasks].sort((left, right) => {
		const locationOrder =
			getTaskLocation(left) === getTaskLocation(right) ? 0 : getTaskLocation(left) === "active" ? -1 : 1;
		if (locationOrder !== 0) return locationOrder;
		const leftMatchesPadding = matchesConfiguredPadding(left.id, zeroPaddedIds);
		const rightMatchesPadding = matchesConfiguredPadding(right.id, zeroPaddedIds);
		if (leftMatchesPadding !== rightMatchesPadding) return leftMatchesPadding ? -1 : 1;
		return (left.filePath ?? left.title).localeCompare(right.filePath ?? right.title);
	});
}

function validateGroupParent(group: DuplicateGroup): { parentId?: string; blockedReasons: string[] } {
	const parentSeparator = group.id.lastIndexOf(".");
	if (parentSeparator < 0) return { blockedReasons: [] };

	const expectedParentId = group.id.slice(0, parentSeparator);
	const blockedReasons: string[] = [];
	let parentId: string | undefined;
	for (const task of group.tasks) {
		const taskPath = task.filePath ?? task.title;
		if (!task.parentTaskId) {
			blockedReasons.push(`${taskPath}: subtask ${task.id} has no parent_task_id; automatic repair is blocked.`);
			continue;
		}
		if (normalizeTaskId(task.parentTaskId) !== normalizeTaskId(expectedParentId)) {
			blockedReasons.push(
				`${taskPath}: subtask ${task.id} has parent_task_id ${task.parentTaskId}, expected ${expectedParentId}; automatic repair is blocked.`,
			);
			continue;
		}
		parentId ??= task.parentTaskId;
	}
	return { parentId, blockedReasons };
}

async function allocateRepairId(
	core: Core,
	parentId: string | undefined,
	existingIds: string[],
	plannedIds: string[],
	taskPrefix: string,
	zeroPaddedIds?: number,
): Promise<string> {
	const generatedId = await core.generateNextId(EntityType.Task, parentId);
	const occupiedIds = [...existingIds, ...plannedIds];
	if (!occupiedIds.some((occupiedId) => taskIdsEqual(occupiedId, generatedId))) {
		return generatedId;
	}

	let nextId: string;
	if (!parentId) {
		nextId = generateNextId(occupiedIds, taskPrefix, zeroPaddedIds);
	} else {
		const generatedParent = generatedId.slice(0, generatedId.lastIndexOf("."));
		nextId = generateNextSubtaskId(occupiedIds, generatedParent, taskPrefix, zeroPaddedIds);
	}
	if (occupiedIds.some((occupiedId) => taskIdsEqual(occupiedId, nextId))) {
		throw new Error(`Could not allocate an unused repair ID after ${generatedId}.`);
	}
	return nextId;
}

function buildTargetPath(sourcePath: string, oldId: string, newId: string): string | null {
	const filename = basename(sourcePath);
	const separatorIndex = filename.indexOf(" - ");
	if (separatorIndex < 0 || normalizeTaskId(filename.slice(0, separatorIndex)) !== normalizeTaskId(oldId)) {
		return null;
	}
	return join(dirname(sourcePath), `${idForFilename(newId)}${filename.slice(separatorIndex)}`).replace(/\\/g, "/");
}

function filenameTaskId(sourcePath: string): string | null {
	const filename = basename(sourcePath);
	const separatorIndex = filename.indexOf(" - ");
	if (separatorIndex < 0) return null;
	return filename.slice(0, separatorIndex);
}

function validateTaskIdMatchesFilename(task: Task): string | null {
	if (!task.filePath) return `${task.title}: task has no local file path.`;
	const filenameId = filenameTaskId(task.filePath);
	if (!filenameId) return `${task.filePath}: filename does not follow expected "<id> - <title>.md" format.`;
	if (normalizeTaskId(filenameId) !== normalizeTaskId(task.id)) {
		return `${task.filePath}: filename ID "${filenameId}" does not match frontmatter ID "${task.id}".`;
	}
	return null;
}

function replaceFrontmatterTaskId(content: string, expectedId: string, newId: string): string {
	const delimiters = Array.from(content.matchAll(/^---(?:\r?\n|$)/gm));
	const opening = delimiters[0];
	const closing = delimiters[1];
	if (opening?.index !== 0) {
		throw new Error("Task file has no YAML frontmatter.");
	}
	if (!closing || closing.index === undefined) {
		throw new Error("Task file has unterminated YAML frontmatter.");
	}
	const frontmatterStart = opening[0].length;
	const frontmatter = content.slice(frontmatterStart, closing.index);
	const idLines = Array.from(frontmatter.matchAll(/^id\s*:[^\r\n]*/gm));
	if (idLines.length !== 1) {
		throw new Error(`Task frontmatter must contain exactly one top-level id field; found ${idLines.length}.`);
	}
	const idLine = idLines[0];
	if (!idLine || idLine.index === undefined) throw new Error("Task frontmatter id field could not be located safely.");
	const line = idLine[0];
	const match = line.match(/^(id\s*:\s*)([^#]*?)(\s+#.*)?$/);
	if (!match) throw new Error("Task frontmatter id field could not be updated safely.");
	const rawValue = (match[2] ?? "").trim();
	const idStart = frontmatterStart + idLine.index;
	if (/^[>|][+-]?$/.test(rawValue)) {
		const continuation = content.slice(idStart + line.length, closing.index).match(/^(\r?\n[ \t]+[^\r\n]*)+/)?.[0];
		const indentation = continuation?.match(/^\r?\n([ \t]+)/)?.[1];
		if (!continuation || !indentation) {
			throw new Error("Task frontmatter block id field has no value.");
		}
		const currentValue = continuation
			.split(/\r?\n/)
			.map((part) => part.trim())
			.join("");
		if (normalizeTaskId(currentValue) !== normalizeTaskId(expectedId)) {
			throw new Error(`Task frontmatter id ${currentValue || "(empty)"} does not match ${expectedId}.`);
		}
		const newline = continuation.startsWith("\r\n") ? "\r\n" : "\n";
		const replacement = `${line}${newline}${indentation}${newId}`;
		return `${content.slice(0, idStart)}${replacement}${content.slice(idStart + line.length + continuation.length)}`;
	}
	const quote =
		rawValue.length >= 2 && rawValue[0] === rawValue.at(-1) && /['"]/.test(rawValue[0] ?? "") ? rawValue[0] : "";
	const currentValue = quote ? rawValue.slice(1, -1) : rawValue;
	if (normalizeTaskId(currentValue) !== normalizeTaskId(expectedId)) {
		throw new Error(`Task frontmatter id ${currentValue || "(empty)"} does not match ${expectedId}.`);
	}
	const replacement = `${match[1]}${quote}${newId}${quote}${match[3] ?? ""}`;
	return `${content.slice(0, idStart)}${replacement}${content.slice(idStart + line.length)}`;
}

async function installFileNoReplace(stagedPath: string, targetPath: string): Promise<void> {
	await link(stagedPath, targetPath);
}

interface DuplicateReferenceScanResult {
	references: DuplicateReferenceReview[];
	failures: string[];
}

async function findReferenceReviews(core: Core, groups: DuplicateGroup[]): Promise<DuplicateReferenceScanResult> {
	if (groups.length === 0) return { references: [], failures: [] };

	const groupIds = groups.map((group) => group.id);
	const literalIds = [
		...new Set(groups.flatMap((group) => group.tasks.map((task) => task.id).filter((id) => !/^\d+$/.test(id)))),
	];
	const legacyPatterns = literalIds.map(
		(id) => new RegExp(`(?<![A-Za-z0-9._-])${escapeRegex(id)}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])`, "gi"),
	);

	let files: string[];
	try {
		files = await Array.fromAsync(
			new Bun.Glob("**/*.md").scan({ cwd: core.filesystem.backlogDir, followSymlinks: true }),
		);
	} catch (error) {
		return {
			references: [],
			failures: [`Reference scan failed under ${core.filesystem.backlogDirName}: ${errorMessage(error)}`],
		};
	}

	function isInsideFrontmatter(content: string, lineIndex: number): boolean {
		const delimiters = Array.from(content.matchAll(/^---(?:\r?\n|$)/gm));
		if (delimiters.length < 2) return false;
		const opening = delimiters[0];
		const closing = delimiters[1];
		if (opening?.index !== 0 || closing?.index === undefined) return false;
		const openingLine = content.slice(0, opening.index + opening[0].length).split(/\r?\n/).length - 1;
		const closingLine = content.slice(0, closing.index + closing[0].length).split(/\r?\n/).length - 1;
		return lineIndex > openingLine && lineIndex < closingLine;
	}

	const reviews: DuplicateReferenceReview[] = [];
	for (const file of files) {
		const absolutePath = join(core.filesystem.backlogDir, file);
		let content: string;
		try {
			content = await Bun.file(absolutePath).text();
		} catch (_error) {
			continue;
		}

		const lines = content.split(/\r?\n/);
		for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
			const line = lines[lineIndex];
			if (!line) continue;
			if (isInsideFrontmatter(content, lineIndex)) continue;
			const matchedIds: string[] = [];
			for (const pattern of legacyPatterns) {
				const matches = Array.from(line.matchAll(pattern));
				for (const match of matches) {
					const matchedId = match[0];
					if (matchedId) matchedIds.push(matchedId);
				}
			}
			if (matchedIds.length === 0) continue;
			const uniqueIds = [
				...new Set(
					matchedIds
						.map((id) => groupIds.find((groupId) => taskIdsEqual(id, groupId)))
						.filter((id): id is string => id !== undefined),
				),
			];
			if (uniqueIds.length === 0) continue;
			reviews.push({
				path: file.replace(/\\/g, "/"),
				line: lineIndex + 1,
				text: line.trim().slice(0, 240),
				ids: uniqueIds,
			});
		}
	}
	return { references: reviews, failures: [] };
}

export async function previewDuplicateTaskIdRepair(core: Core): Promise<DuplicateRepairPlan> {
	const [activeTasks, completedTasks, config] = await Promise.all([
		core.filesystem.listTasks(),
		core.filesystem.listCompletedTasks(),
		core.filesystem.loadConfig(),
	]);

	const allTasks = [
		...activeTasks.map((task) => ({ ...task, source: "local" as const })),
		...completedTasks.map((task) => ({ ...task, source: "completed" as const })),
	];

	const groups = detectDuplicateTaskIds(allTasks);
	const blockedReasons: string[] = [];
	const changes: DuplicateRepairChange[] = [];
	const existingIds = allTasks.map((task) => task.id);
	const plannedIds: string[] = [];

	for (const group of groups) {
		const tasks = sortGroupTasks(group.tasks, config?.zeroPaddedIds);
		// Use the canonical (first sorted) task's normalized ID as the group label.
		group.id = normalizeTaskId(tasks[0]?.id ?? group.id);
		for (const task of tasks) {
			const mismatch = validateTaskIdMatchesFilename(task);
			if (mismatch) blockedReasons.push(mismatch);
		}
		const parentValidation = validateGroupParent(group);
		if (parentValidation.blockedReasons.length > 0) {
			blockedReasons.push(...parentValidation.blockedReasons);
			continue;
		}
		for (const task of tasks.slice(1)) {
			if (!task.filePath) {
				blockedReasons.push(`${group.id}: ${task.title} has no local file path.`);
				continue;
			}
			const nextId = await allocateRepairId(
				core,
				parentValidation.parentId,
				existingIds,
				plannedIds,
				config?.prefixes?.task ?? "task",
				config?.zeroPaddedIds,
			);
			const rawTargetPath = buildTargetPath(task.filePath, task.id, nextId);
			if (!rawTargetPath) {
				blockedReasons.push(`${task.filePath}: filename and frontmatter ID do not identify the same task.`);
				continue;
			}
			const targetPath = normalizeRelativePath(core.filesystem.rootDir, rawTargetPath);
			changes.push({
				sourcePath: normalizeRelativePath(core.filesystem.rootDir, task.filePath),
				targetPath,
				oldId: task.id,
				newId: nextId,
				title: task.title,
				location: getTaskLocation(task),
			});
			plannedIds.push(nextId);
		}
	}

	const duplicateFileCount = groups.reduce((total, group) => total + group.tasks.length - 1, 0);
	if (changes.length !== duplicateFileCount) {
		blockedReasons.push(
			`Expected ${duplicateFileCount} duplicate ${duplicateFileCount === 1 ? "file" : "files"} to be repairable, but prepared ${changes.length}.`,
		);
	}
	const targetPaths = changes.map((change) => change.targetPath);
	if (new Set(targetPaths).size !== targetPaths.length) {
		blockedReasons.push("Repair would create duplicate target paths.");
	}

	const referenceScan = await findReferenceReviews(core, groups);
	blockedReasons.push(...referenceScan.failures);
	const uniqueBlockedReasons = [...new Set(blockedReasons)];
	return {
		groups,
		changes,
		references: referenceScan.references,
		referenceScanComplete: referenceScan.failures.length === 0,
		blockedReasons: uniqueBlockedReasons,
		repairable: groups.length > 0 && uniqueBlockedReasons.length === 0,
	};
}

export async function applyDuplicateTaskIdRepair(
	core: Core,
	plan: DuplicateRepairPlan,
): Promise<DuplicateRepairResult> {
	if (!plan.repairable) {
		throw new Error(plan.blockedReasons.join("\n") || "No duplicate task IDs are available to repair.");
	}

	return await core.withCreateLock(async () => {
		const freshPlan = await previewDuplicateTaskIdRepair(core);
		if (!freshPlan.repairable || JSON.stringify(freshPlan.changes) !== JSON.stringify(plan.changes)) {
			throw new Error("Duplicate task files changed after the preview. Run 'backlog doctor' again before repairing.");
		}

		const transactionId = `${process.pid}-${Date.now()}`;
		const rootDir = core.filesystem.rootDir;

		const prepared = await Promise.all(
			plan.changes.map(async (change, index) => {
				const sourcePath = absoluteProjectPath(rootDir, change.sourcePath);
				const targetPath = absoluteProjectPath(rootDir, change.targetPath);
				const content = await Bun.file(sourcePath).text();
				if (await Bun.file(targetPath).exists()) {
					throw new Error(`${change.targetPath} now exists; no files were changed.`);
				}
				return {
					...change,
					sourcePath,
					targetPath,
					content: replaceFrontmatterTaskId(content, change.oldId, change.newId),
					stagedPath: `${targetPath}.backlog-doctor-${transactionId}-${index}.tmp`,
					backupPath: `${sourcePath}.backlog-doctor-${transactionId}-${index}.bak`,
					metaPath: `${sourcePath}.backlog-doctor-${transactionId}-${index}.json`,
				};
			}),
		);

		const staged: string[] = [];
		const backups: Array<{ sourcePath: string; backupPath: string }> = [];
		const installed: Array<{ targetPath: string; identity: FileOwnershipIdentity }> = [];
		const metaPaths: string[] = [];

		try {
			for (const item of prepared) {
				await Bun.write(item.stagedPath, item.content);
				staged.push(item.stagedPath);
			}
			for (const item of prepared) {
				await rename(item.sourcePath, item.backupPath);
				backups.push({ sourcePath: item.sourcePath, backupPath: item.backupPath });
			}
			for (const [index, item] of prepared.entries()) {
				try {
					await installFileNoReplace(item.stagedPath, item.targetPath);
				} catch (error) {
					if ((error as NodeJS.ErrnoException | undefined)?.code === "EEXIST") {
						throw new Error(`${item.targetPath} now exists; no files were changed.`);
					}
					throw error;
				}
				const stagedIdentity = await readFileOwnershipIdentity(item.stagedPath);
				installed.push({ targetPath: item.targetPath, identity: stagedIdentity });
				await unlink(item.stagedPath);
				staged[index] = "";
			}

			const remainingGroups = await findLocalDuplicateTaskIds(core);
			if (remainingGroups.length > 0) {
				throw new Error("Repair verification still found duplicate task IDs.");
			}

			for (const item of prepared) {
				await Bun.write(
					item.metaPath,
					JSON.stringify({
						targetPath: normalizeRelativePath(rootDir, item.targetPath),
						newId: item.newId,
					}),
				);
				metaPaths.push(item.metaPath);
			}

			return {
				repairedFiles: plan.changes.length,
				changes: plan.changes,
				references: plan.references,
				remainingGroups,
			};
		} catch (error) {
			const rollbackIssues: string[] = [];

			for (const item of installed.reverse()) {
				const issue = await rollbackInstalledFile(rootDir, item).catch(
					(rollbackError) =>
						`Could not roll back ${normalizeRelativePath(rootDir, item.targetPath)}: ${errorMessage(rollbackError)}.`,
				);
				if (issue) rollbackIssues.push(issue);
			}
			for (const item of backups.reverse()) {
				const issue = await restoreBackupNoReplace(rootDir, item).catch(
					(rollbackError) =>
						`Could not restore ${normalizeRelativePath(rootDir, item.sourcePath)}: ${errorMessage(rollbackError)}. Preserved backup ${normalizeRelativePath(rootDir, item.backupPath)}.`,
				);
				if (issue) rollbackIssues.push(issue);
			}
			for (const path of staged) {
				if (path) await removeIfPresent(path).catch(() => {});
			}
			for (const path of metaPaths) {
				await removeIfPresent(path).catch(() => {});
			}

			if (rollbackIssues.length > 0) {
				throw new Error(
					`Repair failed: ${errorMessage(error)}\nRollback preserved concurrent changes instead of overwriting them:\n${rollbackIssues.map((issue) => `- ${issue}`).join("\n")}`,
					{ cause: error },
				);
			}
			throw error;
		}
	});
}

async function rollbackInstalledFile(
	rootDir: string,
	installed: { targetPath: string; identity: FileOwnershipIdentity },
): Promise<string | null> {
	const targetProjectPath = normalizeRelativePath(rootDir, installed.targetPath);
	let recoveryDirectory: string;
	try {
		recoveryDirectory = await mkdtemp(join(dirname(installed.targetPath), ".backlog-doctor-rollback-"));
	} catch (error) {
		return `Could not prepare recovery storage for ${targetProjectPath}: ${errorMessage(error)}. The target was left in place.`;
	}
	const recoveryPath = join(recoveryDirectory, basename(installed.targetPath));
	try {
		await rename(installed.targetPath, recoveryPath);
	} catch (error) {
		await removeIfPresent(recoveryDirectory).catch(() => {});
		if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return null;
		return `Could not secure ${targetProjectPath} for ownership-safe rollback: ${errorMessage(error)}. The target was left in place.`;
	}

	let recoveredIdentity: FileOwnershipIdentity;
	try {
		recoveredIdentity = await readFileOwnershipIdentity(recoveryPath);
	} catch (error) {
		return `Could not verify ${targetProjectPath} during rollback: ${errorMessage(error)}. Preserved its content at ${normalizeRelativePath(rootDir, recoveryPath)}.`;
	}

	if (isSameOwnedFile(installed.identity, recoveredIdentity)) {
		try {
			await unlink(recoveryPath);
		} catch (error) {
			return `Could not remove the transaction-owned target ${targetProjectPath}: ${errorMessage(error)}. Preserved it at ${normalizeRelativePath(rootDir, recoveryPath)}.`;
		}
		try {
			await removeIfPresent(recoveryDirectory).catch(() => {});
			return null;
		} catch (error) {
			return `Removed the transaction-owned target ${targetProjectPath}, but could not remove empty recovery directory ${normalizeRelativePath(rootDir, recoveryDirectory)}: ${errorMessage(error)}.`;
		}
	}

	try {
		await installFileNoReplace(recoveryPath, installed.targetPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code === "EEXIST") {
			return `Target ${targetProjectPath} changed during repair, and another file now occupies that path. Preserved the concurrent content at ${normalizeRelativePath(rootDir, recoveryPath)}.`;
		}
		return `Target ${targetProjectPath} changed during repair. Could not restore it without replacement: ${errorMessage(error)}. Preserved the concurrent content at ${normalizeRelativePath(rootDir, recoveryPath)}.`;
	}

	try {
		await unlink(recoveryPath);
		await removeIfPresent(recoveryDirectory).catch(() => {});
		return `Target ${targetProjectPath} changed during repair. Preserved the concurrent content at its original path.`;
	} catch (error) {
		return `Target ${targetProjectPath} changed during repair. Preserved the concurrent content at its original path, but could not remove recovery directory ${normalizeRelativePath(rootDir, recoveryDirectory)}: ${errorMessage(error)}.`;
	}
}

async function restoreBackupNoReplace(
	rootDir: string,
	backup: { sourcePath: string; backupPath: string },
): Promise<string | null> {
	const sourceProjectPath = normalizeRelativePath(rootDir, backup.sourcePath);
	const backupProjectPath = normalizeRelativePath(rootDir, backup.backupPath);
	try {
		await installFileNoReplace(backup.backupPath, backup.sourcePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException | undefined)?.code === "EEXIST") {
			return `Source ${sourceProjectPath} was recreated during repair. Preserved the concurrent source and original backup at ${backupProjectPath}; reconcile them manually.`;
		}
		return `Could not restore ${sourceProjectPath} without replacement: ${errorMessage(error)}. Preserved the original backup at ${backupProjectPath}.`;
	}

	try {
		await unlink(backup.backupPath);
		return null;
	} catch (error) {
		return `Restored ${sourceProjectPath}, but could not remove recovery backup ${backupProjectPath}: ${errorMessage(error)}.`;
	}
}

export function printDuplicateRepairPlan(plan: DuplicateRepairPlan): void {
	console.log(`Found ${plan.groups.length} duplicate ID group(s).\n`);

	for (const [groupIndex, group] of plan.groups.entries()) {
		console.log(`Group #${groupIndex + 1}: ${group.id}`);
		for (const task of group.tasks) {
			const location = task.source === "completed" ? "completed" : "active";
			console.log(`  - [${location}] ${task.filePath ?? task.title}`);
		}
		console.log("");
	}

	if (plan.changes.length > 0) {
		console.log("Planned repairs:");
		for (const change of plan.changes) {
			console.log(`  ${change.sourcePath}`);
			console.log(`    -> ${change.targetPath}`);
		}
		console.log("");
	}

	if (plan.references.length > 0) {
		console.log("References requiring manual review:");
		for (const reference of plan.references) {
			console.log(`  ${reference.path}:${reference.line}  ${reference.text}`);
			console.log(`    ids: ${reference.ids.join(", ")}`);
		}
		console.log("");
	}

	if (plan.blockedReasons.length > 0) {
		console.log("Blocked reasons:");
		for (const reason of plan.blockedReasons) {
			console.log(`  - ${reason}`);
		}
		console.log("");
	}
}

export async function findLocalDuplicateTaskIds(core: Core): Promise<DuplicateGroup[]> {
	const [activeTasks, completedTasks] = await Promise.all([
		core.filesystem.listTasks(),
		core.filesystem.listCompletedTasks(),
	]);
	return detectDuplicateTaskIds([
		...activeTasks.map((task) => ({ ...task, source: "local" as const })),
		...completedTasks.map((task) => ({ ...task, source: "completed" as const })),
	]);
}

export async function commitDuplicateTaskIdRepair(core: Core): Promise<{ removedBackups: string[] }> {
	const backlogDir = core.filesystem.backlogDirName;
	const rootDir = core.filesystem.rootDir;
	const backupPattern = /\.backlog-doctor-[^\\/\\]+\.bak$/;
	const metaPattern = /\.backlog-doctor-[^\\/\\]+\.json$/;
	const removedBackups: string[] = [];

	for await (const entry of new Bun.Glob(`${backlogDir}/**/*.backlog-doctor-*.bak`).scan({ cwd: rootDir })) {
		const absolutePath = resolve(rootDir, entry);
		if (backupPattern.test(absolutePath)) {
			await unlink(absolutePath);
			removedBackups.push(normalizeRelativePath(rootDir, absolutePath));
		}
	}

	for await (const entry of new Bun.Glob(`${backlogDir}/**/*.backlog-doctor-*.json`).scan({ cwd: rootDir })) {
		const absolutePath = resolve(rootDir, entry);
		if (metaPattern.test(absolutePath)) {
			await unlink(absolutePath);
		}
	}

	return { removedBackups };
}

function readTaskFrontmatterId(content: string): string | null {
	const delimiters = Array.from(content.matchAll(/^---(?:\r?\n|$)/gm));
	if (delimiters[0]?.index !== 0 || delimiters[1]?.index === undefined) return null;
	const frontmatter = content.slice(delimiters[0][0].length, delimiters[1].index);
	const match = frontmatter.match(/^id\s*:\s*([^#\r\n]*?)\s*$/m);
	if (!match) return null;
	const raw = (match[1] ?? "").trim();
	if (raw.length >= 2 && raw[0] === raw.at(-1) && /['"]/.test(raw[0] ?? "")) return raw.slice(1, -1);
	return raw;
}

export async function rollbackDuplicateTaskIdRepair(core: Core): Promise<{ restored: string[]; removed: string[] }> {
	const backlogDir = core.filesystem.backlogDirName;
	const rootDir = core.filesystem.rootDir;
	const backupGlob = new Bun.Glob(`${backlogDir}/**/*.backlog-doctor-*.bak`);
	const restored: string[] = [];
	const removed: string[] = [];
	const warnings: string[] = [];

	for await (const entry of backupGlob.scan({ cwd: rootDir })) {
		const backupPath = resolve(rootDir, entry);
		const sourcePath = backupPath.replace(/\.backlog-doctor-[^/\\]+\.bak$/, "");
		if (sourcePath === backupPath) continue;

		const sourceProjectPath = normalizeRelativePath(rootDir, sourcePath);
		const backupProjectPath = normalizeRelativePath(rootDir, backupPath);
		const metaPath = backupPath.replace(/\.bak$/, ".json");
		let targetPath: string | undefined;
		let newId: string | undefined;
		if (await Bun.file(metaPath).exists()) {
			try {
				const meta = JSON.parse(await Bun.file(metaPath).text());
				targetPath = absoluteProjectPath(rootDir, meta.targetPath);
				newId = meta.newId;
			} catch (error) {
				warnings.push(
					`Could not read repair metadata ${normalizeRelativePath(rootDir, metaPath)}: ${errorMessage(error)}.`,
				);
			}
		}

		const backupContent = await Bun.file(backupPath).text();
		const oldId = readTaskFrontmatterId(backupContent);
		if (!oldId) {
			warnings.push(`Could not read original ID from ${backupProjectPath}. Skipped.`);
			continue;
		}

		const sourceExists = await Bun.file(sourcePath).exists();
		let issue: string | null;

		if (sourceExists) {
			const targetContent = await Bun.file(sourcePath).text();
			const sourceNewId = readTaskFrontmatterId(targetContent) ?? newId;
			if (!sourceNewId) {
				warnings.push(`Could not read repaired ID from ${sourceProjectPath}. Skipped.`);
				continue;
			}
			const expectedTarget = replaceFrontmatterTaskId(backupContent, oldId, sourceNewId);
			if (expectedTarget !== targetContent) {
				warnings.push(
					`${sourceProjectPath} has changed since the repair. Preserved it and skipped restoring ${backupProjectPath}.`,
				);
				continue;
			}

			const recoveryDirectory = await mkdtemp(join(dirname(sourcePath), ".backlog-doctor-rollback-"));
			const recoveryPath = join(recoveryDirectory, basename(sourcePath));
			try {
				await rename(sourcePath, recoveryPath);
				issue = await restoreBackupNoReplace(rootDir, { sourcePath, backupPath });
				if (issue) {
					await rename(recoveryPath, sourcePath).catch(() => {});
					warnings.push(issue);
				} else {
					restored.push(sourceProjectPath);
					removed.push(backupProjectPath);
					await unlink(recoveryPath);
					await removeIfPresent(recoveryDirectory).catch(() => {});
				}
			} catch (error) {
				warnings.push(`Could not roll back ${sourceProjectPath}: ${errorMessage(error)}.`);
				await rename(recoveryPath, sourcePath).catch(() => {});
			}
			continue;
		}

		issue = await restoreBackupNoReplace(rootDir, { sourcePath, backupPath });
		if (issue) {
			warnings.push(issue);
		} else {
			restored.push(sourceProjectPath);
			removed.push(backupProjectPath);
			if (targetPath && newId) {
				const expectedTarget = replaceFrontmatterTaskId(backupContent, oldId, newId);
				if ((await Bun.file(targetPath).exists()) && (await Bun.file(targetPath).text()) === expectedTarget) {
					await removeIfPresent(targetPath).catch((error) =>
						warnings.push(
							`Could not remove repaired target ${normalizeRelativePath(rootDir, targetPath)}: ${errorMessage(error)}.`,
						),
					);
				}
			}
			await removeIfPresent(metaPath).catch(() => {});
		}
	}

	if (warnings.length > 0) {
		console.log("Rollback warnings:");
		for (const warning of warnings) {
			console.log(`  - ${warning}`);
		}
	}

	return { restored, removed };
}
