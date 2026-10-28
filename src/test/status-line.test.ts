import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { statusLine } from "../utils/status-line.ts";

function setTty(value: boolean | undefined): void {
	Object.defineProperty(process.stdout, "isTTY", { value, configurable: true });
}

describe("StatusLine", () => {
	let originalIsTty: boolean | undefined;
	let originalLog: typeof console.log;
	let writes: string[];
	let logs: string[];

	beforeEach(() => {
		originalIsTty = process.stdout.isTTY;
		originalLog = console.log;
		writes = [];
		logs = [];
		// Spy on process.stdout.write (for in-place / lift / clear) and console.log (for the
		// non-TTY fallback). Save/restore console.log so this file does not leak state into sibling
		// test files that install the console hooks (installStatusLineHooks mutates the shared
		// module + console).
		process.stdout.write = ((chunk: string) => {
			writes.push(chunk);
			return true;
		}) as unknown as typeof process.stdout.write;
		console.log = (...args: unknown[]) => {
			logs.push(args.map((a) => String(a)).join(" "));
		};
		delete process.env.BACKLOG_STATUS_LINE;
	});

	afterEach(() => {
		setTty(originalIsTty);
		console.log = originalLog;
		delete process.env.BACKLOG_STATUS_LINE;
	});

	it("falls back to a normal line when not a TTY (no ANSI, no in-place rewrite)", () => {
		setTty(false);
		statusLine.update("hello");
		expect(logs).toEqual(["hello"]);
		expect(writes).toEqual([]);
	});

	it("writes an in-place rewrite when forced on via BACKLOG_STATUS_LINE=1", () => {
		setTty(false);
		process.env.BACKLOG_STATUS_LINE = "1";
		statusLine.update("heartbeat");
		expect(writes).toEqual(["\r\x1b[Kheartbeat"]);
		expect(logs).toEqual([]);
	});

	it("lift() drops to a fresh line without re-printing the status text (no duplication)", () => {
		setTty(false);
		process.env.BACKLOG_STATUS_LINE = "1";
		statusLine.update("status-line");
		writes = [];
		statusLine.lift();
		// Only a single newline to step below the already-drawn status; the text itself is NOT
		// printed again (would be duplication).
		expect(writes).toEqual(["\n"]);
		expect(writes).not.toContain("status-line");
	});

	it("lift() is a no-op when not active", () => {
		setTty(false);
		statusLine.update("x");
		writes = [];
		statusLine.lift();
		expect(writes).toEqual([]);
	});

	it("clear() erases the pinned line when active", () => {
		setTty(false);
		process.env.BACKLOG_STATUS_LINE = "1";
		statusLine.clear();
		expect(writes).toEqual(["\r\x1b[K"]);
	});

	it("clear() is a no-op when not active", () => {
		setTty(false);
		statusLine.clear();
		expect(writes).toEqual([]);
	});
});
