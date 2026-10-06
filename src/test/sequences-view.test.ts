import { describe, expect, test } from "bun:test";
import type { Task } from "../types/index.ts";
import {
	buildMovePreview,
	buildMoveTargets,
	buildSequenceRows,
	moveTargetLabel,
	runSequencesView,
} from "../ui/sequences.ts";

function task(id: string, ordinal?: number): Task {
	const base = {
		id,
		title: `Title ${id}`,
		status: "To Do",
		assignee: [],
		created_date: "2026-01-01",
		labels: [],
		dependencies: [],
	} as unknown as Task;
	if (ordinal !== undefined) base.ordinal = ordinal;
	return base;
}

describe("buildSequenceRows", () => {
	test("puts the unsequenced bucket first and counts every group", () => {
		const rows = buildSequenceRows({
			unsequenced: [task("BACK-1"), task("BACK-2")],
			sequences: [{ index: 1, tasks: [task("BACK-3")] }],
		});
		expect(rows.map((row) => row.label)).toEqual(["Unsequenced (2)", "Sequence 1 (1)"]);
		expect(rows[0]?.kind).toBe("unsequenced");
		expect(rows[0]?.index).toBe(-1);
		expect(rows[1]?.index).toBe(1);
	});

	test("omits the bucket when nothing is unsequenced", () => {
		const rows = buildSequenceRows({ unsequenced: [], sequences: [{ index: 1, tasks: [task("BACK-3")] }] });
		expect(rows.map((row) => row.label)).toEqual(["Sequence 1 (1)"]);
	});

	test("orders a group's tasks by ordinal before id", () => {
		const rows = buildSequenceRows({
			unsequenced: [],
			sequences: [{ index: 1, tasks: [task("BACK-9", 30), task("BACK-2"), task("BACK-5", 10)] }],
		});
		expect(rows[0]?.tasks.map((entry) => entry.id)).toEqual(["BACK-5", "BACK-9", "BACK-2"]);
	});
});

describe("buildMoveTargets", () => {
	test("offers the bucket, every sequence, and the gaps between sequences", () => {
		const rows = buildSequenceRows({
			unsequenced: [task("BACK-1")],
			sequences: [
				{ index: 1, tasks: [task("BACK-2")] },
				{ index: 2, tasks: [task("BACK-3")] },
			],
		});
		expect(buildMoveTargets(rows).map(moveTargetLabel)).toEqual([
			"Unsequenced",
			"Sequence 1",
			"Between Sequence 1 and 2",
			"Sequence 2",
		]);
	});

	test("has no gap above the first or below the last sequence, and no bucket without one", () => {
		const rows = buildSequenceRows({
			unsequenced: [],
			sequences: [{ index: 1, tasks: [task("BACK-2")] }],
		});
		expect(buildMoveTargets(rows).map(moveTargetLabel)).toEqual(["Sequence 1"]);
	});
});

function withDeps(id: string, dependencies: string[]): Task {
	const result = task(id);
	result.dependencies = dependencies;
	return result;
}

describe("buildMovePreview", () => {
	const data = {
		unsequenced: [task("BACK-9")],
		sequences: [
			{ index: 1, tasks: [task("BACK-1"), task("BACK-2")] },
			{ index: 2, tasks: [task("BACK-3")] },
		],
	};
	const rows = buildSequenceRows(data);
	const allTasks = [...data.unsequenced, ...data.sequences.flatMap((seq) => seq.tasks)];

	const previewFor = (id: string, target: Parameters<typeof buildMovePreview>[0]["target"]) =>
		buildMovePreview({
			allTasks,
			data,
			rows,
			task: rows.flatMap((row) => row.tasks).find((entry) => entry.id === id),
			target,
		});

	test("names the source group and the target", () => {
		const lines = previewFor("BACK-3", { kind: "sequence", seqIndex: 2 });
		expect(lines[0]).toBe("Moving: BACK-3");
		expect(lines[1]).toBe("From:   Sequence 2 (1)");
		expect(lines[2]).toBe("To:     Sequence 2");
	});

	test("says the dependencies are replaced by the whole previous layer", () => {
		const lines = previewFor("BACK-3", { kind: "sequence", seqIndex: 2 }).join("\n");
		expect(lines).toContain("dependencies -> all 2 of Sequence 1");
		expect(lines).toContain("(BACK-1, BACK-2)");
		expect(lines).toContain("replaced, not appended");
	});

	test("marks Sequence 1 as the anchor case", () => {
		const lines = previewFor("BACK-9", { kind: "sequence", seqIndex: 1 }).join("\n");
		expect(lines).toContain("dependencies -> []");
		expect(lines).toContain("ordinal -> 0 when unset (anchor)");
	});

	test("spells out the inserted layer for a between target", () => {
		const lines = previewFor("BACK-9", { kind: "between", k: 1 }).join("\n");
		expect(lines).toContain("dependencies -> all 2 of Sequence 1");
		expect(lines).toContain("every Sequence 2 task depends on BACK-9");
		expect(lines).toContain("a new sequence is inserted above it");
	});

	test("refuses an Unsequenced drop for a task that still has dependencies", () => {
		const blocked = allTasks.map((entry) => (entry.id === "BACK-3" ? withDeps("BACK-3", ["BACK-1"]) : entry));
		const lines = buildMovePreview({
			allTasks: blocked,
			data,
			rows,
			task: blocked.find((entry) => entry.id === "BACK-3"),
			target: { kind: "unsequenced" },
		}).join("\n");
		expect(lines).toContain("blocked: it still has dependencies or dependents");
		expect(lines).not.toContain("ordinal -> cleared");
	});

	test("clears dependencies and ordinal for an eligible Unsequenced drop", () => {
		const lines = previewFor("BACK-9", { kind: "unsequenced" }).join("\n");
		expect(lines).toContain("BACK-9.dependencies -> []");
		expect(lines).toContain("BACK-9.ordinal -> cleared");
	});

	test("always says the move sets the layer, not the order inside it", () => {
		for (const target of buildMoveTargets(rows)) {
			const lines = previewFor("BACK-9", target).join("\n");
			expect(lines).toContain("This sets the layer, not the order in it:");
			expect(lines).toContain("rows inside a layer follow ordinal.");
		}
	});
});

describe("runSequencesView headless output", () => {
	test("prints the plain listing when the view is forced headless", async () => {
		const original = process.env.BACKLOG_HEADLESS;
		const logs: string[] = [];
		const originalLog = console.log;
		process.env.BACKLOG_HEADLESS = "1";
		console.log = (message?: unknown) => {
			logs.push(String(message));
		};
		try {
			await runSequencesView({
				unsequenced: [task("BACK-1")],
				sequences: [{ index: 1, tasks: [task("BACK-2")] }],
			});
		} finally {
			console.log = originalLog;
			if (original === undefined) delete process.env.BACKLOG_HEADLESS;
			else process.env.BACKLOG_HEADLESS = original;
		}
		expect(logs.join("\n")).toBe("Unsequenced:\n  BACK-1 - Title BACK-1\n\nSequence 1:\n  BACK-2 - Title BACK-2\n");
	});
});
