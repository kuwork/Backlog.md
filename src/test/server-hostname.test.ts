import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, safeCleanup, sleep } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;

type ServerInternals = {
	server: { hostname?: string } | null;
	openBrowser: (url: string) => Promise<void>;
};

function internals(instance: BacklogServer): ServerInternals {
	return instance as unknown as ServerInternals;
}

async function setupProject(dir: string, configOverrides: Record<string, unknown> = {}) {
	const filesystem = new FileSystem(dir);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Hostname Test",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		dateFormat: "yyyy-mm-dd",
		autoPort: true,
		defaultPort: 6420,
		...configOverrides,
	});
}

describe("BacklogServer loopback binding", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-hostname");
		await setupProject(TEST_DIR);
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("binds to 127.0.0.1 and displays/opens the localhost URL", async () => {
		const logs: string[] = [];
		let openedUrl: string | undefined;
		const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.join(" "));
		});

		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async (url) => {
				openedUrl = url;
			};
			await server.start(0, true);

			const port = server.getPort();
			expect(port).not.toBeNull();
			expect(internals(server).server?.hostname).toBe("127.0.0.1");
			expect(logs).toContain(`🚀 Backlog.md browser interface running at http://localhost:${port}`);
			expect(openedUrl).toBe(`http://localhost:${port}`);
			expect(logs.some((line) => line.includes("loopback only"))).toBe(true);
		} finally {
			logSpy.mockRestore();
		}
	}, 20000);

	it("keeps no-open behavior while displaying the localhost URL", async () => {
		const logs: string[] = [];
		let opened = false;
		const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.join(" "));
		});

		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async () => {
				opened = true;
			};
			await server.start(0, false);

			const port = server.getPort();
			expect(port).not.toBeNull();
			expect(opened).toBe(false);
			expect(logs).toContain(`🚀 Backlog.md browser interface running at http://localhost:${port}`);
			expect(logs).toContain("💡 Open your browser and navigate to the URL above");
			expect(logs).not.toContain("🌐 Opening browser...");
		} finally {
			logSpy.mockRestore();
		}
	}, 20000);

	it("serves the browser API on the loopback interface", async () => {
		server = new BacklogServer(TEST_DIR);
		internals(server).openBrowser = async () => {};
		await server.start(0, false);

		const port = server.getPort();
		expect(port).not.toBeNull();

		const response = await fetch(`http://127.0.0.1:${port}/`);
		expect(response.status).toBe(200);
		await server.stop();
		await sleep(200);
	}, 20000);

	it("binds to 0.0.0.0 when --host is given, displays a concrete LAN URL with warning", async () => {
		const logs: string[] = [];
		let openedUrl: string | undefined;
		const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.join(" "));
		});

		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async (url) => {
				openedUrl = url;
			};
			await server.start(0, true, "0.0.0.0");

			const port = server.getPort();
			expect(port).not.toBeNull();
			expect(internals(server).server?.hostname).toBe("0.0.0.0");
			expect(logs).not.toContain(`🚀 Backlog.md browser interface running at http://localhost:${port}`);
			expect(logs.some((line) => line.includes(`http://${"127.0.0.1"}:${port}`) || line.includes("LAN access"))).toBe(
				true,
			);
			expect(openedUrl).toMatch(/^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/);
			expect(logs.some((line) => line.includes("not recommended"))).toBe(true);
		} finally {
			logSpy.mockRestore();
		}
	}, 20000);

	it("binds to and displays an explicitly given non-loopback host", async () => {
		const lanIps: string[] = [];
		const { networkInterfaces } = await import("node:os");
		for (const entries of Object.values(networkInterfaces())) {
			for (const entry of entries ?? []) {
				if (entry.family === "IPv4" && !entry.internal) {
					lanIps.push(entry.address);
				}
			}
		}
		if (lanIps.length === 0) {
			console.log("Skipping: no non-internal IPv4 interface available");
			return;
		}

		const logs: string[] = [];
		let openedUrl: string | undefined;
		const logSpy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			logs.push(args.join(" "));
		});

		try {
			server = new BacklogServer(TEST_DIR);
			internals(server).openBrowser = async (url) => {
				openedUrl = url;
			};
			const lanIp = lanIps[0];
			await server.start(0, true, lanIp);

			const port = server.getPort();
			expect(port).not.toBeNull();
			expect(internals(server).server?.hostname).toBe(lanIp);
			expect(logs).toContain(`🚀 Backlog.md browser interface running at http://${lanIp}:${port}`);
			expect(openedUrl).toBe(`http://${lanIp}:${port}`);
		} finally {
			logSpy.mockRestore();
		}
	}, 20000);
});
