import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, safeCleanup, sleep } from "./test-utils.ts";

let TEST_DIR: string;

async function setupProject(dir: string, configOverrides: Record<string, unknown> = {}) {
	const filesystem = new FileSystem(dir);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Port Test",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		dateFormat: "yyyy-mm-dd",
		autoPort: true,
		defaultPort: 6420,
		...configOverrides,
	});
}

describe("BacklogServer port selection", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-port");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("autoPort true: second server binds to a temporary port when the default port is occupied", async () => {
		const dir1 = join(TEST_DIR, "project1");
		const dir2 = join(TEST_DIR, "project2");
		await setupProject(dir1);
		await setupProject(dir2);

		const server1 = new BacklogServer(dir1);
		const server2 = new BacklogServer(dir2);

		await server1.start(6430, false);
		expect(server1.getPort()).toBe(6430);

		await server2.start(6430, false);
		const port2 = server2.getPort();
		expect(port2).not.toBe(6430);
		expect(port2).toBeGreaterThan(6430);
		expect(port2).toBeLessThanOrEqual(6530);

		await server1.stop();
		await server2.stop();
		await sleep(200);
	}, 15000);

	it("uses configured defaultPort as the preferred starting port", async () => {
		const dir = join(TEST_DIR, "project");
		await setupProject(dir, { defaultPort: 9000 });

		const server = new BacklogServer(dir);
		await server.start(undefined, false);
		expect(server.getPort()).toBe(9000);

		await server.stop();
		await sleep(200);
	}, 15000);

	it("autoPort false: binds directly to the preferred port", async () => {
		const dir = join(TEST_DIR, "project");
		await setupProject(dir, { autoPort: false, defaultPort: 6440 });

		const server = new BacklogServer(dir);
		await server.start(undefined, false);
		expect(server.getPort()).toBe(6440);

		await server.stop();
		await sleep(200);
	}, 15000);

	it("autoPort true with port 0 lets the OS assign a port", async () => {
		const dir = join(TEST_DIR, "project");
		await setupProject(dir);

		const server = new BacklogServer(dir);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		expect(port).toBeGreaterThan(0);

		await server.stop();
		await sleep(200);
	}, 15000);

	it("falls back when autoPort is undefined (treated as true)", async () => {
		const dir1 = join(TEST_DIR, "project1");
		const dir2 = join(TEST_DIR, "project2");
		const filesystem1 = new FileSystem(dir1);
		await filesystem1.ensureBacklogStructure();
		await filesystem1.saveConfig({
			projectName: "Port Test",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			dateFormat: "yyyy-mm-dd",
			// autoPort is intentionally omitted
		});
		await setupProject(dir2);

		const server1 = new BacklogServer(dir1);
		const server2 = new BacklogServer(dir2);

		await server1.start(6450, false);
		expect(server1.getPort()).toBe(6450);

		await server2.start(6450, false);
		expect(server2.getPort()).not.toBe(6450);

		await server1.stop();
		await server2.stop();
		await sleep(200);
	}, 15000);
});

describe("BacklogServer port selection — EADDRINUSE with autoPort false", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-port-eaddr");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("exits with non-zero code when the preferred port is occupied and autoPort is false", async () => {
		// Skip on Windows because Bun.serve may allow port reuse via SO_REUSEADDR,
		// making EADDRINUSE unreliable across processes.
		if (process.platform === "win32") {
			console.log("Skipping EADDRINUSE subprocess test on Windows");
			return;
		}

		const dir1 = join(TEST_DIR, "project1");
		const dir2 = join(TEST_DIR, "project2");
		await setupProject(dir1);
		await setupProject(dir2, { autoPort: false });

		const server1 = new BacklogServer(dir1);
		await server1.start(6460, false);
		expect(server1.getPort()).toBe(6460);

		// Spawn a subprocess that attempts to start a second server on the same port.
		// BacklogServer.start() calls process.exit(1) on EADDRINUSE when autoPort is false.
		const scriptPath = join(TEST_DIR, "eaddr-test.ts");
		await Bun.write(
			scriptPath,
			`import { BacklogServer } from "${join(process.cwd(), "src", "server", "index.ts").replace(/\\/g, "/")}";
const server = new BacklogServer("${dir2.replace(/\\/g, "/")}");
try {
	await server.start(6460, false);
	console.log("STARTED_ON_" + server.getPort());
	await server.stop();
	process.exit(0);
} catch {
	process.exit(2);
}`,
		);

		const child = Bun.spawn({
			cmd: [process.execPath, "run", scriptPath],
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await child.exited;
		const stdout = await new Response(child.stdout).text();
		const stderr = await new Response(child.stderr).text();

		expect(exitCode).not.toBe(0);
		expect(stderr + stdout).toContain("already in use");

		await server1.stop();
	}, 15000);
});
