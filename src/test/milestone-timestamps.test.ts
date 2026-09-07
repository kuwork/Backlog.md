import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { parseMilestone } from "../markdown/parser.ts";
import { serializeMilestone } from "../markdown/serializer.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

async function milestonePath(id: string): Promise<string> {
	const milestonesDir = join(TEST_DIR, "backlog", "milestones");
	const files = await Array.fromAsync(new Bun.Glob(`${id}*.md`).scan({ cwd: milestonesDir }));
	const [file] = files;
	if (!file) {
		throw new Error(`Milestone file not found for ${id}`);
	}
	return join(milestonesDir, file);
}

describe("Milestone timestamps", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-milestone-timestamps");
		await rm(TEST_DIR, { recursive: true, force: true });
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Milestone Timestamps Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("parses and round-trips created_date and updated_date", () => {
		const content = `---
id: m-0
title: "Timestamped"
created_date: 2026-09-07 17:01
updated_date: 2026-09-07 18:02
---

## Description

Text.`;
		const milestone = parseMilestone(content);
		expect(milestone.createdDate).toBe("2026-09-07 17:01");
		expect(milestone.updatedDate).toBe("2026-09-07 18:02");

		const roundTripped = parseMilestone(serializeMilestone(milestone));
		expect(roundTripped.createdDate).toBe("2026-09-07 17:01");
		expect(roundTripped.updatedDate).toBe("2026-09-07 18:02");
	});

	it("omits timestamp fields when absent", () => {
		const milestone = parseMilestone(`---
id: m-0
title: "Plain"
---

## Description

Text.`);
		expect(milestone.createdDate).toBeUndefined();
		expect(milestone.updatedDate).toBeUndefined();

		const serialized = serializeMilestone({ ...milestone, title: "Renamed" });
		expect(serialized).not.toContain("created_date");
		expect(serialized).not.toContain("updated_date");
	});

	it("stamps created_date on milestone creation and returns it", async () => {
		const core = new Core(TEST_DIR);
		const milestone = await core.filesystem.createMilestone("Release 1");
		expect(milestone.createdDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
		expect(milestone.updatedDate).toBeUndefined();

		const reloaded = await core.filesystem.loadMilestone(milestone.id);
		expect(reloaded?.createdDate).toBe(milestone.createdDate);
	});

	it("stamps updated_date only on substantive changes", async () => {
		const core = new Core(TEST_DIR);
		const created = await core.filesystem.createMilestone("Release 1");

		// Substantive change (due date) stamps updated_date and preserves created_date.
		const withDue = await core.filesystem.updateMilestone(created.id, "Release 1", "2026-12-31");
		expect(withDue.success).toBe(true);
		let reloaded = await core.filesystem.loadMilestone(created.id);
		expect(reloaded?.dueDate).toBe("2026-12-31");
		expect(reloaded?.createdDate).toBe(created.createdDate);
		const stamped = reloaded?.updatedDate;
		expect(stamped).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

		// Backdate updated_date, then a no-op update must preserve it.
		const path = await milestonePath(created.id);
		const backdated = (await Bun.file(path).text()).replace(/updated_date: '.*?'/, "updated_date: '2020-01-01 00:00'");
		await Bun.write(path, backdated);
		const noop = await core.filesystem.updateMilestone(created.id, "Release 1", "2026-12-31");
		expect(noop.success).toBe(true);
		reloaded = await core.filesystem.loadMilestone(created.id);
		expect(reloaded?.updatedDate).toBe("2020-01-01 00:00");

		// Another substantive change (title) refreshes updated_date again.
		const renamed = await core.filesystem.updateMilestone(created.id, "Release 2", "2026-12-31");
		expect(renamed.success).toBe(true);
		reloaded = await core.filesystem.loadMilestone(created.id);
		expect(reloaded?.title).toBe("Release 2");
		expect(reloaded?.updatedDate).not.toBe("2020-01-01 00:00");
		expect(reloaded?.createdDate).toBe(created.createdDate);
	});

	it("does not add timestamps to legacy milestone files on no-op updates", async () => {
		const core = new Core(TEST_DIR);
		const created = await core.filesystem.createMilestone("Legacy");

		// Simulate a legacy file without any timestamps.
		const path = await milestonePath(created.id);
		const legacy = (await Bun.file(path).text())
			.replace(/created_date: '.*?'(\r?\n)/, "")
			.replace(/updated_date: '.*?'(\r?\n)/, "");
		await Bun.write(path, legacy);
		let reloaded = await core.filesystem.loadMilestone(created.id);
		expect(reloaded?.createdDate).toBeUndefined();
		expect(reloaded?.updatedDate).toBeUndefined();

		// A no-op update keeps the file free of timestamps.
		const noop = await core.filesystem.updateMilestone(created.id, "Legacy");
		expect(noop.success).toBe(true);
		reloaded = await core.filesystem.loadMilestone(created.id);
		expect(reloaded?.createdDate).toBeUndefined();
		expect(reloaded?.updatedDate).toBeUndefined();

		// A substantive change only adds updated_date (created_date is never fabricated).
		const changed = await core.filesystem.updateMilestone(created.id, "Legacy", "2027-01-01");
		expect(changed.success).toBe(true);
		reloaded = await core.filesystem.loadMilestone(created.id);
		expect(reloaded?.dueDate).toBe("2027-01-01");
		expect(reloaded?.createdDate).toBeUndefined();
		expect(reloaded?.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});
});
