import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, withTimeout } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
const sockets: WebSocket[] = [];

type LoadingState =
	| { type: "loading"; message: string | null }
	| { type: "loaded" }
	| { type: "error"; message: string };

const openSocket = async (port: number): Promise<{ socket: WebSocket; states: LoadingState[] }> => {
	const states: LoadingState[] = [];
	const socket = new WebSocket(`ws://127.0.0.1:${port}`);
	sockets.push(socket);
	socket.onmessage = (event) => {
		try {
			states.push(JSON.parse(String(event.data)) as LoadingState);
		} catch {}
	};
	await withTimeout(
		new Promise<void>((resolve, reject) => {
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error("WebSocket failed to open"));
		}),
		"loading progress WebSocket",
		2000,
	);
	return { socket, states };
};

const waitForState = async (states: LoadingState[], expected: LoadingState): Promise<void> => {
	await retry(async () => {
		if (!states.some((state) => JSON.stringify(state) === JSON.stringify(expected))) {
			throw new Error(`Missing ${JSON.stringify(expected)} in ${JSON.stringify(states)}`);
		}
	});
};

beforeEach(async () => {
	testDir = createUniqueTestDir("server-loading-progress");
	const filesystem = new FileSystem(testDir);
	await filesystem.ensureBacklogStructure();
	await filesystem.saveConfig({
		projectName: "Loading Progress",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		dateFormat: "yyyy-mm-dd",
		checkActiveBranches: false,
		remoteOperations: false,
		autoCommit: false,
	});

	server = new BacklogServer(testDir);
	await server.start(0, false);
});

afterEach(async () => {
	for (const socket of sockets) {
		try {
			socket.close();
		} catch {}
	}
	sockets.length = 0;
	if (server) {
		await server.stop();
		server = null;
	}
	await safeCleanup(testDir);
});

describe("browser loading state over WebSocket", () => {
	it("sends a loading state then a loaded state to a connecting client", async () => {
		const port = server?.getPort();
		expect(port).not.toBeNull();

		const { states } = await openSocket(port ?? 0);

		await waitForState(states, { type: "loading", message: null });
		await waitForState(states, { type: "loaded" });
	}, 15000);

	it("retains the latest loading state for a late connection", async () => {
		const port = server?.getPort();
		expect(port).not.toBeNull();

		// Let the first client drive initialization to completion.
		const first = await openSocket(port ?? 0);
		await waitForState(first.states, { type: "loaded" });
		first.socket.close();

		// A late connection should still receive the current (loaded) state.
		const { states } = await openSocket(port ?? 0);
		await waitForState(states, { type: "loaded" });
	}, 15000);
});
