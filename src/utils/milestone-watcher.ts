/**
 * Watch the milestone folders and publish the two lists when they change.
 *
 * Milestones are a folder of markdown files the same way tasks and drafts are, and a view that
 * shows them is stale the moment the CLI, the web UI or an editor writes one from its own process.
 * This is that folder's feed: it watches the active and archived folders and hands the caller both
 * lists once a change has settled.
 *
 * It is deliberately coarser than `task-watcher`, which reconciles one record at a time because a
 * project can hold thousands of tasks: a milestone file carries no per-record store and a project
 * holds a handful of them, so re-reading the folders is cheaper than tracking ids, and there is no
 * per-record removal to confirm - a file that is gone is simply not in the list that comes back.
 */

import { type FSWatcher, watch } from "node:fs";
import type { Core } from "../core/backlog.ts";
import type { Milestone } from "../types/index.ts";

export interface MilestoneWatcherCallbacks {
	/** Called once a change has settled, with both lists: every surface reads active and archived. */
	onMilestonesChanged?: (milestones: Milestone[], archivedMilestones: Milestone[]) => void | Promise<void>;
}

const MILESTONE_SETTLE_DELAY_MS = 50;
const MILESTONE_STABILITY_DELAY_MS = 35;
const MILESTONE_READ_ATTEMPTS = 8;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * What counts as a milestone change: the whole record. A milestone carries nothing that describes
 * where it came from rather than what it says - no branch, filePath or lastModified to strip, the
 * way `taskContentSignature` strips them - so its file *is* its content. Exported for the same
 * reason that one is: the view compares the same value when it decides whether an open popup still
 * matches the milestone behind it, so the echo of its own write compares equal.
 */
export function milestoneContentSignature(milestone: Milestone): string {
	return JSON.stringify(milestone);
}

/** Both folders in one value, so the watcher and the view agree on what "nothing moved" means. */
export function milestonesSignature(
	milestones: readonly Milestone[],
	archivedMilestones: readonly Milestone[],
): string {
	return JSON.stringify([milestones.map(milestoneContentSignature), archivedMilestones.map(milestoneContentSignature)]);
}

/**
 * Whether a parsed milestone can be published. `parseMilestone` is forgiving — a file caught
 * half-written parses into an empty record instead of throwing — and an empty record would read to
 * the view as a milestone that changed and then vanished, so a folder holding one is not a folder
 * whose contents are known yet.
 */
function isUsableMilestone(milestone: Milestone): boolean {
	return Boolean(milestone.id.trim() && milestone.title.trim());
}

/**
 * One folder's milestones, or `null` when the read cannot be trusted.
 *
 * `listMilestones` swallows read and parse errors and answers an empty list, so a file caught
 * mid-write would look exactly like every milestone having been deleted. The file count is what
 * tells the two apart: as many usable milestones as `m-*.md` files, or the read does not count.
 */
async function readMilestoneFolder(dir: string, list: () => Promise<Milestone[]>): Promise<Milestone[] | null> {
	try {
		const files = await Array.fromAsync(new Bun.Glob("m-*.md").scan({ cwd: dir, followSymlinks: true }));
		const milestones = await list();
		if (milestones.length !== files.length || !milestones.every(isUsableMilestone)) return null;
		return milestones;
	} catch {
		return null;
	}
}

/**
 * Watch the checkout's milestone folders.
 *
 * A single filesystem event is reconciled until two consecutive reads agree, because atomic writes
 * can make the event visible before the file is - the same reason the config watcher reads twice
 * before it publishes. A pair that matches what was published last is dropped, so a view that
 * reports its own write back cannot make the watcher publish it again.
 */
export function watchMilestones(
	core: Core,
	callbacks: MilestoneWatcherCallbacks,
	initial: { milestones?: readonly Milestone[]; archivedMilestones?: readonly Milestone[] } = {},
): { stop: () => void } {
	const milestonesDir = core.filesystem.milestonesDir;
	const archivedMilestonesDir = core.filesystem.archiveMilestonesDir;
	const dirs = [milestonesDir, archivedMilestonesDir];
	let stopped = false;
	let generation = 0;
	let processing = false;
	let pending = false;
	let lastPublished = milestonesSignature(initial.milestones ?? [], initial.archivedMilestones ?? []);

	const readBoth = async (): Promise<[Milestone[], Milestone[]] | null> => {
		const milestones = await readMilestoneFolder(milestonesDir, () => core.filesystem.listMilestones());
		if (!milestones) return null;
		const archivedMilestones = await readMilestoneFolder(archivedMilestonesDir, () =>
			core.filesystem.listArchivedMilestones(),
		);
		if (!archivedMilestones) return null;
		return [milestones, archivedMilestones];
	};

	const publish = async (eventGeneration: number): Promise<void> => {
		for (let attempt = 0; attempt < MILESTONE_READ_ATTEMPTS; attempt++) {
			await delay(attempt === 0 ? MILESTONE_SETTLE_DELAY_MS : MILESTONE_STABILITY_DELAY_MS);
			if (stopped || eventGeneration !== generation) return;

			const first = await readBoth();
			if (!first) continue;
			await delay(MILESTONE_STABILITY_DELAY_MS);
			if (stopped || eventGeneration !== generation) return;
			const second = await readBoth();
			if (!second || milestonesSignature(...first) !== milestonesSignature(...second)) continue;

			const signature = milestonesSignature(...second);
			if (signature === lastPublished) return;

			while (!stopped && eventGeneration === generation) {
				try {
					await callbacks.onMilestonesChanged?.(second[0], second[1]);
					lastPublished = signature;
					break;
				} catch {
					// Callback failures are bounded by the same finite reconciliation budget.
					await delay(MILESTONE_STABILITY_DELAY_MS);
				}
			}
			return;
		}
	};

	const drain = async (): Promise<void> => {
		if (processing) return;
		processing = true;
		try {
			do {
				pending = false;
				await publish(generation);
			} while (!stopped && pending);
		} finally {
			processing = false;
			if (!stopped && pending) void drain().catch(() => {});
		}
	};

	const schedule = () => {
		generation += 1;
		pending = true;
		void drain().catch(() => {});
	};

	const watchers: FSWatcher[] = [];
	for (const dir of dirs) {
		try {
			watchers.push(
				watch(dir, { recursive: false }, (eventType) => {
					if (eventType === "change" || eventType === "rename") schedule();
				}),
			);
		} catch {
			// The archived folder is not created until something is archived, and a folder that is
			// not there yet has nothing to report.
		}
	}
	for (const watcher of watchers) {
		watcher.on("error", (error) => {
			if (process.env.DEBUG) console.warn("Milestone watcher error", error);
		});
	}

	return {
		stop() {
			stopped = true;
			generation += 1;
			pending = false;
			for (const watcher of watchers) {
				try {
					watcher.close();
				} catch {}
			}
		},
	};
}
