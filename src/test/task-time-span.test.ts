import { describe, expect, test } from "bun:test";
import type { Task } from "../types/index.ts";
import { parseTaskDate, parseTaskDateTime, resolveTaskTimeSpan } from "../utils/task-time-span.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const createTask = (partial: Partial<Task>): Task => ({
	id: "task-1",
	title: "Test Task",
	status: "Done",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2024-01-01",
	rawContent: "",
	...partial,
});

const spanMs = (task: Task, now?: Date): number => {
	const { start, end } = resolveTaskTimeSpan(task, now);
	return end.getTime() - start.getTime();
};

describe("resolveTaskTimeSpan", () => {
	test("prefers stored actual timestamps and does not flag them", () => {
		const task = createTask({ actualStart: "2026-05-28 03:38", actualEnd: "2026-05-28 04:10" });
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.startSource).toBe("actualStart");
		expect(resolved.endSource).toBe("actualEnd");
		expect(resolved.isFallback).toBe(false);
		expect(resolved.originalStart).toBe("2026-05-28 03:38");
		expect(resolved.originalEnd).toBe("2026-05-28 04:10");
		expect(spanMs(task)).toBe(32 * 60 * 1000);
	});

	test("falls back to createdDate for the start only", () => {
		const task = createTask({ actualEnd: "2026-05-10 12:00", createdDate: "2026-05-01 08:00" });
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.startSource).toBe("createdDate");
		expect(resolved.endSource).toBe("actualEnd");
		expect(resolved.isFallback).toBe(false);
		expect(resolved.originalStart).toBe("2026-05-01 08:00");
	});

	test("uses createdDate to updatedDate without flagging it as fallback", () => {
		const task = createTask({ createdDate: "2026-05-01 08:00", updatedDate: "2026-05-01 09:30" });
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.startSource).toBe("createdDate");
		expect(resolved.endSource).toBe("updatedDate");
		expect(resolved.isFallback).toBe(false);
		expect(resolved.originalEnd).toBe("2026-05-01 09:30");
		expect(spanMs(task)).toBe(90 * 60 * 1000);
	});

	test("synthesises one day from createdDate when there is no updated date", () => {
		const task = createTask({ createdDate: "2026-05-01 08:00" });
		delete (task as { updatedDate?: string }).updatedDate;
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.endSource).toBe("createdDate+1d");
		expect(resolved.isFallback).toBe(true);
		expect(resolved.originalEnd).toBeUndefined();
		expect(spanMs(task)).toBe(DAY_MS);
	});

	test("falls back to now and one day when nothing is stored", () => {
		const task = createTask({});
		task.createdDate = "";
		const now = new Date("2026-03-01T00:00:00Z");
		const resolved = resolveTaskTimeSpan(task, now);

		expect(resolved.startSource).toBe("now");
		expect(resolved.endSource).toBe("start+1d");
		expect(resolved.isFallback).toBe(true);
		expect(resolved.start.getTime()).toBe(now.getTime());
		expect(spanMs(task, now)).toBe(DAY_MS);
	});

	test("pushes an inverted pair one day past the start and flags it", () => {
		const task = createTask({ actualStart: "2026-08-16 06:30", actualEnd: "2026-08-15 06:38" });
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.endSource).toBe("clamped");
		expect(resolved.isFallback).toBe(true);
		expect(resolved.end.getTime()).toBe(resolved.start.getTime() + DAY_MS);
		expect(resolved.originalEnd).toBe("2026-08-15 06:38");
		expect(spanMs(task)).toBe(DAY_MS);
	});

	test("leaves an equal pair at zero without clamping it", () => {
		const task = createTask({ createdDate: "2025-06-08 00:00", updatedDate: "2025-06-08 00:00" });
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.endSource).toBe("updatedDate");
		expect(resolved.isFallback).toBe(false);
		expect(spanMs(task)).toBe(0);
	});

	test("resolves date-only planned values to local midnight and omits missing ones", () => {
		const task = createTask({ plannedStart: "2026-05-28", plannedEnd: "2026-05-30" });
		const resolved = resolveTaskTimeSpan(task);

		expect(resolved.plannedStart?.getHours()).toBe(0);
		expect(resolved.plannedStart?.getMinutes()).toBe(0);
		expect(resolved.plannedEnd?.getHours()).toBe(0);

		const withoutPlanned = resolveTaskTimeSpan(createTask({}));
		expect(withoutPlanned.plannedStart).toBeUndefined();
		expect(withoutPlanned.plannedEnd).toBeUndefined();
	});
});

describe("parseTaskDate / parseTaskDateTime", () => {
	test("reads date-only as a local calendar day", () => {
		const d = parseTaskDate("2026-05-28");
		expect(d).not.toBeNull();
		expect(d?.getFullYear()).toBe(2026);
		expect(d?.getMonth()).toBe(4);
		expect(d?.getDate()).toBe(28);
		expect(d?.getHours()).toBe(0);
	});

	test("reads timestamps as the stored UTC instant", () => {
		const d = parseTaskDateTime("2026-05-28 03:38");
		expect(d?.toISOString()).toBe("2026-05-28T03:38:00.000Z");
	});

	test("returns null for missing or unparseable input", () => {
		expect(parseTaskDate(undefined)).toBeNull();
		expect(parseTaskDate("")).toBeNull();
		expect(parseTaskDateTime(undefined)).toBeNull();
		expect(parseTaskDateTime("not-a-date")).toBeNull();
	});
});
