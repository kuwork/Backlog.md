import type { Task } from "../types/index.ts";

const DAY = 24 * 60 * 60 * 1000;

/** Which stored field supplied the resolved start. */
export type TaskStartSource = "actualStart" | "createdDate" | "now";

/**
 * Which stored field supplied the resolved end. `clamped` means an end was found but it preceded
 * the start, so it was pushed forward instead.
 */
export type TaskEndSource = "actualEnd" | "updatedDate" | "createdDate+1d" | "start+1d" | "clamped";

export interface ResolvedTaskTimeSpan {
	start: Date;
	end: Date;
	originalStart?: string;
	originalEnd?: string;
	/** True when the end is not a stored value: a synthetic day, or an inverted pair pushed forward. */
	isFallback: boolean;
	plannedStart?: Date;
	plannedEnd?: Date;
	startSource: TaskStartSource;
	endSource: TaskEndSource;
}

/**
 * Date-only values (`YYYY-MM-DD`) name a calendar day, so they resolve to local midnight.
 */
export function parseTaskDate(dateStr?: string): Date | null {
	if (!dateStr) return null;
	const iso = `${dateStr}T00:00:00`;
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Timestamp values carry a time and are stored as UTC, so they resolve to that UTC instant.
 * A date-only string reaching this path is still read as UTC midnight.
 */
export function parseTaskDateTime(dateStr?: string): Date | null {
	if (!dateStr) return null;
	const hasTime = dateStr.includes(" ") || dateStr.includes("T");
	const iso = dateStr.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z");
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The one place that decides which stored field stands in for a task's start and end.
 *
 * The Gantt view draws its actual bars and prints its Actual Start / Actual End columns from this
 * resolution, and the statistics module measures completion time from it, so the two surfaces
 * always agree on what a task's start and end are rather than drifting apart.
 *
 * Actual timestamps win. `createdDate` and `updatedDate` stand in when the actual ones are absent.
 * With nothing to stand in, the span gets a synthetic day and `isFallback` marks it, which is what
 * the Gantt renders as an asterisk. An end that precedes its start is pushed to one day after the
 * start, because a bar cannot be drawn with a negative width.
 */
export function resolveTaskTimeSpan(task: Task, now: Date = new Date()): ResolvedTaskTimeSpan {
	const plannedStart = parseTaskDate(task.plannedStart);
	const plannedEnd = parseTaskDate(task.plannedEnd);
	const actualStart = parseTaskDateTime(task.actualStart);
	const actualEnd = parseTaskDateTime(task.actualEnd);
	const created = parseTaskDateTime(task.createdDate);
	const updated = parseTaskDateTime(task.updatedDate);

	let start: Date;
	let originalStart: string | undefined;
	let startSource: TaskStartSource;
	if (actualStart) {
		start = actualStart;
		originalStart = task.actualStart;
		startSource = "actualStart";
	} else if (created) {
		start = created;
		originalStart = task.createdDate;
		startSource = "createdDate";
	} else {
		start = now;
		startSource = "now";
	}

	let end: Date;
	let originalEnd: string | undefined;
	let isFallback = false;
	let endSource: TaskEndSource;
	if (actualEnd) {
		end = actualEnd;
		originalEnd = task.actualEnd;
		endSource = "actualEnd";
	} else if (updated) {
		end = updated;
		originalEnd = task.updatedDate;
		endSource = "updatedDate";
	} else if (created) {
		end = new Date(created.getTime() + DAY);
		isFallback = true;
		endSource = "createdDate+1d";
	} else {
		end = new Date(start.getTime() + DAY);
		isFallback = true;
		endSource = "start+1d";
	}

	if (end.getTime() < start.getTime()) {
		end = new Date(start.getTime() + DAY);
		isFallback = true;
		endSource = "clamped";
	}

	return {
		start,
		end,
		originalStart,
		originalEnd,
		isFallback,
		plannedStart: plannedStart ?? undefined,
		plannedEnd: plannedEnd ?? undefined,
		startSource,
		endSource,
	};
}
