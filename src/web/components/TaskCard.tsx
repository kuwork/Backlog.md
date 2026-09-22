import React from 'react';
import { useI18n } from '../hooks/useI18n';
import { type Task } from '../../types';
import { getLabelColorClasses } from '../utils/labelColors';
import { storedUtcHoverTitle } from '../utils/date-display';
import AcceptanceCriteriaProgress from './AcceptanceCriteriaProgress';
import CompletedBadge from './CompletedBadge';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onEdit: (task: Task) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  status?: string;
  laneId?: string;
  terminalStatus?: string | null;
  labelColors?: Record<string, string>;
  isSelected?: boolean;
  selectionCount?: number;
  onSelect?: (event: { shiftKey: boolean }) => void;
  isSelectionDragging?: boolean;
  onSelectionDragChange?: (active: boolean) => void;
}

// Dragging a selected card moves the whole selection, so the drag image has to show it. Stacking
// empty cards (up to two) behind a copy of the dragged one, plus the count of every task that will
// move, keeps the board's own card styling.
const buildSelectionDragImage = (source: HTMLElement, count: number): HTMLElement => {
  const width = source.offsetWidth;
  const height = source.offsetHeight;
  const layer = (offset: number) => `position:absolute;top:${offset}px;left:${offset}px;width:${width}px;height:${height}px;margin:0;`;

  const behind = Math.min(count - 1, 2);
  const spread = 6 * behind;
  const ghost = document.createElement('div');
  ghost.style.cssText = `position:fixed;top:-1000px;left:-1000px;width:${width + spread}px;height:${height + spread}px;pointer-events:none;`;

  for (let depth = behind; depth >= 1; depth -= 1) {
    const shell = document.createElement('div');
    shell.className = source.className;
    shell.style.cssText = layer(6 * depth);
    ghost.appendChild(shell);
  }

  const front = source.cloneNode(true) as HTMLElement;
  front.style.cssText = layer(0);
  ghost.appendChild(front);

  const badge = document.createElement('div');
  badge.textContent = String(count);
  badge.style.cssText =
    'position:absolute;top:-8px;right:-8px;min-width:24px;height:24px;padding:0 6px;border-radius:9999px;' +
    'background:#3b82f6;color:#ffffff;font-size:12px;font-weight:600;line-height:24px;text-align:center;' +
    'box-shadow:0 1px 3px rgba(0,0,0,0.3);';
  ghost.appendChild(badge);

  return ghost;
};

const CURRENT_YEAR = new Date().getFullYear();

const formatCardDate = (dateStr: string): string => {
  const date = new Date(dateStr + "T00:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  if (year === CURRENT_YEAR) {
    return `${month}/${day}`;
  }
  return `${year}/${month}/${day}`;
};

const formatPlannedRange = (start?: string, end?: string): string | null => {
  if (!start && !end) return null;
  if (start && end) {
    return `${formatCardDate(start)}~${formatCardDate(end)}`;
  }
  return start ? formatCardDate(start) : end ? formatCardDate(end) : null;
};

const formatRelativeDate = (dateStr: string) => {
  // Handle both date-only and datetime formats
  const hasTime = dateStr.includes(" ") || dateStr.includes("T");
  const date = new Date(dateStr.replace(" ", "T") + (hasTime ? ":00Z" : "T00:00:00Z"));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

const getPriorityClass = (priority?: string) => {
  switch (priority) {
    case 'high': return 'border-l-4 border-l-red-500 dark:border-l-red-400';
    case 'medium': return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
    case 'low': return 'border-l-4 border-l-green-500 dark:border-l-green-400';
    default: return 'border-l-4 border-l-gray-300 dark:border-l-gray-600';
  }
};

interface WidthAwareLabelsProps {
  labels: string[];
  labelColors?: Record<string, string>;
}

const WidthAwareLabels: React.FC<WidthAwareLabelsProps> = ({ labels, labelColors }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = React.useState(labels.length);

  React.useEffect(() => {
    const measure = () => {
      if (!containerRef.current || !measureRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const measureChildren = Array.from(measureRef.current.children) as HTMLElement[];
      if (measureChildren.length === 0) return;

      const gap = 4; // gap-1 = 4px
      const labelWidths = measureChildren.slice(0, labels.length).map((c) => c.getBoundingClientRect().width);
      const overflowWidth = measureChildren[labels.length]?.getBoundingClientRect().width ?? 0;

      let count = 0;
      let used = 0;
      for (let i = 0; i < labelWidths.length; i++) {
        const w = labelWidths[i] ?? 0;
        const nextUsed = used + (count > 0 ? gap : 0) + w;
        const remaining = labels.length - i - 1;
        const needsOverflow = remaining > 0;
        const required = nextUsed + (needsOverflow ? gap + overflowWidth : 0);
        if (required <= containerWidth) {
          count++;
          used = nextUsed;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [labels]);

  return (
    <div className="relative">
      <div ref={containerRef} className="flex flex-wrap gap-1 mt-2">
        {labels.slice(0, visibleCount).map((label) => {
          const colorClasses = getLabelColorClasses(labelColors?.[label]);
          return (
            <span
              key={label}
              className={`inline-block px-1.5 py-0.5 text-[10px] rounded transition-colors duration-200 ${colorClasses.bg} ${colorClasses.text}`}
            >
              {label}
            </span>
          );
        })}
        {labels.length > visibleCount && (
          <span className="inline-block px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
            +{labels.length - visibleCount}
          </span>
        )}
      </div>
      {/* Hidden measurement container */}
      <div
        ref={measureRef}
        className="absolute invisible whitespace-nowrap flex gap-1 pointer-events-none"
        aria-hidden="true"
      >
        {labels.map((label) => (
          <span key={label} className="inline-block px-1.5 py-0.5 text-[10px] rounded">
            {label}
          </span>
        ))}
        <span className="inline-block px-1.5 py-0.5 text-[10px]">+99</span>
      </div>
    </div>
  );
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDragStart,
  onDragEnd,
  status,
  laneId,
  terminalStatus,
  labelColors,
  isSelected = false,
  selectionCount = 0,
  onSelect,
  isSelectionDragging = false,
  onSelectionDragChange,
}) => {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = React.useState(false);
  const [showBranchTooltip, setShowBranchTooltip] = React.useState(false);

  // Check if task is from another branch (read-only)
  const isFromOtherBranch = Boolean(task.branch);
  // Completed-corpus records are read-only too (BACK-663) and must not be dragged into a
  // status column, so they follow the cross-branch treatment for dragging.
  const isFromCompletedCorpus = task.source === 'completed';

  // Compute due-date risk border class
  let dueDateRiskClass = "";
  if (task.dueDate && task.status !== "Done") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate + "T00:00:00");
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) dueDateRiskClass = "border-l-2 border-red-500";
    else if (diffDays <= 1) dueDateRiskClass = "border-l-2 border-amber-500";
  }

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging cross-branch tasks
    if (isFromOtherBranch) {
      e.preventDefault();
      setShowBranchTooltip(true);
      setTimeout(() => setShowBranchTooltip(false), 3000);
      return;
    }

    e.dataTransfer.setData('text/plain', task.id);
    if (status) {
      e.dataTransfer.setData('text/status', status);
    }
    if (laneId !== undefined) {
      e.dataTransfer.setData('text/lane', laneId);
    }
    e.dataTransfer.effectAllowed = 'move';

    // A modifier-press that turns straight into a drag never completes the click, so the selection
    // would miss the very card being dragged and both the badge and the drop would come up one
    // short. Joining the selection here keeps them in agreement with what the user grabbed.
    const joinsSelection = !isSelected && selectionCount > 0 && (e.ctrlKey || e.metaKey) && Boolean(onSelect);
    if (joinsSelection) onSelect?.({ shiftKey: false });
    const batchCount = isSelected ? selectionCount : joinsSelection ? selectionCount + 1 : 1;

    if (batchCount > 1) {
      // The whole selection moves with this drag, so every selected card on the board carries the
      // same dragging treatment as the grabbed one.
      onSelectionDragChange?.(true);
      if (typeof e.dataTransfer.setDragImage === 'function') {
        const ghost = buildSelectionDragImage(e.currentTarget as HTMLElement, batchCount);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 16, 16);
        // The browser snapshots the element during setDragImage, so it only has to survive this tick.
        setTimeout(() => ghost.remove(), 0);
      }
    }

    setIsDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onSelectionDragChange?.(false);
    onDragEnd?.();
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high': return { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: t.taskCard.priorityShort('high') };
      case 'medium': return { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', label: t.taskCard.priorityShort('medium') };
      case 'low': return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: t.taskCard.priorityShort('low') };
      default: return null;
    }
  };

  return (
    <div className="relative">
      {/* Branch tooltip when trying to drag cross-branch task */}
      {showBranchTooltip && isFromOtherBranch && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {t.taskCard.switchBranchPrefix} <span className="font-semibold text-amber-300">{task.branch}</span> {t.taskCard.switchBranchSuffix}
          </div>
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-700"></div>
        </div>
      )}

      <div
        className={`bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md p-3 mb-2 transition-all duration-200 ${
          isFromOtherBranch 
            ? 'opacity-75 cursor-not-allowed border-dashed' 
            : 'cursor-pointer hover:shadow-md dark:hover:shadow-lg hover:border-stone-500 dark:hover:border-stone-400'
        } ${getPriorityClass(task.priority)} ${dueDateRiskClass} ${
          isDragging || (isSelected && isSelectionDragging) ? 'opacity-50 transform rotate-2 scale-105' : ''
        } ${
          isSelected
            ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
            : ''
        }`}
        data-selected={isSelected ? 'true' : 'false'}
        draggable={!isFromOtherBranch && !isFromCompletedCorpus}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={(event) => {
          // Ctrl/Cmd and Shift belong to the board selection, so they must not open the editor.
          if (onSelect && !isFromOtherBranch && !isFromCompletedCorpus && (event.ctrlKey || event.metaKey || event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            onSelect({ shiftKey: event.shiftKey });
            return;
          }
          onEdit(task);
        }}
      >
        {/* Cross-branch indicator banner */}
        {isFromOtherBranch && (
          <div className="flex items-center gap-1.5 mb-2 px-2 py-1 -mx-1 -mt-1 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 rounded-t text-xs text-amber-700 dark:text-amber-300">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="truncate">
              {t.taskCard.fromBranchPrefix} <span className="font-semibold">{task.branch}</span> {t.taskCard.fromBranchSuffix}
            </span>
          </div>
        )}

        {/* Header row with task ID, acceptance-criteria progress, then the right-hand badge
            group: planned dates, the completed marker, and the priority badge */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 font-mono transition-colors duration-200">{task.id}</span>
            <AcceptanceCriteriaProgress task={task} variant="bar" className="flex-1 min-w-[2.5rem]" />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {(() => {
              const planned = formatPlannedRange(task.plannedStart, task.plannedEnd);
              return planned ? (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {planned}
                </span>
              ) : null;
            })()}
            {/* The completed marker is a badge like the priority one, so it sits in that group
                on the right, directly left of the priority badge. */}
            {isFromCompletedCorpus && <CompletedBadge className="rounded px-1.5 py-0.5 text-[10px] font-medium" />}
            {(() => {
              const badge = getPriorityBadge(task.priority);
              return badge ? (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${badge.bg} ${badge.text} transition-colors duration-200`}>
                  {badge.label}
                </span>
              ) : null;
            })()}
          </div>
        </div>

        {/* Title */}
        <h4 className={`font-semibold text-sm line-clamp-2 transition-colors duration-200 ${
          isFromOtherBranch
            ? 'text-gray-600 dark:text-gray-400'
            : 'text-gray-900 dark:text-gray-100'
        }`}>
          {task.title}
        </h4>

        {/* Labels - width-aware overflow */}
        {task.labels.length > 0 && (
          <WidthAwareLabels labels={task.labels} labelColors={labelColors} />
        )}

        {/* Footer with due date, created date, and assignee */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-600/50 transition-colors duration-200">
          <div className="flex items-center gap-2">
            <span title={storedUtcHoverTitle(task.createdDate)}>{formatRelativeDate(task.createdDate)}</span>
            {task.dueDate && (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const due = new Date(task.dueDate + "T00:00:00");
              const isOverdue = due < today && task.status !== terminalStatus;
              return (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatCardDate(task.dueDate)}
                </span>
              );
            })()}
          </div>
          {task.assignee.length > 0 && (
            <span className="truncate max-w-[80px]" title={task.assignee.join(', ')}>
              {task.assignee[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
