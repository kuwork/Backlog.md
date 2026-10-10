import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

/**
 * `backlog memo update --tags` behaviour, driven through the real CLI.
 *
 * The scratch project is created OUTSIDE the repository: a scratch dir inside the repo is deleted
 * by the cleanup below, and a CLI invoked with a deleted cwd walks up and silently operates on the
 * real repository instead. Every test spawns the CLI several times, so each one gets a timeout well
 * above bun's 5s default.
 */
const TIMEOUT_MS = 60_000;

describe("backlog memo update --tags", () => {
	let dir: string;
	const CLI_PATH = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "backlog-cli-memo-tags-"));
		await Bun.write(join(dir, "backlog", "config.yml"), "project_name: Memo Tags Test\n");
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true }).catch(() => undefined);
	});

	async function run(args: string[]): Promise<{ code: number; out: string }> {
		const result = await $`bun ${CLI_PATH} ${args}`.cwd(dir).nothrow().quiet();
		return {
			code: result.exitCode,
			out: (result.stdout.toString() + result.stderr.toString()).replace(/\r\n/g, "\n"),
		};
	}

	async function createMemo(body: string, tags: string): Promise<string> {
		const created = await run(["memo", "create", "--content", body, "--tags", tags]);
		const id = created.out.match(/Created memo (\S+)/)?.[1];
		if (!id) throw new Error(`memo create failed: ${created.out}`);
		return id;
	}

	async function view(id: string): Promise<string> {
		return (await run(["memo", "view", id, "--plain"])).out;
	}

	it(
		"replaces the tag set and bumps the updated date",
		async () => {
			const id = await createMemo("original body", "idea");
			const before = await view(id);
			expect(before).toContain("tags: idea");
			const updatedBefore = before.match(/updated_date: (\S+ \S+)/)?.[1] ?? "";

			const updated = await run(["memo", "update", id, "--tags", "meeting,important"]);
			expect(updated.code).toBe(0);
			expect(updated.out).toContain(`Updated memo ${id}`);

			const after = await view(id);
			expect(after).toContain("tags: meeting, important");
			// Stamps are minute-precision, so an update in the same minute may only match, never go back.
			expect((after.match(/updated_date: (\S+ \S+)/)?.[1] ?? "") >= updatedBefore).toBe(true);
		},
		TIMEOUT_MS,
	);

	it(
		"clears the tags when the value is blank",
		async () => {
			const id = await createMemo("kept body", "idea,cli");

			const cleared = await run(["memo", "update", id, "--tags", ""]);
			expect(cleared.code).toBe(0);

			const after = await view(id);
			expect(after).toContain("kept body");
			expect(after).not.toContain("tags:");
		},
		TIMEOUT_MS,
	);

	it(
		"updates the body and the tags in one call",
		async () => {
			const id = await createMemo("original body", "idea");

			const updated = await run(["memo", "update", id, "--content", "replaced body", "--tags", "done"]);
			expect(updated.code).toBe(0);

			const after = await view(id);
			expect(after).toContain("replaced body");
			expect(after).toContain("tags: done");
			expect(after).not.toContain("original body");
		},
		TIMEOUT_MS,
	);

	it(
		"accepts a tags-only update and keeps the body",
		async () => {
			const id = await createMemo("untouched body", "idea");

			const updated = await run(["memo", "update", id, "--tags", "later"]);
			expect(updated.code).toBe(0);
			expect(updated.out).not.toContain("No update options provided.");

			const after = await view(id);
			expect(after).toContain("untouched body");
			expect(after).toContain("tags: later");
		},
		TIMEOUT_MS,
	);

	it(
		"appends and re-tags in one call",
		async () => {
			const id = await createMemo("first line", "idea");

			const updated = await run(["memo", "update", id, "--append", "second line", "--tags", "cli"]);
			expect(updated.code).toBe(0);

			const after = await view(id);
			expect(after).toContain("first line");
			expect(after).toContain("second line");
			expect(after).toContain("tags: cli");
		},
		TIMEOUT_MS,
	);

	it(
		"trims, drops empties and dedupes the parsed tags",
		async () => {
			const id = await createMemo("body", "idea");

			const updated = await run(["memo", "update", id, "--tags", " meeting , cli ,, meeting ,,"]);
			expect(updated.code).toBe(0);

			const after = await view(id);
			expect(after).toContain("tags: meeting, cli");
		},
		TIMEOUT_MS,
	);

	it(
		"still rejects an update with no options at all",
		async () => {
			const id = await createMemo("body", "idea");

			const updated = await run(["memo", "update", id]);
			expect(updated.code).toBe(1);
			expect(updated.out).toContain("No update options provided.");
			expect(updated.out).toContain("--tags");
		},
		TIMEOUT_MS,
	);

	it(
		"lists tags in the update help",
		async () => {
			const help = (await run(["memo", "update", "--help"])).out;

			expect(help).toContain("-t, --tags <tags>");
			expect(help).toContain("tags: Comma-separated strings");
			expect(help).toContain("backlog memo update 20261001-1 --tags idea,cli");
		},
		TIMEOUT_MS,
	);
});
