import React, { useMemo, useState } from "react";
import type { Task } from "../../types";
import { canonicalTaskId } from "../../utils/task-id";
import { sortByTaskId } from "../../utils/task-sorting";
import { useI18n } from "../hooks/useI18n";
import { getStatusBadgeColor } from "../utils/task-badge-colors";

interface TaskHierarchySectionProps {
	task: Task;
	availableTasks: Task[];
	onTaskClick: (taskId: string) => void;
}

const isTaskDone = (status?: string) => (status || "").toLowerCase().includes("done");

export const TaskHierarchySection: React.FC<TaskHierarchySectionProps> = ({ task, availableTasks, onTaskClick }) => {
	const { t } = useI18n();
	const [isCollapsed, setIsCollapsed] = useState(false);

	const parentTask = useMemo(
		() =>
			task.parentTaskId
				? availableTasks.find((candidate) => canonicalTaskId(candidate.id) === canonicalTaskId(task.parentTaskId ?? ""))
				: undefined,
		[task, availableTasks],
	);

	const subtaskTasks = useMemo(() => {
		const children = availableTasks.filter(
			(candidate) => candidate.parentTaskId && canonicalTaskId(candidate.parentTaskId) === canonicalTaskId(task.id),
		);
		return sortByTaskId(children);
	}, [task, availableTasks]);

	if (!parentTask && subtaskTasks.length === 0) return null;

	const doneCount = subtaskTasks.filter((subtask) => isTaskDone(subtask.status)).length;
	const progress = subtaskTasks.length === 0 ? 0 : Math.round((doneCount / subtaskTasks.length) * 100);

	return (
		<div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-3">
			{parentTask && (
				<button
					type="button"
					onClick={() => onTaskClick(parentTask.id)}
					className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
				>
					<svg
						className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
					</svg>
					<span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
						{t.taskDetails.section.parent}
					</span>
					<span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-200">{parentTask.id}</span>
					<span className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">{parentTask.title}</span>
					<span
						className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded ${getStatusBadgeColor(parentTask.status)}`}
					>
						{parentTask.status}
					</span>
				</button>
			)}

			{parentTask && subtaskTasks.length > 0 && <div className="border-t border-gray-200 dark:border-gray-700" />}

			{subtaskTasks.length > 0 && (
				<div>
					<button
						type="button"
						onClick={() => setIsCollapsed((current) => !current)}
						aria-expanded={!isCollapsed}
						aria-label={isCollapsed ? t.common.expand : t.common.collapse}
						className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
					>
						<svg
							className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
						</svg>
						<span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
							{t.taskDetails.section.subtasks}
						</span>
						<span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
							{doneCount}/{subtaskTasks.length}
						</span>
						<div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
							<div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
						</div>
						<svg
							className={`w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					{!isCollapsed && (
						<ul className="mt-2 space-y-1">
							{subtaskTasks.map((subtask) => (
								<li key={subtask.id}>
									<button
										type="button"
										onClick={() => onTaskClick(subtask.id)}
										className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
									>
										{isTaskDone(subtask.status) ? (
											<svg
												className="w-4 h-4 flex-shrink-0 text-emerald-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
										) : (
											<svg
												className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												aria-hidden="true"
											>
												<circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
											</svg>
										)}
										<span className="flex-shrink-0 text-sm font-medium text-gray-700 dark:text-gray-200">
											{subtask.id}
										</span>
										<span className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">{subtask.title}</span>
										<span
											className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded ${getStatusBadgeColor(subtask.status)}`}
										>
											{subtask.status}
										</span>
										<svg
											className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
};

export default TaskHierarchySection;
