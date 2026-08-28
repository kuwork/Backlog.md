/**
 * Test utilities for creating isolated test environments
 * Designed to handle Windows-specific file system quirks and prevent parallel test interference
 */

import { spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import * as nodeFs from "node:fs";
import { rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Core } from "../core/backlog.ts";
import { initializeProject as initializeProjectShared } from "../core/init.ts";
import { FileSystem } from "../file-system/operations.ts";
import type { Task } from "../types/index.ts";

/**
 * Creates a unique test directory name to avoid conflicts in parallel execution
 * All test directories are created under tmp/ to keep the root directory clean
 */
export function createUniqueTestDir(prefix: string): string {
	const uuid = randomUUID().slice(0, 8); // Short UUID for readability
	const timestamp = Date.now().toString(36); // Base36 timestamp
	const pid = process.pid.toString(36); // Process ID for additional uniqueness
	return join(process.cwd(), "tmp", `${prefix}-${timestamp}-${pid}-${uuid}`);
}

/**
 * Sleep utility for tests that need to wait
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry utility for operations that might fail intermittently
 * Particularly useful for Windows file operations
 */
export async function retry<T>(fn: () => Promise<T>, maxAttempts = 3, delay = 100): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;
			if (attempt < maxAttempts) {
				await sleep(delay * attempt); // Exponential backoff
			}
		}
	}

	throw lastError || new Error("Retry failed");
}

/**
 * Windows-safe directory cleanup with retry logic
 * Windows can have file locking issues that prevent immediate deletion
 */
export async function safeCleanup(dir: string): Promise<void> {
	await retry(
		async () => {
			await rm(dir, { recursive: true, force: true });
		},
		5,
		50,
	); // More attempts for cleanup
}

/**
 * Detects if we're running on Windows (useful for conditional test behavior)
 */
export function isWindows(): boolean {
	return process.platform === "win32";
}

/**
 * Gets appropriate timeout for the current platform
 * Windows operations tend to be slower due to file system overhead
 */
export function getPlatformTimeout(baseTimeout = 5000): number {
	return isWindows() ? baseTimeout * 2 : baseTimeout;
}

/**
 * Rejects if an operation does not settle in time and always clears its timer
 * when the operation resolves or rejects first.
 */
export function withTimeout<T>(
	operation: Promise<T>,
	label: string,
	timeoutMs: number = getPlatformTimeout(15000),
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			clearTimeout(timer);
			reject(new Error(`Timed out waiting for ${label}`));
		}, timeoutMs);

		operation.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

/**
 * Gets the exit code from a spawnSync result, handling Windows quirks
 * On Windows, result.status can be undefined even for successful processes
 */
export function getExitCode(result: { status: number | null; error?: Error }): number {
	return result.status ?? (result.error ? 1 : 0);
}

/**
 * Shared test helper for project initialization.
 * Uses the same init path as CLI/web and optionally mirrors the legacy auto-commit behavior
 * needed by tests that assert against the post-init commit state.
 */
export async function initializeTestProject(
	core: Core,
	projectName: string,
	autoCommit = false,
	backlogDirectory?: string,
): Promise<void> {
	const backlogDirectorySource = backlogDirectory
		? backlogDirectory === "backlog" || backlogDirectory === ".backlog"
			? (backlogDirectory as "backlog" | ".backlog")
			: "custom"
		: undefined;
	const configLocation = backlogDirectorySource === "custom" ? "root" : "folder";

	await initializeProjectShared(core, {
		projectName,
		backlogDirectory,
		backlogDirectorySource,
		configLocation,
		integrationMode: "none",
		advancedConfig: {
			autoCommit: false,
		},
	});

	if (autoCommit) {
		const repoRoot = await core.gitOps.stageBacklogDirectory(core.filesystem.backlogDirName);
		await core.gitOps.commitChanges(`backlog: Initialize backlog project: ${projectName}`, repoRoot);
	}
}

/**
 * Initialize a project in filesystem-only mode: no git operations, so the
 * loader's cross-branch path stays entirely on the working copy. Mirrors the
 * upstream helper used by the shared branch-task-loader regressions.
 */
export async function initializeFilesystemTestProject(
	core: Core,
	projectName: string,
	backlogDirectory?: string,
): Promise<void> {
	const backlogDirectorySource = backlogDirectory
		? backlogDirectory === "backlog" || backlogDirectory === ".backlog"
			? (backlogDirectory as "backlog" | ".backlog")
			: "custom"
		: undefined;
	const configLocation = backlogDirectorySource === "custom" ? "root" : "folder";
	await initializeProjectShared(core, {
		projectName,
		backlogDirectory,
		backlogDirectorySource,
		configLocation,
		integrationMode: "none",
		filesystemOnly: true,
		advancedConfig: {
			autoCommit: false,
		},
	});
}

export interface DeferredGate {
	started: Promise<void>;
	markStarted: () => void;
	waitForRelease: Promise<void>;
	release: () => void;
}

export function createDeferredGate(): DeferredGate {
	let markStarted = () => {};
	let release = () => {};
	const started = new Promise<void>((resolve) => {
		markStarted = resolve;
	});
	const waitForRelease = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { started, markStarted, waitForRelease, release };
}

export function rootConfig(projectName: string, backlogDirectory: string): string {
	return [
		`project_name: "${projectName}"`,
		`backlog_directory: "${backlogDirectory}"`,
		'statuses: ["To Do", "Done"]',
		"labels: []",
		"date_format: YYYY-MM-DD",
		"check_active_branches: false",
		'task_prefix: "TASK"',
		"",
	].join("\n");
}

export function fixtureFilesystem(projectRoot: string, backlogDirectory: string): FileSystem {
	const fixture = new (FileSystem as new (rootDir: string) => FileSystem)(projectRoot);
	fixture.setBacklogDirectory(backlogDirectory);
	return fixture;
}

export function makeTask(idSuffix: string, title: string): Task {
	return {
		id: `TASK-${idSuffix}`,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2025-09-19 10:00",
		labels: [],
		dependencies: [],
		rawContent: `## Description\n${title}`,
	};
}

export async function writeFixture(filesystem: FileSystem, taskId: string, namespace: string): Promise<void> {
	await filesystem.ensureBacklogStructure();
	await Promise.all([
		filesystem.saveTask(makeTask(taskId, `Task ${namespace}`)),
		filesystem.saveDocument({
			id: `doc-${namespace}`,
			title: `Document ${namespace}`,
			type: "guide",
			createdDate: "2025-09-19",
			rawContent: `# Document ${namespace}`,
		}),
		filesystem.saveDecision({
			id: `decision-${namespace}`,
			title: `Decision ${namespace}`,
			date: "2025-09-19",
			status: "proposed",
			context: `Context ${namespace}`,
			decision: `Decision ${namespace}`,
			consequences: `Consequences ${namespace}`,
			rawContent: `## Context\nContext ${namespace}\n\n## Decision\nDecision ${namespace}\n\n## Consequences\nConsequences ${namespace}`,
		}),
	]);
}

export async function replaceRootConfig(configPath: string, content: string): Promise<void> {
	const replacementPath = `${configPath}.replacement`;
	await Bun.write(replacementPath, content);
	await rename(replacementPath, configPath);
}

export async function waitUntil(
	predicate: () => boolean,
	label: string,
	timeout = getPlatformTimeout(15000),
): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await sleep(25);
	}
	throw new Error(`Timed out waiting for ${label}`);
}

export type CapturedWatchCallback = (eventType: string, filename: string | Buffer | null) => void;

export function captureWatchCallbacks(callbacks: Map<string, CapturedWatchCallback>) {
	return spyOn(nodeFs, "watch").mockImplementation(((path: Parameters<typeof nodeFs.watch>[0], ...args: unknown[]) => {
		const callback = args.findLast((argument) => typeof argument === "function");
		if (typeof callback !== "function") {
			throw new Error(`Expected a watcher callback for ${String(path)}`);
		}
		callbacks.set(resolve(String(path)), callback as CapturedWatchCallback);
		const watcher = new EventEmitter() as EventEmitter & { close(): void };
		watcher.close = () => {};
		return watcher as unknown as nodeFs.FSWatcher;
	}) as typeof nodeFs.watch);
}

export function getCapturedWatcher(callbacks: Map<string, CapturedWatchCallback>, path: string): CapturedWatchCallback {
	const callback = callbacks.get(resolve(path));
	if (!callback) {
		throw new Error(`Expected captured watcher for ${path}`);
	}
	return callback;
}

export async function findDecisionFile(decisionsDir: string, decisionId: string): Promise<string> {
	for await (const file of new Bun.Glob(`${decisionId}*.md`).scan({ cwd: decisionsDir, followSymlinks: true })) {
		return file;
	}
	throw new Error(`Expected decision file for ${decisionId}`);
}
