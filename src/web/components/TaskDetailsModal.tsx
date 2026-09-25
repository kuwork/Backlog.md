import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stripAnyPrefix } from "../../utils/prefix-config";
import type { AcceptanceCriterion, Milestone, Task, TaskComment } from "../../types";
import Modal from "./Modal";
import TaskHierarchySection from "./TaskHierarchySection";
import { apiClient, ApiError, NetworkError } from "../lib/api";
import type { TranslationDict } from "../locales/types";
import { useTheme } from "../contexts/ThemeContext";
import { PasteAwareMDEditor } from "./PasteAwareMDEditor";
import AcceptanceCriteriaEditor from "./AcceptanceCriteriaEditor";
import MermaidMarkdown from './MermaidMarkdown';
import FilePreviewModal from "./FilePreviewModal";
import ChipInput from "./ChipInput";
import DependencyInput from "./DependencyInput";
import { PathAutocomplete } from "./PathAutocomplete";
import {
  dateTimeLocalToStoredUtc,
  storedUtcToDateTimeLocal,
} from "../utils/date-display";
import StoredDate from "./StoredDate";
import { isTypingTarget } from "../utils/keyboard";
import { extractTempImageUrls, replaceTempImageUrls } from "../utils/temp-assets";
import { useI18n } from "../hooks/useI18n";
import { encodeWikiPath } from "../utils/urlHelpers";
import { commands } from "@uiw/react-md-editor";
import { createReadinessGraph, formatReadinessBlockers, getTaskReadiness } from "../../utils/readiness";
import { canonicalTaskId, taskIdsEqual } from "../../utils/task-id";
import type { DependencyDirectionAnswer, DependencyQueryAnswer } from "../../utils/dependency-query";
import TaskDependencyGraph, { type GraphViewports } from "./TaskDependencyGraph";
import type { NodeStyle } from "./GraphLegend";

interface Props {
  task?: Task; // Optional for create mode
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => Promise<void> | void; // refresh callback
  onSubmit?: (taskData: Partial<Task>) => Promise<void>; // For creating new tasks
  onArchive?: () => void; // For archiving tasks
  onPromoted?: (task: Task) => void; // For opening a newly promoted task
  availableStatuses?: string[]; // Available statuses for new tasks
  availableTasks?: Task[]; // Task corpus for hierarchy display and dependency picker
  /** Bumped by the app whenever the task corpus is refreshed (broadcast or own writes). */
  tasksVersion?: number;
  isDraftMode?: boolean; // Whether creating a draft
  availableMilestones?: string[];
  milestoneEntities?: Milestone[];
  archivedMilestoneEntities?: Milestone[];
  definitionOfDoneDefaults?: string[];
  defaultAssignee?: string[];
  availableAssignees?: string[];
  availableLabels?: string[];
  /** Bumped whenever the server graph changes; the relationship view refetches on change. */
  graphVersion?: number;
  onDrillDown?: (task: Task) => void; // Navigate into a dependency task
  onBack?: () => void; // Navigate back to parent task
}

type Mode = "preview" | "edit" | "create";

/**
 * The one way out of a step that is not a separate screen: leaving a drilled-into task and leaving
 * the relationship graph are the same move, so they share the arrow in the same slot - left of the
 * modal title, where a drill-down already puts it.
 */
const HeaderBackButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors duration-200"
    title={label}
    aria-label={label}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  </button>
);

type TaskUpdatePayload = Partial<Task> & {
  definitionOfDoneAdd?: string[];
  definitionOfDoneRemove?: number[];
  definitionOfDoneCheck?: number[];
  definitionOfDoneUncheck?: number[];
  disableDefinitionOfDoneDefaults?: boolean;
  commentsAppend?: string[];
  commentAuthor?: string;
};

type InlineMetaUpdatePayload = Omit<Partial<Task>, "milestone"> & {
  milestone?: string | null;
};

type MetadataTab = "references" | "documentation" | "modifiedFiles";

type TaskDetailsFormState = {
  title: string;
  description: string;
  plan: string;
  notes: string;
  displayComments: TaskComment[];
  finalSummary: string;
  criteria: AcceptanceCriterion[];
  definitionOfDone: AcceptanceCriterion[];
  status: string;
  assignee: string[];
  labels: string[];
  priority: string;
  dependencies: string[];
  references: string[];
  documentation: string[];
  modifiedFiles: string[];
  milestone: string;
  dueDate: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
};

const areJsonEqual = (first: unknown, second: unknown): boolean => JSON.stringify(first) === JSON.stringify(second);

// A modified file is a path from the project root, so the References form's URL branch has no
// counterpart here: a scheme-looking value is refused rather than stored as a path.
const looksLikeUrl = (value: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim());

const preserveDirtyRefreshValue = <T,>(
  current: T,
  previous: T,
  next: T,
  isEqual: (first: T, second: T) => boolean = Object.is,
): T => (isEqual(current, previous) ? next : current);

const buildTaskDetailsFormState = ({
  task,
  isCreateMode,
  isDraftMode,
  availableStatuses,
  defaultDefinitionOfDone,
  defaultAssignee,
}: {
  task?: Task;
  isCreateMode: boolean;
  isDraftMode?: boolean;
  availableStatuses?: string[];
  defaultDefinitionOfDone: AcceptanceCriterion[];
  defaultAssignee?: string[];
}): TaskDetailsFormState => ({
  title: task?.title || "",
  description: task?.description || "",
  plan: task?.implementationPlan || "",
  notes: task?.implementationNotes || "",
  displayComments: task?.comments ?? [],
  finalSummary: task?.finalSummary || "",
  criteria: task?.acceptanceCriteriaItems || [],
  definitionOfDone: task?.definitionOfDoneItems || (isCreateMode ? defaultDefinitionOfDone : []),
  status: task?.status || (isDraftMode ? "Draft" : (availableStatuses?.[0] || "To Do")),
  assignee: task?.assignee || (isCreateMode ? defaultAssignee : []) || [],
  labels: task?.labels || [],
  priority: task?.priority || "",
  dependencies: task?.dependencies || [],
  references: task?.references || [],
  documentation: task?.documentation || [],
  modifiedFiles: task?.modifiedFiles || [],
  milestone: task?.milestone || "",
  dueDate: task?.dueDate || "",
  plannedStart: task?.plannedStart || "",
  plannedEnd: task?.plannedEnd || "",
  actualStart: task?.actualStart || "",
  actualEnd: task?.actualEnd || "",
});

const containsCommentDelimiterLine = (value: string): boolean => /^\s*---\s*$/m.test(value.replace(/\r\n/g, "\n"));

// The comment serializer rejects standalone '---' lines, and the Insert-HR
// command always emits one, so it is dropped from the comment editor toolbar.
const COMMENT_EDITOR_COMMANDS = commands.getCommands().filter((command) => command.name !== "hr");

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight transition-colors duration-200">
      {title}
    </h3>
    {right ? <div className="ml-2 text-xs text-gray-500 dark:text-gray-400">{right}</div> : null}
  </div>
);

// References, Documentation and Modified Files are the modal's three list-shaped metadata fields.
// They share one panel behind this strip instead of stacking as three cards: a finished task can
// list hundreds of paths, and the third card would push everything below it out of reach.
const metadataTabId = (tab: MetadataTab) => `task-details-tab-${tab}`;

// The tab that opens follows the lists and the task's state. A finished task is opened for the
// files it touched, so Modified Files leads there; a task that is still under way is opened for
// what it is built on, so the strip is read left to right and References wins as soon as it has
// entries. Either way the first filled list in that order opens, and References is the fallback
// when nothing is filled at all.
const metadataTabPriorityFor = (isDone: boolean): readonly MetadataTab[] =>
	isDone ? ["modifiedFiles", "references", "documentation"] : ["references", "modifiedFiles", "documentation"];

const defaultMetadataTabFor = (counts: Record<MetadataTab, number>, isDone: boolean): MetadataTab =>
  metadataTabPriorityFor(isDone).find((tab) => counts[tab] > 0) ?? "references";

const MetadataTabButton: React.FC<{
  tab: MetadataTab;
  label: string;
  count: number;
  active: boolean;
  onSelect: (tab: MetadataTab) => void;
}> = ({ tab, label, count, active, onSelect }) => (
  <button
    type="button"
    role="tab"
    id={metadataTabId(tab)}
    aria-selected={active}
    onClick={() => onSelect(tab)}
    className={`px-3 py-1.5 rounded-md text-sm font-semibold tracking-tight transition-colors duration-200 ${
      active
        ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-gray-700/50 dark:hover:text-gray-100"
    }`}
  >
    {label}
    {/* A count is only worth its space when there is something behind it: an empty list shows the
        bare caption, so the strip does not fill up with (0)s. */}
    {count > 0 && <span className="ml-1 font-normal tabular-nums">{`(${count})`}</span>}
  </button>
);

export const TaskDetailsModal: React.FC<Props> = ({
  task,
  isOpen,
  onClose,
  onSaved,
  onSubmit,
  onArchive,
  onPromoted,
  availableStatuses,
  availableTasks: initialAvailableTasks,
  tasksVersion = 0,
  availableMilestones: _availableMilestones,
  milestoneEntities,
  archivedMilestoneEntities,
  isDraftMode,
  definitionOfDoneDefaults,
  defaultAssignee,
  availableAssignees,
  availableLabels,
  graphVersion,
  onDrillDown,
  onBack,
}) => {
  const { theme } = useTheme();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isCreateMode = !task;
  const isFromOtherBranch = Boolean(task?.branch);
  // A record read out of backlog/completed reaches the popup the same way a cross-branch record
  // does: it is not part of the board corpus, so nothing here can refresh it and a save would be
  // written against a copy the board does not own. Both are reading surfaces; only the hint differs.
  const isCompletedCorpus = task?.source === "completed";
  const isReadOnly = isFromOtherBranch || isCompletedCorpus;
  const [mode, setMode] = useState<Mode>(isCreateMode ? "create" : "preview");
  // Reading a neighborhood as a graph is a state of the task being read, not a modal-wide mode: the
  // graph opens per task, so drilling into a neighbour lands on that task's own state - the detail
  // view, unless it was left open as a graph - and coming back restores the mode, the viewport and
  // the legend filters this task was left in. It is kept here rather than inside the graph component
  // because that component unmounts while the neighbour's detail view is on screen.
  const [graphOpenByTask, setGraphOpenByTask] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [graphHiddenStyles, setGraphHiddenStyles] = useState<ReadonlyMap<string, ReadonlySet<NodeStyle>>>(
    () => new Map(),
  );
  const graphViewportsRef = useRef<GraphViewports>(new Map());
  const openTaskId = task?.id ?? "";
  const showGraph = graphOpenByTask.get(openTaskId) ?? false;
  const setShowGraph = useCallback(
    (open: boolean) => {
      setGraphOpenByTask((previous) => new Map(previous).set(openTaskId, open));
    },
    [openTaskId],
  );
  const modeRef = useRef(mode);
  const previousTaskId = useRef(task?.id ?? "");
  const previousIsOpen = useRef(isOpen);
  const formBaselineRef = useRef<TaskDetailsFormState | null>(null);
  const activeDemotionRequest = useRef<{ identity: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [demoting, setDemoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Title field for create mode
  const [title, setTitle] = useState(task?.title || "");

  // Editable fields (edit mode)
  const [description, setDescription] = useState(task?.description || "");
  const [plan, setPlan] = useState(task?.implementationPlan || "");
  const [notes, setNotes] = useState(task?.implementationNotes || "");
  const [displayComments, setDisplayComments] = useState<TaskComment[]>(task?.comments ?? []);
  const [commentBody, setCommentBody] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentsChanged, setCommentsChanged] = useState(false);
  const [finalSummary, setFinalSummary] = useState(task?.finalSummary || "");
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(task?.acceptanceCriteriaItems || []);
  const defaultDefinitionOfDone = useMemo(
    () => (definitionOfDoneDefaults ?? []).map((text, index) => ({ index: index + 1, text, checked: false })),
    [definitionOfDoneDefaults],
  );
  const initialDefinitionOfDone = task?.definitionOfDoneItems ?? (isCreateMode ? defaultDefinitionOfDone : []);
  const [definitionOfDone, setDefinitionOfDone] = useState<AcceptanceCriterion[]>(initialDefinitionOfDone);
  const resolveMilestoneToId = useCallback((value?: string | null): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) return "";
    const key = normalized.toLowerCase();
    const aliasKeys = new Set<string>([key]);
    const looksLikeMilestoneId = /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized);
    const canonicalInputId = looksLikeMilestoneId
      ? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
      : null;
    if (/^\d+$/.test(normalized)) {
      const numericAlias = String(Number.parseInt(normalized, 10));
      aliasKeys.add(numericAlias);
      aliasKeys.add(`m-${numericAlias}`);
    } else {
      const idMatch = normalized.match(/^m-(\d+)$/i);
      if (idMatch?.[1]) {
        const numericAlias = String(Number.parseInt(idMatch[1], 10));
        aliasKeys.add(numericAlias);
        aliasKeys.add(`m-${numericAlias}`);
      }
    }
    const idMatchesAlias = (milestoneId: string): boolean => {
      const milestoneKey = milestoneId.trim().toLowerCase();
      if (aliasKeys.has(milestoneKey)) {
        return true;
      }
      const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
      if (!idMatch?.[1]) {
        return false;
      }
      const numericAlias = String(Number.parseInt(idMatch[1], 10));
      return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
    };
    const findIdMatch = (milestones: Milestone[]): Milestone | undefined => {
      const rawExactMatch = milestones.find((milestone) => milestone.id.trim().toLowerCase() === key);
      if (rawExactMatch) {
        return rawExactMatch;
      }
      if (canonicalInputId) {
        const canonicalRawMatch = milestones.find(
          (milestone) => milestone.id.trim().toLowerCase() === canonicalInputId,
        );
        if (canonicalRawMatch) {
          return canonicalRawMatch;
        }
      }
      return milestones.find((milestone) => idMatchesAlias(milestone.id));
    };
    const activeMilestones = milestoneEntities ?? [];
    const archivedMilestones = archivedMilestoneEntities ?? [];
    const activeIdMatch = findIdMatch(activeMilestones);
    if (activeIdMatch) {
      return activeIdMatch.id;
    }
    if (looksLikeMilestoneId) {
      const archivedIdMatch = findIdMatch(archivedMilestones);
      if (archivedIdMatch) {
        return archivedIdMatch.id;
      }
    }
    const activeTitleMatches = activeMilestones.filter((milestone) => milestone.title.trim().toLowerCase() === key);
    if (activeTitleMatches.length === 1) {
      return activeTitleMatches[0]?.id ?? normalized;
    }
    if (activeTitleMatches.length > 1) {
      return normalized;
    }
    const archivedIdMatch = findIdMatch(archivedMilestones);
    if (archivedIdMatch) {
      return archivedIdMatch.id;
    }
    const archivedTitleMatches = archivedMilestones.filter((milestone) => milestone.title.trim().toLowerCase() === key);
    if (archivedTitleMatches.length === 1) {
      return archivedTitleMatches[0]?.id ?? normalized;
    }
    return normalized;
  }, [milestoneEntities, archivedMilestoneEntities]);
  const resolveMilestoneLabel = useCallback((value?: string | null): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) return "";
    const key = normalized.toLowerCase();
    const aliasKeys = new Set<string>([key]);
    const canonicalInputId =
      /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized)
        ? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
        : null;
    if (/^\d+$/.test(normalized)) {
      const numericAlias = String(Number.parseInt(normalized, 10));
      aliasKeys.add(numericAlias);
      aliasKeys.add(`m-${numericAlias}`);
    } else {
      const idMatch = normalized.match(/^m-(\d+)$/i);
      if (idMatch?.[1]) {
        const numericAlias = String(Number.parseInt(idMatch[1], 10));
        aliasKeys.add(numericAlias);
        aliasKeys.add(`m-${numericAlias}`);
      }
    }
    const idMatchesAlias = (milestoneId: string): boolean => {
      const milestoneKey = milestoneId.trim().toLowerCase();
      if (aliasKeys.has(milestoneKey)) {
        return true;
      }
      const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
      if (!idMatch?.[1]) {
        return false;
      }
      const numericAlias = String(Number.parseInt(idMatch[1], 10));
      return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
    };
    const findIdMatch = (milestones: Milestone[]): Milestone | undefined => {
      const rawExactMatch = milestones.find((milestone) => milestone.id.trim().toLowerCase() === key);
      if (rawExactMatch) {
        return rawExactMatch;
      }
      if (canonicalInputId) {
        const canonicalRawMatch = milestones.find(
          (milestone) => milestone.id.trim().toLowerCase() === canonicalInputId,
        );
        if (canonicalRawMatch) {
          return canonicalRawMatch;
        }
      }
      return milestones.find((milestone) => idMatchesAlias(milestone.id));
    };
    const allMilestones = [...(milestoneEntities ?? []), ...(archivedMilestoneEntities ?? [])];
    const idMatch = findIdMatch(allMilestones);
    if (idMatch) {
      return idMatch.title;
    }
    const titleMatches = allMilestones.filter((milestone) => milestone.title.trim().toLowerCase() === key);
    return titleMatches.length === 1 ? (titleMatches[0]?.title ?? normalized) : normalized;
  }, [milestoneEntities, archivedMilestoneEntities]);

  // Sidebar metadata (inline edit)
  const [status, setStatus] = useState(task?.status || (isDraftMode ? "Draft" : (availableStatuses?.[0] || "To Do")));
  const [assignee, setAssignee] = useState<string[]>(task?.assignee || []);
  const [labels, setLabels] = useState<string[]>(task?.labels || []);
  const [priority, setPriority] = useState<string>(task?.priority || "");
  const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
  // Server rejection message for a dependency-list write (cycle, missing target, lock), shown
  // next to the input instead of the top banner so it is visible where the user is typing.
  // It dismisses itself after a few seconds so a stale failure never lingers.
  const [dependencySaveError, setDependencySaveError] = useState<string | null>(null);
  useEffect(() => {
    if (dependencySaveError === null) return;
    const timer = window.setTimeout(() => setDependencySaveError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [dependencySaveError]);
  const [references, setReferences] = useState<string[]>(task?.references || []);
  const [documentation, setDocumentation] = useState<string[]>(task?.documentation || []);
  const [modifiedFiles, setModifiedFiles] = useState<string[]>(task?.modifiedFiles || []);
  const isDoneStatus = (status || "").toLowerCase().includes("done");
  // null means the panel follows the task: the tab is derived from the state and the lists above,
  // with References as the fallback. A click pins the chosen tab for the open task.
  const [metadataTab, setMetadataTab] = useState<MetadataTab | null>(null);
  const defaultMetadataTab = defaultMetadataTabFor(
    {
      references: references.length,
      documentation: documentation.length,
      modifiedFiles: modifiedFiles.length,
    },
    isDoneStatus,
  );
  const activeMetadataTab = metadataTab ?? defaultMetadataTab;
  const [milestone, setMilestone] = useState<string>(task?.milestone || "");
  const [dueDate, setDueDate] = useState<string>(task?.dueDate || "");
  const [plannedStart, setPlannedStart] = useState<string>(task?.plannedStart || "");
  const [plannedEnd, setPlannedEnd] = useState<string>(task?.plannedEnd || "");
  const [actualStart, setActualStart] = useState<string>(task?.actualStart || "");
  const [actualEnd, setActualEnd] = useState<string>(task?.actualEnd || "");

  const [availableTasks, setAvailableTasks] = useState<Task[]>(initialAvailableTasks ?? []);
  const [availableDrafts, setAvailableDrafts] = useState<Task[]>([]);
  type PreviewTarget =
    | { kind: "file"; path: string }
    | { kind: "entity"; type: "task" | "draft" | "doc" | "decision" | "wiki"; id: string; lineStart?: number; lineEnd?: number };
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const milestoneSelectionValue = resolveMilestoneToId(milestone);

  const handleTaskClick = useCallback((taskId: string, range?: { lineStart?: number; lineEnd?: number }) => {
    if (range?.lineStart !== undefined) {
      setPreviewTarget({ kind: "entity", type: "task", id: taskId, lineStart: range.lineStart, lineEnd: range.lineEnd });
      return;
    }
    const targetTask = availableTasks.find(t => stripAnyPrefix(t.id) === taskId || t.id === taskId);
    if (targetTask && onDrillDown) {
      onDrillDown(targetTask);
    } else {
      navigate(`/task/${taskId}`);
    }
  }, [availableTasks, onDrillDown, navigate]);
  const handleDocClick = useCallback((docId: string, range?: { lineStart?: number; lineEnd?: number }) => {
    if (range?.lineStart !== undefined) {
      setPreviewTarget({ kind: "entity", type: "doc", id: docId, lineStart: range.lineStart, lineEnd: range.lineEnd });
      return;
    }
    navigate(`/documentation/${docId}`);
  }, [navigate]);
  const handleDecisionClick = useCallback((decisionId: string, range?: { lineStart?: number; lineEnd?: number }) => {
    if (range?.lineStart !== undefined) {
      setPreviewTarget({ kind: "entity", type: "decision", id: decisionId, lineStart: range.lineStart, lineEnd: range.lineEnd });
      return;
    }
    navigate(`/decisions/${decisionId}`);
  }, [navigate]);
  const handleWikiClick = useCallback((wikiPath: string, range?: { lineStart?: number; lineEnd?: number }) => {
    if (range?.lineStart !== undefined) {
      setPreviewTarget({ kind: "entity", type: "wiki", id: wikiPath, lineStart: range.lineStart, lineEnd: range.lineEnd });
      return;
    }
    navigate(`/wiki/${encodeWikiPath(wikiPath)}`);
  }, [navigate]);
  const handleDraftClick = useCallback((draftId: string, range?: { lineStart?: number; lineEnd?: number }) => {
    if (range?.lineStart !== undefined) {
      setPreviewTarget({ kind: "entity", type: "draft", id: draftId, lineStart: range.lineStart, lineEnd: range.lineEnd });
      return;
    }
    const targetDraft = availableDrafts.find(d => stripAnyPrefix(d.id) === draftId || d.id === draftId);
    if (targetDraft && onDrillDown) {
      onDrillDown(targetDraft);
    } else {
      navigate(`/draft/${draftId}`);
    }
  }, [availableDrafts, onDrillDown, navigate]);
  const hasMilestoneSelection = (milestoneEntities ?? []).some((milestoneEntity) => milestoneEntity.id === milestoneSelectionValue);

  // Dependencies that already left the board corpus (completed tasks) are fetched by ID so the
  // browser resolves the same task graph the CLI does instead of calling them unknown.
  // Keyed on a string because availableTasks and dependencies are new arrays on every render.
  const unresolvedDependencyKey = useMemo(() => {
    const known = new Set(availableTasks.map((candidate) => canonicalTaskId(candidate.id)));
    return dependencies
      .filter((id) => !known.has(canonicalTaskId(id)))
      .join(",");
  }, [availableTasks, dependencies]);
  const [offBoardDependencies, setOffBoardDependencies] = useState<Task[]>([]);
  useEffect(() => {
    if (!isOpen || unresolvedDependencyKey === "") {
      setOffBoardDependencies((current) => (current.length === 0 ? current : []));
      return;
    }
    let cancelled = false;
    Promise.all(unresolvedDependencyKey.split(",").map((id) => apiClient.fetchTask(id).catch(() => null))).then(
      (results) => {
        if (!cancelled) setOffBoardDependencies(results.filter((result): result is Task => Boolean(result)));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, unresolvedDependencyKey]);

  // A completed predecessor is not in the board corpus, so chips, picker suggestions and
  // click-through resolve against the records fetched by ID as well. The readiness graph keeps its
  // own active/completed split.
  const dependencyCorpus = useMemo(
    () => [...availableTasks, ...offBoardDependencies],
    [availableTasks, offBoardDependencies],
  );

  // BACK-709 AC #9: the closure endpoint answers both directions in one request per popup open -
  // what the record transitively waits for and what waits on it, each with hop counts, plus root
  // blockers, cycles and references that resolve to nothing. Refetched when an inline edit has
  // settled on the server and when the app broadcasts a corpus refresh (an external editor changed
  // a file while this popup is open), never on the optimistic state and never on a timer: a
  // refetch fired at removal time would read the pre-write corpus and re-report the very cycle
  // that was just removed.
  const [closure, setClosure] = useState<DependencyQueryAnswer | null>(null);
  const [closureFailed, setClosureFailed] = useState(false);
  const [closureRefreshTick, setClosureRefreshTick] = useState(0);
  const closureSubjectId = task?.id ?? null;
  useEffect(() => {
    if (!isOpen || isCreateMode || closureSubjectId === null) {
      setClosure((current) => (current === null ? current : null));
      setClosureFailed(false);
      return;
    }
    let cancelled = false;
    // A refetch for the same record keeps the previous answer on screen until the new one arrives;
    // opening a different record starts empty instead of showing the other record's closure.
    setClosure((current) => (current !== null && current.subject.id !== closureSubjectId ? null : current));
    setClosureFailed(false);
    apiClient
      .fetchDependencyClosure(closureSubjectId)
      .then((answer) => {
        if (cancelled) return;
        // A stubbed or misbehaving endpoint can resolve with anything (test doubles answer every
        // URL with an empty array). Only a real both-direction answer may reach the render.
        const validated = isDependencyQueryAnswer(answer) ? answer : null;
        setClosure(validated);
        setClosureFailed(validated === null);
      })
      .catch(() => {
        if (cancelled) return;
        setClosure(null);
        setClosureFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isCreateMode, closureSubjectId, closureRefreshTick, tasksVersion]);
  const hasClosureContent =
    closureFailed ||
    (closure !== null &&
      (closure.dependencies.rows.length > 0 ||
        closure.dependents.rows.length > 0 ||
        closure.dependencies.cycle.length > 0 ||
        closure.unresolved.length > 0));

  // Completed records are the one thing the board corpus cannot answer, and BACK-662's completed
  // corpus makes the search service the surface that can.
  const handleGraphTaskClick = useCallback((taskId: string) => {
    const targetTask = dependencyCorpus.find((entry) => taskIdsEqual(entry.id, taskId));
    if (targetTask && onDrillDown) {
      onDrillDown(targetTask);
    }
  }, [dependencyCorpus, onDrillDown]);

  const searchCompletedDependencies = useCallback(async (query: string): Promise<Task[]> => {
    const results = await apiClient.search({ query, types: ["task"], completed: true, limit: 8 });
    return results.flatMap((result) => (result.type === "task" ? [result.task] : []));
  }, []);

  // Dependency readiness, derived at render time from the dependencies and status currently shown,
  // so an inline edit is reflected immediately instead of waiting for a refresh.
  // Only meaningful while dependencies exist and the task has not been completed.
  const readiness = useMemo(() => {
    if (!task || dependencies.length === 0) return null;
    // Records resolved outside the board corpus come from backlog/completed, where the record's
    // location is the completion evidence rather than its status string. That applies to the open
    // task itself as well: a direct link can open a completed task whose historical status is no
    // longer the configured terminal one.
    const offBoard = [...offBoardDependencies, ...(task.source === "completed" ? [task] : [])];
    const graph = createReadinessGraph({
      tasks: [...availableTasks, ...offBoard.filter((entry) => entry.source !== "completed")],
      completedTasks: offBoard.filter((entry) => entry.source === "completed"),
      statuses: availableStatuses,
    });
    const result = getTaskReadiness({ ...task, dependencies, status }, graph);
    return result.isReady || result.isBlocked ? result : null;
  }, [task, dependencies, status, availableTasks, offBoardDependencies, availableStatuses]);

  // Keep a baseline for dirty-check
  const baseline = useMemo(() => ({
    title: task?.title || "",
    description: task?.description || "",
    plan: task?.implementationPlan || "",
    notes: task?.implementationNotes || "",
    finalSummary: task?.finalSummary || "",
    criteria: JSON.stringify(task?.acceptanceCriteriaItems || []),
    definitionOfDone: JSON.stringify(task?.definitionOfDoneItems || (isCreateMode ? defaultDefinitionOfDone : [])),
    dueDate: task?.dueDate || "",
    plannedStart: task?.plannedStart || "",
    plannedEnd: task?.plannedEnd || "",
    actualStart: task?.actualStart || "",
    actualEnd: task?.actualEnd || "",
  }), [task, defaultDefinitionOfDone, isCreateMode]);

  const isDirty = useMemo(() => {
    return (
      title !== baseline.title ||
      description !== baseline.description ||
      plan !== baseline.plan ||
      notes !== baseline.notes ||
      finalSummary !== baseline.finalSummary ||
      JSON.stringify(criteria) !== baseline.criteria ||
      JSON.stringify(definitionOfDone) !== baseline.definitionOfDone ||
      dueDate !== baseline.dueDate ||
      plannedStart !== baseline.plannedStart ||
      plannedEnd !== baseline.plannedEnd ||
      actualStart !== baseline.actualStart ||
      actualEnd !== baseline.actualEnd
    );
  }, [title, description, plan, notes, finalSummary, criteria, definitionOfDone, dueDate, plannedStart, plannedEnd, actualStart, actualEnd, baseline]);

  const isDraftTask = task?.id?.startsWith("DRAFT-") ?? false;

  // A demotion moves the record, so every continuation after the request must prove it still
  // belongs to the task it started on: the popup may have switched task, closed, or the record
  // may have turned from a task into a draft while the request was in flight.
  const demotionIdentity = [
    isOpen ? "open" : "closed",
    task?.id ?? "",
    task?.source ?? "",
    task?.branch ?? "",
    isDraftTask ? "draft" : "task",
  ].join("\0");
  const demotionIdentityRef = useRef(demotionIdentity);
  demotionIdentityRef.current = demotionIdentity;

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Retire an in-flight demotion on unmount so its continuation cannot touch a dead component.
  useEffect(
    () => () => {
      activeDemotionRequest.current = null;
    },
    [],
  );

  // Switching task, opening or closing the popup or changing the record type retires the request
  // in flight: its continuations would otherwise close or refresh a view it no longer owns.
  useEffect(() => {
    activeDemotionRequest.current = null;
    setDemoting(false);
  }, [demotionIdentity]);

  // Intercept Escape to cancel edit (not close modal) when in edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The dependency graph owns Escape while it fills the modal: collapse it instead of closing.
      if (showGraph && e.key === "Escape" && !isTypingTarget(e)) {
        e.preventDefault();
        e.stopPropagation();
        setShowGraph(false);
        return;
      }
      if (mode === "edit" && (e.key === "Escape")) {
        e.preventDefault();
        e.stopPropagation();
        handleCancelEdit();
      }
      if (mode === "edit" && ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        e.stopPropagation();
        void handleSave();
      }
      // Preview shortcuts must not intercept typing in editable fields,
      // while edit-mode Escape and Cmd/Ctrl+S above keep working there.
      if (mode !== "preview" || isTypingTarget(e)) return;
      // A demotion is already moving the record, so no shortcut may start another write.
      if (demoting) return;

      if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setMode("edit");
      }
      if (isDoneStatus && (e.key.toLowerCase() === "c") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleComplete();
      }
      if (!isDoneStatus && !isDraftTask && (e.key.toLowerCase() === "d") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handleDemote();
      }
      if (isDraftTask && (e.key.toLowerCase() === "p") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        void handlePromote();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [mode, title, description, plan, notes, finalSummary, criteria, definitionOfDone, status, isDraftTask, demoting, showGraph]);

  // Reset local state when task changes or modal opens
  useEffect(() => {
    const nextTaskId = task?.id ?? "";
    const nextFormState = buildTaskDetailsFormState({
      task,
      isCreateMode,
      isDraftMode,
      availableStatuses,
      defaultDefinitionOfDone,
      defaultAssignee,
    });
    const previousFormState = formBaselineRef.current;
    const sameOpenModalRefresh =
      Boolean(previousFormState) && isOpen && previousIsOpen.current && previousTaskId.current === nextTaskId;
    const shouldPreserveEditMode =
      !isCreateMode && sameOpenModalRefresh && modeRef.current === "edit";

    // Opening the modal on another task drops a pinned tab so the default follows the new task.
    if (nextTaskId !== previousTaskId.current || !isOpen || !previousIsOpen.current) {
      setMetadataTab(null);
      setDependencySaveError(null);
    }

    // Every task opens in the detail view; the per-task graph state (mode, viewport, filters) lives
    // as long as the modal does, so a drill-down round trip still finds each task where it was left.
    if (!isOpen || !previousIsOpen.current) {
      setGraphOpenByTask(new Map());
      setGraphHiddenStyles(new Map());
      graphViewportsRef.current.clear();
    }

    if (sameOpenModalRefresh && previousFormState) {
      setTitle((current) => preserveDirtyRefreshValue(current, previousFormState.title, nextFormState.title));
      setDescription((current) =>
        preserveDirtyRefreshValue(current, previousFormState.description, nextFormState.description),
      );
      setPlan((current) => preserveDirtyRefreshValue(current, previousFormState.plan, nextFormState.plan));
      setNotes((current) => preserveDirtyRefreshValue(current, previousFormState.notes, nextFormState.notes));
      setDisplayComments(nextFormState.displayComments);
      setCommentSaving(false);
      setCommentsChanged(false);
      setFinalSummary((current) =>
        preserveDirtyRefreshValue(current, previousFormState.finalSummary, nextFormState.finalSummary),
      );
      setCriteria((current) =>
        preserveDirtyRefreshValue(current, previousFormState.criteria, nextFormState.criteria, areJsonEqual),
      );
      setDefinitionOfDone((current) =>
        preserveDirtyRefreshValue(
          current,
          previousFormState.definitionOfDone,
          nextFormState.definitionOfDone,
          areJsonEqual,
        ),
      );
      setStatus((current) => preserveDirtyRefreshValue(current, previousFormState.status, nextFormState.status));
      setAssignee((current) =>
        preserveDirtyRefreshValue(current, previousFormState.assignee, nextFormState.assignee, areJsonEqual),
      );
      setLabels((current) =>
        preserveDirtyRefreshValue(current, previousFormState.labels, nextFormState.labels, areJsonEqual),
      );
      setPriority((current) => preserveDirtyRefreshValue(current, previousFormState.priority, nextFormState.priority));
      setDependencies((current) =>
        preserveDirtyRefreshValue(current, previousFormState.dependencies, nextFormState.dependencies, areJsonEqual),
      );
      setReferences((current) =>
        preserveDirtyRefreshValue(current, previousFormState.references, nextFormState.references, areJsonEqual),
      );
      setDocumentation((current) =>
        preserveDirtyRefreshValue(current, previousFormState.documentation, nextFormState.documentation, areJsonEqual),
      );
      setModifiedFiles((current) =>
        preserveDirtyRefreshValue(current, previousFormState.modifiedFiles, nextFormState.modifiedFiles, areJsonEqual),
      );
      setMilestone((current) =>
        preserveDirtyRefreshValue(current, previousFormState.milestone, nextFormState.milestone),
      );
      setDueDate((current) => preserveDirtyRefreshValue(current, previousFormState.dueDate, nextFormState.dueDate));
      setPlannedStart((current) =>
        preserveDirtyRefreshValue(current, previousFormState.plannedStart, nextFormState.plannedStart),
      );
      setPlannedEnd((current) =>
        preserveDirtyRefreshValue(current, previousFormState.plannedEnd, nextFormState.plannedEnd),
      );
      setActualStart((current) =>
        preserveDirtyRefreshValue(current, previousFormState.actualStart, nextFormState.actualStart),
      );
      setActualEnd((current) =>
        preserveDirtyRefreshValue(current, previousFormState.actualEnd, nextFormState.actualEnd),
      );
      setMode(shouldPreserveEditMode ? "edit" : isCreateMode ? "create" : modeRef.current);
      previousTaskId.current = nextTaskId;
      previousIsOpen.current = isOpen;
      formBaselineRef.current = nextFormState;
      setError(null);
      // Preload tasks for dependency picker
      if (isOpen) {
        apiClient.fetchTasks().then(setAvailableTasks).catch(() => setAvailableTasks([]));
        apiClient.fetchDrafts().then(setAvailableDrafts).catch(() => setAvailableDrafts([]));
      }
      return;
    }

    setTitle(nextFormState.title);
    setDescription(nextFormState.description);
    setPlan(nextFormState.plan);
    setNotes(nextFormState.notes);
    setDisplayComments(nextFormState.displayComments);
    setCommentBody("");
    setCommentAuthor("");
    setCommentSaving(false);
    setCommentsChanged(false);
    setFinalSummary(nextFormState.finalSummary);
    setCriteria(nextFormState.criteria);
    setDefinitionOfDone(nextFormState.definitionOfDone);
    setStatus(nextFormState.status);
    setAssignee(nextFormState.assignee);
    setLabels(nextFormState.labels);
    setPriority(nextFormState.priority);
    setDependencies(nextFormState.dependencies);
    setReferences(nextFormState.references);
    setDocumentation(nextFormState.documentation);
    setModifiedFiles(nextFormState.modifiedFiles);
    setMilestone(nextFormState.milestone);
    setDueDate(nextFormState.dueDate);
    setPlannedStart(nextFormState.plannedStart);
    setPlannedEnd(nextFormState.plannedEnd);
    setActualStart(nextFormState.actualStart);
    setActualEnd(nextFormState.actualEnd);
    setMode(isCreateMode ? "create" : "preview");
    previousTaskId.current = nextTaskId;
    previousIsOpen.current = isOpen;
    formBaselineRef.current = nextFormState;
    setError(null);
    // Preload tasks for dependency picker. Only while the modal is open: this effect also runs for a
    // closed modal on every data change, and the picker's options are not read before it opens.
    if (isOpen) {
      apiClient.fetchTasks().then(setAvailableTasks).catch(() => setAvailableTasks([]));
      apiClient.fetchDrafts().then(setAvailableDrafts).catch(() => setAvailableDrafts([]));
    }
  }, [task, isOpen, isCreateMode, isDraftMode, availableStatuses, defaultDefinitionOfDone]);

  const refreshAfterCommentChange = useCallback(() => {
    if (!commentsChanged) return;
    setCommentsChanged(false);
    if (onSaved) void onSaved();
  }, [commentsChanged, onSaved]);

  const hasCommentDraft = commentBody.trim() !== "" || commentAuthor.trim() !== "";
  // Nothing is persisted while creating, so any entered field is unsaved work.
  const hasCreateModeEntries =
    isCreateMode &&
    (title.trim() !== "" ||
      priority.trim() !== "" ||
      milestone.trim() !== "" ||
      assignee.length > 0 ||
      labels.length > 0 ||
      dependencies.length > 0 ||
      references.length > 0 ||
      documentation.length > 0 ||
      modifiedFiles.length > 0);
  const hasUnsavedEdits =
    (mode === "edit" || mode === "create") && (isDirty || hasCommentDraft || hasCreateModeEntries);

  // Links inside the modal (dependency chips, auto-linked entity IDs in markdown) leave this
  // task behind, so they ask the same question cancel does before the navigation happens.
  const confirmNavigationAwayFromEdits = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!hasUnsavedEdits || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    const destination = new URL(link.href, window.location.href);
    if (destination.protocol !== "http:" && destination.protocol !== "https:") return;
    // Same-page anchors (markdown heading links) do not unload the form.
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (window.confirm("Discard unsaved changes and leave this task?")) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleCancelEdit = () => {
    if (demoting) return;
    if (isDirty) {
      const confirmDiscard = window.confirm(t.taskDetails.unsavedChangesPrompt);
      if (!confirmDiscard) return;
    }
    if (isCreateMode) {
      // In create mode, close the modal on cancel
      onClose();
    } else {
      setTitle(task?.title || "");
      setDescription(task?.description || "");
      setPlan(task?.implementationPlan || "");
      setNotes(task?.implementationNotes || "");
      setCommentBody("");
      setCommentAuthor("");
      setFinalSummary(task?.finalSummary || "");
      setCriteria(task?.acceptanceCriteriaItems || []);
      setDefinitionOfDone(task?.definitionOfDoneItems || []);
      setDueDate(task?.dueDate || "");
      setPlannedStart(task?.plannedStart || "");
      setPlannedEnd(task?.plannedEnd || "");
      setActualStart(task?.actualStart || "");
      setActualEnd(task?.actualEnd || "");
      setMode("preview");
      refreshAfterCommentChange();
    }
  };

  const normalizeChecklistItems = (items: AcceptanceCriterion[]): AcceptanceCriterion[] => {
    return items
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text.length > 0);
  };

  const buildDefinitionOfDoneCreatePayload = (): TaskUpdatePayload => {
    const cleanedCurrent = normalizeChecklistItems(definitionOfDone);
    const defaults = (definitionOfDoneDefaults ?? []).map((item) => item.trim()).filter((item) => item.length > 0);
    const defaultItems = defaults.map((text, index) => ({ index: index + 1, text, checked: false }));
    const defaultsMatch =
      cleanedCurrent.length >= defaultItems.length &&
      defaultItems.every(
        (item, index) =>
          cleanedCurrent[index]?.text === item.text && cleanedCurrent[index]?.checked === false,
      );

    const disableDefaults = !defaultsMatch;
    const definitionOfDoneAdd = disableDefaults
      ? cleanedCurrent.map((item) => item.text)
      : cleanedCurrent.slice(defaultItems.length).map((item) => item.text);

    const payload: TaskUpdatePayload = {};
    if (definitionOfDoneAdd.length > 0) {
      payload.definitionOfDoneAdd = definitionOfDoneAdd;
    }
    if (disableDefaults) {
      payload.disableDefinitionOfDoneDefaults = true;
    }
    return payload;
  };

  const buildDefinitionOfDoneEditPayload = (): TaskUpdatePayload => {
    const original = task?.definitionOfDoneItems ?? [];
    const cleanedCurrent = normalizeChecklistItems(definitionOfDone);
    const originalByIndex = new Map(original.map((item) => [item.index, item]));
    const currentByIndex = new Map(cleanedCurrent.map((item) => [item.index, item]));
    const removals = new Set<number>();
    const additions: string[] = [];
    const checks: number[] = [];
    const unchecks: number[] = [];

    let nextIndex = original.reduce((max, item) => Math.max(max, item.index), 0);

    for (const item of cleanedCurrent) {
      const originalItem = originalByIndex.get(item.index);
      if (!originalItem) {
        additions.push(item.text);
        nextIndex += 1;
        if (item.checked) {
          checks.push(nextIndex);
        }
        continue;
      }
      if (originalItem.text !== item.text) {
        removals.add(item.index);
        additions.push(item.text);
        nextIndex += 1;
        if (item.checked) {
          checks.push(nextIndex);
        }
        continue;
      }
      if (originalItem.checked !== item.checked) {
        if (item.checked) {
          checks.push(item.index);
        } else {
          unchecks.push(item.index);
        }
      }
    }

    for (const originalItem of original) {
      if (!currentByIndex.has(originalItem.index)) {
        removals.add(originalItem.index);
      }
    }

    const payload: TaskUpdatePayload = {};
    if (additions.length > 0) {
      payload.definitionOfDoneAdd = additions;
    }
    if (removals.size > 0) {
      payload.definitionOfDoneRemove = Array.from(removals);
    }
    if (checks.length > 0) {
      payload.definitionOfDoneCheck = checks;
    }
    if (unchecks.length > 0) {
      payload.definitionOfDoneUncheck = unchecks;
    }
    return payload;
  };

  const handleSave = async () => {
    if (demoting) return;
    setSaving(true);
    setError(null);

    // Validation for create mode
    if (isCreateMode && !title.trim()) {
      setError(t.common.failedToSave);
      setSaving(false);
      return;
    }

    try {
      // Promote temporary pasted images before saving.
      let saveDescription = description;
      let savePlan = plan;
      let saveNotes = notes;
      let saveFinalSummary = finalSummary;

      const tempUrls = [
        ...extractTempImageUrls(description),
        ...extractTempImageUrls(plan),
        ...extractTempImageUrls(notes),
        ...extractTempImageUrls(finalSummary),
      ];
      const uniqueTempUrls = [...new Set(tempUrls)];
      if (uniqueTempUrls.length > 0) {
        const mapping = await apiClient.promoteAssets(uniqueTempUrls);
        saveDescription = replaceTempImageUrls(saveDescription, mapping);
        savePlan = replaceTempImageUrls(savePlan, mapping);
        saveNotes = replaceTempImageUrls(saveNotes, mapping);
        saveFinalSummary = replaceTempImageUrls(saveFinalSummary, mapping);
        setDescription(saveDescription);
        setPlan(savePlan);
        setNotes(saveNotes);
        setFinalSummary(saveFinalSummary);
      }

      const taskData: TaskUpdatePayload = {
        title: title.trim(),
        description: saveDescription,
        implementationPlan: savePlan,
        implementationNotes: saveNotes,
        finalSummary: saveFinalSummary,
        acceptanceCriteriaItems: criteria,
        status,
        labels,
        priority: (priority === "" ? undefined : priority) as "high" | "medium" | "low" | undefined,
        dependencies,
        references,
        documentation,
        modifiedFiles,
        milestone: milestone.trim().length > 0 ? milestone.trim() : undefined,
        dueDate: dueDate.trim(),
        plannedStart: plannedStart.trim(),
        plannedEnd: plannedEnd.trim(),
        actualStart: actualStart.trim(),
        actualEnd: actualEnd.trim(),
      };

      // In create mode, omit assignee when it matches the configured default so the core
      // applies defaultAssignee (and respects later config changes). Otherwise send the
      // explicit value, including an empty array for "intentionally unassigned".
      if (!isCreateMode || !areJsonEqual(assignee, defaultAssignee ?? [])) {
        taskData.assignee = assignee;
      }

      if (isCreateMode && onSubmit) {
        Object.assign(taskData, buildDefinitionOfDoneCreatePayload());
        // Create new task
        await onSubmit(taskData);
        // Only close if successful (no error thrown)
        onClose();
      } else if (task) {
        Object.assign(taskData, buildDefinitionOfDoneEditPayload());
        // Update existing task
        await apiClient.updateTask(task.id, taskData);
        setMode("preview");
        if (onSaved) await onSaved();
        setCommentsChanged(false);
      }
    } catch (err) {
      // Extract and display the error message from API response
      let errorMessage = t.common.failedToSave;

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null && 'error' in err) {
        errorMessage = String((err as any).error);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCriterion = async (index: number, checked: boolean) => {
    if (demoting) return;
    if (!task) return; // Can't toggle in create mode
    if (isReadOnly) return; // Can't toggle for records the board does not own
    // Optimistic update
    const next = (criteria || []).map((c) => (c.index === index ? { ...c, checked } : c));
    setCriteria(next);
    try {
      await apiClient.updateTask(task.id, { acceptanceCriteriaItems: next });
      if (onSaved) await onSaved();
    } catch (err) {
      // rollback
      setCriteria(criteria);
      console.error(t.common.failedToSave, err);
    }
  };

  const handleToggleDefinitionOfDone = async (index: number, checked: boolean) => {
    if (demoting) return;
    if (!task) return; // Can't toggle in create mode
    if (isReadOnly) return; // Can't toggle for records the board does not own
    const next = (definitionOfDone || []).map((c) => (c.index === index ? { ...c, checked } : c));
    setDefinitionOfDone(next);
    try {
      const updates: TaskUpdatePayload = checked
        ? { definitionOfDoneCheck: [index] }
        : { definitionOfDoneUncheck: [index] };
      await apiClient.updateTask(task.id, updates);
      if (onSaved) await onSaved();
    } catch (err) {
      setDefinitionOfDone(definitionOfDone);
      console.error(t.common.failedToSave, err);
    }
  };

  const handleInlineMetaUpdate = async (updates: InlineMetaUpdatePayload) => {
    if (demoting) return;
    // Don't allow updates for off-board records
    if (isReadOnly) return;

    // The server write happens after the optimistic set below, so remember what was on screen:
    // a rejected update (dependency gate, lock conflict) must roll back, otherwise a chip or a
    // status sits there as if it had been saved when the file says otherwise.
    const previous: Record<string, unknown> = {};

    // Optimistic UI
    if (updates.status !== undefined) {
      previous.status = status;
      setStatus(String(updates.status));
    }
    if (updates.assignee !== undefined) {
      previous.assignee = assignee;
      setAssignee(updates.assignee as string[]);
    }
    if (updates.labels !== undefined) {
      previous.labels = labels;
      setLabels(updates.labels as string[]);
    }
    if (updates.priority !== undefined) {
      previous.priority = priority;
      setPriority(String(updates.priority));
    }
    if (updates.dependencies !== undefined) {
      previous.dependencies = dependencies;
      setDependencies(updates.dependencies as string[]);
      setDependencySaveError(null);
    }
    if (updates.references !== undefined) {
      previous.references = references;
      setReferences(updates.references as string[]);
    }
    if (updates.documentation !== undefined) {
      previous.documentation = documentation;
      setDocumentation(updates.documentation as string[]);
    }
    if (updates.modifiedFiles !== undefined) {
      previous.modifiedFiles = modifiedFiles;
      setModifiedFiles(updates.modifiedFiles as string[]);
    }
    if (updates.milestone !== undefined) {
      previous.milestone = milestone;
      setMilestone((updates.milestone ?? "") as string);
    }

    // Only update server if editing existing task
    if (task) {
      try {
        await apiClient.updateTask(task.id, updates);
        if (onSaved) await onSaved();
      } catch (err) {
        // Put the pre-edit values back: the file does not hold the optimistic ones, and the
        // dirty-preserve refresh would otherwise keep the rejected value on screen forever.
        if (previous.status !== undefined) setStatus(String(previous.status));
        if (previous.assignee !== undefined) setAssignee(previous.assignee as string[]);
        if (previous.labels !== undefined) setLabels(previous.labels as string[]);
        if (previous.priority !== undefined) setPriority(String(previous.priority));
        if (previous.dependencies !== undefined) setDependencies(previous.dependencies as string[]);
        if (previous.references !== undefined) setReferences(previous.references as string[]);
        if (previous.documentation !== undefined) setDocumentation(previous.documentation as string[]);
        if (previous.modifiedFiles !== undefined) setModifiedFiles(previous.modifiedFiles as string[]);
        if (previous.milestone !== undefined) setMilestone((previous.milestone ?? "") as string);
        const message = localizeDependencySaveError(err, t);
        // A dependency rejection surfaces next to the input the user was typing in; everything
        // else keeps using the banner at the top of the popup.
        if (updates.dependencies !== undefined) setDependencySaveError(message);
        else setError(message);
      } finally {
        // Refetch the closure only once the write has settled, success or not: on failure the
        // refetch re-syncs the display with what the file actually says.
        setClosureRefreshTick((tick) => tick + 1);
      }
    }
  };

  const handleAddComment = async () => {
    if (demoting) return;
    if (!task || isReadOnly) return;
    const body = commentBody.trim();
    if (!body) return;
    const author = commentAuthor.trim();
    if (containsCommentDelimiterLine(body)) {
      setError("Comment body cannot contain standalone '---' delimiter lines.");
      return;
    }
    if (author && containsCommentDelimiterLine(author)) {
      setError("Comment author cannot contain standalone '---' delimiter lines.");
      return;
    }
    setCommentSaving(true);
    setError(null);
    try {
      // Promote temporary pasted images before saving, exactly like the other
      // markdown fields: rewrite the body with the permanent URLs and keep the
      // rewritten text in the editor so a failed save can be retried.
      let bodyToSave = body;
      const tempUrls = extractTempImageUrls(body);
      if (tempUrls.length > 0) {
        const mapping = await apiClient.promoteAssets(tempUrls);
        bodyToSave = replaceTempImageUrls(bodyToSave, mapping);
        setCommentBody(bodyToSave);
      }
      const updatedTask = await apiClient.updateTask(task.id, {
        commentsAppend: [bodyToSave],
        ...(author.length > 0 && { commentAuthor: author }),
      });
      setDisplayComments(updatedTask.comments ?? []);
      setCommentsChanged(true);
      setCommentBody("");
      setCommentAuthor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommentSaving(false);
    }
  };

  const handleDeleteComment = async (index: number) => {
    if (demoting) return;
    if (!task || isReadOnly) return;
    if (!window.confirm(t.taskDetails.deleteCommentConfirm)) return;
    setCommentSaving(true);
    setError(null);
    try {
      const updatedTask = await apiClient.updateTask(task.id, { commentRemove: [index] });
      setDisplayComments(updatedTask.comments ?? []);
      setCommentsChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommentSaving(false);
    }
  };

  const handleClearComments = async () => {
    if (demoting) return;
    if (!task || isReadOnly) return;
    if (comments.length === 0) return;
    if (!window.confirm(t.taskDetails.clearCommentsConfirm)) return;
    setCommentSaving(true);
    setError(null);
    try {
      const updatedTask = await apiClient.updateTask(task.id, { commentClear: true });
      setDisplayComments(updatedTask.comments ?? []);
      setCommentsChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommentSaving(false);
    }
  };

  // labels handled via ChipInput; no textarea parsing

	const handleComplete = async () => {
		if (demoting) return;
		if (!task) return;
		if (!window.confirm(t.taskDetails.completeConfirm)) return;
		try {
			await apiClient.completeTask(task.id);
			if (onSaved) await onSaved();
			onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

	const handleDemote = async () => {
		if (demoting || !task || isDraftTask || isDoneStatus || isReadOnly) return;
		if (activeDemotionRequest.current !== null) return;
		if (!window.confirm(t.taskDetails.demoteConfirm)) return;

		const request = { identity: demotionIdentity };
		activeDemotionRequest.current = request;
		// Every continuation has to prove that both the request it came from and the record it is
		// about are still the current ones before it may touch state, refresh or close.
		const isCurrentRequest = () =>
			activeDemotionRequest.current === request && demotionIdentityRef.current === request.identity;
		// The record has already moved, so the user has to learn about the follow-up failure before
		// the popup disappears even when the refresh itself is what broke.
		const finishWithRefreshWarning = async (message: string) => {
			window.dispatchEvent(new CustomEvent("drafts-updated"));
			try {
				if (onSaved) await onSaved();
			} catch (refreshError) {
				console.error("Task was demoted, but refreshing the Web UI failed", refreshError);
			}
			if (!isCurrentRequest()) return;
			try {
				window.alert(message);
			} catch {
				setError(message);
			}
			onClose();
		};

		setDemoting(true);
		setError(null);
		try {
			await apiClient.demoteTask(task.id);
			if (!isCurrentRequest()) return;
			try {
				window.dispatchEvent(new CustomEvent("drafts-updated"));
				if (onSaved) await onSaved();
			} catch {
				await finishWithRefreshWarning(t.taskDetails.demoteRefreshFailed);
				return;
			}
			if (!isCurrentRequest()) return;
			onClose();
		} catch (err) {
			if (!isCurrentRequest()) return;
			// A lost response is not a rejection: the move may well have happened, so the user has
			// to verify the drafts list instead of being told the demotion failed.
			if (err instanceof NetworkError) {
				await finishWithRefreshWarning(t.taskDetails.demoteResponseLost);
				return;
			}
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			if (isCurrentRequest()) {
				activeDemotionRequest.current = null;
				setDemoting(false);
			}
		}
	};

	const handlePromote = async () => {
		if (demoting) return;
		if (!task) return;
		if (!window.confirm(t.taskDetails.promoteConfirm)) return;
		try {
			const promotedTask = await apiClient.promoteDraft(task.id);
			if (onSaved) await onSaved();
			window.dispatchEvent(new CustomEvent('drafts-updated'));
			onClose();
			if (onPromoted) onPromoted(promotedTask);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

  const handleArchive = async () => {
    if (demoting) return;
    if (!task || !onArchive) return;
    if (!window.confirm(t.taskDetails.archiveConfirm(task.title))) return;
    onArchive();
    onClose();
  };

  const checkedCount = (criteria || []).filter((c) => c.checked).length;
  const totalCount = (criteria || []).length;
  const definitionCheckedCount = (definitionOfDone || []).filter((c) => c.checked).length;
  const definitionTotalCount = (definitionOfDone || []).length;
  const comments = displayComments;

  const displayId = task?.id ?? "";


  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={() => {
        // A demotion is already moving the record; closing here would hide what it reports.
        if (demoting) return;
        // When in edit mode, confirm closing if dirty
        if (mode === "edit" && isDirty) {
          if (!window.confirm(t.taskDetails.discardAndClosePrompt)) return;
        }
        refreshAfterCommentChange();
        onClose();
      }}
      title={isCreateMode ? (isDraftMode ? t.taskDetails.createDraft : t.taskDetails.createTask) : `${displayId} — ${task.title}`}
      maxWidthClass="max-w-5xl"
      disableEscapeClose={mode === "edit" || mode === "create" || demoting || showGraph}
      leftActions={
        // The graph is a step into this task, so the arrow that leaves it sits where a drill-down
        // already puts one and does what the graph's own close used to: back to the detail view.
        showGraph ? (
          <HeaderBackButton
            onClick={() => setShowGraph(false)}
            label={t.taskDetails.dependencyGraphBack}
          />
        ) : onBack ? (
          <HeaderBackButton onClick={onBack} label={t.common.back} />
        ) : undefined
      }
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
		          {isDoneStatus && mode === "preview" && !isCreateMode && !isReadOnly && (
		            <button
		              onClick={handleComplete}
		              disabled={demoting}
		              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.taskDetails.markCompletedTitle}
		            >
		              {t.taskDetails.markCompleted}
		            </button>
		          )}
		          {!isDoneStatus && !isDraftTask && mode === "preview" && !isCreateMode && !isReadOnly && (
		            <button
		              onClick={handleDemote}
		              disabled={demoting}
		              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
		              title={t.taskDetails.demoteToDraftTitle}
		            >
		              {demoting ? t.taskDetails.demoteInProgress : t.taskDetails.demoteToDraft}
		            </button>
		          )}
		          {isDraftTask && mode === "preview" && !isCreateMode && !isReadOnly && (
		            <button
		              onClick={handlePromote}
		              disabled={demoting}
		              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-700 hover:bg-emerald-700 dark:hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.taskDetails.promoteToTaskTitle}
		            >
		              {t.taskDetails.promoteToTask}
		            </button>
		          )}
		          {mode === "preview" && !isCreateMode && !isReadOnly ? (
		            <button
		              onClick={() => setMode("edit")}
		              disabled={demoting}
		              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		              title={t.common.edit}
		            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t.common.edit}
            </button>
          ) : (mode === "edit" || mode === "create") ? (
            <div className="flex items-center gap-2">
		              <button
		                onClick={handleCancelEdit}
		                disabled={demoting}
		                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
		                title={t.common.cancel}
		              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t.common.cancel}
              </button>
		              <button
		                onClick={() => void handleSave()}
		                disabled={saving || demoting}
		                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 disabled:opacity-50"
		                title={t.common.save}
		              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {saving ? t.common.saving : (isCreateMode ? t.common.create : t.common.save)}
              </button>
            </div>
          ) : null}
        </div>
      }
    >
      {showGraph && task ? (
        <TaskDependencyGraph
          focusId={task.id}
          graphVersion={graphVersion}
          viewports={graphViewportsRef.current}
          hiddenStyles={graphHiddenStyles.get(task.id)}
          onHiddenStylesChange={(next) => {
            setGraphHiddenStyles((previous) => new Map(previous).set(task.id, next));
          }}
          onTaskClick={handleGraphTaskClick}
        />
      ) : (
      <>
      {error && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Off-board record indicator: cross-branch or completed corpus */}
      {isReadOnly && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-200">
          <svg className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div className="flex-1">
            <span className="font-medium">{t.common.readOnly}:</span>{" "}
            {isFromOtherBranch
              ? t.taskDetails.crossBranchHint(task?.branch || "")
              : t.taskDetails.completedCorpusHint}
          </div>
        </div>
      )}

      {/* Parent/subtask hierarchy */}
      {task && !isCreateMode && (
        <TaskHierarchySection task={task} availableTasks={availableTasks} onTaskClick={handleTaskClick} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" onClickCapture={confirmNavigationAwayFromEdits}>
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Title field for create mode */}
          {isCreateMode && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <SectionHeader title={t.taskDetails.section.title} />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.taskDetails.placeholderTitle}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
              />
            </div>
          )}
          {/* Description */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.description} />
            {mode === "preview" ? (
              description ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={description} onFileClick={(path) => setPreviewTarget({ kind: "file", path })} onTaskClick={handleTaskClick} onDraftClick={handleDraftClick} onDocClick={handleDocClick} onDecisionClick={handleDecisionClick} onWikiClick={handleWikiClick} wikilinkBasePath="index.md" />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDescription}</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                <PasteAwareMDEditor
                  value={description}
                  onChange={(val) => setDescription(val || "")}
                  preview="edit"
                  height={320}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* References, Documentation and Modified Files are one panel: the three list-shaped
              metadata fields share a tab strip instead of stacking as three cards, so a long file
              list cannot push the sections below out of reach. */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div role="tablist" aria-label={t.taskDetails.metadataTabsLabel} className="flex flex-wrap gap-1 mb-3">
              <MetadataTabButton
                tab="references"
                label={t.taskDetails.section.references}
                count={references.length}
                active={activeMetadataTab === "references"}
                onSelect={setMetadataTab}
              />
              <MetadataTabButton
                tab="documentation"
                label={t.taskDetails.section.documentation}
                count={documentation.length}
                active={activeMetadataTab === "documentation"}
                onSelect={setMetadataTab}
              />
              <MetadataTabButton
                tab="modifiedFiles"
                label={t.taskDetails.section.modifiedFiles}
                count={modifiedFiles.length}
                active={activeMetadataTab === "modifiedFiles"}
                onSelect={setMetadataTab}
              />
            </div>

            {activeMetadataTab === "references" && (
              <div
                role="tabpanel"
                id="task-details-metadata-panel-references"
                aria-labelledby={metadataTabId("references")}
                className="space-y-3"
              >
                {references.length > 0 ? (
                  <ul className="space-y-2">
                    {references.map((ref, idx) => (
                      <li key={idx} className="flex items-center gap-3 group">
                        <span className="flex-1 min-w-0">
                          {ref.startsWith("http://") || ref.startsWith("https://") ? (
                            <a
                              href={ref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                            >
                              {ref}
                            </a>
                          ) : (
                            <button
                              onClick={() => setPreviewTarget({ kind: "file", path: ref })}
                              className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                              title={t.taskDetails.clickToPreview}
                            >
                              {ref}
                            </button>
                          )}
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              const newRefs = references.filter((_, i) => i !== idx);
                              handleInlineMetaUpdate({ references: newRefs });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                            title={t.taskDetails.removeReference}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noReferences}</p>
                )}
                {!isReadOnly && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("newRef") as HTMLInputElement;
                      const value = input.value.trim();
                      if (value && !references.includes(value)) {
                        handleInlineMetaUpdate({ references: [...references, value] });
                        input.value = "";
                      }
                    }}
                    className="flex gap-2"
                  >
                    <PathAutocomplete
                      name="newRef"
                      placeholder={t.taskDetails.placeholderRefDoc}
                      className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      {t.common.add}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeMetadataTab === "documentation" && (
              <div
                role="tabpanel"
                id="task-details-metadata-panel-documentation"
                aria-labelledby={metadataTabId("documentation")}
                className="space-y-3"
              >
                {documentation.length > 0 ? (
                  <ul className="space-y-2">
                    {documentation.map((doc, idx) => (
                      <li key={idx} className="flex items-center gap-3 group">
                        <span className="flex-1 min-w-0">
                          {doc.startsWith("http://") || doc.startsWith("https://") ? (
                            <a
                              href={doc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                            >
                              {doc}
                            </a>
                          ) : (
                            <button
                              onClick={() => setPreviewTarget({ kind: "file", path: doc })}
                              className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                              title={t.taskDetails.clickToPreview}
                            >
                              {doc}
                            </button>
                          )}
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              const newDocs = documentation.filter((_, i) => i !== idx);
                              handleInlineMetaUpdate({ documentation: newDocs });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                            title={t.taskDetails.removeDocumentation}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDocumentation}</p>
                )}
                {!isReadOnly && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("newDoc") as HTMLInputElement;
                      const value = input.value.trim();
                      if (value && !documentation.includes(value)) {
                        handleInlineMetaUpdate({ documentation: [...documentation, value] });
                        input.value = "";
                      }
                    }}
                    className="flex gap-2"
                  >
                    <PathAutocomplete
                      name="newDoc"
                      placeholder={t.taskDetails.placeholderRefDoc}
                      className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      {t.common.add}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeMetadataTab === "modifiedFiles" && (
              <div
                role="tabpanel"
                id="task-details-metadata-panel-modifiedFiles"
                aria-labelledby={metadataTabId("modifiedFiles")}
                className="space-y-3"
              >
                {modifiedFiles.length > 0 ? (
                  <ul className="space-y-2">
                    {modifiedFiles.map((file, idx) => (
                      <li key={idx} className="flex items-center gap-3 group">
                        <span className="flex-1 min-w-0">
                          {/* Same rendering as a reference path, minus the URL branch: a modified file
                              is always a path from the project root. */}
                          <button
                            onClick={() => setPreviewTarget({ kind: "file", path: file })}
                            className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded break-all hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-left"
                            title={t.taskDetails.clickToPreview}
                          >
                            {file}
                          </button>
                        </span>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              const newFiles = modifiedFiles.filter((_, i) => i !== idx);
                              handleInlineMetaUpdate({ modifiedFiles: newFiles });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                            title={t.taskDetails.removeModifiedFile}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noModifiedFiles}</p>
                )}
                {!isReadOnly && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem("newModifiedFile") as HTMLInputElement;
                      const value = input.value.trim();
                      if (value && !looksLikeUrl(value) && !modifiedFiles.includes(value)) {
                        handleInlineMetaUpdate({ modifiedFiles: [...modifiedFiles, value] });
                        input.value = "";
                      }
                    }}
                    className="flex gap-2"
                  >
                    <PathAutocomplete
                      name="newModifiedFile"
                      placeholder={t.taskDetails.placeholderRefDoc}
                      className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      {t.common.add}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Acceptance Criteria */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader
              title={`${t.taskDetails.section.acceptanceCriteria} ${totalCount ? `(${checkedCount}/${totalCount})` : ""}`}
              right={mode === "preview" ? (
                <span>{t.taskDetails.toggleToUpdate}</span>
              ) : null}
            />
            {mode === "preview" ? (
              <ul className="space-y-2">
                {(criteria || []).map((c) => (
                  <li key={c.index} className="flex items-start gap-2 rounded-md px-2 py-1">
                    <div className="flex items-start gap-1">
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={(e) => void handleToggleCriterion(c.index, e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="mt-0.5 font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {`#${c.index}`}
                      </span>
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-100">{c.text}</div>
                  </li>
                ))}
                {totalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noAcceptanceCriteria}</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} />
            )}
          </div>

          {/* Definition of Done */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader
              title={`${t.taskDetails.section.definitionOfDone} ${definitionTotalCount ? `(${definitionCheckedCount}/${definitionTotalCount})` : ""}`}
              right={mode === "preview" ? (
                <span>{t.taskDetails.toggleToUpdate}</span>
              ) : null}
            />
            {mode === "preview" ? (
              <ul className="space-y-2">
                {(definitionOfDone || []).map((item) => (
                  <li key={item.index} className="flex items-start gap-2 rounded-md px-2 py-1">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => void handleToggleDefinitionOfDone(item.index, e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="text-sm text-gray-800 dark:text-gray-100">{item.text}</div>
                  </li>
                ))}
                {definitionTotalCount === 0 && (
                  <li className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noDefinitionOfDone}</li>
                )}
              </ul>
            ) : (
              <AcceptanceCriteriaEditor
                criteria={definitionOfDone}
                onChange={setDefinitionOfDone}
                label={t.taskDetails.section.definitionOfDone}
                preserveIndices
                disableToggle={isCreateMode}
              />
            )}
          </div>

          {/* Implementation Plan */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.implementationPlan} />
            {mode === "preview" ? (
              plan ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={plan} onFileClick={(path) => setPreviewTarget({ kind: "file", path })} onTaskClick={handleTaskClick} onDraftClick={handleDraftClick} onDocClick={handleDocClick} onDecisionClick={handleDecisionClick} onWikiClick={handleWikiClick} wikilinkBasePath="index.md" />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noPlan}</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                <PasteAwareMDEditor
                  value={plan}
                  onChange={(val) => setPlan(val || "")}
                  preview="edit"
                  height={280}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* Implementation Notes */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <SectionHeader title={t.taskDetails.section.implementationNotes} />
            {mode === "preview" ? (
              notes ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={notes} onFileClick={(path) => setPreviewTarget({ kind: "file", path })} onTaskClick={handleTaskClick} onDraftClick={handleDraftClick} onDocClick={handleDocClick} onDecisionClick={handleDecisionClick} onWikiClick={handleWikiClick} wikilinkBasePath="index.md" />
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noNotes}</div>
              )
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                <PasteAwareMDEditor
                  value={notes}
                  onChange={(val) => setNotes(val || "")}
                  preview="edit"
                  height={280}
                  data-color-mode={theme}
                />
              </div>
            )}
          </div>

          {/* Comments */}
          {!isCreateMode && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <SectionHeader
                title={`${t.taskDetails.section.comments}${comments.length ? ` (${comments.length})` : ""}`}
                right={!isReadOnly && comments.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleClearComments()}
                    disabled={commentSaving}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title={t.taskDetails.clearComments}
                  >
                    {t.taskDetails.clearCommentsLabel}
                  </button>
                ) : null}
              />
              {comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <article key={`${comment.index}-${comment.createdDate}`} className="border-l-2 border-gray-200 dark:border-gray-700 pl-3 group">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">#{comment.index}</span>
                        {comment.author ? <span>{comment.author}</span> : null}
                        {comment.createdDate ? <span><StoredDate value={comment.createdDate} /></span> : null}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteComment(comment.index)}
                            disabled={commentSaving}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 disabled:opacity-50"
                            title={t.taskDetails.deleteComment}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                        <MermaidMarkdown source={comment.body} wikilinkBasePath="index.md" />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">{t.taskDetails.noComments}</div>
              )}
              {!isReadOnly && (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder={t.taskDetails.placeholderCommentAuthor}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
                  />
                  <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                    <PasteAwareMDEditor
                      value={commentBody}
                      onChange={(val) => setCommentBody(val || "")}
                      preview="edit"
                      height={200}
                      data-color-mode={theme}
                      commands={COMMENT_EDITOR_COMMANDS}
                      textareaProps={{ placeholder: t.taskDetails.placeholderCommentBody }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleAddComment()}
                      disabled={commentSaving || commentBody.trim().length === 0}
                      className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                    >
                      {commentSaving ? t.taskDetails.addingComment : t.taskDetails.addComment}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Final Summary */}
          {(mode !== "preview" || finalSummary.trim().length > 0) && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <SectionHeader title={t.taskDetails.section.finalSummary} right={t.taskDetails.section.completionSummary} />
              {mode === "preview" ? (
                <div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
                  <MermaidMarkdown source={finalSummary} onFileClick={(path) => setPreviewTarget({ kind: "file", path })} onTaskClick={handleTaskClick} onDraftClick={handleDraftClick} onDocClick={handleDocClick} onDecisionClick={handleDecisionClick} onWikiClick={handleWikiClick} wikilinkBasePath="index.md" />
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md">
                  <PasteAwareMDEditor
                    value={finalSummary}
                    onChange={(val) => setFinalSummary(val || "")}
                    preview="edit"
                    height={220}
                    data-color-mode={theme}
                    textareaProps={{
                      placeholder: t.taskDetails.placeholderFinalSummary,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          {/* Dates */}
	          {task && (
	            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
	              <div><span className="font-semibold text-gray-800 dark:text-gray-100">{t.common.created}:</span> <span className="text-gray-700 dark:text-gray-200"><StoredDate value={task.createdDate} /></span></div>
	              {task.updatedDate && (
	                <div><span className="font-semibold text-gray-800 dark:text-gray-100">{t.common.updated}:</span> <span className="text-gray-700 dark:text-gray-200"><StoredDate value={task.updatedDate} /></span></div>
	              )}
	            </div>
	          )}
          {/* Title (editable for existing tasks) */}
          {task && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <SectionHeader title={t.taskDetails.section.title} />
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                onBlur={() => {
                  if (title.trim() && title !== task.title) {
                    void handleInlineMetaUpdate({ title: title.trim() });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                disabled={isReadOnly}
                className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
          )}

          {/* Status */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.status} />
            <StatusSelect current={status} onChange={(val) => handleInlineMetaUpdate({ status: val })} disabled={isReadOnly || isDraftTask} />
          </div>

          {/* Assignee */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.assignee} />
            <ChipInput
              name="assignee"
              label=""
              value={assignee}
              onChange={(value) => handleInlineMetaUpdate({ assignee: value })}
              placeholder={t.taskDetails.placeholderAssignee}
              disabled={isReadOnly}
              availableOptions={availableAssignees}
            />
          </div>

          {/* Labels */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.labels} />
            <ChipInput
              name="labels"
              label=""
              value={labels}
              onChange={(value) => handleInlineMetaUpdate({ labels: value })}
              placeholder={t.taskDetails.placeholderLabels}
              disabled={isReadOnly}
              availableOptions={availableLabels}
            />
          </div>

          {/* Priority */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.priority} />
            <select
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={priority}
              onChange={(e) => handleInlineMetaUpdate({ priority: e.target.value as any })}
              disabled={isReadOnly}
            >
              <option value="">{t.common.none}</option>
              <option value="low">{t.common.low}</option>
              <option value="medium">{t.common.medium}</option>
              <option value="high">{t.common.high}</option>
            </select>
          </div>

          {/* Milestone */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.milestone} />
            <select
              className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={milestoneSelectionValue}
				onChange={(e) => {
					const value = e.target.value;
					setMilestone(value);
					handleInlineMetaUpdate({ milestone: value.trim().length > 0 ? value : null });
				}}
              disabled={isReadOnly}
            >
              <option value="">{t.taskDetails.noMilestone}</option>
              {!hasMilestoneSelection && milestoneSelectionValue ? (
                <option value={milestoneSelectionValue}>{resolveMilestoneLabel(milestoneSelectionValue)}</option>
              ) : null}
              {(milestoneEntities ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Dependencies */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader
              title={t.taskDetails.section.dependencies}
              right={
                task && !isCreateMode ? (
                  <button
                    type="button"
                    onClick={() => setShowGraph(true)}
                    title={t.taskDetails.dependencyGraphToggle}
                    aria-label={t.taskDetails.dependencyGraphToggle}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="6" cy="6" r="2.5" strokeWidth={2} />
                      <circle cx="18" cy="6" r="2.5" strokeWidth={2} />
                      <circle cx="6" cy="18" r="2.5" strokeWidth={2} />
                      <circle cx="18" cy="18" r="2.5" strokeWidth={2} fill="currentColor" stroke="none" />
                      <path strokeLinecap="round" strokeWidth={2} d="M8.5 6h7M6 8.5v7m12-7v7M8.5 18h7" />
                    </svg>
                  </button>
                ) : undefined
              }
            />
            <DependencyInput
              value={dependencies}
              onChange={(value) => handleInlineMetaUpdate({ dependencies: value })}
              availableTasks={dependencyCorpus}
              currentTaskId={task?.id}
              label=""
              disabled={isReadOnly}
              searchCompletedTasks={searchCompletedDependencies}
              onTaskClick={(taskId) => {
                const targetTask = dependencyCorpus.find(t => stripAnyPrefix(t.id) === taskId || t.id === taskId);
                if (targetTask && onDrillDown) {
                  onDrillDown(targetTask);
                }
              }}
            />
            {dependencySaveError && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <span aria-hidden="true">⚠</span>
                <span>{dependencySaveError}</span>
              </div>
            )}
            {readiness && (
              <div
                className={`mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium ${
                  readiness.isReady
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span aria-hidden="true">{readiness.isReady ? '✓' : '⏳'}</span>
                <span>{readiness.isReady ? 'Ready to start' : formatReadinessBlockers(readiness)}</span>
              </div>
            )}
            {hasClosureContent && (
              <div className="mt-2 space-y-1.5 text-xs">
                {closureFailed && (
                  <div className="rounded-md bg-gray-100 px-2 py-1.5 text-gray-400 dark:bg-gray-900/40 dark:text-gray-500">
                    {t.taskDetails.closureUnavailable}
                  </div>
                )}
                {closure && (
                  <>
                    <ClosureDirectionList icon="↑" label={t.taskDetails.closureWaitsFor} answer={closure.dependencies} />
                    <ClosureDirectionList icon="↓" label={t.taskDetails.closureWaitedOnBy} answer={closure.dependents} />
                    {closure.dependencies.cycle.length > 0 && (
                      <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <span aria-hidden="true">↻</span>
                        <span>
                          {t.taskDetails.closureCycle}: {closure.dependencies.cycle.join(' → ')}
                        </span>
                      </div>
                    )}
                    {closure.dependencies.truncated && (
                      <div className="px-2 text-gray-400 dark:text-gray-500">{t.taskDetails.closureTruncated}</div>
                    )}
                    {closure.unresolved.length > 0 && (
                      <div className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <span aria-hidden="true">⚠</span>
                        <span>
                          {t.taskDetails.closureUnresolved}:{' '}
                          {closure.unresolved
                            .map((defect) => `${defect.source} → ${defect.reference}`)
                            .join(', ')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <SectionHeader title={t.taskDetails.section.dates} />
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.dueDate}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDueDate(value);
                    let updates: InlineMetaUpdatePayload = { dueDate: value };
                    if (value && !plannedStart) {
                      const today = new Date().toISOString().slice(0, 10);
                      if (value >= today) {
                        setPlannedStart(today);
                        setPlannedEnd(value);
                        updates.plannedStart = today;
                        updates.plannedEnd = value;
                      }
                    }
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate(updates);
                    }
                  }}
                  disabled={isReadOnly}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.plannedStart}</label>
                <input
                  type="date"
                  value={plannedStart}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlannedStart(value);
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate({ plannedStart: value });
                    }
                  }}
                  disabled={isReadOnly}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.plannedEnd}</label>
                <input
                  type="date"
                  value={plannedEnd}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlannedEnd(value);
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate({ plannedEnd: value });
                    }
                  }}
                  disabled={isReadOnly}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.actualStart}</label>
                <input
                  type="datetime-local"
                  value={storedUtcToDateTimeLocal(actualStart)}
                  onChange={(e) => {
                    const value = dateTimeLocalToStoredUtc(e.target.value);
                    setActualStart(value);
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate({ actualStart: value });
                    }
                  }}
                  disabled={isReadOnly}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t.taskDetails.section.actualEnd}</label>
                <input
                  type="datetime-local"
                  value={storedUtcToDateTimeLocal(actualEnd)}
                  onChange={(e) => {
                    const value = dateTimeLocalToStoredUtc(e.target.value);
                    setActualEnd(value);
                    if (task && !isCreateMode) {
                      handleInlineMetaUpdate({ actualEnd: value });
                    }
                  }}
                  disabled={isReadOnly}
                  className={`w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 dark:[color-scheme:dark] ${isReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Archive button at bottom of sidebar */}
		          {task && onArchive && !isReadOnly && (
		            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
		              <button
		                onClick={handleArchive}
		                className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-500 dark:bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-400 dark:focus:ring-red-500 transition-colors duration-200"
		              >
		                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {t.taskDetails.archiveTask}
              </button>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </Modal>
    {previewTarget?.kind === "file" && (
      <FilePreviewModal
        path={previewTarget.path}
        onClose={() => setPreviewTarget(null)}
      />
    )}
    {previewTarget?.kind === "entity" && (
      <FilePreviewModal
        path={`preview://${previewTarget.type}/${previewTarget.id}:${previewTarget.lineStart ?? ""}${previewTarget.lineEnd !== undefined ? `-${previewTarget.lineEnd}` : ""}`}
        onClose={() => setPreviewTarget(null)}
        loader={() => apiClient.fetchPreview(previewTarget.type, previewTarget.id, previewTarget.lineStart, previewTarget.lineEnd)}
      />
    )}
    </>
  );
};

const StatusSelect: React.FC<{ current: string; onChange: (v: string) => void; disabled?: boolean }> = ({ current, onChange, disabled }) => {
  const [statuses, setStatuses] = useState<string[]>([]);
  useEffect(() => {
    apiClient.fetchStatuses().then(setStatuses).catch(() => setStatuses(["To Do", "In Progress", "Done"]));
  }, []);
  // A draft is on status Draft, and a completed record can hold a historical status, neither of
  // which is configured. Showing the value the record actually has beats showing the first option.
  const options = !current || statuses.includes(current) ? statuses : [current, ...statuses];
  return (
    <select
      className={`w-full h-10 px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
};

/**
 * Runtime shape check for the closure endpoint's answer: the fetch layer is typed, but a stubbed or
 * otherwise misbehaving backend can still resolve with anything, and rendering that crashes.
 */
const isDependencyQueryAnswer = (value: unknown): value is DependencyQueryAnswer => {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<DependencyQueryAnswer>;
	return (
		typeof candidate.subject === "object" &&
		candidate.subject !== null &&
		typeof candidate.dependencies === "object" &&
		candidate.dependencies !== null &&
		Array.isArray(candidate.dependencies.rows) &&
		typeof candidate.dependents === "object" &&
		candidate.dependents !== null &&
		Array.isArray(candidate.dependents.rows) &&
		Array.isArray(candidate.unresolved)
	);
};

/**
 * A gate rejection reaches the client as an ApiError carrying { code, detail } alongside the
 * English text. Render the known codes in the user's locale; anything else falls back to the
 * raw server message, which stays correct even when a new gate error has no translation yet.
 */
const localizeDependencySaveError = (err: unknown, t: TranslationDict): string => {
  if (err instanceof ApiError && err.data !== null && typeof err.data === "object") {
    const data = err.data as {
      code?: string;
      detail?: { chain?: string[]; taskId?: string; dependency?: string; kind?: string };
    };
    if (data.code === "dependency_cycle" && data.detail?.chain && data.detail.chain.length > 0) {
      return t.taskDetails.dependencyErrorCycle(data.detail.chain.join(" → "));
    }
    if (data.code === "self_dependent" && data.detail?.taskId) {
      return t.taskDetails.dependencyErrorSelf(data.detail.taskId);
    }
    if (data.code === "ineligible_target" && data.detail?.dependency) {
      return data.detail.kind === "milestone"
        ? t.taskDetails.dependencyErrorTargetMilestone(data.detail.dependency)
        : t.taskDetails.dependencyErrorTargetDraft(data.detail.dependency);
    }
  }
  return err instanceof Error && err.message.trim().length > 0 ? err.message : t.common.failedToSave;
};

/**
 * One closure direction as a badge block matching the readiness line above it: icon, localized
 * label, then the id list with hop counts. Root blockers (unfinished, nothing of their own left to
 * wait for) are highlighted; completed records are dimmed.
 */
const ClosureDirectionList: React.FC<{ icon: string; label: string; answer: DependencyDirectionAnswer }> = ({
  icon,
  label,
  answer,
}) => {
  const { t } = useI18n();
  if (answer.rows.length === 0) return null;
  const blockers = new Set(answer.blockers.map((row) => row.id));
  return (
    <div className="flex items-start gap-1.5 rounded-md bg-gray-50 px-2 py-1.5 font-medium text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
      <span aria-hidden="true">{icon}</span>
      <span>
        <span className="text-gray-500 dark:text-gray-400">{label}: </span>
        {answer.rows.map((row, index) => (
          <span key={row.id}>
            {index > 0 && ', '}
            <span
              className={
                blockers.has(row.id)
                  ? 'text-amber-700 dark:text-amber-400'
                  : row.terminal
                    ? 'text-gray-400 dark:text-gray-500'
                    : undefined
              }
              title={
                blockers.has(row.id)
                  ? t.taskDetails.closureRootBlockerTitle
                  : row.terminal
                    ? t.taskDetails.closureCompletedTitle
                    : undefined
              }
            >
              {row.id}
            </span>{' '}
            <span className="text-gray-400 dark:text-gray-500">({t.taskDetails.closureHops(row.hops)})</span>
          </span>
        ))}
      </span>
    </div>
  );
};

export default TaskDetailsModal;
