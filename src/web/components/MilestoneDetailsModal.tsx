import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { type Milestone, type Task } from "../../types";
import Modal from "./Modal";
import MilestoneTaskRow from "./MilestoneTaskRow";
import MermaidMarkdown from "./MermaidMarkdown";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import { apiClient } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../hooks/useI18n";
import { isTypingTarget } from "../utils/keyboard";
import { extractTempImageUrls, replaceTempImageUrls } from "../utils/temp-assets";
import { isDoneStatus, milestoneKey } from "../utils/milestones";
import {
	dateTimeLocalToStoredUtc,
	parseStoredUtcDate,
	storedUtcToDateTimeLocal,
} from "../utils/date-display";
import { compareTaskIds, groupSubtasksUnderParents, sortByOrdinal } from "../../utils/task-sorting";
import { stripAnyPrefix } from "../../utils/prefix-config";

interface Props {
	milestoneId: string | null;
	milestone?: Milestone | null; // resolved from loaded entities; modal fetches when missing
	tasks: Task[];
	milestoneEntities?: Milestone[]; // active milestones (remove-dialog reassign options)
	isOpen: boolean;
	onClose: () => void;
	onEditTask: (task: Task) => void;
	onRefreshData?: () => Promise<void> | void;
}

type Mode = "preview" | "edit";

type TaskSortColumn = "id" | "title" | "status" | "priority" | "created";
type TaskSortDirection = "asc" | "desc";

interface TaskSortConfig {
	column: TaskSortColumn;
	direction: TaskSortDirection;
}

type RemoveTaskHandling = "clear" | "reassign";

const TASK_PRIORITY_RANK: Record<string, number> = {
	high: 3,
	medium: 2,
	low: 1,
};

const compareTaskIdsAscending = (a: Task, b: Task): number => compareTaskIds(a.id, b.id);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
	<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors duration-200">
		{title}
	</h3>
);

const dateInputClass =
	"w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]";

export const MilestoneDetailsModal: React.FC<Props> = ({
	milestoneId,
	milestone,
	tasks,
	milestoneEntities,
	isOpen,
	onClose,
	onEditTask,
	onRefreshData,
}) => {
	const { theme } = useTheme();
	const { t } = useI18n();
	const navigate = useNavigate();
	const [mode, setMode] = useState<Mode>("preview");
	const [fetchedMilestone, setFetchedMilestone] = useState<Milestone | null>(null);
	const activeMilestone = milestone ?? fetchedMilestone;

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [plannedStart, setPlannedStart] = useState("");
	const [plannedEnd, setPlannedEnd] = useState("");
	const [actualStart, setActualStart] = useState("");
	const [actualEnd, setActualEnd] = useState("");
	const [saving, setSaving] = useState(false);
	const [archiving, setArchiving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [sortConfig, setSortConfig] = useState<TaskSortConfig | null>(null);

	const [showRemove, setShowRemove] = useState(false);
	const [removeTaskHandling, setRemoveTaskHandling] = useState<RemoveTaskHandling>("clear");
	const [removeReassignTo, setRemoveReassignTo] = useState("");
	const [removing, setRemoving] = useState(false);

	// Fetch fallback when the milestone is not present in the loaded entities
	useEffect(() => {
		if (!isOpen || !milestoneId || milestone) return;
		let cancelled = false;
		apiClient
			.fetchMilestone(milestoneId)
			.then((result) => {
				if (!cancelled) setFetchedMilestone(result);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : t.milestones.loadError);
			});
		return () => {
			cancelled = true;
		};
	}, [isOpen, milestoneId, milestone, t]);

	// Reset local state when the opened milestone changes
	useEffect(() => {
		setName(activeMilestone?.title || "");
		setDescription(activeMilestone?.description || "");
		setDueDate(activeMilestone?.dueDate || "");
		setPlannedStart(activeMilestone?.plannedStart || "");
		setPlannedEnd(activeMilestone?.plannedEnd || "");
		setActualStart(activeMilestone?.actualStart || "");
		setActualEnd(activeMilestone?.actualEnd || "");
		setMode("preview");
		setSortConfig(null);
		setShowRemove(false);
		setError(null);
		// biome-ignore lint/correctness/useExhaustiveDependencies: only reset when the opened milestone changes, not on every content refresh
	}, [isOpen, milestoneId]);

	const milestoneTasks = useMemo(() => {
		const key = milestoneKey(activeMilestone?.id ?? "");
		if (!key) return [];
		return tasks.filter((task) => milestoneKey(task.milestone) === key);
	}, [tasks, activeMilestone]);

	const doneCount = useMemo(() => milestoneTasks.filter((task) => isDoneStatus(task.status)).length, [milestoneTasks]);
	const progress = milestoneTasks.length > 0 ? Math.round((doneCount / milestoneTasks.length) * 100) : 0;

	const baseline = useMemo(
		() => ({
			name: activeMilestone?.title || "",
			description: activeMilestone?.description || "",
			dueDate: activeMilestone?.dueDate || "",
			plannedStart: activeMilestone?.plannedStart || "",
			plannedEnd: activeMilestone?.plannedEnd || "",
			actualStart: activeMilestone?.actualStart || "",
			actualEnd: activeMilestone?.actualEnd || "",
		}),
		[activeMilestone],
	);

	const isDirty = useMemo(() => description !== baseline.description, [description, baseline]);

	const handleCancelEdit = useCallback(() => {
		if (isDirty && !window.confirm(t.taskDetails.unsavedChangesPrompt)) return;
		setName(baseline.name);
		setDescription(baseline.description);
		setDueDate(baseline.dueDate);
		setPlannedStart(baseline.plannedStart);
		setPlannedEnd(baseline.plannedEnd);
		setActualStart(baseline.actualStart);
		setActualEnd(baseline.actualEnd);
		setMode("preview");
		setError(null);
	}, [isDirty, baseline, t]);

	// Links inside the modal (Board/List buttons, task links in markdown) leave this
	// milestone behind, so they ask the same question cancel does before the navigation happens.
	const confirmNavigationAwayFromEdits = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!isDirty || event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
		if (!link) return;
		if (link.target && link.target !== "_self") return;
		const destination = new URL(link.href, window.location.href);
		if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
		if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
		if (window.confirm(t.taskDetails.discardAndClosePrompt)) return;
		event.preventDefault();
		event.stopPropagation();
	};

	const confirmLeaveWithUnsavedEdits = (): boolean => !isDirty || window.confirm(t.taskDetails.discardAndClosePrompt);

	const saveMeta = async (updates: {
		name?: string;
		dueDate?: string;
		plannedStart?: string;
		plannedEnd?: string;
		actualStart?: string;
		actualEnd?: string;
	}) => {
		if (!activeMilestone) return;
		const nextName = updates.name ?? name;
		if (!nextName.trim()) {
			setError(t.milestones.nameRequired);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await apiClient.updateMilestone(
				activeMilestone.id,
				nextName.trim(),
				updates.dueDate ?? dueDate,
				updates.plannedStart ?? plannedStart,
				updates.plannedEnd ?? plannedEnd,
				updates.actualStart ?? actualStart,
				updates.actualEnd ?? actualEnd,
			);
			setFetchedMilestone(null);
			if (onRefreshData) await onRefreshData();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.milestones.editError);
		} finally {
			setSaving(false);
		}
	};

	const handleSave = async () => {
		if (!activeMilestone) return;
		const value = name.trim();
		if (!value) {
			setError(t.milestones.nameRequired);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			let saveDescription = description;
			const tempUrls = extractTempImageUrls(description);
			if (tempUrls.length > 0) {
				const mapping = await apiClient.promoteAssets(tempUrls);
				saveDescription = replaceTempImageUrls(description, mapping);
				setDescription(saveDescription);
			}
			await apiClient.updateMilestone(
				activeMilestone.id,
				value,
				dueDate.trim(),
				plannedStart.trim(),
				plannedEnd.trim(),
				actualStart.trim(),
				actualEnd.trim(),
				saveDescription,
			);
			setMode("preview");
			setFetchedMilestone(null);
			if (onRefreshData) await onRefreshData();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.milestones.editError);
		} finally {
			setSaving(false);
		}
	};

	const handleArchive = async () => {
		if (!activeMilestone) return;
		const label = activeMilestone.title || activeMilestone.id;
		if (!window.confirm(t.milestones.archiveConfirm(label))) return;
		setArchiving(true);
		setError(null);
		try {
			await apiClient.archiveMilestone(activeMilestone.id);
			if (onRefreshData) await onRefreshData();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.milestones.archiveError);
		} finally {
			setArchiving(false);
		}
	};

	const removeReassignOptions = useMemo(
		() =>
			(milestoneEntities ?? []).filter(
				(candidate) => milestoneKey(candidate.id) !== milestoneKey(activeMilestone?.id ?? ""),
			),
		[milestoneEntities, activeMilestone],
	);

	const openRemoveModal = () => {
		setRemoveTaskHandling("clear");
		setRemoveReassignTo(removeReassignOptions[0]?.id ?? "");
		setShowRemove(true);
		setError(null);
	};

	const handleRemove = async () => {
		if (!activeMilestone) return;
		if (removeTaskHandling === "reassign" && !removeReassignTo) {
			setError(t.milestones.reassignRequired);
			return;
		}
		setRemoving(true);
		setError(null);
		try {
			await apiClient.removeMilestone(activeMilestone.id, {
				taskHandling: removeTaskHandling,
				reassignTo: removeTaskHandling === "reassign" ? removeReassignTo : undefined,
			});
			if (onRefreshData) await onRefreshData();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : t.milestones.removeError);
		} finally {
			setRemoving(false);
		}
	};

	const handleTaskClick = useCallback(
		(taskId: string) => {
			const target = milestoneTasks.find(
				(task) => stripAnyPrefix(task.id) === taskId || task.id === taskId,
			);
			if (target) {
				onEditTask(target);
			} else {
				if (!confirmLeaveWithUnsavedEdits()) return;
				navigate(`/task/${taskId}`);
			}
		},
		[milestoneTasks, onEditTask, navigate, confirmLeaveWithUnsavedEdits],
	);

	const noopDrag = useCallback(() => {}, []);

	// Escape cancels edit (not close) in edit mode; Cmd/Ctrl+S saves
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (mode === "edit" && e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				handleCancelEdit();
			}
			if (mode === "edit" && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				e.stopPropagation();
				void handleSave();
			}
			if (mode !== "preview" || isTypingTarget(e)) return;
			if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				e.stopPropagation();
				setMode("edit");
			}
		};
		window.addEventListener("keydown", onKey, { capture: true });
		return () => window.removeEventListener("keydown", onKey, { capture: true } as unknown as EventListenerOptions);
	}, [
		mode,
		isDirty,
		handleCancelEdit,
		baseline,
		activeMilestone,
		name,
		description,
		dueDate,
		plannedStart,
		plannedEnd,
		actualStart,
		actualEnd,
		onRefreshData,
		t,
	]);

	const getStatusBadgeClass = (status?: string | null) => {
		const normalized = (status ?? "").toLowerCase();
		if (normalized.includes("done") || normalized.includes("complete")) {
			return "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300";
		}
		if (normalized.includes("progress")) {
			return "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300";
		}
		return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300";
	};

	const getPriorityBadgeClass = (priority?: string) => {
		switch (priority?.toLowerCase()) {
			case "high":
				return "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300";
			case "medium":
				return "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300";
			case "low":
				return "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300";
			default:
				return "";
		}
	};

	const handleSortChange = (column: TaskSortColumn) => {
		setSortConfig((current) => {
			if (current?.column === column) {
				if (current.direction === "asc") return { column, direction: "desc" };
				return null;
			}
			return { column, direction: "asc" };
		});
	};

	const renderSortIcon = (column: TaskSortColumn) => {
		const isActive = sortConfig?.column === column;
		const isAsc = sortConfig?.direction === "asc";
		return (
			<span className="inline-flex items-center justify-center w-4 text-xs select-none" aria-hidden="true">
				<span className={isActive && isAsc ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"}>
					↑
				</span>
				<span className={isActive && !isAsc ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"}>
					↓
				</span>
			</span>
		);
	};

	const getSortedTasks = (taskList: Task[]): Task[] => {
		const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
		const withDirection = (value: number) => (sortConfig?.direction === "asc" ? value : -value);

		if (!sortConfig) {
			return sortByOrdinal(taskList);
		}

		if (sortConfig.column === "id") {
			const sorted = taskList.slice().sort((a, b) => withDirection(compareTaskIdsAscending(a, b)));
			return groupSubtasksUnderParents(sorted, compareTaskIdsAscending, undefined, sortConfig.direction);
		}

		return taskList.slice().sort((a, b) => {
			let result = 0;
			switch (sortConfig.column) {
				case "title": {
					result = withDirection(collator.compare(a.title, b.title));
					break;
				}
				case "status": {
					result = withDirection(collator.compare(a.status, b.status));
					break;
				}
				case "priority": {
					const rankA = TASK_PRIORITY_RANK[(a.priority ?? "").toLowerCase()] ?? 0;
					const rankB = TASK_PRIORITY_RANK[(b.priority ?? "").toLowerCase()] ?? 0;
					result = withDirection(rankA - rankB);
					break;
				}
				case "created": {
					const createdA = parseStoredUtcDate(a.createdDate)?.getTime();
					const createdB = parseStoredUtcDate(b.createdDate)?.getTime();
					if (createdA === undefined && createdB === undefined) {
						result = 0;
					} else if (createdA === undefined) {
						result = 1;
					} else if (createdB === undefined) {
						result = -1;
					} else {
						result = withDirection(createdA - createdB);
					}
					break;
				}
			}
			if (result !== 0) return result;
			return compareTaskIdsAscending(b, a);
		});
	};

	const renderTaskTableHeader = () => (
		<div className="grid grid-cols-[1.5rem_5rem_1fr_5rem_5rem_5rem] gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
			<div />
			<button
				type="button"
				onClick={() => handleSortChange("id")}
				className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 text-left"
			>
				ID {renderSortIcon("id")}
			</button>
			<button
				type="button"
				onClick={() => handleSortChange("title")}
				className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 text-left"
			>
				{t.milestones.tableHeaders.title} {renderSortIcon("title")}
			</button>
			<button
				type="button"
				onClick={() => handleSortChange("status")}
				className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 justify-center"
			>
				{t.milestones.tableHeaders.status} {renderSortIcon("status")}
			</button>
			<button
				type="button"
				onClick={() => handleSortChange("priority")}
				className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 justify-center"
			>
				{t.milestones.tableHeaders.priority} {renderSortIcon("priority")}
			</button>
			<button
				type="button"
				onClick={() => handleSortChange("created")}
				className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100 justify-center"
			>
				{t.milestones.tableHeaders.created} {renderSortIcon("created")}
			</button>
		</div>
	);

	const milestoneIdSegment = encodeURIComponent(activeMilestone?.id ?? milestoneId ?? "");

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={() => {
					if (mode === "edit" && isDirty) {
						if (!window.confirm(t.taskDetails.discardAndClosePrompt)) return;
					}
					onClose();
				}}
				title={activeMilestone ? activeMilestone.title : t.milestones.loading}
				maxWidthClass="max-w-5xl"
				disableEscapeClose={mode === "edit"}
				actions={
					activeMilestone ? (
						<div className="flex items-center gap-2">
							{mode === "preview" ? (
								<>
									<Link
										to={`/?lane=milestone&milestone=${milestoneIdSegment}`}
										onClick={(event) => {
											if (!confirmLeaveWithUnsavedEdits()) event.preventDefault();
										}}
										className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									>
										{t.milestones.board}
									</Link>
									<Link
										to={`/tasks?milestone=${milestoneIdSegment}`}
										onClick={(event) => {
											if (!confirmLeaveWithUnsavedEdits()) event.preventDefault();
										}}
										className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
									>
										{t.milestones.list}
									</Link>
									<button
										type="button"
										onClick={() => setMode("edit")}
										disabled={saving}
										className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
									>
										{t.common.edit}
									</button>
									<button
										type="button"
										onClick={() => void handleArchive()}
										disabled={saving || archiving}
										className="inline-flex items-center px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-60"
									>
										{archiving ? t.common.archiving : t.milestones.archive}
									</button>
									<button
										type="button"
										onClick={openRemoveModal}
										disabled={saving}
										className="inline-flex items-center px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
									>
										{t.common.remove}
									</button>
								</>
							) : (
								<>
									<button
										type="button"
										onClick={handleCancelEdit}
										className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
										title={t.common.cancel}
									>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
										</svg>
										{t.common.cancel}
									</button>
									<button
										type="button"
										onClick={() => void handleSave()}
										disabled={saving || !name.trim()}
										className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:opacity-50"
										title={t.common.save}
									>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
										{saving ? t.common.saving : t.common.save}
									</button>
								</>
							)}
						</div>
					) : undefined
				}
			>
				{error && <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

				{!activeMilestone ? (
					<div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t.milestones.loading}</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6" onClickCapture={confirmNavigationAwayFromEdits}>
						{/* Main content */}
						<div className="md:col-span-2 space-y-6">
							<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
								<SectionHeader title={t.milestones.descriptionLabel} />
								{mode === "preview" ? (
									description ? (
										<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
											<MermaidMarkdown
												source={description}
												onTaskClick={handleTaskClick}
												onDraftClick={(draftId) => {
													if (!confirmLeaveWithUnsavedEdits()) return;
													navigate(`/draft/${draftId}`);
												}}
												wikilinkBasePath="index.md"
											/>
										</div>
									) : (
										<div className="text-sm text-gray-500 dark:text-gray-400">{t.milestones.noDescription}</div>
									)
								) : (
									<div className="border border-gray-200 dark:border-gray-700 rounded-md">
										<PasteAwareMDEditor
											value={description}
											onChange={(val) => setDescription(val || "")}
											preview="edit"
											height={300}
											data-color-mode={theme}
										/>
									</div>
								)}
							</div>
						</div>

						{/* Sidebar metadata */}
						<div className="space-y-6">
							<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
								<SectionHeader title={t.taskDetails.section.title} />
								<input
									type="text"
									value={name}
									onChange={(e) => {
										setName(e.target.value);
										if (error) setError(null);
									}}
									onBlur={() => {
										if (!name.trim()) {
											setName(baseline.name);
											return;
										}
										if (name.trim() !== (activeMilestone?.title || "")) {
											void saveMeta({ name });
										}
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.currentTarget.blur();
										}
									}}
									className={dateInputClass}
								/>
								<p className="text-xs text-gray-500 dark:text-gray-400">{t.milestones.renameHint}</p>
							</div>

							<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
								<SectionHeader title={t.milestones.progressLabel} />
								<div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
									<div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-gray-500 dark:text-gray-400">
										{milestoneTasks.length}{" "}
										{milestoneTasks.length === 1 ? t.milestones.taskSingular : t.milestones.taskPlural}
									</span>
									<span className="font-bold text-emerald-600 dark:text-emerald-400">{progress}%</span>
								</div>
							</div>

							<div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
								<SectionHeader title={t.milestones.datesLabel} />
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{t.taskDetails.section.dueDate}
									</label>
									<input
										type="date"
										value={dueDate}
										onChange={(e) => {
											const value = e.target.value;
											setDueDate(value);
											void saveMeta({ dueDate: value });
										}}
										className={dateInputClass}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{t.taskDetails.section.plannedStart}
									</label>
									<input
										type="date"
										value={plannedStart}
										onChange={(e) => {
											const value = e.target.value;
											setPlannedStart(value);
											void saveMeta({ plannedStart: value });
										}}
										className={dateInputClass}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{t.taskDetails.section.plannedEnd}
									</label>
									<input
										type="date"
										value={plannedEnd}
										onChange={(e) => {
											const value = e.target.value;
											setPlannedEnd(value);
											void saveMeta({ plannedEnd: value });
										}}
										className={dateInputClass}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{t.taskDetails.section.actualStart}
									</label>
									<input
										type="datetime-local"
										value={storedUtcToDateTimeLocal(actualStart)}
										onChange={(e) => {
											const value = dateTimeLocalToStoredUtc(e.target.value);
											setActualStart(value);
											void saveMeta({ actualStart: value });
										}}
										className={dateInputClass}
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{t.taskDetails.section.actualEnd}
									</label>
									<input
										type="datetime-local"
										value={storedUtcToDateTimeLocal(actualEnd)}
										onChange={(e) => {
											const value = dateTimeLocalToStoredUtc(e.target.value);
											setActualEnd(value);
											void saveMeta({ actualEnd: value });
										}}
										className={dateInputClass}
									/>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Task list */}
				{activeMilestone && (
					<div className="mt-6">
						<div className="mb-3 flex items-center justify-between">
							<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
								{t.milestones.tasksSection}
							</h3>
							<span className="text-xs text-gray-500 dark:text-gray-400">
								{doneCount}/{milestoneTasks.length}
							</span>
						</div>
						{milestoneTasks.length === 0 ? (
							<p className="rounded-md border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
								{t.milestones.noTasks}
							</p>
						) : (
							<div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
								<div className="divide-y divide-gray-200 dark:divide-gray-700">
									{renderTaskTableHeader()}
									{getSortedTasks(milestoneTasks).map((task) => (
										<MilestoneTaskRow
											key={task.id}
											task={task}
											isDone={isDoneStatus(task.status)}
											statusBadgeClass={getStatusBadgeClass(task.status)}
											priorityBadgeClass={getPriorityBadgeClass(task.priority)}
											onEditTask={onEditTask}
											onDragStart={noopDrag}
											onDragEnd={noopDrag}
										/>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</Modal>

			{/* Remove confirmation */}
			<Modal
				isOpen={showRemove}
				onClose={() => setShowRemove(false)}
				title={t.milestones.removeTitle}
				maxWidthClass="max-w-md"
			>
				<div className="space-y-4">
					<p className="text-sm text-gray-600 dark:text-gray-300">
						{t.milestones.removeDescription(activeMilestone?.title ?? "")}
					</p>
					<div className="space-y-3">
						<label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
							<input
								type="radio"
								name="milestone-details-remove-handling"
								value="clear"
								checked={removeTaskHandling === "clear"}
								onChange={() => setRemoveTaskHandling("clear")}
								className="mt-0.5"
							/>
							<span>
								<span className="block font-medium text-gray-900 dark:text-gray-100">
									{t.milestones.leaveUnassigned}
								</span>
								<span className="block text-xs text-gray-500 dark:text-gray-400">
									{t.milestones.leaveUnassignedDesc}
								</span>
							</span>
						</label>
						<label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm text-gray-700 dark:text-gray-200">
							<input
								type="radio"
								name="milestone-details-remove-handling"
								value="reassign"
								checked={removeTaskHandling === "reassign"}
								disabled={removeReassignOptions.length === 0}
								onChange={() => setRemoveTaskHandling("reassign")}
								className="mt-0.5"
							/>
							<span className="flex-1">
								<span className="block font-medium text-gray-900 dark:text-gray-100">
									{t.milestones.reassignTasks}
								</span>
								<span className="block text-xs text-gray-500 dark:text-gray-400">
									{t.milestones.reassignTasksDesc}
								</span>
								<select
									value={removeReassignTo}
									onChange={(event) => setRemoveReassignTo(event.target.value)}
									disabled={removeTaskHandling !== "reassign" || removeReassignOptions.length === 0}
									className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
								>
									{removeReassignOptions.map((candidate) => (
										<option key={candidate.id} value={candidate.id}>
											{candidate.title}
										</option>
									))}
								</select>
							</span>
						</label>
					</div>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => setShowRemove(false)}
							className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						>
							{t.common.cancel}
						</button>
						<button
							type="button"
							onClick={() => void handleRemove()}
							disabled={removing || (removeTaskHandling === "reassign" && !removeReassignTo)}
							className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
						>
							{removing ? t.common.removing : t.milestones.remove}
						</button>
					</div>
				</div>
			</Modal>
		</>
	);
};

export default MilestoneDetailsModal;
