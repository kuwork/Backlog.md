import { afterEach, beforeEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeMilestone } from "../markdown/serializer.ts";
import type { Milestone } from "../types/index.ts";
import { watchMilestones } from "../utils/milestone-watcher.ts";
import {
	type CapturedWatchCallback,
	captureWatchCallbacks,
	createUniqueTestDir,
	getCapturedWatcher,
	getPlatformTimeout,
	safeCleanup,
	sleep,
	waitUntil,
	withTimeout,
} from "./test-utils.ts";

// Real filesystem watchers can be slow to deliver events under full-suite load.
setDefaultTimeout(20000);

function sampleMilestone(id: string, title: string, description = "Watcher fixture"): Milestone {
	return {
		id,
		title,
		description,
		rawContent: `## Description\n\n${description}`,
		createdDate: "2026-09-23 10:00",
	};
}

describe("milestone watcher", () => {
	let testDir: string;
	let core: Core;
	let callbacks: Map<string, CapturedWatchCallback>;
	let watchSpy: ReturnType<typeof captureWatchCallbacks>;
	let stopWatcher: (() => void) | undefined;

	beforeEach(async () => {
		testDir = createUniqueTestDir("milestone-watcher");
		core = new Core(testDir);
		await core.filesystem.ensureBacklogStructure();
		callbacks = new Map();
		watchSpy = captureWatchCallbacks(callbacks);
	});

	afterEach(async () => {
		stopWatcher?.();
		stopWatcher = undefined;
		watchSpy.mockRestore();
		await safeCleanup(testDir);
	});

	/** Events arrive per folder, so a test drives the folder it is aimed at. */
	const emit = (path: string, eventType: string, filename: string) =>
		getCapturedWatcher(callbacks, path)(eventType, filename);

	it("watches both milestone folders and publishes a milestone written elsewhere", async () => {
		const published: Milestone[][] = [];
		let resolvePublished = () => {};
		const publication = new Promise<void>((resolve) => {
			resolvePublished = resolve;
		});
		stopWatcher = watchMilestones(core, {
			onMilestonesChanged: (milestones) => {
				published.push(milestones);
				resolvePublished();
			},
		}).stop;

		const fileName = "m-7 - Seventh.md";
		await writeFile(
			join(core.filesystem.milestonesDir, fileName),
			serializeMilestone(sampleMilestone("m-7", "Seventh")),
			"utf8",
		);
		emit(core.filesystem.milestonesDir, "change", fileName);

		await withTimeout(publication, "the milestone publication", getPlatformTimeout(2000));
		expect(published).toHaveLength(1);
		expect(published[0]?.map((milestone) => milestone.id)).toEqual(["m-7"]);
		// Both folders are watched, so an archive move cannot slip past as an edit of the other one.
		expect([...callbacks.keys()].sort()).toEqual(
			[core.filesystem.milestonesDir, core.filesystem.archiveMilestonesDir].sort(),
		);
	});

	it("publishes both lists when a milestone is archived elsewhere", async () => {
		const fileName = "m-3 - Third.md";
		await writeFile(
			join(core.filesystem.milestonesDir, fileName),
			serializeMilestone(sampleMilestone("m-3", "Third")),
			"utf8",
		);
		const published: Array<[Milestone[], Milestone[]]> = [];
		let resolvePublished = () => {};
		const publication = new Promise<void>((resolve) => {
			resolvePublished = resolve;
		});
		stopWatcher = watchMilestones(
			core,
			{
				onMilestonesChanged: (milestones, archivedMilestones) => {
					published.push([milestones, archivedMilestones]);
					resolvePublished();
				},
			},
			{ milestones: await core.filesystem.listMilestones(), archivedMilestones: [] },
		).stop;

		// Archiving is a move between the two folders; the active folder is the one that loses it.
		await rename(join(core.filesystem.milestonesDir, fileName), join(core.filesystem.archiveMilestonesDir, fileName));
		emit(core.filesystem.milestonesDir, "rename", fileName);

		await withTimeout(publication, "the archive publication", getPlatformTimeout(2000));
		expect(published[0]?.[0]).toEqual([]);
		expect(published[0]?.[1]?.map((milestone) => milestone.id)).toEqual(["m-3"]);
	});

	it("does not publish a write that leaves the content alone", async () => {
		const fileName = "m-1 - One.md";
		const filePath = join(core.filesystem.milestonesDir, fileName);
		const source = serializeMilestone(sampleMilestone("m-1", "One"));
		await writeFile(filePath, source, "utf8");
		const published: Milestone[][] = [];
		stopWatcher = watchMilestones(
			core,
			{
				onMilestonesChanged: (milestones) => {
					published.push(milestones);
				},
			},
			{ milestones: await core.filesystem.listMilestones(), archivedMilestones: [] },
		).stop;

		// A touch, or a view reporting its own write back: same content, nothing to repaint.
		await writeFile(filePath, source, "utf8");
		emit(core.filesystem.milestonesDir, "change", fileName);
		await sleep(500);

		expect(published).toEqual([]);
	});

	it("holds a half-written file back and publishes it once it is complete", async () => {
		const fileName = "m-2 - Two.md";
		const filePath = join(core.filesystem.milestonesDir, fileName);
		await writeFile(filePath, serializeMilestone(sampleMilestone("m-2", "Two")), "utf8");
		const published: Milestone[][] = [];
		stopWatcher = watchMilestones(
			core,
			{
				onMilestonesChanged: (milestones) => {
					published.push(milestones);
				},
			},
			{ milestones: await core.filesystem.listMilestones(), archivedMilestones: [] },
		).stop;

		// An editor truncating in place: parseMilestone is forgiving and answers an empty record
		// rather than throwing, so an unusable read has to be treated as a folder that is not ready.
		await writeFile(filePath, "---\nid: m-2\n", "utf8");
		emit(core.filesystem.milestonesDir, "change", fileName);
		await sleep(600);
		expect(published).toEqual([]);

		await writeFile(filePath, serializeMilestone(sampleMilestone("m-2", "Two", "Complete at last")), "utf8");
		emit(core.filesystem.milestonesDir, "change", fileName);
		await waitUntil(() => published.length > 0, "the completed write to publish", getPlatformTimeout(2000));
		expect(published[0]?.[0]?.description).toBe("Complete at last");
	});

	it("publishes an atomic edit through a real filesystem watcher", async () => {
		watchSpy.mockRestore();
		const fileName = "m-4 - Four.md";
		const filePath = join(core.filesystem.milestonesDir, fileName);
		await writeFile(filePath, serializeMilestone(sampleMilestone("m-4", "Four")), "utf8");
		const published: Milestone[][] = [];
		stopWatcher = watchMilestones(
			core,
			{
				onMilestonesChanged: (milestones) => {
					published.push(milestones);
				},
			},
			{ milestones: await core.filesystem.listMilestones(), archivedMilestones: [] },
		).stop;

		await Bun.write(filePath, serializeMilestone(sampleMilestone("m-4", "Four", "Edited by the CLI")));
		await waitUntil(() => published.length > 0, "the real watcher to publish", getPlatformTimeout(5000));
		expect(published[0]?.[0]?.description).toBe("Edited by the CLI");
	});
});
