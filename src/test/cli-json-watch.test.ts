import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import {
	createLauncherInstall,
	createUniqueTestDir,
	getPlatformTimeout,
	initializeFilesystemTestProject,
	isWindows,
	safeCleanup,
	waitUntil,
	withTimeout,
} from "./test-utils.ts";

const CLI = join(process.cwd(), "src", "cli.ts");
const WATCH = ["task", "list", "--json", "--watch"];
let directory: string;
let core: Core;
const processes: ReturnType<typeof startWatch>[] = [];

type StreamCollector = { read: () => string; settled: Promise<void>; ended: Promise<void> };

/**
 * Collect a child stream into text, settling when the stream ends **or** the process is gone.
 *
 * On Windows a killed child's stdout and stderr never report end, so waiting only for the end
 * would hang the hook that killed it. What the child managed to write is collected either way.
 */
function collect(stream: ReadableStream<Uint8Array>, until: Promise<unknown>, onChunk?: (chunk: string) => void) {
	let text = "";
	const decoder = new TextDecoder();
	const draining = (async () => {
		const reader = stream.getReader();
		try {
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				text += chunk;
				onChunk?.(chunk);
			}
		} catch {
			// A killed child's stream can fail instead of reporting end.
		}
	})();
	const collector: StreamCollector = {
		read: () => text,
		settled: Promise.race([draining, until]).then(() => undefined),
		// Resolves only when the stream truly ends or fails, never on `until`.
		ended: draining.then(() => undefined),
	};
	return collector;
}

/**
 * Run `task list` against the temporary project.
 *
 * The child is deliberately not parented in the project directory: on Windows a child that is
 * stopped by signal leaves its working directory permanently unremovable (EBUSY), so every test
 * that ends a watch with SIGTERM would fail during cleanup. Pointing the CLI at the project
 * through BACKLOG_CWD keeps the project directory free of process-level locks, and the CLI
 * resolves its root, watch targets and config from it exactly as it would from the working
 * directory.
 */
function spawnCli(args: string[]) {
	return Bun.spawn(["bun", CLI, "task", "list", ...args], {
		cwd: process.cwd(),
		env: { ...process.env, BACKLOG_CWD: directory },
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
}

function startWatch(args: string[] = []) {
	return follow(spawnCli(["--json", "--watch", ...args]));
}

/** Start the watch from a throwaway process that hands it stdout and stderr, as a script or agent harness would. */
function startWatchFrom(command: string[]) {
	// The starter is node, not bun: on Windows bun assigns spawned children to a kill-on-close job
	// object, so a bun starter's whole tree would die with it and the test could not tell whether
	// the watch ended by itself. node leaves no such job, so only the watch's own liveness check
	// can end it. It also runs everywhere the launcher case needs it.
	const starter = `require("node:child_process").spawn(${JSON.stringify(command[0])}, ${JSON.stringify(command.slice(1))}, { stdio: ["ignore", "inherit", "inherit"] })`;
	return follow(
		Bun.spawn(["node", "-e", starter], {
			cwd: process.cwd(),
			env: { ...process.env, BACKLOG_CWD: directory },
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			// A POSIX process group lets cleanup stop anything the starter left behind.
			detached: !isWindows(),
		}),
	);
}

function follow(child: Bun.Subprocess<"ignore", "pipe", "pipe">): {
	process: Bun.Subprocess<"ignore", "pipe", "pipe">;
	snapshots: string[];
	stderr: StreamCollector;
	reading: Promise<void>;
	/** Settles when the child's stdout truly ends: no starter, launcher or watch still holds it. */
	stdoutEnd: Promise<void>;
} {
	const snapshots: string[] = [];
	let buffer = "";
	const stderr = collect(child.stderr, child.exited);
	const stdout = collect(child.stdout, child.exited, (chunk) => {
		buffer += chunk;
		// The existing pretty-printed envelope ends with an unindented closing brace.
		let end = buffer.indexOf("\n}\n");
		while (end !== -1) {
			snapshots.push(buffer.slice(0, end + 3));
			buffer = buffer.slice(end + 3);
			end = buffer.indexOf("\n}\n");
		}
	});
	const result = { process: child, snapshots, stderr, reading: stdout.settled, stdoutEnd: stdout.ended };
	processes.push(result);
	return result;
}

/** The diagnostics a watch run produced, once it has stopped or been stopped. */
async function stderrOf(watch: ReturnType<typeof startWatch>): Promise<string> {
	await watch.stderr.settled;
	return watch.stderr.read();
}

async function once(args: string[] = []) {
	const child = spawnCli(["--json", ...args]);
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(stderr).toBe("");
	expect(code).toBe(0);
	return stdout;
}

async function create(id: string, overrides: Partial<Task> = {}) {
	await core.createTask(
		{
			id,
			title: `Task ${id}`,
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2026-09-12",
			rawContent: "",
			...overrides,
		},
		false,
	);
}

async function expectCurrent(watch: ReturnType<typeof startWatch>, args: string[] = []) {
	const expected = await once(args);
	await waitUntil(() => watch.snapshots.at(-1) === expected, "watch matching one-shot JSON", 5000);
	expect(watch.snapshots.at(-1)).toBe(expected);
}

describe("CLI JSON watch", () => {
	beforeEach(async () => {
		directory = createUniqueTestDir("json-watch");
		await mkdir(directory, { recursive: true });
		core = new Core(directory);
		await initializeFilesystemTestProject(core, "JSON watch");
	});

	afterEach(async () => {
		for (const watch of processes.splice(0)) {
			watch.process.kill();
			await watch.process.exited;
			await watch.reading;
		}
		core.disposeContentStore();
		core.disposeSearchService();
		await safeCleanup(directory);
	});

	it("preserves exact initial bytes, follows create/atomic edit/removal, and suppresses unchanged results", async () => {
		const watch = startWatch();
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots[0] ?? "").tasks).toEqual([]);
		expect(watch.process.exitCode).toBeNull();

		await create("TASK-1", { title: 'Quoted "title" with } and a newline\ninside', labels: ["cli"] });
		await expectCurrent(watch);
		const task = await core.loadTaskById("TASK-1");
		const path = task?.filePath;
		if (!path) throw new Error("Missing task path");
		const markdown = await readFile(path, "utf8");
		await writeFile(`${path}.tmp`, markdown.replace("labels:", "priority: high\nlabels:"));
		await rename(`${path}.tmp`, path);
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].priority).toBe("high");

		const count = watch.snapshots.length;
		await writeFile(path, await readFile(path, "utf8"));
		await Bun.sleep(1300);
		expect(watch.snapshots).toHaveLength(count);
		await rm(path);
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks).toEqual([]);
		expect(await once()).toBe(watch.snapshots.at(-1) ?? "");
		watch.process.kill("SIGTERM");
		await watch.process.exited;
		expect(await stderrOf(watch)).toBe("");
	});

	it("reapplies filters, sorting and limits as tasks enter and leave the result", async () => {
		await create("TASK-1", { priority: "low", labels: ["cli"] });
		await create("TASK-2", { priority: "high", status: "Done", labels: ["cli"] });
		const args = ["--status", "To Do", "--labels", "cli", "--sort", "priority", "--limit", "1"];
		const watch = startWatch(args);
		await expectCurrent(watch, args);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].id).toBe("TASK-1");
		await core.editTask("TASK-2", { status: "To Do" });
		await expectCurrent(watch, args);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].id).toBe("TASK-2");
		await core.archiveTask("TASK-2");
		await expectCurrent(watch, args);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].id).toBe("TASK-1");
	});

	it("refreshes readiness from completed dependencies and configuration", async () => {
		await create("TASK-1", { dependencies: ["TASK-2"] });
		await create("TASK-2", { status: "Done" });
		await core.completeTask("TASK-2");
		const args = ["--parent", "TASK-9"];
		// Readiness must see completed dependencies even when only one local task remains.
		const watch = startWatch();
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].isReady).toBe(true);
		const completed = (await core.filesystem.listCompletedTasks())[0];
		if (!completed?.filePath) throw new Error("Missing completed task path");
		await rm(completed.filePath);
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks[0].isReady).toBe(false);
		await create("TASK-2", { status: "Done" });
		await expectCurrent(watch);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing config");
		await core.filesystem.saveConfig({ ...config, statuses: ["To Do", "Done", "Finished"] });
		await expectCurrent(watch);
		expect(JSON.parse(watch.snapshots.at(-1) ?? "").tasks.find((task: Task) => task.id === "TASK-1").isReady).toBe(
			false,
		);
		// A failed initial lookup produces no JSON, exactly as in one-shot mode.
		const invalid = startWatch(args);
		expect(await invalid.process.exited).toBe(1);
		expect(invalid.snapshots).toEqual([]);
	});

	it("fails closed if a duplicate identity appears after the initial response", async () => {
		await create("TASK-1");
		const watch = startWatch();
		await expectCurrent(watch);
		const task = await core.loadTaskById("TASK-1");
		if (!task?.filePath) throw new Error("Missing task path");
		await writeFile(join(core.filesystem.tasksDir, "task-1 - Duplicate.md"), await readFile(task.filePath, "utf8"));
		expect(await watch.process.exited).toBe(1);
		expect(watch.snapshots).toHaveLength(1);
		expect(await stderrOf(watch)).toContain("TASK-1");
	});

	it("terminates even when a subscriber stops reading a large response", async () => {
		await create("TASK-1", { references: [`https://example.com/${"x".repeat(2_000_000)}`] });
		const child = spawnCli(["--json", "--watch"]);
		let exited = false;
		const exit = child.exited.then((code) => {
			exited = true;
			return code;
		});
		// The subscriber stops reading this response, so its streams never report end once the child
		// is killed; settle on the exit instead of waiting for an end that cannot arrive.
		const stderr = collect(child.stderr, exit);
		try {
			const reader = child.stdout.getReader();
			// Bound the first read: a child that died before writing would otherwise hang here.
			const first = await Promise.race([reader.read(), child.exited.then(() => undefined)]);
			expect(first?.done).toBe(false);
			reader.releaseLock();
			child.kill("SIGTERM");
			await waitUntil(() => exited, "watch termination with unread output", 5000);
			const exitCode = await exit;
			// Windows terminates the process directly rather than delivering a POSIX signal.
			if (process.platform !== "win32") expect(exitCode).toBe(143);
			await stderr.settled;
			expect(stderr.read()).toBe("");
		} finally {
			if (!exited) child.kill("SIGKILL");
			await exit;
		}
	});

	async function expectWatchToEndWithItsStarter(command: string[]) {
		// On Windows, bun puts spawned children in a job object whose members all die when the
		// starter's handle closes, so a plain chain would pass even without the fix. Routing the
		// command through `cmd /c` breaks that linkage one level down: cmd dies with the starter,
		// but everything it started keeps running, so only the watch's own liveness check can end it.
		const watch = startWatchFrom(isWindows() ? ["cmd", "/c", ...command] : command);
		const tasks = () => JSON.parse(watch.snapshots.at(-1) ?? "{}").tasks?.length;
		try {
			await waitUntil(() => tasks() === 0, "initial watch response", getPlatformTimeout(5000));
			// Outlive at least one liveness check, then keep following changes.
			await Bun.sleep(1100);
			await create("TASK-1");
			await waitUntil(() => tasks() === 1, "watch response after a task change", getPlatformTimeout(5000));
			watch.process.kill("SIGKILL");
			await watch.process.exited;
			// End of output means no starter, launcher or watch process holds it any longer.
			await withTimeout(watch.stdoutEnd, "watch exit after its starter was killed", getPlatformTimeout(5000));
			await watch.stderr.settled;
			expect(watch.stderr.read()).toBe("");
		} finally {
			if (!isWindows()) {
				try {
					process.kill(-watch.process.pid, "SIGKILL");
				} catch {
					// Nothing was left behind.
				}
			}
		}
	}

	it("ends when the process that started it is killed", async () => {
		await expectWatchToEndWithItsStarter([process.execPath, CLI, ...WATCH]);
	});

	it("ends with the launcher when the process that started the npm launcher is killed", async () => {
		// The platform binary is this Bun, so the launched binary runs the CLI path it is given.
		const launcher = await createLauncherInstall(join(directory, "launcher"), (path) =>
			copyFile(process.execPath, path),
		);
		await expectWatchToEndWithItsStarter(["node", launcher, CLI, ...WATCH]);
	});

	it("ignores a stale launcher marker inherited through unrelated processes", async () => {
		const child = Bun.spawn([process.execPath, CLI, ...WATCH], {
			cwd: process.cwd(),
			env: { ...process.env, BACKLOG_CWD: directory, BACKLOG_LAUNCHER: "1:2" },
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		const watch = follow(child);
		await expectCurrent(watch);
		// The marker names neither this watch's parent nor any live starter, so it must be ignored:
		// the watch outlives a liveness tick and still follows changes.
		await Bun.sleep(1100);
		expect(watch.process.exitCode).toBeNull();
		await create("TASK-1");
		await expectCurrent(watch);
		watch.process.kill("SIGTERM");
		await watch.process.exited;
	});

	it("requires JSON and rejects invalid options without writing a snapshot", async () => {
		const child = spawnCli(["--watch"]);
		expect(await new Response(child.stdout).text()).toBe("");
		expect(await new Response(child.stderr).text()).toContain("--watch requires --json");
		expect(await child.exited).toBe(1);
		for (const args of [["--plain"], ["--limit", "0"], ["--sort", "unknown"]]) {
			const watch = startWatch(args);
			expect(await watch.process.exited).toBe(1);
			expect(watch.snapshots).toEqual([]);
			expect(await stderrOf(watch)).not.toBe("");
		}
	});
});
