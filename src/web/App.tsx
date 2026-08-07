import React, { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useMatch, useNavigate } from "react-router-dom";
import type {
	BacklogConfig,
	Decision,
	DecisionSearchResult,
	DocsTreeNode,
	Document,
	DocumentSearchResult,
	Milestone,
	SearchResult,
	Task,
	TaskSearchResult,
	WikiTreeNode,
} from "../types";
import { collectAvailableLabels } from "../utils/label-filter";
import { stripAnyPrefix } from "../utils/prefix-config";
import BoardPage from "./components/BoardPage";
import DecisionDetail from "./components/DecisionDetail";
import DocumentationDetail from "./components/DocumentationDetail";
import DraftsList from "./components/DraftsList";
import GanttView from "./components/GanttView";
import InitializationScreen from "./components/InitializationScreen";
import Layout from "./components/Layout";
import MilestonesPage from "./components/MilestonesPage";
import Settings from "./components/Settings";
import Statistics from "./components/Statistics";
import DuplicateTaskRepairModal from "./components/DuplicateTaskRepairModal";
import { SuccessToast } from "./components/SuccessToast";
import TaskDetailsModal from "./components/TaskDetailsModal";
import TaskList from "./components/TaskList";
import WikiDetail from "./components/WikiDetail";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import { useHealthCheckContext } from "./contexts/HealthCheckContext";
import { useI18n } from "./hooks/useI18n";
import { useI18nContext } from "./contexts/I18nContext";
import { ImageLightboxProvider } from "./contexts/ImageLightboxContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { apiClient } from "./lib/api";
import { isValidLocale } from "./locales";
import { collectArchivedMilestoneKeys, collectMilestoneIds, milestoneKey } from "./utils/milestones";
import { sanitizeUrlTitle } from "./utils/urlHelpers";
import { getWebVersion } from "./utils/version";

const buildMilestoneAliasMap = (milestones: Milestone[], archivedMilestones: Milestone[]): Map<string, string> => {
	const aliasMap = new Map<string, string>();
	const collectIdAliasKeys = (value: string): string[] => {
		const normalized = value.trim();
		const normalizedKey = normalized.toLowerCase();
		if (!normalizedKey) return [];
		const keys = new Set<string>([normalizedKey]);
		if (/^\d+$/.test(normalized)) {
			const numericAlias = String(Number.parseInt(normalized, 10));
			keys.add(numericAlias);
			keys.add(`m-${numericAlias}`);
			return Array.from(keys);
		}
		const idMatch = normalized.match(/^m-(\d+)$/i);
		if (idMatch?.[1]) {
			const numericAlias = String(Number.parseInt(idMatch[1], 10));
			keys.add(`m-${numericAlias}`);
			keys.add(numericAlias);
		}
		return Array.from(keys);
	};
	const reservedIdKeys = new Set<string>();
	for (const milestone of [...milestones, ...archivedMilestones]) {
		for (const key of collectIdAliasKeys(milestone.id)) {
			reservedIdKeys.add(key);
		}
	}
	const setAlias = (aliasKey: string, id: string, allowOverwrite: boolean) => {
		const existing = aliasMap.get(aliasKey);
		if (!existing) {
			aliasMap.set(aliasKey, id);
			return;
		}
		if (!allowOverwrite) {
			return;
		}
		const existingKey = existing.toLowerCase();
		const nextKey = id.toLowerCase();
		const preferredRawId = /^\d+$/.test(aliasKey) ? `m-${aliasKey}` : /^m-\d+$/.test(aliasKey) ? aliasKey : null;
		if (preferredRawId) {
			const existingIsPreferred = existingKey === preferredRawId;
			const nextIsPreferred = nextKey === preferredRawId;
			if (existingIsPreferred && !nextIsPreferred) {
				return;
			}
			if (nextIsPreferred && !existingIsPreferred) {
				aliasMap.set(aliasKey, id);
			}
			return;
		}
		aliasMap.set(aliasKey, id);
	};
	const addIdAliases = (id: string, allowOverwrite = true) => {
		const idKey = id.toLowerCase();
		setAlias(idKey, id, allowOverwrite);
		const idMatch = id.match(/^m-(\d+)$/i);
		if (!idMatch?.[1]) return;
		const numericAlias = String(Number.parseInt(idMatch[1], 10));
		const canonicalId = `m-${numericAlias}`;
		setAlias(canonicalId, id, allowOverwrite);
		setAlias(numericAlias, id, allowOverwrite);
	};
	const activeTitleCounts = new Map<string, number>();
	for (const milestone of milestones) {
		const title = milestone.title.trim();
		if (!title) continue;
		const titleKey = title.toLowerCase();
		activeTitleCounts.set(titleKey, (activeTitleCounts.get(titleKey) ?? 0) + 1);
	}
	const activeTitleKeys = new Set(activeTitleCounts.keys());

	for (const milestone of milestones) {
		const id = milestone.id.trim();
		const title = milestone.title.trim();
		if (!id) continue;
		addIdAliases(id);
		if (title && !reservedIdKeys.has(title.toLowerCase()) && activeTitleCounts.get(title.toLowerCase()) === 1) {
			const titleKey = title.toLowerCase();
			if (!aliasMap.has(titleKey)) {
				aliasMap.set(titleKey, id);
			}
		}
	}

	const archivedTitleCounts = new Map<string, number>();
	for (const milestone of archivedMilestones) {
		const title = milestone.title.trim();
		if (!title) continue;
		const titleKey = title.toLowerCase();
		if (activeTitleKeys.has(titleKey)) continue;
		archivedTitleCounts.set(titleKey, (archivedTitleCounts.get(titleKey) ?? 0) + 1);
	}
	for (const milestone of archivedMilestones) {
		const id = milestone.id.trim();
		const title = milestone.title.trim();
		if (!id) continue;
		addIdAliases(id, false);
		const titleKey = title.toLowerCase();
		if (
			title &&
			!activeTitleKeys.has(titleKey) &&
			!reservedIdKeys.has(titleKey) &&
			archivedTitleCounts.get(titleKey) === 1
		) {
			if (!aliasMap.has(titleKey)) {
				aliasMap.set(titleKey, id);
			}
		}
	}
	return aliasMap;
};

const canonicalizeMilestone = (value: string | null | undefined, aliasMap?: Map<string, string>): string => {
	const normalized = (value ?? "").trim();
	if (!normalized) return "";
	const direct = aliasMap?.get(milestoneKey(normalized));
	if (direct) {
		return direct;
	}
	const idMatch = normalized.match(/^m-(\d+)$/i);
	if (idMatch?.[1]) {
		const numericAlias = String(Number.parseInt(idMatch[1], 10));
		return aliasMap?.get(`m-${numericAlias}`) ?? aliasMap?.get(numericAlias) ?? normalized;
	}
	if (/^\d+$/.test(normalized)) {
		const numericAlias = String(Number.parseInt(normalized, 10));
		return aliasMap?.get(`m-${numericAlias}`) ?? aliasMap?.get(numericAlias) ?? normalized;
	}
	return normalized;
};

function App() {
	return (
		<ThemeProvider>
			<BrowserRouter>
				<ImageLightboxProvider>
					<AppContent />
				</ImageLightboxProvider>
			</BrowserRouter>
		</ThemeProvider>
	);
}

function AppContent() {
	const location = useLocation();
	const navigate = useNavigate();
	const state = location.state as { backgroundLocation?: Location } | null;
	const taskRouteMatch = useMatch("/task/:id");
	const taskRouteMatchWildcard = useMatch("/task/:id/*");
	const taskIdFromUrl = taskRouteMatch?.params?.id ?? taskRouteMatchWildcard?.params?.id;

	const draftRouteMatch = useMatch("/draft/:id");
	const draftRouteMatchWildcard = useMatch("/draft/:id/*");
	const draftIdFromUrl = draftRouteMatch?.params?.id ?? draftRouteMatchWildcard?.params?.id;

	const [showModal, setShowModal] = useState(false);
	const [editingTask, setEditingTask] = useState<Task | null>(null);
	const [taskHistory, setTaskHistory] = useState<Task[]>([]);
	const taskHistoryRef = useRef<Task[]>([]);
	useEffect(() => {
		taskHistoryRef.current = taskHistory;
	}, [taskHistory]);
	const [isDraftMode, setIsDraftMode] = useState(false);
	const [statuses, setStatuses] = useState<string[]>([]);
	const [availableLabels, setAvailableLabels] = useState<string[]>([]);
	const [projectName, setProjectName] = useState<string>("");
	const [config, setConfig] = useState<BacklogConfig | null>(null);
	const labelColors = config?.labelColors;
	const [milestones, setMilestones] = useState<string[]>([]);
	const [milestoneEntities, setMilestoneEntities] = useState<Milestone[]>([]);
	const [archivedMilestones, setArchivedMilestones] = useState<Milestone[]>([]);
	const [showSuccessToast, setShowSuccessToast] = useState(false);
	const [taskConfirmation, setTaskConfirmation] = useState<{ task: Task; isDraft: boolean } | null>(null);

	// Initialization state
	const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

	// Centralized data state
	const [tasks, setTasks] = useState<Task[]>([]);
	const [drafts, setDrafts] = useState<Task[]>([]);
	const [docs, setDocs] = useState<Document[]>([]);
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [wikiTree, setWikiTree] = useState<WikiTreeNode[]>([]);
	const [docsTree, setDocsTree] = useState<DocsTreeNode[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [duplicatePlan, setDuplicatePlan] = useState<DuplicateRepairPlan | null>(null);
	const [showDuplicateRepairModal, setShowDuplicateRepairModal] = useState(false);

	const { isOnline } = useHealthCheckContext();
	const { t } = useI18n();
	const { setLocale } = useI18nContext();
	const previousOnlineRef = useRef<boolean | null>(null);
	const hasBeenRunningRef = useRef(false);

	// Set version data attribute on body
	React.useEffect(() => {
		getWebVersion().then((version) => {
			if (version) {
				document.body.setAttribute("data-version", `Backlog.md - v${version}`);
			}
		});
	}, []);

	// Check initialization status on mount
	React.useEffect(() => {
		const checkInitStatus = async () => {
			try {
				const status = await apiClient.checkStatus();
				setIsInitialized(status.initialized);
			} catch (error) {
				// If we can't check status, assume not initialized
				console.error("Failed to check initialization status:", error);
				setIsInitialized(false);
			}
		};
		checkInitStatus();
	}, []);

	const handleInitialized = useCallback(() => {
		setIsInitialized(true);
	}, []);

	const handleLabelColorsChange = useCallback(
		async (colors: Record<string, string>) => {
			if (!config) return;
			try {
				const updated = { ...config, labelColors: colors };
				await apiClient.updateConfig(updated);
				setConfig(updated);
			} catch (err) {
				console.error("Failed to update label colors:", err);
			}
		},
		[config],
	);

	const applySearchResults = useCallback(
		(results: SearchResult[], archivedMilestoneKeys?: Set<string>, milestoneAliases?: Map<string, string>) => {
			const taskResults = results.filter((result): result is TaskSearchResult => result.type === "task");
			const documentResults = results.filter((result): result is DocumentSearchResult => result.type === "document");
			const decisionResults = results.filter((result): result is DecisionSearchResult => result.type === "decision");

			const tasksList = taskResults.map((result) => result.task);
			const normalizedTasks =
				archivedMilestoneKeys && archivedMilestoneKeys.size > 0
					? tasksList.map((task) => {
							const canonicalMilestone = canonicalizeMilestone(task.milestone, milestoneAliases);
							const key = milestoneKey(canonicalMilestone);
							if (!key || !archivedMilestoneKeys.has(key)) {
								if (task.milestone === canonicalMilestone) {
									return task;
								}
								return { ...task, milestone: canonicalMilestone || undefined };
							}
							return { ...task, milestone: undefined };
						})
					: tasksList.map((task) => {
							const canonicalMilestone = canonicalizeMilestone(task.milestone, milestoneAliases);
							if (task.milestone === canonicalMilestone) {
								return task;
							}
							return { ...task, milestone: canonicalMilestone || undefined };
						});
			const docsList = documentResults.map((result) => result.document);
			const decisionsList = decisionResults.map((result) => result.decision);

			setTasks(normalizedTasks);
			setDocs(docsList);
			setDecisions(decisionsList);

			return { tasks: normalizedTasks, docs: docsList, decisions: decisionsList };
		},
		[],
	);

	const hasLoadedRef = useRef(false);

	const loadAllData = useCallback(async () => {
		const isFirstLoad = !hasLoadedRef.current;
		try {
			if (isFirstLoad) {
				setIsLoading(true);
			}
			const [
				statusesData,
				configData,
				searchResults,
				draftsData,
				milestonesData,
				archivedMilestonesData,
				wikiTreeData,
				docsTreeData,
			] = await Promise.all([
				apiClient.fetchStatuses(),
				apiClient.fetchConfig(),
				apiClient.search(),
				apiClient.fetchDrafts(),
				apiClient.fetchMilestones(),
				apiClient.fetchArchivedMilestones(),
				apiClient.fetchWikiTree(),
				apiClient.fetchDocsTree(),
			]);

			const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
			const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
			const { tasks: tasksList } = applySearchResults(searchResults, archivedKeys, milestoneAliases);

			setStatuses(statusesData);
			setProjectName(configData.projectName);
			setAvailableLabels(configData.labels || []);
			setConfig(configData);
			if (isFirstLoad && configData.locale && isValidLocale(configData.locale)) {
				setLocale(configData.locale);
			}
			setMilestoneEntities(milestonesData);
			setArchivedMilestones(archivedMilestonesData);
			setMilestones(
				collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
					(milestone) => !archivedKeys.has(milestoneKey(milestone)),
				),
			);
			setDrafts(draftsData);
			setWikiTree(wikiTreeData);
			setDocsTree(docsTreeData);

			try {
				const duplicatePreview = await apiClient.getDuplicateTaskIdsPreview();
				setDuplicatePlan(duplicatePreview);
			} catch (error) {
				console.error("Failed to load duplicate task ID preview:", error);
				setDuplicatePlan(null);
			}
		} catch (error) {
			console.error("Failed to load data:", error);
		} finally {
			if (isFirstLoad) {
				setIsLoading(false);
				hasLoadedRef.current = true;
			}
		}
	}, [applySearchResults]);

	React.useEffect(() => {
		// Only load data when initialized
		if (isInitialized === true) {
			loadAllData();
		}
	}, [loadAllData, isInitialized]);

	// Reload data when connection is restored
	React.useEffect(() => {
		if (isOnline && previousOnlineRef.current === false) {
			// Connection restored, reload data
			const loadData = async () => {
				try {
					const [results, milestonesData, archivedMilestonesData] = await Promise.all([
						apiClient.search(),
						apiClient.fetchMilestones(),
						apiClient.fetchArchivedMilestones(),
					]);
					const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
					const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
					const { tasks: tasksList } = applySearchResults(results, archivedKeys, milestoneAliases);
					setMilestoneEntities(milestonesData);
					setArchivedMilestones(archivedMilestonesData);
					setMilestones(
						collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
							(milestone) => !archivedKeys.has(milestoneKey(milestone)),
						),
					);

					try {
						const duplicatePreview = await apiClient.getDuplicateTaskIdsPreview();
						setDuplicatePlan(duplicatePreview);
					} catch (error) {
						console.error("Failed to reload duplicate task ID preview:", error);
						setDuplicatePlan(null);
					}
				} catch (error) {
					console.error("Failed to reload data:", error);
				}
			};
			loadData();
		}
	}, [applySearchResults, isOnline]);

	// Update document title when project name changes
	React.useEffect(() => {
		if (projectName) {
			document.title = `${projectName} - Task Management`;
		}
	}, [projectName]);

	// Mark that we've been running after initial load
	useEffect(() => {
		const timer = setTimeout(() => {
			hasBeenRunningRef.current = true;
		}, 2000); // Wait 2 seconds after page load
		return () => clearTimeout(timer);
	}, []);

	// Show success toast when connection is restored
	useEffect(() => {
		// Only show toast if:
		// 1. We went from offline to online AND
		// 2. We've been running for a while (not initial page load)
		if (isOnline && previousOnlineRef.current === false && hasBeenRunningRef.current) {
			setShowSuccessToast(true);
			// Auto-dismiss after 4 seconds
			const timer = setTimeout(() => {
				setShowSuccessToast(false);
			}, 4000);
			return () => clearTimeout(timer);
		}

		// Update the ref for next time
		previousOnlineRef.current = isOnline;
	}, [isOnline]);

	const getTaskUrlPath = useCallback((task: Task): string => {
		const slug = sanitizeUrlTitle(task.title);
		if (task.id.startsWith("DRAFT-")) {
			return `/draft/${stripAnyPrefix(task.id)}/${slug}`;
		}
		return `/task/${stripAnyPrefix(task.id)}/${slug}`;
	}, []);

	// Sync modal state with URL /task/:id and /draft/:id
	useEffect(() => {
		const idFromUrl = taskIdFromUrl || draftIdFromUrl;
		if (!idFromUrl) {
			if (showModal && editingTask) {
				// URL navigated away from /task/* or /draft/* (e.g. browser back) – close modal
				setShowModal(false);
				setEditingTask(null);
				setTaskHistory([]);
				setIsDraftMode(false);
			}
			return;
		}

		if (!isInitialized || isLoading) return;

		let matchedTask: Task | undefined;
		let matchedIsDraft = false;

		if (draftIdFromUrl) {
			matchedTask = drafts.find((d) => stripAnyPrefix(d.id) === draftIdFromUrl || d.id === draftIdFromUrl);
			matchedIsDraft = true;
		} else if (taskIdFromUrl) {
			matchedTask = tasks.find((t) => stripAnyPrefix(t.id) === taskIdFromUrl || t.id === taskIdFromUrl);
			matchedIsDraft = false;
		}

		if (matchedTask) {
			// Normalize bare URL to slugged /:type/:id/:title
			const expectedSlug = sanitizeUrlTitle(matchedTask.title);
			const currentSlug = draftIdFromUrl ? draftRouteMatchWildcard?.params["*"] : taskRouteMatchWildcard?.params["*"];
			if (currentSlug !== expectedSlug) {
				navigate(getTaskUrlPath(matchedTask), { replace: true, state: location.state });
			}

			if (!showModal) {
				setEditingTask(matchedTask);
				setTaskHistory([]);
				setIsDraftMode(matchedIsDraft);
				setShowModal(true);
			} else if (editingTask && editingTask.id !== matchedTask.id) {
				const topOfStack = taskHistoryRef.current[taskHistoryRef.current.length - 1];
				if (topOfStack?.id === idFromUrl || stripAnyPrefix(topOfStack?.id || "") === idFromUrl) {
					// Browser back/forward to parent task
					setTaskHistory((prev) => prev.slice(0, -1));
					setEditingTask(topOfStack || null);
					setIsDraftMode(topOfStack?.id?.startsWith("DRAFT-") ?? false);
				} else {
					// Drill down into dependency task
					setTaskHistory((prev) => [...prev, editingTask]);
					setEditingTask(matchedTask);
					setIsDraftMode(matchedIsDraft);
				}
			}
		} else if (!isLoading) {
			// Unknown task ID – fall back to home
			navigate("/", { replace: true });
		}
	}, [
		taskIdFromUrl,
		draftIdFromUrl,
		tasks,
		drafts,
		isInitialized,
		isLoading,
		showModal,
		editingTask,
		navigate,
		getTaskUrlPath,
	]);

	const handleOpenTask = useCallback(
		(task: Task) => {
			navigate(getTaskUrlPath(task), { state: { backgroundLocation: location } });
		},
		[navigate, location, getTaskUrlPath],
	);

	const handleNewTask = useCallback(() => {
		if (taskIdFromUrl) {
			const backgroundPath = state?.backgroundLocation
				? `${state.backgroundLocation.pathname}${state.backgroundLocation.search}`
				: "/";
			navigate(backgroundPath, { replace: true });
		}
		setEditingTask(null);
		setTaskHistory([]);
		setIsDraftMode(false);
		setShowModal(true);
	}, [taskIdFromUrl, navigate, state]);

	const handleNewDraft = useCallback(() => {
		if (taskIdFromUrl) {
			const backgroundPath = state?.backgroundLocation
				? `${state.backgroundLocation.pathname}${state.backgroundLocation.search}`
				: "/";
			navigate(backgroundPath, { replace: true });
		}
		setEditingTask(null);
		setTaskHistory([]);
		setIsDraftMode(true);
		setShowModal(true);
	}, [taskIdFromUrl, navigate, state]);

	const handlePromotedTask = useCallback(
		(task: Task) => {
			setEditingTask(task);
			setTaskHistory([]);
			setIsDraftMode(false);
			setShowModal(true);
			if (taskIdFromUrl || draftIdFromUrl) {
				navigate(getTaskUrlPath(task), {
					replace: true,
					state: { backgroundLocation: state?.backgroundLocation || location },
				});
			}
		},
		[taskIdFromUrl, draftIdFromUrl, navigate, state, location, getTaskUrlPath],
	);

	const handleDrillDown = useCallback(
		(task: Task) => {
			navigate(getTaskUrlPath(task), { state: { backgroundLocation: state?.backgroundLocation || location } });
		},
		[navigate, state, location, getTaskUrlPath],
	);

	const handleBack = useCallback(() => {
		const parentTask = taskHistoryRef.current[taskHistoryRef.current.length - 1];
		if (parentTask) {
			navigate(getTaskUrlPath(parentTask), { state: { backgroundLocation: state?.backgroundLocation || location } });
		}
	}, [navigate, state, location, getTaskUrlPath]);

	const handleCloseModal = useCallback(() => {
		if (taskIdFromUrl || draftIdFromUrl) {
			const backgroundPath = state?.backgroundLocation
				? `${state.backgroundLocation.pathname}${state.backgroundLocation.search}`
				: "/";
			navigate(backgroundPath, { replace: true });
		} else {
			setShowModal(false);
			setEditingTask(null);
			setTaskHistory([]);
			setIsDraftMode(false);
		}
	}, [navigate, state, taskIdFromUrl, draftIdFromUrl]);

	const refreshData = useCallback(async () => {
		await loadAllData();
	}, [loadAllData]);

	// Sync editingTask with refreshed tasks data to prevent stale state
	useEffect(() => {
		if (editingTask && showModal) {
			const updatedTask = tasks.find((t) => t.id === editingTask.id);
			if (updatedTask && updatedTask !== editingTask) {
				setEditingTask(updatedTask);
			}
		}
	}, [tasks, editingTask, showModal]);

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const ws = new WebSocket(`${protocol}//${window.location.host}`);
		ws.onmessage = (event) => {
			if (event.data === "tasks-updated") {
				refreshData();
			} else if (event.data === "config-updated") {
				// Reload statuses when config changes
				loadAllData();
			}
		};
		return () => ws.close();
	}, [refreshData, loadAllData]);

	const handleSubmitTask = async (taskData: Partial<Task>) => {
		// Don't catch errors here - let TaskDetailsModal handle them
		if (editingTask) {
			await apiClient.updateTask(editingTask.id, taskData);
		} else {
			// Set status to 'Draft' if in draft mode
			const finalTaskData = isDraftMode ? { ...taskData, status: "Draft" } : taskData;
			const createdTask = await apiClient.createTask(finalTaskData as Omit<Task, "id" | "createdDate">);

			// Show task creation confirmation
			setTaskConfirmation({ task: createdTask, isDraft: isDraftMode });

			// Auto-dismiss after 4 seconds
			setTimeout(() => {
				setTaskConfirmation(null);
			}, 4000);
		}
		handleCloseModal();
		await refreshData();

		// If we're on the drafts page and created a draft, trigger a refresh
		if (isDraftMode && window.location.pathname === "/drafts") {
			// Trigger refresh by updating a timestamp that DraftsList can watch
			window.dispatchEvent(new Event("drafts-updated"));
		}
	};

	const handleArchiveTask = async (taskId: string) => {
		try {
			await apiClient.archiveTask(taskId);
			handleCloseModal();
			await refreshData();
		} catch (error) {
			console.error("Failed to archive task:", error);
		}
	};

	const layoutProps = {
		projectName,
		showSuccessToast,
		onDismissToast: () => setShowSuccessToast(false),
		tasks,
		docs,
		decisions,
		wikiTree,
		docsTree,
		isLoading,
		onRefreshData: refreshData,
	};

	const boardPageProps = {
		onEditTask: handleOpenTask,
		onNewTask: handleNewTask,
		tasks,
		onRefreshData: refreshData,
		statuses,
		milestones,
		availableLabels: collectAvailableLabels(tasks, availableLabels),
		milestoneEntities,
		archivedMilestones,
		isLoading,
		labelColors,
		onLabelColorsChange: handleLabelColorsChange,
		hideEmptyColumns: config?.hideEmptyColumns ?? false,
	};

	const mainLocation = state?.backgroundLocation || location;

	// Show loading state while checking initialization
	if (isInitialized === null) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
				<div className="text-lg text-gray-600 dark:text-gray-300">Loading...</div>
			</div>
		);
	}

	// Show initialization screen if not initialized
	if (isInitialized === false) {
		return <InitializationScreen onInitialized={handleInitialized} />;
	}

	return (
		<>
			{duplicatePlan && duplicatePlan.groups.length > 0 && (
				<div className="fixed top-0 left-0 right-0 z-40 bg-yellow-50 dark:bg-yellow-900/40 border-b border-yellow-200 dark:border-yellow-700 px-4 py-2">
					<div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
						<p className="text-sm text-yellow-800 dark:text-yellow-200 truncate">
							{t.duplicateRepair.warning(duplicatePlan.groups.length)}
						</p>
						<button
							type="button"
							onClick={() => setShowDuplicateRepairModal(true)}
							className="shrink-0 px-3 py-1 rounded-md text-sm font-medium bg-yellow-100 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-700"
						>
							{t.duplicateRepair.review}
						</button>
					</div>
				</div>
			)}

			<Routes location={mainLocation}>
				<Route path="/" element={<Layout {...layoutProps} />}>
					<Route index element={<BoardPage {...boardPageProps} />} />
					<Route
						path="tasks"
						element={
							<TaskList
								onEditTask={handleOpenTask}
								onNewTask={handleNewTask}
								tasks={tasks}
								availableStatuses={statuses}
								availableLabels={availableLabels}
								availableMilestones={milestones}
								milestoneEntities={milestoneEntities}
								archivedMilestones={archivedMilestones}
								onRefreshData={refreshData}
							/>
						}
					/>
					<Route
						path="milestones"
						element={
							<MilestonesPage
								tasks={tasks}
								statuses={statuses}
								milestoneEntities={milestoneEntities}
								archivedMilestones={archivedMilestones}
								onEditTask={handleOpenTask}
								onRefreshData={refreshData}
							/>
						}
					/>
					<Route
						path="drafts"
						element={
							<DraftsList
								onEditTask={handleOpenTask}
								onNewDraft={handleNewDraft}
								availableStatuses={statuses}
								availableMilestones={milestones}
								milestoneEntities={milestoneEntities}
								availableLabels={availableLabels}
							/>
						}
					/>
					<Route path="documentation" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} />} />
					<Route path="documentation/:id" element={<DocumentationDetail docs={docs} onRefreshData={refreshData} />} />
					<Route
						path="documentation/:id/:title"
						element={<DocumentationDetail docs={docs} onRefreshData={refreshData} />}
					/>
					<Route path="decisions" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} />} />
					<Route path="decisions/:id" element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} />} />
					<Route
						path="decisions/:id/:title"
						element={<DecisionDetail decisions={decisions} onRefreshData={refreshData} />}
					/>
					<Route path="wiki" element={<WikiDetail />} />
					<Route path="wiki/*" element={<WikiDetail />} />
					<Route
						path="statistics"
						element={
							<Statistics tasks={tasks} isLoading={isLoading} onEditTask={handleOpenTask} projectName={projectName} />
						}
					/>
					<Route path="settings" element={<Settings />} />
					<Route path="gantt" element={<GanttView tasks={tasks} onEditTask={handleOpenTask} />} />
				</Route>
				<Route path="task/:id" element={<Layout {...layoutProps} />}>
					<Route index element={<BoardPage {...boardPageProps} />} />
				</Route>
				<Route path="task/:id/*" element={<Layout {...layoutProps} />}>
					<Route index element={<BoardPage {...boardPageProps} />} />
				</Route>
				<Route path="draft/:id" element={<Layout {...layoutProps} />}>
					<Route index element={<BoardPage {...boardPageProps} />} />
				</Route>
				<Route path="draft/:id/*" element={<Layout {...layoutProps} />}>
					<Route index element={<BoardPage {...boardPageProps} />} />
				</Route>
			</Routes>

			<TaskDetailsModal
				task={editingTask || undefined}
				isOpen={showModal}
				onClose={handleCloseModal}
				onSaved={refreshData}
				onSubmit={handleSubmitTask}
				onArchive={editingTask ? () => handleArchiveTask(editingTask.id) : undefined}
				onPromoted={handlePromotedTask}
				onDrillDown={handleDrillDown}
				onBack={taskHistory.length > 0 ? handleBack : undefined}
				availableStatuses={isDraftMode ? ["Draft", ...statuses] : statuses}
				availableMilestones={milestones}
				milestoneEntities={milestoneEntities}
				archivedMilestoneEntities={archivedMilestones}
				isDraftMode={isDraftMode}
				definitionOfDoneDefaults={config?.definitionOfDone ?? []}
				availableLabels={collectAvailableLabels(tasks, availableLabels)}
			/>

			<DuplicateTaskRepairModal
				isOpen={showDuplicateRepairModal}
				onClose={() => setShowDuplicateRepairModal(false)}
				onRepaired={refreshData}
			/>

			{/* Task Creation Confirmation Toast */}
			{taskConfirmation && (
				<SuccessToast
					message={`${taskConfirmation.isDraft ? "Draft" : "Task"} "${taskConfirmation.task.title}" created successfully! (${taskConfirmation.task.id.replace("task-", "")})`}
					onDismiss={() => setTaskConfirmation(null)}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					}
				/>
			)}
		</>
	);
}

export default App;
