import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * `backlog memo create` stdin behaviour, driven through the real CLI.
 *
 * The scratch project is created OUTSIDE the repository: a scratch dir inside the repo is deleted
 * by the cleanup below, and a CLI invoked with a deleted cwd walks up and silently operates on the
 * real repository instead. Every test spawns the CLI, so each one gets a timeout well above bun's
 * 5s default.
 */
const TIMEOUT_MS = 60_000;

describe("backlog memo create stdin", () => {
	let dir: string;
	const CLI_PATH = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "backlog-cli-memo-stdin-"));
		await Bun.write(join(dir, "backlog", "config.yml"), "project_name: Memo Stdin Test\n");
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true }).catch(() => undefined);
	});

	async function runWithStdin(args: string[], body: string): Promise<{ code: number; out: string }> {
		const proc = Bun.spawn(["bun", CLI_PATH, ...args], {
			cwd: dir,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		});
		proc.stdin.write(body);
		proc.stdin.end();
		const [stdout, stderr, code] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		return {
			code,
			out: (stdout + stderr).replace(/\r\n/g, "\n"),
		};
	}

	async function run(args: string[]): Promise<{ code: number; out: string }> {
		return runWithStdin(args, "");
	}

	async function memoFiles(): Promise<string[]> {
		return readdir(join(dir, "backlog", "memos")).catch(() => [] as string[]);
	}

	it(
		"captures a piped multi-line body verbatim",
		async () => {
			const created = await runWithStdin(["memo", "create"], "line one\nline two");
			expect(created.code).toBe(0);
			const id = created.out.match(/Created memo (\S+)/)?.[1];
			expect(id).toBeDefined();

			const viewed = await run(["memo", "view", id as string, "--plain"]);
			expect(viewed.out).toContain("line one\nline two");
		},
		TIMEOUT_MS,
	);

	it(
		"keeps --tags working when the body arrives on stdin",
		async () => {
			const created = await runWithStdin(["memo", "create", "--tags", "idea,cli"], "piped body");
			expect(created.code).toBe(0);
			const id = created.out.match(/Created memo (\S+)/)?.[1];

			const viewed = await run(["memo", "view", id as string, "--plain"]);
			expect(viewed.out).toContain("piped body");
			expect(viewed.out).toContain("tags: idea, cli");
		},
		TIMEOUT_MS,
	);

	it(
		"does not print the interactive hint when stdin is piped",
		async () => {
			const created = await runWithStdin(["memo", "create"], "quiet body");
			expect(created.code).toBe(0);
			expect(created.out).not.toContain("Ctrl+D");
			expect(created.out).not.toContain("Type the memo");
		},
		TIMEOUT_MS,
	);

	it(
		"rejects an empty pipe with the existing empty-content message and creates no memo",
		async () => {
			const created = await runWithStdin(["memo", "create"], "");
			expect(created.code).toBe(1);
			expect(created.out).toContain("Memo content is empty.");
			expect(await memoFiles()).toEqual([]);
		},
		TIMEOUT_MS,
	);

	it(
		"rejects a whitespace-only pipe and creates no memo",
		async () => {
			const created = await runWithStdin(["memo", "create"], "  \n \n");
			expect(created.code).toBe(1);
			expect(created.out).toContain("Memo content is empty.");
			expect(await memoFiles()).toEqual([]);
		},
		TIMEOUT_MS,
	);
});
