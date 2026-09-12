import React, { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SearchRow } from "../../utils/search-results";

export interface VirtualListHandle {
	scrollRowIntoView: (rowIndex: number) => void;
}

interface VirtualListProps {
	rows: SearchRow[];
	headerHeight: number;
	itemHeight: number;
	overscan?: number;
	/** Row index to scroll to once rows are available (position restore); null disables. */
	restoreIndex?: number | null;
	/** Called after a pending restore has been applied or dismissed. */
	onRestoreHandled?: () => void;
	/** When this value changes, the scroll position resets to the top. */
	resetKey: string;
	/** Invoked with the first visible row index whenever the scroll position changes. */
	onVisibleStartChange?: (index: number) => void;
	children: (row: SearchRow, rowIndex: number) => React.ReactNode;
}

const findStartIndex = (offsets: number[], scrollTop: number): number => {
	let low = 0;
	let high = offsets.length - 1;
	let result = 0;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const value = offsets[mid];
		if (value !== undefined && value <= scrollTop) {
			result = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	return result;
};

const VirtualList = forwardRef<VirtualListHandle, VirtualListProps>(function VirtualList(
	{ rows, headerHeight, itemHeight, overscan = 4, restoreIndex = null, onRestoreHandled, resetKey, onVisibleStartChange, children },
	ref,
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const onVisibleStartChangeRef = useRef(onVisibleStartChange);
	const onRestoreHandledRef = useRef(onRestoreHandled);
	onVisibleStartChangeRef.current = onVisibleStartChange;
	onRestoreHandledRef.current = onRestoreHandled;

	const rowHeight = useCallback((row: SearchRow) => (row.kind === "header" ? headerHeight : itemHeight), [headerHeight, itemHeight]);

	const { offsets, totalHeight } = useMemo(() => {
		const result: number[] = [];
		let offset = 0;
		for (const row of rows) {
			result.push(offset);
			offset += rowHeight(row);
		}
		return { offsets: result, totalHeight: offset };
	}, [rows, rowHeight]);

	// Reset to top whenever the query/filter changes
	const prevResetKeyRef = useRef(resetKey);
	useLayoutEffect(() => {
		if (prevResetKeyRef.current !== resetKey) {
			prevResetKeyRef.current = resetKey;
			if (containerRef.current) {
				containerRef.current.scrollTop = 0;
			}
			setScrollTop(0);
		}
	}, [resetKey]);

	// Track viewport height for windowing
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		setViewportHeight(container.clientHeight);
		const observer = new ResizeObserver(() => {
			setViewportHeight(container.clientHeight);
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	// Restore scroll position once rows are available
	useLayoutEffect(() => {
		if (restoreIndex === null || rows.length === 0) return;
		const container = containerRef.current;
		if (!container) return;
		const target = restoreIndex < rows.length ? restoreIndex : null;
		container.scrollTop = target === null ? 0 : (offsets[target] ?? 0);
		setScrollTop(container.scrollTop);
		onRestoreHandledRef.current?.();
	}, [restoreIndex, rows.length, offsets]);

	const handleScroll = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;
		setScrollTop(container.scrollTop);
		onVisibleStartChangeRef.current?.(findStartIndex(offsets, container.scrollTop));
	}, [offsets]);

	useImperativeHandle(
		ref,
		() => ({
			scrollRowIntoView: (rowIndex: number) => {
				const container = containerRef.current;
				const row = rows[rowIndex];
				const top = offsets[rowIndex];
				if (!container || !row || top === undefined) return;
				const bottom = top + rowHeight(row);
				const viewTop = container.scrollTop;
				const viewBottom = viewTop + container.clientHeight;
				if (top < viewTop) {
					container.scrollTop = top;
				} else if (bottom > viewBottom) {
					container.scrollTop = bottom - container.clientHeight;
				}
				setScrollTop(container.scrollTop);
			},
		}),
		[rows, offsets, rowHeight],
	);

	const startIndex = findStartIndex(offsets, scrollTop);
	let endIndex = startIndex;
	while (endIndex < rows.length && (offsets[endIndex] ?? 0) < scrollTop + viewportHeight) {
		endIndex++;
	}
	const from = Math.max(0, startIndex - overscan);
	const to = Math.min(rows.length - 1, endIndex - 1 + overscan);

	return (
		<div ref={containerRef} onScroll={handleScroll} className="overflow-y-auto flex-1 min-h-0">
			<div className="relative" style={{ height: totalHeight }}>
				{from <= to &&
					rows.slice(from, to + 1).map((row, i) => {
						const rowIndex = from + i;
						return (
							<div
								key={row.kind === "header" ? `header-${row.type}` : `item-${row.type}-${getRowId(row)}-${rowIndex}`}
								className="absolute left-0 right-0 overflow-hidden"
								style={{ top: offsets[rowIndex] ?? 0, height: rowHeight(row) }}
							>
								{children(row, rowIndex)}
							</div>
						);
					})}
			</div>
		</div>
	);
});

function getRowId(row: SearchRow): string {
	if (row.kind === "header") return row.type;
	const result = row.result;
	if (result.type === "task") return result.task.id;
	if (result.type === "document") return result.document.id;
	if (result.type === "decision") return result.decision.id;
	return result.wiki.path;
}

export default VirtualList;
