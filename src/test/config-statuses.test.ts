import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createUniqueTestDir } from "./test-utils.ts";

const OBJECT_FORM = `project_name: "State Machine"
statuses:
  - name: To Do
    category: active
    next:
      - to: Planning
        when: "人类已确认描述与验收标准完整，可以开工"
        ai: allowed
      - to: Dropped
        when: "任务已过时或被放弃"
        ai: propose
  - name: Planning
    category: wip
    next:
      - to: Plan Review
        when: "实现计划已写入 implementationPlan"
        ai: allowed_if
        if: "implementationPlan 非空"
        requires: "implementationPlan 非空"
  - name: Plan Review
    category: blocked
    next:
      - to: In Progress
        when: "人类已批准实现计划"
        ai: forbidden
  - name: Dropped
    category: dropped
    exit: archive
    next: []
labels: []
date_format: yyyy-mm-dd
`;

const STRING_FORM = `project_name: "Legacy"
statuses: ["To Do", "In Progress", "Done"]
labels: []
date_format: yyyy-mm-dd
`;

describe("config.yml statuses — object form (FR-7 R2 / R4)", () => {
	let testDir: string;
	let filesystem: FileSystem;

	beforeEach(async () => {
		testDir = createUniqueTestDir("config-statuses");
		await mkdir(join(testDir, "backlog"), { recursive: true });
		filesystem = new FileSystem(testDir);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	const write = async (content: string) => {
		await Bun.write(join(testDir, "backlog", "config.yml"), content);
	};

	it("parses every declared field instead of turning objects into '[object Object]'", async () => {
		await write(OBJECT_FORM);
		const config = await filesystem.loadConfig();
		const statuses = config?.statuses ?? [];
		expect(statuses).toHaveLength(4);
		expect(statuses[0]).toEqual({
			name: "To Do",
			category: "active",
			next: [
				{ to: "Planning", when: "人类已确认描述与验收标准完整，可以开工", ai: "allowed" },
				{ to: "Dropped", when: "任务已过时或被放弃", ai: "propose" },
			],
		});
		const planning = statuses[1];
		expect(planning).toBeDefined();
		if (typeof planning === "string" || !planning) throw new Error("expected an object form status");
		expect(planning.next?.[0]).toEqual({
			to: "Plan Review",
			when: "实现计划已写入 implementationPlan",
			ai: "allowed_if",
			if: "implementationPlan 非空",
			requires: "implementationPlan 非空",
		});
		expect(statuses[3]).toEqual({ name: "Dropped", category: "dropped", exit: "archive", next: [] });
	});

	it("round-trips a save without losing a single field", async () => {
		await write(OBJECT_FORM);
		const loaded = await filesystem.loadConfig();
		await filesystem.saveConfig(loaded as BacklogConfig);
		const reparsed = await filesystem.loadConfig();
		expect(reparsed?.statuses).toEqual(loaded?.statuses);

		const raw = await readFile(join(testDir, "backlog", "config.yml"), "utf8");
		expect(raw).toContain("ai: allowed_if");
		expect(raw).toContain('requires: "implementationPlan 非空"');
		expect(raw).toContain("exit: archive");
		expect(raw).not.toContain("[object Object]");
	});

	it("keeps the single-line form for a plain string array", async () => {
		await write(STRING_FORM);
		const loaded = await filesystem.loadConfig();
		expect(loaded?.statuses).toEqual(["To Do", "In Progress", "Done"]);
		await filesystem.saveConfig(loaded as BacklogConfig);
		const raw = await readFile(join(testDir, "backlog", "config.yml"), "utf8");
		expect(raw).toContain('statuses: ["To Do", "In Progress", "Done"]');
	});

	it("upgrades a string array to the object form when the editor saves one back", async () => {
		await write(STRING_FORM);
		const loaded = await filesystem.loadConfig();
		await filesystem.saveConfig({
			...(loaded as BacklogConfig),
			statuses: [
				{ name: "To Do", category: "active", next: [{ to: "Done", when: "done", ai: "propose" }] },
				{ name: "Done", category: "done", exit: "complete", next: [] },
			],
		});
		const reparsed = await filesystem.loadConfig();
		expect(reparsed?.statuses).toEqual([
			{ name: "To Do", category: "active", next: [{ to: "Done", when: "done", ai: "propose" }] },
			{ name: "Done", category: "done", exit: "complete", next: [] },
		]);
	});

	it("round-trips the display flag: false is written and read back, default is omitted", async () => {
		await write(STRING_FORM);
		const loaded = await filesystem.loadConfig();
		await filesystem.saveConfig({
			...(loaded as BacklogConfig),
			statuses: [
				{ name: "To Do", category: "active", display: true, next: [] },
				{ name: "Dropped", category: "dropped", exit: "archive", display: false, next: [] },
			],
		});
		const reparsed = await filesystem.loadConfig();
		expect(reparsed?.statuses).toEqual([
			{ name: "To Do", category: "active", display: true, next: [] },
			{ name: "Dropped", category: "dropped", exit: "archive", display: false, next: [] },
		]);

		const raw = await readFile(join(testDir, "backlog", "config.yml"), "utf8");
		expect(raw).toContain("display: false");
		expect(raw).not.toContain("display: true");
	});
});
