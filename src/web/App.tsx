import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { parseBrowserLoadingState } from "../utils/browser-loading-state";
import { stripAnyPrefix } from "../utils/prefix-config";
import BoardPage from "./components/BoardPage";
import DecisionDetail from "./components/DecisionDetail";
import DocumentationDetail from "./components/DocumentationDetail";
import DraftsList from "./components/DraftsList";
import GanttView from "./components/GanttView";
import GraphView from "./components/GraphView";
import InitializationScreen from "./components/InitializationScreen";
import Layout from "./components/Layout";
import LoadingSpinner from "./components/LoadingSpinner";
import MilestoneDetailsModal from "./components/MilestoneDetailsModal";
import MilestonesPage from "./components/MilestonesPage";
import Settings from "./components/Settings";
import SearchDialog from "./components/search/SearchDialog";
import Statistics from "./components/Statistics";
import DuplicateTaskRepairModal from "./components/DuplicateTaskRepairModal";
import { SuccessToast } from "./components/SuccessToast";
import TaskDetailsModal from "./components/TaskDetailsModal";
import TaskList from "./components/TaskList";
import WikiDetail from "./components/WikiDetail";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import { useHealthCheckContext } from "./contexts/HealthCheckContext";
import { useHashScroll } from "./hooks/useHashScroll";
import { useI18n } from "./hooks/useI18n";
import { useI18nContext } from "./contexts/I18nContext";
import { ImageLightboxProvider } from "./contexts/ImageLightboxContext";
import { TaskIdIndexProvider } from "./contexts/TaskIdIndexContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { apiClient } from "./lib/api";
import { isValidLocale } from "./locales";
import { collectArchivedMilestoneKeys, collectMilestoneIds, milestoneKey } from "./utils/milestones";
import { deepEqual, reconcileById } from "./utils/reconcile";
import { sanitizeUrlTitle } from "./utils/urlHelpers";
import { getWebVersion } from "./utils/version";

const collectWikiPagePaths = (nodes: WikiTreeNode[]): string[] => {
	const paths: string[] = [];
	const walk = (items: WikiTreeNode[]) => {
		for (const item of items) {
			if (item.type === "directory") {
				walk(item.children ?? []);
			} else if (item.path.toLowerCase().endsWith(".md")) {
				paths.push(item.path.replace(/\.md$/i, ""));
			}
		}
	};
	walk(nodes);
	return paths;
};

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
	useHashScroll();
	const state = location.state as { backgroundLocation?: Location; preloadedTask?: Task } | null;
	const taskRouteMatch = useMatch("/task/:id");
	const taskRouteMatchWildcard = useMatch("/task/:id/*");
	const taskIdFromUrl = taskRouteMatch?.params?.id ?? taskRouteMatchWildcard?.params?.id;

	const draftRouteMatch = useMatch("/draft/:id");
	const draftRouteMatchWildcard = useMatch("/draft/:id/*");
	const draftIdFromUrl = draftRouteMatch?.params?.id ?? draftRouteMatchWildcard?.params?.id;

	const milestoneRouteMatch = useMatch("/milestone/:id");
	const milestoneIdFromUrl = milestoneRouteMatch?.params?.id ?? null;

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
	// Mirrors of the store lists, so a refresh can reconcile in place without resubscribing the
	// WebSocket effect to every state change. Every writer of these lists goes through the ref.
	const tasksRef = useRef<Task[]>([]);
	const docsRef = useRef<Document[]>([]);
	const decisionsRef = useRef<Decision[]>([]);
	const milestoneEntitiesRef = useRef<Milestone[]>([]);
	const archivedMilestonesRef = useRef<Milestone[]>([]);
	const loadErrorRef = useRef<Error | null>(null);
	const duplicatePlanRef = useRef<DuplicateRepairPlan | null>(null);
	/**
	 * The id of the newest data request, full load or incremental refresh, plus the scope of the one
	 * in flight: 0 tasks, 1 with milestones, 2 a full load. A narrower refresh that supersedes an
	 * in-flight request through this id has to adopt at least its scope, or the wider data is lost.
	 */
	const dataRequestRef = useRef(0);
	const pendingDataRequestRef = useRef<number | null>(null);
	const pendingScopeRankRef = useRef(0);
	const [isLoading, setIsLoading] = useState(true);
	const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
	// Task graph cold start (doc-014): driven by its own WS messages, parallel to loadingMessage.
	const [graphStatus, setGraphStatus] = useState<"building" | "ready" | null>(null);
	// Bumped on every graph-updated broadcast so the graph view refetches in place.
	const [graphVersion, setGraphVersion] = useState(0);
	const [loadError, setLoadError] = useState<Error | null>(null);
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

			// Reconcile instead of replacing: unchanged records keep their identity, so views
			// re-render only for real changes and a refresh that echoes an already-applied update
			// (the echo of a surgical drag) is a state no-op.
			const nextTasks = reconcileById(tasksRef.current, normalizedTasks);
			tasksRef.current = nextTasks;
			setTasks(nextTasks);
			const nextDocs = reconcileById(docsRef.current, docsList);
			docsRef.current = nextDocs;
			setDocs(nextDocs);
			const nextDecisions = reconcileById(decisionsRef.current, decisionsList);
			decisionsRef.current = nextDecisions;
			setDecisions(nextDecisions);

			return { tasks: nextTasks };
		},
		[],
	);

	/** Identity-preserving setters: an unchanged value must not re-render its consumers. */
	const applyMilestoneIds = useCallback((next: string[]) => {
		setMilestones((current) =>
			next.length === current.length && next.every((id, index) => id === current[index]) ? current : next,
		);
	}, []);

	const applyLoadError = useCallback((error: Error | null) => {
		loadErrorRef.current = error;
		setLoadError(error);
	}, []);

	const applyDuplicatePlan = useCallback((plan: DuplicateRepairPlan | null) => {
		duplicatePlanRef.current = plan;
		setDuplicatePlan(plan);
	}, []);

	const hasLoadedRef = useRef(false);
	// Content is on screen once the first load has succeeded; from then on a mid-session
	// indexing broadcast must not flip the blocking skeleton back on.
	const hasLoadedDataRef = useRef(false);
	// Reactive twin of hasLoadedRef: the deep-link effect needs to re-run when the first load
	// completes, and a ref change alone would not retrigger it.
	const [hasCompletedFirstLoad, setHasCompletedFirstLoad] = useState(false);

	const loadAllData = useCallback(async () => {
		const isFirstLoad = !hasLoadedRef.current;
		const requestId = ++dataRequestRef.current;
		pendingDataRequestRef.current = requestId;
		pendingScopeRankRef.current = 2;
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
			hasLoadedDataRef.current = true;
			// A load that read the whole store just replaced whatever the failure left behind, so the
			// error clears here: otherwise the incremental refresh would keep falling back to this
			// loader forever.
			applyLoadError(null);

			setStatuses(statusesData);
			setProjectName(configData.projectName);
			setAvailableLabels(configData.labels || []);
			setConfig(configData);
			if (isFirstLoad && configData.locale && isValidLocale(configData.locale)) {
				setLocale(configData.locale);
			}
			milestoneEntitiesRef.current = milestonesData;
			archivedMilestonesRef.current = archivedMilestonesData;
			setMilestoneEntities(milestonesData);
			setArchivedMilestones(archivedMilestonesData);
			applyMilestoneIds(
				collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
					(milestone) => !archivedKeys.has(milestoneKey(milestone)),
				),
			);
			setDrafts(draftsData);
			setWikiTree(wikiTreeData);
			setDocsTree(docsTreeData);

			try {
				const duplicatePreview = await apiClient.getDuplicateTaskIdsPreview();
				if (dataRequestRef.current === requestId) applyDuplicatePlan(duplicatePreview);
			} catch (error) {
				console.error("Failed to load duplicate task ID preview:", error);
				if (dataRequestRef.current === requestId) applyDuplicatePlan(null);
			}
		} catch (error) {
			console.error("Failed to load data:", error);
			// A failed full load leaves a store the incremental refresh cannot patch, so it records
			// the failure for that check. It is not surfaced: a background reload failing must not
			// replace the content the user is looking at.
			if (dataRequestRef.current === requestId) {
				loadErrorRef.current = error instanceof Error ? error : new Error("Failed to load data");
			}
		} finally {
			if (pendingDataRequestRef.current === requestId) {
				pendingDataRequestRef.current = null;
			}
			if (isFirstLoad) {
				setIsLoading(false);
				hasLoadedRef.current = true;
				setHasCompletedFirstLoad(true);
			}
		}
	}, [applySearchResults, applyMilestoneIds, applyDuplicatePlan]);

	/**
	 * Incremental refresh: the surgical update the single-card reorder path already applied, made
	 * the standard one. It refetches only the search corpus, plus the milestone entities when the
	 * change was milestone-scoped, and reconciles the result into the store in place. Statuses and
	 * config have their own broadcast, and the duplicate repair plan is a filesystem rescan behind
	 * the scenes, so that one is refetched only when the set of task ids can have changed. Anything
	 * that cannot be applied incrementally falls back to the full load.
	 */
	const refreshTasksData = useCallback(
		async (includeMilestones: boolean) => {
			// A store that never finished loading, or whose last load failed, holds resources an
			// incremental refresh would never request again, so both go through the full loader.
			if (!hasLoadedDataRef.current || loadErrorRef.current) {
				await loadAllData();
				return;
			}
			// Superseding an in-flight request discards its responses through the shared id, so this
			// refresh has to adopt at least that request's scope or the wider data is lost.
			const supersededRank = pendingDataRequestRef.current !== null ? pendingScopeRankRef.current : -1;
			if (supersededRank >= 2) {
				await loadAllData();
				return;
			}
			const withMilestones = includeMilestones || supersededRank >= 1;
			const requestId = ++dataRequestRef.current;
			pendingDataRequestRef.current = requestId;
			pendingScopeRankRef.current = withMilestones ? 1 : 0;
			try {
				const [milestonesData, archivedMilestonesData, searchResults] = await Promise.all([
					withMilestones ? apiClient.fetchMilestones() : milestoneEntitiesRef.current,
					withMilestones ? apiClient.fetchArchivedMilestones() : archivedMilestonesRef.current,
					apiClient.search(),
				]);
				if (dataRequestRef.current !== requestId) return;

				if (withMilestones) {
					milestoneEntitiesRef.current = milestonesData;
					archivedMilestonesRef.current = archivedMilestonesData;
					setMilestoneEntities(milestonesData);
					setArchivedMilestones(archivedMilestonesData);
				}
				const archivedKeys = new Set(collectArchivedMilestoneKeys(archivedMilestonesData, milestonesData));
				const milestoneAliases = buildMilestoneAliasMap(milestonesData, archivedMilestonesData);
				const idSignature = (list: Task[]) =>
					list
						.map((task) => task.id)
						.sort()
						.join("\n");
				const previousIdSignature = idSignature(tasksRef.current);
				const { tasks: tasksList } = applySearchResults(searchResults, archivedKeys, milestoneAliases);
				applyMilestoneIds(
					collectMilestoneIds(tasksList, milestonesData, archivedMilestonesData).filter(
						(milestone) => !archivedKeys.has(milestoneKey(milestone)),
					),
				);
				// In the healthy steady state (an empty plan on record) duplicate ids can only appear
				// when the set of ids changes, so edits and reorders skip the rescan behind the plan.
				// While duplicates exist the plan keeps refreshing, and a plan that is still null means
				// the initial read has not landed yet, so that one does too.
				const plan = duplicatePlanRef.current;
				const planUnsettled = plan === null || plan.groups.length > 0;
				if (planUnsettled || idSignature(tasksList) !== previousIdSignature) {
					void apiClient
						.getDuplicateTaskIdsPreview()
						.then((duplicatePreview) => {
							if (dataRequestRef.current === requestId) applyDuplicatePlan(duplicatePreview);
						})
						.catch(() => {});
				}
			} catch {
				if (dataRequestRef.current !== requestId) return;
				await loadAllData();
			} finally {
				if (pendingDataRequestRef.current === requestId) {
					pendingDataRequestRef.current = null;
				}
			}
		},
		[applySearchResults, applyMilestoneIds, applyDuplicatePlan, loadAllData],
	);

	React.useEffect(() => {
		// Only load data when initialized
		if (isInitialized === true) {
			loadAllData();
		}
	}, [loadAllData, isInitialized]);

	// Reload data when connection is restored. The incremental entry point fetches exactly what this
	// path used to fetch by hand - the corpus plus the milestone entities - and going through it keeps
	// the store refs the refresh path relies on in step.
	React.useEffect(() => {
		if (isOnline && previousOnlineRef.current === false) {
			void refreshTasksData(true);
		}
	}, [refreshTasksData, isOnline]);

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

		// Resolve the id only once this browser has finished its own first load. A server
		// "loaded" broadcast clears isLoading while the first /api/search is still in flight,
		// and matching against the still-empty task list would read a valid deep link as an
		// unknown id and replace it with the board.
		if (!isInitialized || isLoading || !hasCompletedFirstLoad) return;

		let matchedTask: Task | undefined;
		let matchedIsDraft = false;

		if (draftIdFromUrl) {
			matchedTask = drafts.find((d) => stripAnyPrefix(d.id) === draftIdFromUrl || d.id === draftIdFromUrl);
			matchedIsDraft = true;
		} else if (taskIdFromUrl) {
			matchedTask = tasks.find((t) => stripAnyPrefix(t.id) === taskIdFromUrl || t.id === taskIdFromUrl);
			if (!matchedTask) {
				// Completed tasks are not in the board corpus. A task opened from a widened
				// surface (e.g. the search dialog with the completed toggle) travels with the
				// navigation, so the modal opens without a corpus hit instead of falling back
				// to the board the way an unknown deep link does.
				const preloaded = state?.preloadedTask;
				if (preloaded && (stripAnyPrefix(preloaded.id) === taskIdFromUrl || preloaded.id === taskIdFromUrl)) {
					matchedTask = preloaded;
				}
			}
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
				} else if (taskHistoryRef.current.some((entry) => stripAnyPrefix(entry.id) === idFromUrl || entry.id === matchedTask.id)) {
					// Navigated back to a task deeper in the stack (multi-step pop):
					// drop the entries above it instead of pushing a duplicate.
					const stackIndex = taskHistoryRef.current.findIndex(
						(entry) => stripAnyPrefix(entry.id) === idFromUrl || entry.id === matchedTask.id,
					);
					setTaskHistory((prev) => prev.slice(0, stackIndex));
					setEditingTask(matchedTask);
					setIsDraftMode(matchedIsDraft);
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
		hasCompletedFirstLoad,
		showModal,
		editingTask,
		navigate,
		getTaskUrlPath,
	]);

	const handleOpenTask = useCallback(
		(task: Task) => {
			// Completed records are not in the board corpus, so the record travels with the
			// navigation and the modal opens it read-only instead of hitting the fallback.
			navigate(getTaskUrlPath(task), { state: { backgroundLocation: location, preloadedTask: task } });
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
			// Target already in the drill-down stack: pop back to it instead of
			// pushing a duplicate entry (e.g. clicking the subtask we came from).
			const targetBody = stripAnyPrefix(task.id);
			const stackIndex = taskHistoryRef.current.findIndex(
				(entry) => stripAnyPrefix(entry.id) === targetBody || entry.id === task.id,
			);
			if (stackIndex >= 0) {
				navigate(-(taskHistoryRef.current.length - stackIndex));
				return;
			}
			// The drill-down target may not be in the board corpus (a completed predecessor keeps
			// its record in backlog/completed), so the navigation carries the record it is about
			// the way the search dialog does; otherwise the deep link reads as an unknown id.
			navigate(getTaskUrlPath(task), {
				state: { backgroundLocation: state?.backgroundLocation || location, preloadedTask: task },
			});
		},
		[navigate, state, location, getTaskUrlPath],
	);

	const handleBack = useCallback(() => {
		// The parent entry IS the previous history entry (each drill-down pushed
		// one entry on top of it), so pop it. Pushing the parent URL instead
		// would leave the child entry behind and break handleCloseModal's
		// navigate(-1), which would land back on the child modal.
		if (taskHistoryRef.current.length > 0) {
			navigate(-1);
		}
	}, [navigate]);

	const handleCloseModal = useCallback(() => {
		if (taskIdFromUrl || draftIdFromUrl) {
			// This modal entry was pushed on top of state.backgroundLocation, so
			// the previous history entry IS the background: pop it instead of
			// replacing, otherwise background entries (e.g. /search) pile up and
			// leaving the background takes one extra back/close per modal opened.
			if (state?.backgroundLocation) {
				navigate(-1);
				return;
			}
			const backgroundPath = "/";
			navigate(backgroundPath, { replace: true });
		} else {
			setShowModal(false);
			setEditingTask(null);
			setTaskHistory([]);
			setIsDraftMode(false);
		}
	}, [navigate, state, taskIdFromUrl, draftIdFromUrl]);

	const milestoneFromUrl = useMemo(() => {
		if (!milestoneIdFromUrl) return null;
		const key = milestoneKey(milestoneIdFromUrl);
		return (
			[...milestoneEntities, ...archivedMilestones].find(
				(entity) => milestoneKey(entity.id) === key || milestoneKey(entity.title) === key,
			) ?? null
		);
	}, [milestoneIdFromUrl, milestoneEntities, archivedMilestones]);

	const handleCloseMilestoneModal = useCallback(() => {
		if (state?.backgroundLocation) {
			// The modal entry was pushed on top of the background location, so popping it both
			// closes the modal and lands back on the view it was opened from (graph, milestones,
			// ...) without leaving a duplicate entry behind - the same rule as the task modal.
			navigate(-1);
			return;
		}
		navigate("/milestones", { replace: true });
	}, [navigate, state]);

	const refreshData = useCallback(async () => {
		await refreshTasksData(false);
		// Drafts are loaded by the drafts page, not by this refresh, and creating, editing, promoting
		// or demoting a task can change them, so tell that page to reload whenever the rest does.
		window.dispatchEvent(new Event("drafts-updated"));
	}, [refreshTasksData]);

	/** A milestone change also moves the milestone entities, so that scope is refetched with it. */
	const refreshMilestoneData = useCallback(async () => {
		await refreshTasksData(true);
		window.dispatchEvent(new Event("drafts-updated"));
	}, [refreshTasksData]);

	/**
	 * Content-entity refreshes: each one refetches only the list its broadcast names, so a doc
	 * edit never touches tasks and vice versa. They run beside the tasks/milestone machinery
	 * (no shared request id): the fetches are idempotent GETs and the reconcile below turns an
	 * unchanged response into a state no-op.
	 */
	const refreshDocumentsData = useCallback(async () => {
		if (!hasLoadedDataRef.current || loadErrorRef.current) {
			await loadAllData();
			return;
		}
		try {
			const [searchResults, docsTreeData] = await Promise.all([
				apiClient.search({ types: ["document"] }),
				apiClient.fetchDocsTree(),
			]);
			const documentResults = searchResults.filter((result): result is DocumentSearchResult => result.type === "document");
			const nextDocs = reconcileById(docsRef.current, documentResults.map((result) => result.document));
			docsRef.current = nextDocs;
			setDocs(nextDocs);
			setDocsTree((current) => (deepEqual(current, docsTreeData) ? current : docsTreeData));
		} catch (error) {
			console.error("Failed to refresh documentation data:", error);
			await loadAllData();
		}
	}, [loadAllData]);

	const refreshDecisionsData = useCallback(async () => {
		if (!hasLoadedDataRef.current || loadErrorRef.current) {
			await loadAllData();
			return;
		}
		try {
			const decisionsData = await apiClient.fetchDecisions();
			const nextDecisions = reconcileById(decisionsRef.current, decisionsData);
			decisionsRef.current = nextDecisions;
			setDecisions(nextDecisions);
		} catch (error) {
			console.error("Failed to refresh decisions data:", error);
			await loadAllData();
		}
	}, [loadAllData]);

	const refreshWikisData = useCallback(async () => {
		if (!hasLoadedDataRef.current || loadErrorRef.current) {
			await loadAllData();
			return;
		}
		try {
			const wikiTreeData = await apiClient.fetchWikiTree();
			setWikiTree((current) => (deepEqual(current, wikiTreeData) ? current : wikiTreeData));
		} catch (error) {
			console.error("Failed to refresh wiki data:", error);
			await loadAllData();
		}
	}, [loadAllData]);

	// There is deliberately no full-refresh wrapper beside these two: the paths that need the whole
	// shell (the first load and a config change) call loadAllData directly, and everything else moves
	// in place. The full load also stays the fallback inside refreshTasksData.

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
				void refreshData();
			} else if (event.data === "milestones-updated") {
				void refreshMilestoneData();
			} else if (event.data === "documents-updated") {
				void refreshDocumentsData();
			} else if (event.data === "decisions-updated") {
				void refreshDecisionsData();
			} else if (event.data === "wikis-updated") {
				void refreshWikisData();
			} else if (event.data === "config-updated") {
				// Statuses and labels genuinely changed, which only a full load re-reads.
				void loadAllData();
			} else if (event.data === "graph-started") {
				setGraphStatus("building");
			} else if (event.data === "graph-ready") {
				setGraphStatus("ready");
			} else if (event.data === "graph-updated") {
				setGraphVersion((version) => version + 1);
			} else if (event.data === "graph-failed") {
				// No retry signal exists yet; dropping the chip beats a spinner that never ends.
				setGraphStatus(null);
			} else {
				const loadingState = parseBrowserLoadingState(event.data);
			if (loadingState?.type === "loading") {
				// Once content is on screen it stays interactive; the header indexing
				// indicator (driven by loadingMessage) is the only loading signal. A new
				// loading attempt always clears a stale terminal error, so a passive client
				// shows its cached content instead of the obsolete failure.
				if (!hasLoadedDataRef.current) setIsLoading(true);
				applyLoadError(null);
				setLoadingMessage(loadingState.message);
			} else if (loadingState?.type === "loaded") {
				setIsLoading(false);
				setLoadingMessage(null);
			} else if (loadingState?.type === "error") {
				setIsLoading(false);
				setLoadingMessage(null);
				applyLoadError(new Error(loadingState.message));
			}
			}
		};
		return () => ws.close();
	}, [refreshData, refreshMilestoneData, refreshDocumentsData, refreshDecisionsData, refreshWikisData, loadAllData, applyLoadError]);

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

	const applyReorderedTasks = useCallback((updatedTasks: Task[], requestTask: Task) => {
		// Through the ref, like every other writer: an incremental refresh reconciles against this
		// list, so a surgical update that skipped the ref would be reconciled away again.
		const current = tasksRef.current;
		const currentRequest = current.find((task) => task.id === requestTask.id);
		if (currentRequest !== requestTask) return;
		const updatesById = new Map(updatedTasks.map((task) => [task.id, task]));
		const next = current.map((task) => updatesById.get(task.id) ?? task);
		tasksRef.current = next;
		setTasks(next);
	}, []);

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
		loadingMessage,
		graphStatus,
		loadError,
		onRefreshData: refreshData,
	};

	const availableAssignees = useMemo(() => {
		const seen = new Set<string>();
		for (const task of tasks) {
			for (const assignee of task.assignee) {
				if (assignee.trim()) seen.add(assignee.trim());
			}
		}
		for (const assignee of config?.defaultAssignee ?? []) {
			if (assignee.trim()) seen.add(assignee.trim());
		}
		return Array.from(seen).sort((a, b) => a.localeCompare(b));
	}, [tasks, config?.defaultAssignee]);

	const boardPageProps = {
		onEditTask: handleOpenTask,
		onNewTask: handleNewTask,
		tasks,
		onRefreshData: refreshData,
		onTasksUpdated: applyReorderedTasks,
		statuses,
		milestones,
		availableLabels: collectAvailableLabels(tasks, availableLabels),
		milestoneEntities,
		archivedMilestones,
		isLoading,
		loadError,
		labelColors,
		onLabelColorsChange: handleLabelColorsChange,
		hideEmptyColumns: config?.hideEmptyColumns ?? false,
	};

	const mainLocation = state?.backgroundLocation || location;

	const entityWikiPaths = useMemo(() => collectWikiPagePaths(wikiTree), [wikiTree]);

	// Show loading state while checking initialization
	if (isInitialized === null) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900" role="status">
				<LoadingSpinner size="md" text="" />
				<span className="sr-only">{t.nav.projectLoading}</span>
			</div>
		);
	}

	// Show initialization screen if not initialized
	if (isInitialized === false) {
		return <InitializationScreen onInitialized={handleInitialized} />;
	}

	return (
		<>
			<TaskIdIndexProvider tasks={tasks} docs={docs} decisions={decisions} drafts={drafts} wikiPaths={entityWikiPaths}>
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
								onRefreshData={refreshMilestoneData}
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
					<Route path="graph" element={<GraphView graphVersion={graphVersion} onEditTask={handleOpenTask} />} />
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
				<Route path="milestone/:id" element={<Layout {...layoutProps} />}>
					<Route
						index
						element={
							<MilestonesPage
								tasks={tasks}
								statuses={statuses}
								milestoneEntities={milestoneEntities}
								archivedMilestones={archivedMilestones}
								onEditTask={handleOpenTask}
								onRefreshData={refreshMilestoneData}
							/>
						}
					/>
				</Route>
				<Route path="search" element={<Layout {...layoutProps} />}>
					<Route index element={<BoardPage {...boardPageProps} />} />
				</Route>
			</Routes>

			{location.pathname === "/search" && <SearchDialog />}

			<MilestoneDetailsModal
				milestoneId={milestoneIdFromUrl}
				milestone={milestoneFromUrl}
				tasks={tasks}
				milestoneEntities={milestoneEntities}
				isOpen={milestoneIdFromUrl !== null}
				onClose={handleCloseMilestoneModal}
				onEditTask={handleOpenTask}
				onRefreshData={refreshData}
			/>

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
				availableTasks={tasks}
				availableMilestones={milestones}
				milestoneEntities={milestoneEntities}
				archivedMilestoneEntities={archivedMilestones}
				isDraftMode={isDraftMode}
				definitionOfDoneDefaults={config?.definitionOfDone ?? []}
				defaultAssignee={config?.defaultAssignee ?? []}
				availableAssignees={availableAssignees}
				availableLabels={collectAvailableLabels(tasks, availableLabels)}
				graphVersion={graphVersion}
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
			</TaskIdIndexProvider>
		</>
	);
}

export default App;
