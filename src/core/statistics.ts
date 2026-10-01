import type { StatusesConfig, Task } from "../types/index.ts";
import { getStoredUtcTimestamp, parseStoredUtcDate } from "../utils/date-utc.ts";
import { taskIdsEqual } from "../utils/task-path.ts";
import { resolveTaskTimeSpan } from "../utils/task-time-span.ts";
import { getTerminalStatus } from "../utils/terminal-status.ts";
import { statusNames } from "./state-machine.ts";

export interface TaskStatistics {
	statusCounts: Map<string, number>;
	priorityCounts: Map<string, number>;
	totalTasks: number;
	completedTasks: number;
	completionPercentage: number;
	draftCount: number;
	recentActivity: {
		created: Task[];
		updated: Task[];
	};
	projectHealth: {
		averageTaskAge: number;
		/** Mean span of completed tasks, in minutes, resolved the same way the Gantt resolves its actual bar. */
		averageCompletionMinutes: number;
		/** How many completed tasks that mean covers. */
		completionSampleCount: number;
		staleTasks: Task[];
		atRiskTasks: Task[];
		overdueTasks: Task[];
		blockedTasks: Task[];
	};
	completionHeatmap: Record<string, number>;
}

/**
 * Calculate comprehensive task statistics for the overview
 */
export function getTaskStatistics(tasks: Task[], drafts: Task[], statuses: StatusesConfig): TaskStatistics {
	const statusCounts = new Map<string, number>();
	const priorityCounts = new Map<string, number>();

	// Initialize status counts
	for (const status of statusNames(statuses)) {
		statusCounts.set(status, 0);
	}

	// The project decides which status means done, so read it from the raw config instead of
	// assuming a status name. A renamed or multi-valued machine then still counts correctly, and
	// a dropped status is not a completion.
	const completedStatus = getTerminalStatus(statuses);
	const isCompleted = (status: string | undefined): boolean =>
		completedStatus !== null && (status ?? "").trim().toLowerCase() === completedStatus.trim().toLowerCase();

	// Initialize priority counts
	priorityCounts.set("high", 0);
	priorityCounts.set("medium", 0);
	priorityCounts.set("low", 0);
	priorityCounts.set("none", 0);

	let completedTasks = 0;
	const now = new Date();
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const recentlyCreated: Task[] = [];
	const recentlyUpdated: Task[] = [];
	const staleTasks: Task[] = [];
	const atRiskTasks: Task[] = [];
	const overdueTasks: Task[] = [];
	const blockedTasks: Task[] = [];
	let totalAge = 0;
	let taskCount = 0;
	let totalCompletionMs = 0;
	let completionSampleCount = 0;
	const completionHeatmap: Record<string, number> = {};
	const oneYearAgo = now.getTime() - 365 * 24 * 60 * 60 * 1000;

	// Process each task
	for (const task of tasks) {
		// Skip tasks with empty or undefined status
		if (!task.status || task.status === "") {
			continue;
		}

		// Count by status
		const currentCount = statusCounts.get(task.status) || 0;
		statusCounts.set(task.status, currentCount + 1);

		// Count completed tasks, build the heatmap, and accumulate the completion span
		if (isCompleted(task.status)) {
			completedTasks++;

			// Every completed task contributes to the mean however its span resolves: one with no
			// stored timestamps still resolves through the Gantt fallback chain, so the sample
			// count stays equal to the completed task count.
			const span = resolveTaskTimeSpan(task, now);
			totalCompletionMs += span.end.getTime() - span.start.getTime();
			completionSampleCount++;

			const completionDateStr = task.actualEnd || task.updatedDate;
			if (typeof completionDateStr === "string" && completionDateStr) {
				const completionDate = parseStoredUtcDate(completionDateStr);
				if (completionDate) {
					const completionTime = completionDate.getTime();
					if (completionTime >= oneYearAgo) {
						const dateKey = completionDate.toISOString().slice(0, 10);
						completionHeatmap[dateKey] = (completionHeatmap[dateKey] || 0) + 1;
					}
				}
			}
		}

		// Count by priority
		const priority = task.priority || "none";
		const priorityCount = priorityCounts.get(priority) || 0;
		priorityCounts.set(priority, priorityCount + 1);

		// Track recent activity
		if (task.createdDate) {
			const createdDate = getStoredUtcTimestamp(task.createdDate);
			if (createdDate >= oneWeekAgo.getTime()) {
				recentlyCreated.push(task);
			}

			// Calculate task age
			// For completed tasks, use the time from creation to completion
			// For active tasks, use the time from creation to now
			let ageInDays: number;
			if (isCompleted(task.status) && task.updatedDate) {
				const updatedDate = getStoredUtcTimestamp(task.updatedDate);
				ageInDays = Math.floor((updatedDate - createdDate) / (24 * 60 * 60 * 1000));
			} else {
				ageInDays = Math.floor((now.getTime() - createdDate) / (24 * 60 * 60 * 1000));
			}
			totalAge += ageInDays;
			taskCount++;
		}

		{
			const lastUpdated = task.updatedDate || task.createdDate;
			if (lastUpdated) {
				const updatedDate = getStoredUtcTimestamp(lastUpdated);
				if (updatedDate >= oneWeekAgo.getTime()) {
					recentlyUpdated.push(task);
				}
			}
		}

		// Identify stale tasks (not updated in 30 days and not done, and no due date)
		if (!isCompleted(task.status) && !task.dueDate) {
			const lastDate = task.updatedDate || task.createdDate;
			if (lastDate) {
				const date = getStoredUtcTimestamp(lastDate);
				if (date < oneMonthAgo.getTime()) {
					staleTasks.push(task);
				}
			}
		}

		// Identify at-risk and overdue tasks based on dueDate
		if (!isCompleted(task.status) && task.dueDate) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const due = new Date(`${task.dueDate}T00:00:00`);
			const diffDays = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
			if (diffDays < 0) {
				overdueTasks.push(task);
			} else if (diffDays <= 1) {
				atRiskTasks.push(task);
			}
		}

		// Identify blocked tasks (has dependencies that are not done)
		if (task.dependencies && task.dependencies.length > 0 && !isCompleted(task.status)) {
			// Check if any dependency is not done
			const hasBlockingDependency = task.dependencies.some((depId) => {
				const dep = tasks.find((t) => taskIdsEqual(t.id, depId));
				return dep && !isCompleted(dep.status);
			});

			if (hasBlockingDependency) {
				blockedTasks.push(task);
			}
		}
	}

	// Sort recent activity by date
	recentlyCreated.sort((a, b) => {
		const dateA = a.createdDate ? getStoredUtcTimestamp(a.createdDate) : 0;
		const dateB = b.createdDate ? getStoredUtcTimestamp(b.createdDate) : 0;
		return dateB - dateA;
	});

	recentlyUpdated.sort((a, b) => {
		const dateA = a.updatedDate ? getStoredUtcTimestamp(a.updatedDate) : 0;
		const dateB = b.updatedDate ? getStoredUtcTimestamp(b.updatedDate) : 0;
		return dateB - dateA;
	});

	// Calculate average task age
	const averageTaskAge = taskCount > 0 ? Math.round(totalAge / taskCount) : 0;

	// Average completion time, in minutes. No sample is filtered out, so the count here equals
	// the number of completed tasks the overview reports.
	const averageCompletionMinutes =
		completionSampleCount > 0 ? Math.round(totalCompletionMs / completionSampleCount / (60 * 1000)) : 0;

	// Calculate completion percentage (only count tasks with valid status)
	const totalTasks = Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0);
	const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

	return {
		statusCounts,
		priorityCounts,
		totalTasks,
		completedTasks,
		completionPercentage,
		draftCount: drafts.length,
		recentActivity: {
			created: recentlyCreated.slice(0, 5), // Top 5 most recent
			updated: recentlyUpdated.slice(0, 5), // Top 5 most recent
		},
		projectHealth: {
			averageTaskAge,
			averageCompletionMinutes,
			completionSampleCount,
			staleTasks: staleTasks.slice(0, 5), // Top 5 stale tasks
			atRiskTasks: atRiskTasks.slice(0, 5), // Top 5 at-risk tasks
			overdueTasks: overdueTasks.slice(0, 5), // Top 5 overdue tasks
			blockedTasks: blockedTasks.slice(0, 5), // Top 5 blocked tasks
		},
		completionHeatmap,
	};
}
